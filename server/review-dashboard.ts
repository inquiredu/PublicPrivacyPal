import type { DecodedIdToken } from 'firebase-admin/auth';
import { FieldPath } from 'firebase-admin/firestore';
import { z } from 'zod';
import type { Services } from './firebase.ts';
import { HttpError, membersRef, requireMember } from './operations.ts';
import { reviewCollection } from './review-storage.ts';
import { reviewRollup, type ReviewQueue, type ReviewDashboardRow } from '../shared/review-dashboard.ts';
const headSchema = z.object({ id: z.uuid(), name: z.string().min(1).max(120), storageVersion: z.literal(3), published: z.boolean(), sourceKind: z.enum(['fixture','pasted','bundle']).optional(), analysisId: z.uuid().nullable(), decisionId: z.string().regex(/^[a-f0-9]{64}$/).nullable(), serviceId: z.string().regex(/^[a-f0-9]{64}$/).optional(), reviewed: z.number().int().min(0).max(50), measureCount: z.number().int().min(1).max(50), job: z.object({ id: z.uuid(), status: z.enum(['queued','running','failed','cancelled','awaiting_review','succeeded']) }), serviceSummary: z.object({ blockers: z.array(z.string()).max(20) }).optional() });
const decisionSchema = z.object({ analysisId: z.uuid(), serviceRevision: z.number().int().positive().optional(), outcome: z.enum(['approved','conditional','declined']) });
export async function reviewDashboard(s: Services, actor: DecodedIdToken, queue: ReviewQueue = 'all', cursor?: string) {
  if (cursor && !z.uuid().safeParse(cursor).success) throw new HttpError(400, 'Invalid dashboard cursor.');
  return s.db.runTransaction(async tx => {
    requireMember((await tx.get(membersRef(s).doc(actor.uid))).data(), actor, ['admin','reviewer','viewer']);
    const heads = await tx.get(reviewCollection(s).orderBy(FieldPath.documentId()).limit(1001).select('id','name','storageVersion','published','sourceKind','analysisId','decisionId','serviceId','reviewed','measureCount','job.id','job.status','serviceSummary.blockers'));
    if (heads.size > 1000) throw new HttpError(409, 'Review inventory exceeds the supported bound.');
    // Only review-prefixed projections count; bootstrap catalogue examples are separate resources.
    const projections = async (path: string) => tx.get(s.db.collection(path).orderBy(FieldPath.documentId()).startAt('review-').endBefore('review.').limit(1001).select());
    const [publicDocs, staffDocs] = await Promise.all([projections(`publicDistricts/${s.config.districtId}/tools`), projections(`districts/${s.config.districtId}/staffTools`)]);
    const ids = new Set(heads.docs.map(d => d.id));
    for (const docs of [publicDocs, staffDocs]) if (docs.size > 1000 || docs.docs.some(d => !ids.has(d.id.slice(7)))) throw new HttpError(409, 'Publication inventory contains unmatched review records. Ask the operator to inspect it.');
    const publicIds = new Set(publicDocs.docs.map(d => d.id.slice(7))); const staffIds = new Set(staffDocs.docs.map(d => d.id.slice(7)));
    const parsedHeads = heads.docs.map(doc => { const parsed = headSchema.safeParse(doc.data());
      if (!parsed.success || parsed.data.id !== doc.id) throw new HttpError(409, 'Review summary is invalid or requires migration.');
      return { doc, h: parsed.data };
    });
    const decisionRefs = parsedHeads.filter(x => x.h.decisionId).map(x => x.doc.ref.collection('decisions').doc(x.h.decisionId!));
    const serviceRefs = parsedHeads.filter(x => x.h.decisionId && x.h.serviceId).map(x => x.doc.ref.collection('services').doc(x.h.serviceId!));
    const decisions = new Map((decisionRefs.length ? await tx.getAll(...decisionRefs, { fieldMask: ['analysisId','serviceRevision','outcome'] }) : []).map(d => [d.ref.path, d.data()]));
    const services = new Map((serviceRefs.length ? await tx.getAll(...serviceRefs, { fieldMask: ['revision'] }) : []).map(d => [d.ref.path, d.get('revision')]));
    const rows: ReviewDashboardRow[] = [];
    for (const { doc, h } of parsedHeads) {
      const queues: ReviewQueue[] = ['all'];
      let current = false;
      if (h.decisionId) {
        const d = decisionSchema.safeParse(decisions.get(doc.ref.collection('decisions').doc(h.decisionId).path));
        if (!d.success) throw new HttpError(409, 'A review decision summary is unavailable.');
        let serviceRevision: number | undefined;
        if (h.serviceId) { serviceRevision = services.get(doc.ref.collection('services').doc(h.serviceId).path); if (!Number.isInteger(serviceRevision) || serviceRevision! < 1) throw new HttpError(409, 'A service revision is unavailable.'); }
        current = h.job.status === 'succeeded' && !!h.analysisId && d.data.analysisId === h.analysisId && (!h.serviceId || d.data.serviceRevision === serviceRevision);
      }
      const pub = publicIds.has(h.id), staff = staffIds.has(h.id);
      if (pub) queues.push('public'); if (staff) queues.push('staff');
      if (pub !== h.published || staff !== h.published) queues.push('publication');
      if (h.job.status === 'failed') queues.push('failed');
      if (h.job.status === 'awaiting_review' || (['pasted','bundle'].includes(h.sourceKind || '') && h.analysisId && h.reviewed < h.measureCount)) queues.push('evidence');
      if (h.job.status === 'succeeded' && h.analysisId && !current) queues.push('decision');
      if (h.serviceSummary?.blockers.length) queues.push('requirements');
      rows.push({ id: h.id, name: h.name, queues });
    }
    return reviewRollup(rows, queue, cursor, new Date().toISOString());
  });
}
