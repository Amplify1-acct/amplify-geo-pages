import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileTrackerSnapshot} from '../src/lib/tracker-sync.ts';
const row=(id,status,time)=>({id,status,createdAt:'2026-09-15T10:00:00Z',updatedAt:time});
test('remote repair replaces an open browser error without ordering a new job',()=>{
 const old=row('a','error','2026-09-15T10:01:00Z');const repaired={...row('a','generating','2026-09-15T10:02:00Z'),jobId:'same-job'};
 assert.deepEqual(reconcileTrackerSnapshot([old],[repaired]),[repaired]);
});
test('snapshot preserves newer local changes and unchanged references',()=>{
 const local=[row('a','review','2026-09-15T10:03:00Z')];
 assert.equal(reconcileTrackerSnapshot(local,[row('a','error','2026-09-15T10:02:00Z')]),local);
 assert.equal(reconcileTrackerSnapshot(local,structuredClone(local)),local);
});
test('deletion markers win while locally created unsynced records survive',()=>{
 const a=row('a','review','2026-09-15T10:03:00Z'),b=row('b','draft','2026-09-15T10:03:00Z');
 assert.deepEqual(reconcileTrackerSnapshot([a,b],[a],['a']),[b]);
});
