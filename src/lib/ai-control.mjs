/** Server-only paid AI boundary. Copies are installed into each independently deployed app. */
import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';

const context = new AsyncLocalStorage();
const sha = value => createHash('sha256').update(value).digest('hex');
const prefix = 'ai-control:v1:';
let customStore = null;
export function configureAIStorage(store) { customStore = store; }
export class AIControlError extends Error {
  constructor(code, message) { super(message); this.name = 'AIControlError'; this.code = code; }
}
const fail = (code, message) => { throw new AIControlError(code, message); };
function directory() { return process.env.AI_CONTROL_DIR || path.join(process.cwd(), '.ai-control'); }
async function redis(command) {
  const url = process.env.AI_CONTROL_REDIS_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.AI_CONTROL_REDIS_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return undefined;
  const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(command), signal: AbortSignal.timeout(10000) });
  if (!response.ok) fail('AI_STORAGE_UNAVAILABLE', 'AI control storage is unavailable. No new paid call was sent.');
  const result = await response.json();
  if (result.error) fail('AI_STORAGE_UNAVAILABLE', 'AI control storage rejected the operation.');
  return { value: result.result };
}
async function fileFor(key) {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) fail('AI_STORAGE_REQUIRED', 'Configure durable AI control Redis storage before enabling paid calls on serverless hosts.');
  const dir = directory();
  await mkdir(dir, { recursive: true, mode: 0o700 });
  return path.join(dir, sha(key) + '.json');
}
export async function controlGet(key) {
  if (customStore) return customStore.get(prefix + key);
  const remote = await redis(['GET', prefix + key]);
  if (remote) return remote.value == null ? null : JSON.parse(remote.value);
  try { return JSON.parse(await readFile(await fileFor(key), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
export async function controlSet(key, value, onlyIfAbsent = false) {
  if (customStore) return customStore.set(prefix + key, value, onlyIfAbsent);
  const remote = await redis(['SET', prefix + key, JSON.stringify(value), ...(onlyIfAbsent ? ['NX'] : [])]);
  if (remote) return remote.value === 'OK';
  const filename = await fileFor(key);
  if (onlyIfAbsent) {
    try { await writeFile(filename, JSON.stringify(value), { flag: 'wx', mode: 0o600 }); return true; }
    catch (error) { if (error.code === 'EEXIST') return false; throw error; }
  }
  const temporary = filename + '.' + randomUUID();
  await writeFile(temporary, JSON.stringify(value), { mode: 0o600 });
  await rename(temporary, filename);
  return true;
}
async function releaseUnsent(key, callId) {
  const saved=await controlGet(key);
  if(saved?.callId!==callId || saved.state!=='submitted')return;
  if(customStore){await customStore.delete(prefix+key);return;}
  const remote=await redis(['DEL',prefix+key]);
  if(!remote)await rm(await fileFor(key),{force:true});
}
export async function setAIPaused(paused) { await controlSet('paused', paused === true); }
export async function isAIPaused() { return /^(1|true|yes)$/i.test(process.env.AI_PAUSED || '') || await controlGet('paused') === true; }
export async function assertAIAvailable() {
  if (await isAIPaused()) fail('AI_PAUSED', 'AI calls are paused. Resume AI before starting or continuing this job.');
}
export function currentAIAction() { return context.getStore() || null; }
export async function withAIAction(action, task) {
  if (!action?.id || !action?.purpose || action.expiresAt <= Date.now()) fail('AI_USER_ACTION_REQUIRED', 'Start this AI task explicitly before continuing.');
  return context.run(action, task);
}
export async function saveAIContinuation(id) {
  const action = currentAIAction();
  if (action) await controlSet('continuation:' + id, action);
}
export async function withAIContinuation(id, task) {
  const action = await controlGet('continuation:' + id);
  // Legacy/orphan status reads remain possible, but cannot create paid work.
  return action && action.expiresAt > Date.now() ? withAIAction(action, task) : task();
}
/** Wrap explicit action handlers only. Never wrap cron, mount, health, or refresh handlers. */
export function userActionRoute(purpose, handler) {
  return async function(request, ...args) {
    const inherited = currentAIAction();
    if (inherited) return handler(request, ...args);
    const method = request.method.toUpperCase();
    if (!['POST', 'PATCH', 'PUT'].includes(method)) fail('AI_USER_ACTION_REQUIRED', 'AI generation requires an explicit user action.');
    const actor = request.headers.get('cookie') || request.headers.get('authorization') || request.headers.get('x-forwarded-for') || 'public';
    const bytes = request.headers.get('content-type')?.includes('multipart/form-data') ? Buffer.alloc(0) : Buffer.from(await request.clone().arrayBuffer());
    const id = sha(purpose + ':' + actor + ':' + new URL(request.url).origin + new URL(request.url).pathname + ':' + (request.headers.get('idempotency-key') || '') + ':' + sha(bytes));
    return withAIAction({ id, purpose, owner:sha(actor + ':' + new URL(request.url).origin), expiresAt: Date.now() + 60 * 60 * 1000 }, () => handler(request, ...args));
  };
}
// Rates are explicit estimates, not invoice amounts. Unknown models/modalities stay unknown.
// Standard short-context rates verified 2026-09-20; configure overrides for other models.
const rates = { 'gpt-6-astra': [5,25], 'gpt-5.6-sol': [2,10], 'gpt-5.6-terra': [1,6], 'gpt-5.6-luna': [.1,.6] };
export function estimateCost(body = {}, result = {}) {
  let configured = {};
  try { configured = JSON.parse(process.env.AI_PRICE_RATES_JSON || '{}'); } catch { /* Explicit unknown below. */ }
  const model = result.model || body.model || 'unknown';
  const rate = configured[model] || rates[model];
  const usage = result.usage || {};
  const input = usage.input_tokens ?? usage.prompt_tokens;
  const output = usage.output_tokens ?? usage.completion_tokens;
  if (!rate || input == null || output == null || /image|audio|transcri/.test(model)) return { estimatedCostUsd: null, costBasis: 'unknown; configure model/modal rates or reconcile provider usage', model, usage };
  // Cached input is conservatively charged at full input price; tool fees are separate.
  return { estimatedCostUsd: (input * rate[0] + output * rate[1]) / 1e6, costBasis: 'standard text token estimate; excludes tool fees, long-context uplift and discounts', model, usage };
}
async function logCall(event) {
  await controlSet('log:' + event.callId + ':' + event.phase, event);
  console.info('[ai-call]', JSON.stringify(event));
}
/** Single transport attempt: SDK retries are disabled; ambiguous requests never auto-resubmit. */
export async function aiFetch(input, init) {
  const request = new Request(input, init);
  const url = new URL(request.url);
  if (url.hostname !== 'api.openai.com' || url.protocol !== 'https:') fail('AI_ENDPOINT_INVALID', 'Unsupported AI endpoint.');
  await assertAIAvailable();
  const paid = !['GET', 'HEAD', 'DELETE'].includes(request.method);
  const action = currentAIAction();
  if (paid && (!action || action.expiresAt <= Date.now())) fail('AI_USER_ACTION_REQUIRED', 'This paid AI step needs an explicit user-started task.');
  const bytes = Buffer.from(await request.clone().arrayBuffer());
  let body = {};
  if (request.headers.get('content-type')?.includes('application/json')) {
    try { body = JSON.parse(bytes.toString()); } catch { /* Provider validates malformed input. */ }
  }
  if (body.stream === true) fail('AI_STREAM_UNSUPPORTED', 'Streaming needs a metered transport; this application uses non-streaming calls.');
  let fingerprint = sha(bytes);
  if (request.headers.get('content-type')?.includes('multipart/form-data')) {
    const parts=[];
    const form=await request.clone().formData();
    body={model:String(form.get('model') || 'unknown')};
    for (const [name,value] of form) parts.push([name,typeof value==='string'?value:sha(Buffer.from(await value.arrayBuffer()))]);
    fingerprint=sha(JSON.stringify(parts));
  }
  const key = 'request:' + sha((action?.id || 'read') + ':' + request.method + ':' + url.pathname + ':' + fingerprint);
  const contentKey='inflight:'+sha((action?.owner || 'internal')+':'+(action?.purpose || '')+':'+url.pathname+':'+fingerprint);
  const callId = randomUUID();
  const base = { callId, time: new Date().toISOString(), purpose: action?.purpose || 'status or connection check', actionId: action?.id || null, endpoint: url.pathname, method: request.method, attempt: 1, paid, ...estimateCost(body) };
  if (paid) {
    if (!await controlSet(key, { state: 'submitted', callId, time: base.time }, true)) {
      const previous = await controlGet(key);
      if (previous?.state === 'completed' && previous.response) {
        const cached = previous.response;
        try { const saved=JSON.parse(Buffer.from(cached.body,'base64').toString()); if(saved.id)await saveAIContinuation(saved.id); } catch(error) { if(!(error instanceof SyntaxError))throw error; }
        return new Response(Buffer.from(cached.body, 'base64'), { status: cached.status, headers: cached.headers });
      }
      fail('AI_DUPLICATE_BLOCKED', 'This AI request is already submitted or its result is uncertain. Inspect the saved job before retrying.');
    }
  }
  if (paid && !await controlSet(contentKey,{state:'submitted',callId,time:base.time},true)) {
    await releaseUnsent(key,callId);
    fail('AI_DUPLICATE_BLOCKED','Identical AI work is already running or has an uncertain result. Check the existing job.');
  }
  await logCall({ ...base, phase: 'submitted', estimatedCostUsd: paid ? base.estimatedCostUsd : 0 });
  // Re-read pause after the durable reservation/log, immediately before network dispatch.
  try { await assertAIAvailable(); }
  catch(error) {
    if(paid && error.code==='AI_PAUSED'){await releaseUnsent(key,callId);await releaseUnsent(contentKey,callId);}
    await logCall({...base,phase:'not-sent',estimatedCostUsd:0,errorType:error.code || error.name});
    throw error;
  }
  try {
    const response = await fetch(request, { redirect: 'error', signal: AbortSignal.any([request.signal, AbortSignal.timeout(240000)]) });
    const output = Buffer.from(await response.arrayBuffer());
    let result = {};
    try { result = JSON.parse(output.toString()); } catch { /* Retain uncertain billing. */ }
    const cost = paid ? estimateCost(body, result) : { estimatedCostUsd: 0, costBasis: 'read-only request' };
    if (!paid && result.id && result.usage && await controlGet('continuation:' + result.id)) {
      await controlSet('response-usage:' + result.id, {time:new Date().toISOString(),responseId:result.id,purpose:action?.purpose || 'Completed user-requested generation',...estimateCost(body,result)});
    }
    await logCall({ ...base, ...cost, phase: 'finished', status: response.status, requestId: response.headers.get('x-request-id'), responseId: result.id || null });
    if (paid) {
      // Persist even non-2xx results. Retrying requires deliberate reconciliation, not a timer.
      await controlSet(key, { state: response.ok ? 'completed' : 'failed', callId, response: response.ok ? { status: response.status, headers: { 'content-type': response.headers.get('content-type') || 'application/json' }, body: output.toString('base64') } : null });
      if (result.id) await saveAIContinuation(result.id);
      if(response.ok || [400,401,403,404,422,429].includes(response.status))await releaseUnsent(contentKey,callId);
    }
    const headers = new Headers(response.headers);
    headers.delete('content-encoding'); headers.delete('content-length');
    return new Response([204,205,304].includes(response.status) ? null : output, { status: response.status, statusText: response.statusText, headers });
  } catch (error) {
    await logCall({ ...base, phase: 'uncertain', errorType: error.name || 'Error' });
    throw error;
  }
}
