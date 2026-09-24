import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
function evaluate(source, globals = {}) {
  const exports = {};
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  vm.runInNewContext(outputText, { exports, ...globals });
  return exports;
}

const { waitingReviewPriority } = evaluate(read("src/lib/aron-review-order.ts"));
const serverSource = read("src/app/api/aron/review-queue/route.ts");
const clientSource = read("src/app/aron/review-client.tsx");
const server = evaluate(
  serverSource.slice(serverSource.indexOf("function normalized"), serverSource.indexOf("export async function GET"))
    + "\nexport { stableQueueOrder };",
  { waitingReviewPriority },
);
const client = evaluate(
  clientSource.slice(clientSource.indexOf("function host"), clientSource.indexOf("function googleDocId"))
    + "\nexport { stableWaitingOrder, stableApprovedOrder };",
  { waitingReviewPriority },
);

function record(id, createdAt, extra = {}) {
  return {
    id, createdAt, website: "https://example.com", docUrl: `https://docs.google.com/document/d/${id}/edit`,
    practiceArea: "Car Accidents", workflow: "subaop", city: "", state: "",
    status: "review", aronDone: false, ...extra,
  };
}

test("pin moves only the selected waiting item and remains stable across refreshes", () => {
  const items = [record("a", "2026-08-01"), record("b", "2026-08-02"), record("c", "2026-09-03")];
  const pinned = items.map((item) => item.id === "c" ? { ...item, reviewPriority: 1 } : item);
  for (const sort of [server.stableQueueOrder, client.stableWaitingOrder]) {
    for (const input of [pinned, [...pinned].reverse(), [pinned[1], pinned[2], pinned[0]]]) {
      assert.deepEqual([...input].sort(sort).map((item) => item.id), ["c", "a", "b"]);
    }
  }
  assert.equal(pinned[2].createdAt, "2026-09-03");
  assert.equal(pinned[2].aronDone, false);
});

test("invalid priorities and approved items never receive waiting priority", () => {
  for (const priority of [undefined, -1, NaN, Infinity, "1"]) {
    assert.equal(waitingReviewPriority(record("a", "2026-08-01", { reviewPriority: priority })), 0);
  }
  for (const status of [{ aronDone: true }, { approvalStatus: "APPROVED" }, { status: "ready" }]) {
    assert.equal(waitingReviewPriority(record("a", "2026-08-01", { reviewPriority: 1, ...status })), 0);
  }
  const approved = [record("a", "2026-08-01", { aronDone: true, reviewPriority: 1 }), record("b", "2026-08-02", { aronDone: true })];
  assert.deepEqual(approved.sort(client.stableApprovedOrder).map((item) => item.id), ["b", "a"]);
});

test("a tracker sync cannot overwrite the separately stored manual pin", async () => {
  const queueKey = "amplify:aron-review-queue:v1";
  const priorityKey = "amplify:aron-review-priority:v1";
  const item = record("target", "2026-09-03");
  const hashes = { [queueKey]: { target: item }, [priorityKey]: { target: 1 } };
  class Redis {
    async hgetall(key) { return hashes[key]; }
    async hset(key, values) { Object.assign(hashes[key], values); }
  }
  const queue = evaluate(read("src/lib/aron-review-queue.ts"), {
    process: { env: { KV_REST_API_URL: "test", KV_REST_API_TOKEN: "test" } },
    require(name) {
      if (name === "@upstash/redis") return { Redis };
      if (name === "@/lib/obsolete-content") return { isObsoleteDrazenPage: () => false };
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  assert.equal((await queue.listAronReviewItems())[0].reviewPriority, 1);
  await queue.syncAronReviewQueue([item]);
  const [reloaded] = await queue.listAronReviewItems();
  assert.equal(reloaded.reviewPriority, 1);
  assert.equal(reloaded.createdAt, item.createdAt);
  assert.equal(reloaded.aronDone, false);
  assert.equal(hashes[priorityKey].target, 1);
});

test("archive retrieval retains links without resurfacing older waiting duplicates", async () => {
  const archived=record('sent','2026-09-01',{aronDone:true,wordpressPageId:10,wordpressEditUrl:'https://example.com/wp-admin/post.php?post=10',reviewArchivedAt:'2026-09-04'});
  const pending=record('pending','2026-09-02',{practiceArea:'Bicycle Accidents'});
  const failed=record('failed','2026-09-03',{aronDone:true,practiceArea:'Truck Accidents',error:'Upload failed'});
  const rows=[archived,record('older-copy','2026-08-01'),pending,failed];
  const modules={
    'next/server':{NextResponse:{json:data=>data}},
    '@/lib/aron-wordpress-status':{refreshAronWordPressStatuses:async()=>{}},
    '@/lib/wordpress-upload-worker':{},
    '@/lib/wordpress-upload-store':{publicUploadJobs:async()=>new Map()},
    '@/lib/aron-review-queue':{isAronReviewer:()=>true,listAronReviewItems:async()=>rows,pruneObsoleteAronReviewItems:async()=>{}},
    '@/lib/google':{getGoogleAccessToken:async()=>'test',getGoogleEmail:async()=>'test@example.com'},
    '@/lib/aron-review-order':{waitingReviewPriority},
  };
  const api=evaluate(serverSource,{require:name=>modules[name],URL});
  const response=await api.GET();
  assert.deepEqual(Array.from(response.records,r=>r.id),['pending','failed']);
  assert.equal(response.archivedRecords.length,1);
  assert.equal(response.archivedRecords[0].docUrl,archived.docUrl);
  assert.equal(response.archivedRecords[0].wordpressEditUrl,archived.wordpressEditUrl);
  archived.reviewDeletedAt = "2026-09-05";
  const deletedResponse = await api.GET();
  assert.equal(deletedResponse.archivedRecords.length, 0);
  assert.deepEqual(Array.from(deletedResponse.records, r => r.id), ['pending', 'failed']);
});
