import { randomUUID } from 'node:crypto';
import type { Services } from './firebase.ts';

export async function acquireMaintenance(s: Services, reason: string) {
  const lock = { id: randomUUID(), reason, startedAt: new Date().toISOString() };
  await s.db.runTransaction(async tx => {
    const ref = s.db.doc('installation/maintenance');
    const prior = await tx.get(ref);
    if (prior.exists) throw new Error(`Maintenance is already active. Lock: ${prior.get('id')}. See docs/backup-recovery.md.`);
    tx.create(ref, lock);
  });
  return lock.id;
}
export async function releaseMaintenance(s: Services, id: string) {
  await s.db.runTransaction(async tx => {
    const ref = s.db.doc('installation/maintenance');
    const prior = await tx.get(ref);
    if (!prior.exists || prior.get('id') !== id) throw new Error('Maintenance lock does not match; no state was changed.');
    tx.delete(ref);
  });
}
