import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, requestJson } from '../../src/api.ts';
const timeout = (e: unknown) => e instanceof ApiError && e.uncertain;
test('a lost mutation response is uncertain and never automatically retried', async () => {
  let calls = 0;
  await assert.rejects(requestJson('/api/reviews',undefined,{name:'Synthetic'},{commandId:'same-id',fetcher:async (_, init)=>{calls++; assert.equal((init?.headers as Record<string,string>)['Idempotency-Key'],'same-id'); throw new Error('response lost after commit');}}),timeout);
  assert.equal(calls,1);
});
test('deadlines bound fetch and token acquisition without a late mutation', async () => {
  await assert.rejects(requestJson('/api/reviews',undefined,{}, {timeoutMs:10,fetcher:()=>new Promise(()=>{})}),timeout);
  let calls=0; let release!: (v:string)=>void;
  await assert.rejects(requestJson('/api/reviews',()=>new Promise(r=>{release=r;}),{}, {timeoutMs:10,fetcher:async()=>{calls++;return new Response('{}');}}), e=>e instanceof ApiError && !e.uncertain);
  release('synthetic'); await new Promise(r=>setTimeout(r,5)); assert.equal(calls,0);
});
test('validation is definite; server errors and unreadable mutation acknowledgements are uncertain', async () => {
  for (const status of [400,401,403,409,429]) await assert.rejects(requestJson('/api/reviews',undefined,{}, {fetcher:async()=>new Response('{"error":"Rejected"}',{status})}),e=>e instanceof ApiError && !e.uncertain && e.status===status);
  await assert.rejects(requestJson('/api/reviews',undefined,{}, {fetcher:async()=>new Response('{}',{status:503})}),timeout);
  await assert.rejects(requestJson('/api/reviews',undefined,{}, {fetcher:async()=>new Response('broken')}),timeout);
  assert.deepEqual(await requestJson('/api/commands/id',undefined,undefined,{fetcher:async()=>new Response('{"state":"not_found"}')}),{state:'not_found'});
});
