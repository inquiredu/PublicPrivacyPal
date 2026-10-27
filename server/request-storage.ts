import { z } from 'zod';
import { digest } from './evaluation.ts';
import type { Services } from './firebase.ts';
import { requestHead, requestsRef, requestBytes, eventId } from './requests.ts';
import { REQUEST_LIMITS as L, requestEventSchema, requestReceiptSchema, requestActionSchema, transitionRequest } from '../shared/requests.ts';

/** Validate under the operator fence, including orphan history and actor receipt descendants. */
export async function validateRequestInstallation(s: Services, maintenanceId: string) {
  const fence = async () => {
    if ((await s.db.doc('installation/maintenance').get()).get('id') !== maintenanceId) throw new Error('Request validation requires its maintenance fence.');
  };
  await fence(); let hasArtifacts = false;
  const refs = await requestsRef(s).listDocuments();
  if (refs.length > L.count) throw new Error('Request inventory exceeds the supported limit.');
  const expectedReceipts = new Map<string, { event: z.infer<typeof requestEventSchema>; bytes: number }>();
  const totals = new Map<string, { retained: number; measured: number; stateBytes: number }>();
  for (const ref of refs) {
    const snap = await ref.get(); if (!snap.exists) throw new Error('Orphan request history.');
    const head = requestHead(ref.id, snap.data()); const state = head.state;
    const children = await ref.listCollections();
    if (children.some(c => c.id !== 'history')) throw new Error('Unknown request descendants.');
    const events = await ref.collection('history').orderBy('revision').limit(L.events + 1).get();
    // listDocuments also finds malformed/orphan rows without a revision field.
    const eventRefs = await ref.collection('history').listDocuments();
    if (eventRefs.length !== events.size || events.size > L.events) throw new Error('Malformed request history inventory.');
    if (!snap.get('state')) { if (events.size) throw new Error('Legacy request has unexpected history.'); continue; }
    hasArtifacts = true;
    if (!state.revision || events.size !== state.revision) throw new Error('Incomplete request history.');
    let previous: unknown = null; let measured = 0;
    for (let i = 0; i < events.size; i++) {
      const doc = events.docs[i];
      if ((await doc.ref.listCollections()).length) throw new Error('Unknown request history descendants.');
      const e = requestEventSchema.parse(doc.data());
      if (e.requestId !== ref.id || e.revision !== i + 1 || doc.id !== eventId(e.revision) || e.after.id !== ref.id || e.after.revision !== e.revision || e.after.updatedAt !== e.at) throw new Error('Invalid request history identity.');
      if (i === 0 && state.legacy) {
        if (!e.before?.legacy || e.before.revision !== 0 || e.before.status !== 'pending' || e.before.outcome || e.before.assignee || e.before.archivedByAdmin) throw new Error('Invalid legacy adoption baseline.');
        previous = e.before;
      }
      if (digest(e.before) !== digest(previous)) throw new Error('Broken request history chain.');
      if (!e.before) {
        if (e.action !== 'create' || e.after.requestedBy !== e.actorUid || e.after.status !== 'pending' || e.after.assignee || e.after.outcome || e.after.legacy || e.after.archivedByAdmin || e.after.archivedByRequester || e.after.createdAt !== e.at || e.note) throw new Error('Invalid request creation event.');
      } else {
        if (e.action === 'create') throw new Error('Duplicate request creation.');
        const common = { revision: e.before.revision };
        const cmd = e.action === 'archive' ? { ...common, action: e.action, audience: e.after.archivedByAdmin !== e.before.archivedByAdmin ? 'admin' as const : 'requester' as const,
          archived: e.after.archivedByAdmin !== e.before.archivedByAdmin ? e.after.archivedByAdmin : e.after.archivedByRequester }
          : e.action === 'decide' ? { ...common, action: e.action, outcome: e.after.outcome!.kind, reason: e.after.outcome!.reason, reviewId: e.after.outcome!.reviewId }
          : e.action === 'takeover' || e.action === 'reopen' ? { ...common, action: e.action, reason: e.note }
          : { ...common, action: e.action };
        // Archive no-ops cannot reveal their audience from the snapshots; both authorized paths are valid.
        let candidates = [cmd];
        if (e.action === 'archive' && e.before.archivedByAdmin === e.after.archivedByAdmin && e.before.archivedByRequester === e.after.archivedByRequester)
          candidates = [{ ...common, action: 'archive', audience: 'admin', archived: e.after.archivedByAdmin }, { ...common, action: 'archive', audience: 'requester', archived: e.after.archivedByRequester }];
        const valid = candidates.some(c => { try { return digest({ ...transitionRequest(e.before!, requestActionSchema.parse(c), e.actorUid, e.actorRole), revision: e.revision, updatedAt: e.at }) === digest(e.after); } catch { return false; } });
        if (!valid) throw new Error('Invalid request transition in history.');
      }
      const path = `districts/${s.config.districtId}/requestReceipts/${e.actorUid}/entries/${e.commandId}`;
      if (expectedReceipts.has(path)) throw new Error('Duplicate request command identity.');
      expectedReceipts.set(path, { event: e, bytes: requestBytes(e) }); measured += requestBytes(e);
      if (requestBytes(e) > L.record * 2 || requestBytes(e.after) > L.record) throw new Error('Request history record exceeds its byte limit.');
      previous = e.after;
    }
    if (digest(previous) !== digest(state)) throw new Error('Request head disagrees with history.');
    totals.set(ref.id, { retained: head.retainedBytes, measured, stateBytes: requestBytes(state) });
  }
  const actors = await s.db.collection(`districts/${s.config.districtId}/requestReceipts`).listDocuments();
  if (actors.length > L.count * L.events) throw new Error('Request receipt actor limit exceeded.');
  for (const actor of actors) {
    if ((await actor.get()).exists || (await actor.listCollections()).some(c => c.id !== 'entries')) throw new Error('Unknown request receipt parent.');
    const entries = await actor.collection('entries').limit(L.count * L.events + 1).get();
    if (entries.size > L.count * L.events) throw new Error('Too many request receipts.');
    const refs = await actor.collection('entries').listDocuments();
    if (refs.length !== entries.size) throw new Error('Orphan request receipts.');
    for (const doc of entries.docs) {
      if ((await doc.ref.listCollections()).length) throw new Error('Unknown receipt descendants.');
      hasArtifacts = true; const r = requestReceiptSchema.parse(doc.data()); const match = expectedReceipts.get(doc.ref.path);
      if (!match || r.actorUid !== actor.id || r.commandId !== doc.id || r.requestId !== match.event.requestId || r.revision !== match.event.revision || r.at !== match.event.at || r.route !== (match.event.action === 'create' ? '/api/requests' : `/api/requests/${r.requestId}`)) throw new Error('Invalid request receipt reference.');
      totals.get(r.requestId)!.measured += requestBytes(r); expectedReceipts.delete(doc.ref.path);
    }
  }
  if (expectedReceipts.size) throw new Error('Request history is missing receipts.');
  for (const t of totals.values()) if (t.measured !== t.retained || t.measured + t.stateBytes > L.bytes) throw new Error('Request retained-byte accounting mismatch.');
  await fence(); return { hasArtifacts };
}
