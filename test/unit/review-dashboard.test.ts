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
