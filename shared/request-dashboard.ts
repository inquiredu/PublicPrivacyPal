import type { RequestView } from './requests.ts';
export const requestQueues = ['all', 'active', 'pending', 'in_review', 'assigned', 'decided', 'archived'] as const;
export type RequestQueue = typeof requestQueues[number];
export const queueLabels: Record<RequestQueue, string> = { all: 'All requests', active: 'Active requests', pending: 'Pending requests', in_review: 'In review', assigned: 'Assigned to you', decided: 'Decided requests', archived: 'Archived requests' };
export function inRequestQueue(r: RequestView, queue: RequestQueue, uid: string): boolean {
  if (queue === 'all') return true;
  if (queue === 'archived') return r.archived;
  if (r.archived) return false;
  if (queue === 'active') return r.status !== 'decided';
  if (queue === 'assigned') return r.status === 'in_review' && r.assignee === uid;
  return r.status === queue;
}
export type RequestDashboard = { asOf: string; audience: 'district' | 'own'; counts: Record<RequestQueue, number>; attention: { id: string; toolName: string; status: RequestView['status'] }[] };
export function summarizeRequests(rows: RequestView[], uid: string, reviewer: boolean, asOf: string): RequestDashboard {
  const counts = Object.fromEntries(requestQueues.map(q => [q, rows.filter(r => inRequestQueue(r, q, uid)).length])) as Record<RequestQueue, number>;
  const attention = rows.filter(r => inRequestQueue(r, reviewer ? 'pending' : 'decided', uid) || reviewer && inRequestQueue(r, 'assigned', uid))
    .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? '') || a.id.localeCompare(b.id))
    .slice(0, 6).map(({ id, toolName, status }) => ({ id, toolName, status }));
  return { asOf, audience: reviewer ? 'district' : 'own', counts, attention };
}
