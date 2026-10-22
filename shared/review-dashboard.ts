export const reviewQueues = ['all', 'public', 'staff', 'failed', 'evidence', 'decision', 'requirements', 'publication'] as const;
export type ReviewQueue = typeof reviewQueues[number];
export const reviewQueueLabels: Record<ReviewQueue, string> = { all: 'All reviews', public: 'Public review notices', staff: 'Staff review entries', failed: 'Failed analysis jobs', evidence: 'Unfinished evidence', decision: 'Decision needed', requirements: 'Requirement gaps at last save', publication: 'Publication mismatch' };
export type ReviewDashboardRow = { id: string; name: string; queues: ReviewQueue[] };
export type ReviewDashboard = { asOf: string; counts: Record<ReviewQueue, number>; attentionTotal: number; attention: ReviewDashboardRow[]; items: ReviewDashboardRow[]; nextCursor: string | null };
export const attentionQueues: ReviewQueue[] = ['publication', 'failed', 'evidence', 'decision', 'requirements'];
export function reviewRollup(rows: ReviewDashboardRow[], queue: ReviewQueue, cursor: string | undefined, asOf: string): ReviewDashboard {
  const counts = Object.fromEntries(reviewQueues.map(q => [q, rows.filter(r => r.queues.includes(q)).length])) as Record<ReviewQueue, number>;
  const attention = rows.filter(r => r.queues.some(q => attentionQueues.includes(q))).sort((a,b) => Math.min(...a.queues.map(q => { const n=attentionQueues.indexOf(q); return n < 0 ? 99 : n; })) - Math.min(...b.queues.map(q => { const n=attentionQueues.indexOf(q); return n < 0 ? 99 : n; })) || a.id.localeCompare(b.id));
  const filtered = rows.filter(r => r.queues.includes(queue) && (!cursor || r.id > cursor)).sort((a,b) => a.id.localeCompare(b.id));
  return { asOf, counts, attentionTotal: attention.length, attention: attention.slice(0,6), items: filtered.slice(0,20), nextCursor: filtered.length > 20 ? filtered[19].id : null };
}
