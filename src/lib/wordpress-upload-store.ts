import { Redis } from "@upstash/redis";
import { createHash, randomUUID } from "node:crypto";

export type UploadJob = {
  id:string; docId:string; credential?:string; email:string; mode?:"intake"|"prepare";
  state:"queued"|"uploading"|"retry"|"blocked"|"complete";
  aiAction?: {id:string;purpose:string;expiresAt:number}; pendingChecks?:number; attempts:number; updatedAt:string; error?:string; nextAttemptAt?:string;
};
const PREFIX="amplify:wordpress-upload:v1:";
const DUE=PREFIX+"due";
type DocConnection={credential:string;email:string};
export async function saveDocUploadConnection(docId:string,connection:DocConnection) {
  await uploadRedis().set(PREFIX+"doc:"+docId,JSON.stringify(connection),{ex:90*24*60*60});
}
export async function getDocUploadConnection(docId:string) {
  return await uploadRedis().get<DocConnection>(PREFIX+"doc:"+docId);
}
export function uploadRedis() {
  const url=process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL;
  const token=process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN;
  if(!url||!token)throw new Error("WordPress upload queue storage is not configured.");
  return new Redis({url,token});
}
export async function getUploadJob(id:string) {
  return await uploadRedis().get<UploadJob>(PREFIX+id);
}
export async function publicUploadJobs(ids:string[]) {
  if(!ids.length)return new Map();
  const jobs=await uploadRedis().mget<(UploadJob|null)[]>(...ids.map(id=>PREFIX+id));
  return new Map(ids.map((id,index)=>[id,publicUploadJob(jobs[index])]));
}
export function publicUploadJob(job:UploadJob|null) {
  if(!job)return undefined;
  const {state,attempts,updatedAt,error,nextAttemptAt}=job;
  return {state,attempts,updatedAt,error,nextAttemptAt};
}
export async function putUploadJob(job:UploadJob,due?:number) {
  const redis=uploadRedis();
  // Credentials are encrypted, short-lived, and removed at terminal states.
  const pipeline=redis.multi();
  pipeline.set(PREFIX+job.id,JSON.stringify(job),{ex:7*24*60*60});
  if(due!==undefined)pipeline.zadd(DUE,{score:due,member:job.id});
  else pipeline.zrem(DUE,job.id);
  await pipeline.exec();
}
export async function dueUploadIds() {
  const redis=uploadRedis();
  const ids=await redis.zrange<string[]>(DUE,0,Date.now(),{byScore:true,offset:0,count:10});
  const active:string[]=[];
  for(const id of ids) {
    if(await getUploadJob(id))active.push(id);
    else await redis.zrem(DUE,id);
  }
  return active;
}
export async function uploadLease(scope:string) {
  const redis=uploadRedis();
  const key=PREFIX+"lock:"+createHash("sha256").update(scope).digest("hex");
  const token=randomUUID();
  if(!await redis.set(key,token,{nx:true,ex:600}))return null;
  return async()=>{await redis.eval("if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end",[key],[token]);};
}
