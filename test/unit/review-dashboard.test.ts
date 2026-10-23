import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reviewRollup, type ReviewDashboardRow } from '../../shared/review-dashboard.ts';
test('rollups count all rows, deduplicate attention and paginate matching queues', () => {
  const rows: ReviewDashboardRow[] = Array.from({length: 45}, (_, i) => ({id:String(i).padStart(3,'0'),name:'Synthetic',queues:['all','failed','requirements']}));
  rows[44].queues.push('publication');
  const first=reviewRollup(rows,'failed',undefined,'now');
  assert.equal(first.counts.all,45); assert.equal(first.counts.failed,45); assert.equal(first.attentionTotal,45);
  assert.equal(first.attention[0].id,'044'); assert.equal(first.attention.length,6); assert.equal(first.items.length,20);
  const second=reviewRollup(rows,'failed',first.nextCursor!,'now'); assert.equal(second.items[0].id,'020');
  assert.equal(reviewRollup(rows,'public',undefined,'now').items.length,0);
  assert.equal(reviewRollup([],'all',undefined,'now').counts.all,0);
});
test('tier distribution distinguishes Pending from absent tiers and filters names before paging', () => {
  const rows: ReviewDashboardRow[] = Array.from({length:46},(_,i)=>({id:String(i).padStart(3,'0'), name:i%2?'Maple Reading':'Cedar Science',tier:i%2?'Pending':'Tier 2: Site/Department Approved',queues:['all','evidence']}));
  rows.push({id:'999',name:'Maple legacy',queues:['all']});
  const data=reviewRollup(rows,'evidence',undefined,'now',{search:'  MAPLE  ',tier:'Pending'});
  assert.equal(data.matchingTotal,23); assert.equal(data.items.length,20); assert.equal(data.tierCounts.Pending,23); assert.equal(data.tierCounts.unassigned,1);
  assert.equal(Object.values(data.tierCounts).reduce((a,b)=>a+b,0),47);
  assert.equal(reviewRollup(rows,'evidence',data.nextCursor!,'now',{search:'maple',tier:'Pending'}).items.length,3);
  assert.equal(reviewRollup(rows,'all',undefined,'now',{search:'[.*]'}).matchingTotal,0,'Search is literal, not a regular expression');
  assert.equal(reviewRollup(rows,'all',undefined,'now',{tier:'unassigned'}).items[0].id,'999');
});
