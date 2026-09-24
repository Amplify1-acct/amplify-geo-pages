export type AIAction = { id: string; purpose: string; owner?: string; expiresAt: number };
export class AIControlError extends Error { code: string; }
export function controlGet(key: string): Promise<any>;
export function controlSet(key: string, value: unknown, onlyIfAbsent?: boolean): Promise<boolean>;
export function setAIPaused(paused: boolean): Promise<void>;
export function isAIPaused(): Promise<boolean>;
export function assertAIAvailable(): Promise<void>;
export function currentAIAction(): AIAction | null;
export function withAIAction<T>(action: AIAction, task: () => T): Promise<Awaited<T>>;
export function saveAIContinuation(id: string): Promise<void>;
export function withAIContinuation<T>(id: string, task: () => T): Promise<Awaited<T>>;
export function userActionRoute<T extends (request: any, ...args: any[]) => any>(purpose: string, handler: T): T;
export function estimateCost(body?: any, result?: any): { estimatedCostUsd: number | null; costBasis: string; model: string; usage: any };
export const aiFetch: typeof fetch;

export function configureAIStorage(store: {get(key:string):Promise<any>;set(key:string,value:unknown,onlyIfAbsent:boolean):Promise<boolean>;delete(key:string):Promise<void>} | null):void;
