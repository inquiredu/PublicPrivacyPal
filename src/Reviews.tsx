import { segmentedExampleCapture } from '../shared/segmented-assistance';
import './source-dependencies.css';
import { SourceBundleCapture } from './SourceBundleCapture';
import { dependencyErrors } from './SourceDependencyEditor';
import { emptySourceBundle } from '../shared/source-bundle';
import { ANALYSIS_EXAMPLE } from '../shared/analysis-example';
import { PAGE_SIZE, type ReviewSummary } from '../shared/evaluation';
import { z } from 'zod';
import { captureDraftSchema } from '../shared/drafts';
import { useDraftStore, useReviewCommands } from './ReviewDrafts';
import { useEffect, useState, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import { collection, doc, documentId, onSnapshot, orderBy, query, limit, startAfter } from 'firebase/firestore';
import type { Client } from './firebase';
import { criteria, MAX_POLICY_LENGTH, MAX_REVIEW_IMPORT_BYTES, type Review } from '../shared/review';
import { DEFAULT_PROFILE, profiles, profileVersions } from '../shared/scoring/profiles';
import { api } from './api';
import { ReviewDetail, type RubricStatus } from './ReviewDetail';
import { ReviewCard } from './ReviewCard';
const message = (e: unknown) => e instanceof Error ? e.message : 'The action could not be completed.';

export function Reviews({ client, user, readOnly }: { client: Client; user: User; readOnly: boolean }) {
  const [rows, setRows] = useState<ReviewSummary[]>([]);
  const [active, setActive] = useState<Review>();
  const [detailError, setDetailError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [page, setPage] = useState<{ at: string; id: string }[]>([]);
  const [hasNext, setHasNext] = useState(false);
  const [rubric, setRubric] = useState<RubricStatus>();
  const store = useDraftStore();
  const capture: z.infer<typeof captureDraftSchema> = store.get('capture', captureDraftSchema) || { sourceKind: 'pasted' as const, name: '', sourceLabel: '', sourceText: '', fixtureId: 'complete' as const, profileVersion: DEFAULT_PROFILE, completeService: true };
  const sourceKind = capture.sourceKind;
  const currentDefinitions = capture.rubricMode === 'district' ? rubric?.captureDefinitions?.district : rubric?.captureDefinitions?.practice[capture.profileVersion];
  const definitionsCurrent = !!capture.captureDefinitions && !!currentDefinitions && capture.captureDefinitions.id === currentDefinitions.id
    && (capture.rubricMode !== 'district' || capture.settingsRevision === currentDefinitions.settingsRevision);
  const bundleErrors = sourceKind === 'bundle' ? [
    ...(!definitionsCurrent ? ['Explicitly adopt the current review measures before saving this document set. Existing text and selections are retained.'] : []),
    ...dependencyErrors(capture.sourceBundle || emptySourceBundle(), capture.captureDefinitions),
  ] : [];
  const selected = store.get('location', z.string()) || '';
  const setSelected = (id: string) => store.set('location', id);
  const changeCapture = (patch: Partial<typeof capture>) => store.set('capture', { ...capture, ...patch });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let q = query(collection(client.db, `districts/${client.config.districtId}/reviews`), orderBy('createdAt', 'desc'), orderBy(documentId(), 'desc'), limit(PAGE_SIZE + 1));
    const cursor = page.at(-1); if (cursor) q = query(q, startAfter(cursor.at, cursor.id));
    return onSnapshot(q, snap => {
      setHasNext(snap.size > PAGE_SIZE); setRows(snap.docs.slice(0, PAGE_SIZE).map(d => { const r = d.data(); return { id: d.id, name: r.name, revision: r.revision, createdAt: r.createdAt, updatedAt: r.updatedAt, published: r.published, status: r.job.status, score: r.score, reviewed: r.reviewed, measureCount: r.measureCount, ...(r.serviceSummary ? { service: r.serviceSummary } : {}) }; }));
    }, () => { setRows([]); setError('Reviews could not be loaded. Check your membership and local services.'); });
  }, [client, page]);
  useEffect(() => { let alive = true; void api<RubricStatus>('/api/review-rubric', user).then(r => { if (alive) setRubric(r); }).catch(e => { if (alive) setError(message(e)); }); return () => { alive = false; }; }, [user]);
  useEffect(() => {
    if (!selected) return; let sequence = 0; let alive = true; setDetailError('');
    const stop = onSnapshot(doc(client.db, `districts/${client.config.districtId}/reviews/${selected}`), snap => {
      const request = ++sequence;
      if (!snap.exists()) { setActive(undefined); return; }
      void api<Review>(`/api/reviews/${selected}`, user).then(r => { if (alive && request === sequence) setActive(old => old?.id === r.id && old.revision > r.revision ? old : r); }).catch(e => { if (alive && request === sequence) { setActive(undefined); setDetailError(message(e)); } });
    }, () => { setActive(undefined); setDetailError('Review access is unavailable.'); });
    return () => { alive = false; stop(); };
  }, [client, selected, user, loadAttempt]);
  function acceptReview(r: Review) { setActive(old => old?.id === r.id && old.revision > r.revision ? old : r); }
  const commands = useReviewCommands(user, r => { acceptReview(r); setSelected(r.id); });
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError('');
    if (bundleErrors.length) { setError(bundleErrors.join(' ')); return; }
    await commands.start('/api/reviews', { name: capture.name, ...(capture.completeService ? { serviceSettingsRevision: capture.serviceSettingsRevision || rubric?.revision } : {}), ...(sourceKind !== 'fixture' && capture.rubricMode === 'district' ? { rubricMode: 'district', settingsRevision: capture.settingsRevision, engineVersion: profiles[capture.profileVersion].engineVersion } : { profileVersion: capture.profileVersion }), ...(sourceKind === 'bundle' ? { sourceKind, sourceDefinitionId: capture.captureDefinitions?.id, sourceLabel: capture.sourceLabel, sourceBundle: { ...(capture.sourceBundle || emptySourceBundle()), documents: (capture.sourceBundle || emptySourceBundle()).documents.map(d => ({ ...d, effectiveDates: d.effectiveDates.filter(v => v.trim()) })) } } : sourceKind === 'pasted' ? { sourceKind, sourceLabel: capture.sourceLabel, sourceText: capture.sourceText } : { fixtureId: capture.fixtureId }) }, 'Create review', ['capture']);
  }
  return <>
    {commands.notice}
    <section className="panel"><details open={!selected}><summary>New policy review — paste a source or use a synthetic example</summary><p>Paste policy text for manual evidence review, or practice with a bundled fictional policy. Everything stays in your local sandbox. No website is fetched and no AI service is called.</p><p className="subtle">Choose the eight-measure practice profile or explicitly adopt your saved district rubric. Each review keeps its chosen source, rubric and scoring rule; changing Settings does not rescore existing reviews.</p>
      {!readOnly && <form className="review-create" onSubmit={e => void create(e)}><fieldset disabled={busy || commands.blocked}>
        <label className="check-option"><input type="checkbox" checked={capture.completeService ?? false} onChange={e => changeCapture({ completeService: e.target.checked, ...(rubric?.servicePolicyAvailable ? { serviceSettingsRevision: rubric.revision } : {}) })}/>Complete service review with saved district tier requirements</label>{capture.completeService && <p>Adopt tier policy from settings revision {capture.serviceSettingsRevision || rubric?.revision || "—"}. {!rubric?.servicePolicyAvailable && "An administrator must save a tier policy in Settings first."}{rubric?.servicePolicyAvailable && capture.serviceSettingsRevision && capture.serviceSettingsRevision !== rubric.revision && <button type="button" onClick={() => changeCapture({ serviceSettingsRevision: rubric.revision })}>Adopt current service policy revision {rubric.revision}</button>}</p>}<label>Policy source<select value={sourceKind} onChange={e => changeCapture({ sourceKind: e.target.value as typeof sourceKind })}><option value="pasted">Paste policy text</option><option value="bundle">Paste a set of policy documents</option><option value="fixture">Bundled synthetic policy</option></select></label>
        <button type="button" className="secondary" disabled={!!capture.name || !!capture.sourceLabel || !!capture.sourceText || !!capture.sourceBundle} onClick={() => changeCapture({ sourceKind: 'pasted', name: 'Cedar Intelligence Lab', sourceLabel: 'Fictional school-account policy', sourceText: ANALYSIS_EXAMPLE })}>Load Cedar Intelligence Lab example</button>
        <button type="button" className="secondary" disabled={!!capture.name || !!capture.sourceLabel || !!capture.sourceText || !!capture.sourceBundle || !rubric?.captureDefinitions?.practice['community-evidence-v1']} onClick={() => { const example = segmentedExampleCapture(); changeCapture({ ...example, rubricMode: 'practice', completeService: false, captureDefinitions: rubric!.captureDefinitions!.practice['community-evidence-v1'] }); }}>Load Lantern long-policy lab</button>
        <label>Tool name<input name="name" value={capture.name} onChange={e => changeCapture({ name: e.target.value })} maxLength={120} required placeholder="e.g. Orchard Learning"/></label>
        <label>Scoring profile<select name="profileVersion" value={capture.profileVersion} onChange={e => changeCapture({ profileVersion: e.target.value as typeof capture.profileVersion })}>{profileVersions.map(version => <option key={version} value={version}>{profiles[version].name}</option>)}</select></label>
        {sourceKind !== 'fixture' && <div><label>Review measures<select value={capture.rubricMode || 'practice'} onChange={e => changeCapture({ rubricMode: e.target.value as 'practice' | 'district', ...(rubric?.available ? { settingsRevision: rubric.revision } : {}) })}><option value="practice">Eight-measure practice profile</option><option value="district" disabled={!rubric?.available}>Saved district rubric (50 measures){rubric?.profile === 'pef-precision-v1' ? ' — precision pilot v1' : ''}</option></select></label>{capture.rubricMode === 'district' && <small>Adopting settings revision {capture.settingsRevision}.{rubric?.revision === capture.settingsRevision && rubric?.profile === 'pef-precision-v1' && ' Includes 14 refined measures with clause-level review.'} Disabled areas are excluded from scoring and completion. {rubric?.available && rubric.revision !== capture.settingsRevision && <button type="button" onClick={() => changeCapture({ settingsRevision: rubric.revision })}>Use current settings revision {rubric?.revision}</button>}</small>}<button type="button" className="secondary" onClick={() => { setError(''); void api<typeof rubric>('/api/review-rubric', user).then(setRubric).catch(e => setError(message(e))); }}>Refresh saved rubric</button></div>}
        {sourceKind !== 'fixture' ? <><label className="full-width">Source label<input name="sourceLabel" value={capture.sourceLabel} onChange={e => changeCapture({ sourceLabel: e.target.value })} maxLength={160} required placeholder="e.g. Orchard fictional policy, October 2026"/></label>{sourceKind === 'bundle' ? <><section className="notice" aria-label="Source dependency definitions"><p>{capture.captureDefinitions ? `Document dependencies use ${capture.captureDefinitions.definitionVersion}${capture.captureDefinitions.settingsRevision ? `, settings revision ${capture.captureDefinitions.settingsRevision}` : ''}.` : 'Choose the review definitions before assigning document dependencies.'}</p>{!definitionsCurrent && <p>Review measures changed or have not been adopted for this draft. Text, dependencies and exclusions remain in place. Inspect them after adopting the current definitions.</p>}<button type="button" className="secondary" disabled={!currentDefinitions || definitionsCurrent} onClick={() => currentDefinitions && changeCapture({ captureDefinitions: currentDefinitions, ...(currentDefinitions.kind === 'district' ? { settingsRevision: currentDefinitions.settingsRevision! } : {}) })}>Adopt current review measures for document dependencies</button>{!currentDefinitions && <p>Current definitions are unavailable. Refresh the saved rubric and retry.</p>}</section><SourceBundleCapture definitions={capture.captureDefinitions} value={capture.sourceBundle || emptySourceBundle()} onChange={sourceBundle => changeCapture({ sourceBundle })}/>{bundleErrors.length > 0 && <p className="subtle" role="status">Resolve the document dependency feedback above before saving. Captured text and unfinished declarations stay in this tab.</p>}</> : <label className="full-width">Policy text<textarea name="sourceText" value={capture.sourceText} onChange={e => changeCapture({ sourceText: e.target.value })} rows={8} maxLength={MAX_POLICY_LENGTH} required/><small>Up to 32,000 characters. Use synthetic text for this local trial. This saved copy is fixed; create a new review for a changed policy. Review every enabled criterion before recording a decision.</small></label>}</> : <label>Synthetic policy<select name="fixtureId" value={capture.fixtureId} onChange={e => changeCapture({ fixtureId: e.target.value as typeof capture.fixtureId })}><option value="complete">Clear commitments</option><option value="gaps">Missing and conflicting commitments</option><option value="retry">Temporary failure — retry practice</option></select></label>}
        <button disabled={busy || commands.blocked || bundleErrors.length > 0 || (!!capture.completeService && !rubric?.servicePolicyAvailable)}>{sourceKind !== 'fixture' ? 'Save policy for review' : 'Start synthetic analysis'}</button>
      </fieldset></form>}
      {store.has('capture') && !readOnly && <p className="subtle">Draft kept in this tab; not saved to the workspace. <button type="button" className="secondary" disabled={commands.blocked} onClick={() => store.remove('capture')}>Discard new review draft</button></p>}
      <details><summary>Eight-measure practice rubric</summary><p>These eight criteria are a candidate for district review. A score measures the statements in a policy, not a vendor’s actual practices. There is no approval threshold.</p><p>The evidence-first candidate gives missing evidence zero credit. The inherited profile retains 60% missing-evidence credit for comparison. New analyses stay on the profile selected when the review was created.</p><div className="evidence-list">{criteria.map(c => <article key={c.id}><h3>{c.label} · Weight {c.weight}</h3><p><strong>Meets:</strong> {c.evidence}</p><p><strong>Partial:</strong> {c.partial}</p><p><strong>Does not meet:</strong> {c.failure}</p></article>)}</div><p><strong>Not addressed:</strong> no supporting statement. Missing evidence remains distinct from an explicit contradiction. The fixture adapter does not evaluate arbitrary policies.</p></details>
      {!readOnly && <label className="import-control">Import a review as a new draft<input type="file" accept="application/json,.json" disabled={busy || commands.blocked} onChange={async e => {
        const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
        setBusy(true); setError('');
        try { if (file.size > MAX_REVIEW_IMPORT_BYTES) throw new Error('Choose a JSON file no larger than 2 MiB.'); await commands.start('/api/reviews/import', JSON.parse(await file.text()), 'Import review'); }
        catch (e) { setError(message(e)); } finally { setBusy(false); }
      }}/><small>Pasted imports require fresh evidence review. Synthetic imports rerun the fixture analysis. District-rubric exports are archives: paste the source into a new review and explicitly select the current saved rubric. Archived findings, approvals, and history cannot authorize publication.</small></label>}
      {error && <div className="notice" role="alert">{error}</div>}
    </details></section>
    <div className="review-layout"><aside className="review-list" aria-label="Reviews"><h2>Reviews <span className="count">{rows.length}</span></h2><p className="subtle review-list-help">Select a service to inspect its evidence and district decision.</p>{!rows.length && <p>No reviews yet.</p>}{rows.map(r => <ReviewCard key={r.id} review={r} selected={r.id === selected} onSelect={() => setSelected(r.id)}/>)}<div className="actions review-pagination"><button className="secondary" disabled={!page.length} onClick={() => setPage(p => p.slice(0, -1))}>Previous reviews</button><button className="secondary" disabled={!hasNext} onClick={() => { const last = rows.at(-1); if (last) setPage(p => [...p, { at: last.createdAt, id: last.id }]); }}>Next reviews</button></div></aside>
      <div>{active?.id === selected ? <ReviewDetail key={active.id} review={active} client={client} user={user} readOnly={readOnly} commands={commands} rubric={rubric}/> : <section className="panel">{detailError && <div role="alert" className="notice">{detailError} <button className="secondary" onClick={() => setLoadAttempt(n => n + 1)}>Retry loading review</button></div>}{selected && !detailError && <p role="status">Loading selected review…</p>}<h2>From evidence to a district decision</h2><ol className="review-steps"><li>Paste policy text or analyze a synthetic policy.</li><li>Inspect the score, quotes, and evidence gaps.</li><li>Record the district’s decision and public wording.</li><li>Publish to the local library, or remove it.</li></ol></section>}</div>
    </div>
  </>;
}
