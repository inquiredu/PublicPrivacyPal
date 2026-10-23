import { tiers, type Tier } from './service-policy.ts';
export const dashboardTiers = [...tiers, 'unassigned'] as const;
export type DashboardTier = Tier | 'unassigned';
export type ReviewFilters = { search?: string; tier?: DashboardTier | 'all' };
export const tierLabel = (tier: DashboardTier) => tier === 'unassigned' ? 'No recorded tier' : tier;
export const reviewQueues = ['all', 'public', 'staff', 'failed', 'evidence', 'decision', 'requirements', 'publication'] as const;
export type ReviewQueue = typeof reviewQueues[number];
export const reviewQueueLabels: Record<ReviewQueue, string> = { all: 'All reviews', public: 'Public review notices', staff: 'Staff review entries', failed: 'Failed analysis jobs', evidence: 'Unfinished evidence', decision: 'Decision needed', requirements: 'Requirement gaps at last save', publication: 'Publication mismatch' };
export type ReviewDashboardRow = { id: string; name: string; queues: ReviewQueue[]; tier?: DashboardTier };
export type ReviewDashboard = { asOf: string; tierCounts: Record<DashboardTier, number>; matchingTotal: number; counts: Record<ReviewQueue, number>; attentionTotal: number; attention: ReviewDashboardRow[]; items: ReviewDashboardRow[]; nextCursor: string | null };
export const attentionQueues: ReviewQueue[] = ['publication', 'failed', 'evidence', 'decision', 'requirements'];
export function reviewRollup(rows: ReviewDashboardRow[], queue: ReviewQueue, cursor: string | undefined, asOf: string, filters: ReviewFilters = {}): ReviewDashboard {
  const counts = Object.fromEntries(reviewQueues.map(q => [q, rows.filter(r => r.queues.includes(q)).length])) as Record<ReviewQueue, number>;
  const attention = rows.filter(r => r.queues.some(q => attentionQueues.includes(q))).sort((a,b) => Math.min(...a.queues.map(q => { const n=attentionQueues.indexOf(q); return n < 0 ? 99 : n; })) - Math.min(...b.queues.map(q => { const n=attentionQueues.indexOf(q); return n < 0 ? 99 : n; })) || a.id.localeCompare(b.id));
  const tierCounts = Object.fromEntries(dashboardTiers.map(t => [t, rows.filter(r => (r.tier ?? 'unassigned') === t).length])) as Record<DashboardTier, number>;
  const search = (filters.search || '').trim().toLocaleLowerCase('en-US');
  const matching = rows.filter(r => r.queues.includes(queue) && (!filters.tier || filters.tier === 'all' || (r.tier ?? 'unassigned') === filters.tier) && r.name.toLocaleLowerCase('en-US').includes(search));
  const filtered = matching.filter(r => !cursor || r.id > cursor).sort((a,b) => a.id.localeCompare(b.id));
  return { asOf, tierCounts, matchingTotal: matching.length, counts, attentionTotal: attention.length, attention: attention.slice(0,6), items: filtered.slice(0,20), nextCursor: filtered.length > 20 ? filtered[19].id : null };
}
