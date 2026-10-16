import { TierPolicyEditor } from './TierPolicyEditor';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { api } from './api';
import { LibraryView, previewProfiles } from './LibraryView';
import {
  DEFAULT_FOOTER, MAX_LOGO_BYTES, accentText, defaultWeights, evaluationAreas, evaluationSettingsSchema,
  laws, librarySettingsSchema, priorityOptions, standards, states, tiers,
  type EvaluationSettings, type LibrarySettings, type SavedSettings,
} from '../shared/settings';


type SettingsResponse = { evaluation: SavedSettings<EvaluationSettings>; library: SavedSettings<LibrarySettings> };
const errorText = (e: unknown) => e instanceof Error ? e.message : 'Settings could not be saved. Try again.';
function useUnsaved(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
}
function Message({ error, children }: { error?: boolean; children: ReactNode }) {
  return <div className={`settings-message ${error ? 'error' : ''}`} role={error ? 'alert' : 'status'}>{children}</div>;
}
export function Settings({ user, openLibraryRequest = 0 }: { user: User; openLibraryRequest?: number }) {
  const [saved, setSaved] = useState<SettingsResponse>(); const [error, setError] = useState('');
  const [libraryNotice, setLibraryNotice] = useState('');
  const [libraryOpen, setLibraryOpen] = useState(false); const [attempt, setAttempt] = useState(0);
  useEffect(() => { if (openLibraryRequest > 0) setLibraryOpen(true); }, [openLibraryRequest]);
  useEffect(() => {
    let active = true; setError('');
    void api<SettingsResponse>('/api/settings', user).then(data => { if (active) setSaved(data); }).catch(e => { if (active) setError(errorText(e)); });
    return () => { active = false; };
  }, [user, attempt]);
  if (!saved) return <div className="original-settings">{error ? <><Message error>{error}</Message><button onClick={() => setAttempt(x => x + 1)}>Try again</button></> : <p role="status">Loading district settings…</p>}</div>;
  return <div className="original-settings">
    <div className="settings-toolbar"><div><h1 className="settings-title">District settings</h1><p>Evaluation choices and your public library’s appearance.</p></div><button className="secondary" onClick={() => setLibraryOpen(true)}>⚙ Customize Library</button></div>
    {libraryNotice && <Message>{libraryNotice}</Message>}
    <SetupWizard user={user} saved={saved.evaluation} onSaved={evaluation => setSaved(s => s && ({ ...s, evaluation }))}/>
    {libraryOpen && <LibraryDesignWizard user={user} saved={saved.library} onClose={() => setLibraryOpen(false)} onReloaded={library => setSaved(s => s && ({ ...s, library }))} onSaved={library => { setSaved(s => s && ({ ...s, library })); setLibraryOpen(false); setLibraryNotice(`Library changes saved — version ${library.revision}. The local public library is updated.`); }}/>}
  </div>;
}

// Preserves the original six-part SetupWizard arrangement; persistence is now server-owned.
function SetupWizard({ user, saved, onSaved }: { user: User; saved: SavedSettings<EvaluationSettings>; onSaved: (s: SavedSettings<EvaluationSettings>) => void }) {
  const [draft, setDraft] = useState(saved.values); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [status, setStatus] = useState('');
  const [custom, setCustom] = useState(!!draft.customEvaluationContext);
  const [context, setContext] = useState(!!(draft.districtMission || draft.strategicPlan));
  const [lawSearch, setLawSearch] = useState(''); const [showStateLaw, setShowStateLaw] = useState(draft.laws.includes('example-state-privacy'));
  const [documentText, setDocumentText] = useState(''); const [documentStatus, setDocumentStatus] = useState(''); const [reading, setReading] = useState(false);
  const [discard, setDiscard] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved.values); useUnsaved(dirty);
  function update<K extends keyof EvaluationSettings>(key: K, value: EvaluationSettings[K]) { setDraft(d => ({ ...d, [key]: value })); setStatus(''); }
  function toggle(key: 'laws' | 'evaluationStandards', id: string) { update(key, draft[key].includes(id) ? draft[key].filter(s => s !== id) : [...draft[key], id]); }
  async function save(e: FormEvent) {
    e.preventDefault(); setError(''); setStatus('');
    const check = evaluationSettingsSchema.safeParse(draft);
    if (!check.success) { setError(check.error.issues[0].message); return; }
    setBusy(true);
    try {
      const next = await api<SavedSettings<EvaluationSettings>>('/api/settings', user, { section: 'evaluation', revision: saved.revision, values: check.data });
      setDraft(next.values); onSaved(next); setStatus(`Settings saved — version ${next.revision}. Your existing reviews have not been changed.`);
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  async function reload() {
    setBusy(true); setError('');
    try { const next = (await api<SettingsResponse>('/api/settings', user)).evaluation; setDraft(next.values); setCustom(!!next.values.customEvaluationContext); setContext(!!(next.values.districtMission || next.values.strategicPlan)); setShowStateLaw(next.values.laws.includes('example-state-privacy')); onSaved(next); setDiscard(false); setStatus('Loaded the last saved settings.'); }
    catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  async function readDocument(file: File | undefined) {
    if (!file) return; setReading(true); setDocumentStatus('Reading the PDF on this device…'); setDocumentText('');
    try { const { extractDistrictPdf } = await import('./pdf-import'); const result = await extractDistrictPdf(file); setDocumentText(result.text); setDocumentStatus(`Read ${result.pagesRead} of ${result.totalPages} pages. Review the text before using it; the PDF itself is not saved.`); }
    catch (e) { setDocumentStatus(errorText(e)); } finally { setReading(false); }
  }
  const shownLaws = laws.filter(l => (l.id !== 'example-state-privacy' || showStateLaw || draft.laws.includes(l.id)) && `${l.name} ${l.description}`.toLowerCase().includes(lawSearch.toLowerCase()));
  const included = draft.starterProfile === 'none' ? 0 : evaluationAreas.filter(a => draft.evaluationWeights[a.id] > 0).reduce((n, a) => n + a.criteria.length, 0);
  return <form className="setup-wizard" onSubmit={e => { void save(e); }}>
    <h2>{saved.complete ? 'Settings' : 'Welcome! Let’s Get Started.'}</h2><p className="wizard-intro">{saved.complete ? 'Update your evaluation context and priorities.' : 'Define your context to get the most relevant analysis.'}</p>
    <fieldset disabled={busy} className="wizard-fields">
      <label>1. Select Your Sector<select value={draft.sector} onChange={() => {}}><option>Education (K-12)</option></select></label>
      <label>2. Select Your State<select value={draft.state} onChange={e => update('state', e.target.value as EvaluationSettings['state'])}><option value="">Select your state…</option>{states.map(s => <option key={s}>{s}</option>)}</select></label>
      <section><h3>3. Select Evaluation Standards</h3><p className="help">These selections guide analysis and review. The scoring measures and priorities are shown in step 6.</p>
        <div className="option-box">{standards.map(s => <label className="check-option" key={s.id}><input type="checkbox" checked={draft.evaluationStandards.includes(s.id)} onChange={() => toggle('evaluationStandards', s.id)}/><span><strong>{s.name}</strong><small>{s.description}</small></span></label>)}
          <label className="check-option"><input type="checkbox" checked={custom} onChange={e => { setCustom(e.target.checked); if (!e.target.checked) update('customEvaluationContext', ''); }}/><span><strong>Add Custom District Guidelines</strong><small>Paste your own principles or context to guide review.</small></span></label>
          {custom && <label className="inset-field">Custom district guidelines<textarea rows={3} maxLength={6000} value={draft.customEvaluationContext} onChange={e => update('customEvaluationContext', e.target.value)} placeholder="e.g., Student information must not be used for targeted advertising."/></label>}
        </div>
      </section>
      <section><h3>4. Select Relevant Privacy Laws</h3><p className="help">Choose references for your district’s review. Live law discovery is unavailable in this local sandbox; the state-law example is fictional.</p>
        <label>Search law references<input type="search" value={lawSearch} onChange={e => setLawSearch(e.target.value)} placeholder="Search by name or keyword…"/></label>
        <button className="secondary small-button" type="button" onClick={() => { setShowStateLaw(true); setLawSearch(''); }}>Show example state law for {draft.state}</button>
        <div className="option-box law-list">{shownLaws.map(l => <label className="check-option" key={l.id}><input type="checkbox" checked={draft.laws.includes(l.id)} onChange={() => toggle('laws', l.id)}/><span><strong>{l.name}</strong><small>{l.description}</small></span></label>)}{!shownLaws.length && <p>No matching references. Clear the search to see your selections.</p>}</div>
        <p className="help">{draft.laws.length} selected. Changing state preserves your selections for review.</p>
      </section>
      <section><h3>5. District Context (Optional)</h3><p className="help">Add your mission and strategic priorities for district-appropriate review and communication.</p>
        <label className="check-option bordered"><input type="checkbox" checked={context} onChange={e => { setContext(e.target.checked); if (!e.target.checked) { setDraft(d => ({ ...d, districtMission: '', strategicPlan: '' })); setStatus(''); } }}/><span><strong>Include District Mission & Strategic Plan</strong><small>Use synthetic district text while testing locally.</small></span></label>
        {context && <div className="context-fields">
          <label>Upload District Document (PDF)<input type="file" accept="application/pdf,.pdf" disabled={reading} onChange={e => { void readDocument(e.target.files?.[0]); e.target.value = ''; }}/></label><p className="help">Up to 5 MB; text from the first five pages. No upload to a cloud service.</p>
          {documentStatus && <Message>{documentStatus}</Message>}
          {documentText && <div className="option-box"><label>Extracted document text<textarea rows={5} value={documentText} onChange={e => setDocumentText(e.target.value)}/></label><button type="button" className="secondary small-button" disabled={documentText.length > 12000} onClick={() => { update('strategicPlan', documentText); setDocumentStatus('Text placed in Strategic Plan. Review it, then save settings.'); }}>Use as strategic plan text</button>{documentText.length > 12000 && <p className="help">Shorten this text to 12,000 characters before using it.</p>}</div>}
          <label>District Mission Statement<textarea rows={3} maxLength={4000} value={draft.districtMission} onChange={e => update('districtMission', e.target.value)} placeholder="Enter your district’s mission statement…"/></label>
          <label>Strategic Plan / Key Priorities<textarea rows={4} maxLength={12000} value={draft.strategicPlan} onChange={e => update('strategicPlan', e.target.value)} placeholder="Enter key strategic priorities, values, or goals…"/></label>
        </div>}
      </section>
      <TierPolicyEditor value={draft.tierPolicy} onChange={value => update('tierPolicy', value)}/>
      <section><h3>6. Customize Evaluation Priorities</h3><p className="help">Choose a starting framework and adjust the importance of each area. The original PrivacyPal example includes 50 measures in 11 areas.</p>
        <label>Starting framework<select value={draft.starterProfile} onChange={e => { setStatus(''); setDraft(d => ({ ...d, starterProfile: e.target.value as EvaluationSettings['starterProfile'], evaluationWeights: e.target.value === 'none' ? {} : defaultWeights() })); }}><option value="pef-2.0">PrivacyPal Evaluation Framework 2.0 — optional example</option><option value="none">Choose evaluation measures later</option></select></label>
        {draft.starterProfile === 'pef-2.0' ? <><div className="option-box priorities">{evaluationAreas.map(area => <div className="priority-row" key={area.id}><div><strong>{area.name}</strong><small>{area.criteria.length} measures</small></div><div className="priority-options" role="group" aria-label={`${area.name} priority`}>{priorityOptions.map(opt => <label key={opt.value} className={`priority priority-${opt.value * 2} ${draft.evaluationWeights[area.id] === opt.value ? 'selected' : ''}`}><input type="radio" name={`weight-${area.id}`} value={opt.value} checked={draft.evaluationWeights[area.id] === opt.value} onChange={() => update('evaluationWeights', { ...draft.evaluationWeights, [area.id]: opt.value })}/>{opt.label}</label>)}</div></div>)}</div><details className="measure-preview"><summary>Preview included measures ({included} of 50)</summary>{evaluationAreas.map(a => <section key={a.id}><h4>{a.name} · {draft.evaluationWeights[a.id] === 0 ? 'Disabled' : `${draft.evaluationWeights[a.id]}× weight`}</h4><ul>{a.criteria.map(c => <li key={c.id}>{c.question}</li>)}</ul></section>)}</details></> : <Message>Your context can be saved now. No scoring framework has been adopted.</Message>}
      </section>
      <Message>These choices are saved for your district’s full service-review workflow. Current practice reviews use their own eight-measure examples. Saving settings never recalculates or republishes existing reviews.</Message>
      {saved.complete && <p className="help">Saved version {saved.revision} · {new Date(saved.updatedAt!).toLocaleString()}</p>}
      {error && <Message error>{error}</Message>}{status && <Message>{status}</Message>}
      <div className="wizard-save"><button disabled={busy || reading} type="submit">{busy ? 'Saving…' : saved.complete ? 'Save Settings' : 'Finish Setup'}</button><button className="secondary" type="button" onClick={() => dirty ? setDiscard(true) : void reload()}>Reload saved settings</button></div>
      {discard && <Message>Discard your unsaved setup edits and load the last saved version?<div className="actions"><button type="button" className="secondary" onClick={() => setDiscard(false)}>Keep editing</button><button type="button" onClick={() => { void reload(); }}>Discard edits and reload</button></div></Message>}
    </fieldset>
  </form>;
}

function LibraryDesignWizard({ user, saved, onSaved, onReloaded, onClose }: { user: User; saved: SavedSettings<LibrarySettings>; onSaved: (s: SavedSettings<LibrarySettings>) => void; onReloaded: (s: SavedSettings<LibrarySettings>) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(saved.values); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [discard, setDiscard] = useState<'close' | 'reload' | null>(null); const [preview, setPreview] = useState(false);
  const [revision, setRevision] = useState(saved.revision); const [baseline, setBaseline] = useState(saved.values);
  const dialog = useRef<HTMLDialogElement>(null); const logoInput = useRef<HTMLInputElement>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline); useUnsaved(dirty);
  useEffect(() => { const el = dialog.current!; const trigger = document.activeElement; el.showModal(); return () => { el.close(); if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus(); }; }, []);
  const requestClose = () => { if (!busy) { if (dirty) setDiscard('close'); else onClose(); } };
  function update<K extends keyof LibrarySettings>(key: K, value: LibrarySettings[K]) { setDraft(d => ({ ...d, [key]: value })); }
  async function save(e: FormEvent) {
    e.preventDefault(); setError(''); const check = librarySettingsSchema.safeParse(draft);
    if (!check.success) { setError(check.error.issues[0].message); return; }
    setBusy(true);
    try { onSaved(await api<SavedSettings<LibrarySettings>>('/api/settings', user, { section: 'library', revision, values: check.data })); }
    catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  async function reload() {
    setBusy(true); setError('');
    try { const next = (await api<SettingsResponse>('/api/settings', user)).library; setDraft(next.values); setBaseline(next.values); setRevision(next.revision); onReloaded(next); setDiscard(null); }
    catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  async function readLogo(file: File | undefined) {
    if (!file) return; setError('');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > MAX_LOGO_BYTES) { setError('Use a PNG, JPEG, or WebP logo under 100 KB.'); return; }
    setBusy(true);
    try {
      const result = await new Promise<string>((accept, reject) => { const r = new FileReader(); r.onload = () => accept(String(r.result)); r.onerror = () => reject(new Error('Could not read this image.')); r.readAsDataURL(file); });
      const img = new Image(); img.src = result; await img.decode(); update('logo', result);
    } catch { setError('This image could not be read. Choose another PNG, JPEG, or WebP.'); } finally { setBusy(false); }
  }
  function section(index: number, patch: Partial<LibrarySettings['footerSections'][number]>) { update('footerSections', draft.footerSections.map((f, i) => i === index ? { ...f, ...patch } : f)); }
  function move(index: number, delta: number) { const rows = [...draft.footerSections]; [rows[index], rows[index + delta]] = [rows[index + delta], rows[index]]; update('footerSections', rows); }
  const previewResult = librarySettingsSchema.safeParse(draft);
  return <dialog className="library-dialog original-settings" ref={dialog} aria-labelledby="customize-library-title" onCancel={e => { e.preventDefault(); requestClose(); }} onClick={e => { if (e.target === e.currentTarget) requestClose(); }}>
    <form onSubmit={e => { void save(e); }} className="library-designer"><header><div><h2 id="customize-library-title">⚙ Customize Library</h2><p>Personalize the appearance of your public library.</p></div><button type="button" autoFocus aria-label="Close Customize Library" className="close-button secondary" disabled={busy} onClick={requestClose}>×</button></header>
      <fieldset className="wizard-fields" disabled={busy}>
        <label>Library Title<input value={draft.title} maxLength={120} required onChange={e => update('title', e.target.value)}/></label>
        <div className="two-columns"><div><label>Logo</label><div className="logo-control"><div className="logo-preview">{draft.logo ? <img src={draft.logo} alt="Logo preview"/> : <span>Preview</span>}</div><input hidden ref={logoInput} aria-label="Choose logo file" type="file" accept="image/png,image/jpeg,image/webp" onChange={e => { void readLogo(e.target.files?.[0]); e.target.value = ''; }}/><button type="button" className="secondary" onClick={() => logoInput.current?.click()}>Upload Logo</button>{draft.logo && <button type="button" className="secondary" onClick={() => update('logo', '')}>Remove logo</button>}</div><p className="help">PNG, JPEG or WebP · up to 100 KB</p></div>
          <div><label>Accent Color<div className="color-control"><input aria-label="Accent color hex" value={draft.themeColor} maxLength={7} onChange={e => update('themeColor', e.target.value)}/><input aria-label="Choose accent color" type="color" value={/^#[\da-f]{6}$/i.test(draft.themeColor) ? draft.themeColor : '#0284c7'} onChange={e => update('themeColor', e.target.value)}/></div></label></div></div>
        <section className="designer-section"><h3>Library statements</h3><p className="help">The words families read. Leave notice text blank to use the synthetic practice notice.</p><label>Notice text (top of the page)<textarea rows={6} maxLength={4000} value={draft.customDisclaimer} onChange={e => update('customDisclaimer', e.target.value)} placeholder="Leave blank to use the built-in notice."/></label><p className="help">Keep this statement true of every tool listed.</p><label>Contact address<input type="email" maxLength={200} value={draft.contactEmail} onChange={e => update('contactEmail', e.target.value)} placeholder="privacy@district.example"/></label><p className="help">Used wherever {'{email}'} appears in the footer. Use a synthetic address here.</p></section>
        <section className="designer-section"><div className="section-heading"><div><h3>Important information footer</h3><p className="help">Edit and reorder the sections at the bottom of your library.</p></div><button className="secondary" type="button" onClick={() => { update('footerSections', structuredClone(DEFAULT_FOOTER)); update('footerHeading', 'Important information'); }}>Reset to default</button></div>
          <label>Footer heading<input maxLength={120} value={draft.footerHeading} onChange={e => update('footerHeading', e.target.value)}/></label>
          <ol className="footer-editor">{draft.footerSections.map((f, i) => <li key={f.id}><div className="section-heading"><strong>Section {i + 1}</strong><div className="footer-actions"><button type="button" className="secondary" disabled={i === 0} aria-label={`Move section ${i + 1} up`} onClick={() => move(i, -1)}>↑</button><button type="button" className="secondary" disabled={i === draft.footerSections.length - 1} aria-label={`Move section ${i + 1} down`} onClick={() => move(i, 1)}>↓</button><button type="button" className="secondary" aria-label={`Remove section ${i + 1}`} onClick={() => update('footerSections', draft.footerSections.filter((_, j) => j !== i))}>Remove</button></div></div><label>Section {i + 1} heading<input maxLength={120} value={f.heading} required onChange={e => section(i, { heading: e.target.value })}/></label><label>Section {i + 1} text<textarea rows={3} maxLength={2000} value={f.body} required onChange={e => section(i, { body: e.target.value })}/></label></li>)}</ol>
          {!draft.footerSections.length && <p className="help">No sections — the footer will not appear on the notice.</p>}<button type="button" className="secondary" disabled={draft.footerSections.length >= 8} onClick={() => update('footerSections', [...draft.footerSections, { id: crypto.randomUUID(), heading: '', body: '' }])}>+ Add section</button>
        </section>
        <section className="designer-section"><h3>Display Preferences</h3><div role="group" aria-label="Default View Mode" className="display-options">{(['cards', 'compact'] as const).map(mode => <label className={draft.defaultViewMode === mode ? 'selected' : ''} key={mode}><input type="radio" name="view-mode" checked={draft.defaultViewMode === mode} onChange={() => update('defaultViewMode', mode)}/>{mode === 'cards' ? 'Cards View' : 'Compact View'}</label>)}</div><p className="help">Visitors can change the view for their own session.</p>
          <label>Default Sort Order<select value={draft.defaultSortMode} onChange={e => update('defaultSortMode', e.target.value as LibrarySettings['defaultSortMode'])}><option value="library_order">District order</option><option value="name_asc">A → Z (alphabetical)</option><option value="tier_asc">By approval tier</option></select></label>
          <label>Default Tier Filter<select value={draft.defaultFilterTier} onChange={e => update('defaultFilterTier', e.target.value as LibrarySettings['defaultFilterTier'])}><option value="all">Show All Tiers (no default filter)</option>{tiers.map(t => <option key={t}>{t}</option>)}</select></label><p className="help">Records without an assigned tier appear under Pending. The example preview includes tiers for testing these controls.</p>
        </section>
        <button type="button" className="secondary" aria-expanded={preview} onClick={() => setPreview(p => !p)}>{preview ? 'Hide preview' : 'Preview library'}</button>
        {preview && (previewResult.success ? <section className="library-preview" aria-label="Unsaved library preview"><p className="help">Unsaved preview · fictional sample cards</p><LibraryView settings={previewResult.data} profiles={previewProfiles} preview/></section> : <Message error>Complete the required fields to preview: {previewResult.error.issues[0].message}</Message>)}
        {error && <Message error>{error}</Message>}
        {discard && <Message>Discard your unsaved library edits?<div className="actions"><button type="button" className="secondary" onClick={() => setDiscard(null)}>Keep editing</button><button type="button" onClick={() => discard === 'close' ? onClose() : void reload()}>Discard edits{discard === 'reload' ? ' and reload' : ''}</button></div></Message>}
        <div className="designer-save"><button className="secondary" type="button" onClick={() => dirty ? setDiscard('reload') : void reload()}>Reload saved settings</button><button className="secondary" type="button" onClick={requestClose}>Cancel</button><button type="submit" style={{ background: /^#[\da-f]{6}$/i.test(draft.themeColor) ? draft.themeColor : '#0284c7', color: accentText(draft.themeColor) }}>{busy ? 'Saving…' : 'Save Changes'}</button></div>
      </fieldset>
    </form>
  </dialog>;
}
