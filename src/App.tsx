import { RequestDashboard } from './RequestDashboard';
import type { RequestQueue } from '../shared/request-dashboard';
import { clearRequestDrafts, hasRequestDrafts } from './request-journal';
import { ServiceNotice } from './ServiceNotice';
import { DraftProvider } from './ReviewDrafts';
import { browserDraftStore, clearReviewDrafts, type DraftStore } from './draft-store';
import { api } from './api';
import { DeferredScreen } from './DeferredScreen';

import { LibraryView } from './LibraryView';
import { defaultLibrary, librarySettingsSchema, type LibrarySettings, type LibraryProfile } from '../shared/settings';
import { lazy, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { collection, doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { connectLocal, type Client } from './firebase';
import { roles, type Role } from '../shared/config';

const RequestPanel = lazy(() => import('./RequestPanel').then(m => ({ default: m.RequestPanel })));
const ReviewDashboard = lazy(() => import('./ReviewDashboard').then(m => ({ default: m.ReviewDashboard })));
const Reviews = lazy(() => import('./Reviews').then(m => ({ default: m.Reviews })));
const Settings = lazy(() => import('./Settings').then(m => ({ default: m.Settings })));
type Profile = LibraryProfile;
type Member = { uid: string; email: string; role: Role; active: boolean; protected?: boolean };
type Tool = { id: string; name: string; url: string; notes: string };
const roleLabels: Record<Role, string> = { admin: 'Administrator', reviewer: 'Reviewer', viewer: 'Read-only reviewer', staff: 'Staff' };
const message = (e: unknown) => e instanceof Error ? e.message : 'Something went wrong. Please try again.';
function Brand() { return <span className="brand"><span className="brand-mark" aria-hidden="true">P</span>PrivacyPal<span className="edition">community</span></span>; }
function Notice({ children }: { children: ReactNode }) { return <div className="notice" role="status">{children}</div>; }

export function App() {
  const [client, setClient] = useState<Client>();
  const [problem, setProblem] = useState('');
  const [setup, setSetup] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setProblem(''); setSetup(false);
    void (async () => {
      const config = await api<Client['config']>('/api/config');
      const health = await api<{ initialized: boolean; message?: string }>('/api/health');
      if (!health.initialized) { if (alive) { setSetup(true); setProblem(health.message || 'Initial administrator setup is required.'); } return; }
      const local = await connectLocal(config);
      if (alive) setClient(local);
    })().catch(() => { if (alive) setProblem('The local workspace is not available. Check your configuration and start the local services.'); });
    return () => { alive = false; };
  }, [attempt]);
  if (!client) return <div className="setup-page"><Brand/><main className="setup-card"><p className="eyebrow">YOUR DISTRICT. YOUR WORKSPACE.</p><h1>{problem ? setup ? 'Set up your first administrator' : 'Let’s get your workspace ready' : 'Opening your workspace…'}</h1><p>{problem || 'Connecting to your local sandbox.'}</p>{problem && <><ol><li>Initialize configuration: <code>npm run local:init</code></li><li>Start local services: <code>npm run dev</code></li><li>In a second terminal: <code>npm run local:bootstrap</code></li></ol><p>The operator command creates the administrator named in your configuration. Visiting this page never grants access.</p><button onClick={() => setAttempt(x => x + 1)}>Check again</button></>}<p className="subtle">Local sandbox · Synthetic records only · No cloud credentials</p></main></div>;
  return <Workspace client={client}/>;
}

function Workspace({ client }: { client: Client }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [drafts, setDrafts] = useState<DraftStore | null>(null);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const signOutDialog = useRef<HTMLDialogElement>(null);
  const draftOwner = useRef('');
  const requestOwner = useRef('');
  const [member, setMember] = useState<Member | null>(null);
  const [accountReady, setAccountReady] = useState(false);
  useEffect(() => {
    if (!authReady || (user && !accountReady)) return;
    const owner = user && member ? `${user.uid}/${member.role}` : '';
    if (!owner || requestOwner.current && requestOwner.current !== owner) clearRequestDrafts();
    requestOwner.current = owner;
  }, [authReady, accountReady, user?.uid, member?.role]);
  const [tab, setTab] = useState<'library' | 'dashboard' | 'requests' | 'workspace' | 'people' | 'reviews' | 'settings'>('library');
  const [dashboardVisited, setDashboardVisited] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<{ id?: string; visit: number }>({ visit: 0 });
  const [returnRequest, setReturnRequest] = useState<string>();
  function openReview(id?: string) { setReturnRequest(undefined); setReviewTarget(t => ({ id, visit: t.visit + 1 })); setTab('reviews'); }
  const [requestTarget, setRequestTarget] = useState<{ queue: RequestQueue; id?: string; visit: number }>({ queue: 'active', visit: 0 });
  function openRequests(queue: RequestQueue, id?: string) { setRequestTarget(t => ({ queue, id, visit: t.visit + 1 })); setTab('requests'); }
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [library, setLibrary] = useState<LibrarySettings>();
  const [libraryError, setLibraryError] = useState('');
  const [customizeRequest, setCustomizeRequest] = useState(0);
  const [settingsOwner, setSettingsOwner] = useState('');
  const mainRef = useRef<HTMLElement>(null);
  const previousTab = useRef(tab);
  const [error, setError] = useState('');
  useEffect(() => onAuthStateChanged(client.auth, next => { setAuthReady(true); setUser(next); setMember(null); setAccountReady(!next); setDashboardVisited(false); setReturnRequest(undefined); setTab('library'); }), [client]);
  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(client.db, `districts/${client.config.districtId}/members/${user.uid}`), snap => {
      const data = snap.data();
      setMember(data?.active === true && user.emailVerified && data.email === user.email && roles.includes(data.role)
        ? { uid: user.uid, email: data.email, role: data.role, active: true } : null);
      setAccountReady(true);
    }, () => { setMember(null); setAccountReady(true); });
  }, [client, user]);
  useEffect(() => onSnapshot(collection(client.db, `publicDistricts/${client.config.districtId}/tools`), snap => {
    setProfiles(snap.docs.map(d => ({ id: d.id, ...d.data() } as Profile)).sort((a, b) => a.name.localeCompare(b.name)));
    setError('');
  }, () => { setProfiles([]); setError('The library could not be loaded. Check the local emulators.'); }), [client]);
  useEffect(() => onSnapshot(doc(client.db, `publicDistricts/${client.config.districtId}`), snap => {
    const values = snap.get('librarySettings');
    const parsed = librarySettingsSchema.safeParse(values ?? defaultLibrary(client.config.districtName));
    if (parsed.success) { setLibrary(parsed.data); setLibraryError(''); }
    else { setLibrary(undefined); setLibraryError('Library settings could not be read. Ask your local administrator to check them.'); }
  }, () => { setLibrary(undefined); setLibraryError('Library settings are unavailable. Check the local services.'); }), [client]);
  const canReview = member && ['admin', 'reviewer', 'viewer'].includes(member.role);
  useEffect(() => {
    if (!authReady || (user && !accountReady)) return;
    const owner = user && canReview ? `${client.config.projectId}/${client.config.districtId}/${user.uid}/${member!.role}` : '';
    if (owner === draftOwner.current) { if (!owner) clearReviewDrafts(); return; }
    if (draftOwner.current) clearReviewDrafts();
    draftOwner.current = owner;
    setDrafts(owner ? browserDraftStore(owner) : null);
  }, [authReady, accountReady, user?.uid, member?.role, canReview, client]);
  useEffect(() => { if (confirmSignOut && !signOutDialog.current?.open) signOutDialog.current?.showModal(); }, [confirmSignOut, drafts]);
  function keepEditing() { signOutDialog.current?.close(); setConfirmSignOut(false); }
  async function leaveAccount(confirmed = false) {
    if (signingOut) return;
    if (!confirmed && (drafts?.has() || hasRequestDrafts())) { setConfirmSignOut(true); return; }
    setSigningOut(true);
    try { await signOut(client.auth); clearReviewDrafts(); clearRequestDrafts(); setConfirmSignOut(false); }
    catch (e) { setError(message(e)); setConfirmSignOut(false); }
    finally { setSigningOut(false); }
  }
  const currentTab = (tab === 'reviews' && !canReview) || (['people', 'settings'].includes(tab) && member?.role !== 'admin') || (['workspace', 'dashboard', 'requests'].includes(tab) && !member) ? 'library' : tab;
  useEffect(() => {
    document.title = `${currentTab === 'dashboard' ? 'Dashboard' : currentTab === 'requests' ? (member?.role === 'admin' || member?.role === 'reviewer' ? 'Requests' : 'My Requests') : currentTab === 'library' ? 'Public library' : currentTab === 'reviews' ? 'Policy reviews' : currentTab === 'settings' ? 'Settings' : currentTab === 'people' ? 'People & access' : 'My workspace'} · PrivacyPal`;
    if (previousTab.current !== currentTab) mainRef.current?.focus();
    previousTab.current = currentTab;
    if (currentTab === 'settings' && user) setSettingsOwner(user.uid);
    if (!user || member?.role !== 'admin') setSettingsOwner('');
  }, [currentTab, user?.uid, member?.role]);
  const content = <div className="app-shell"><a className="skip-link" href="#main-content">Skip to main content</a>
    <aside className="sidebar"><Brand/><div className="district-label"><span className="eyebrow">DISTRICT WORKSPACE</span><strong>{client.config.districtName}</strong></div><nav aria-label="Main navigation">
      <button aria-current={currentTab === 'library' ? 'page' : undefined} className={currentTab === 'library' ? 'nav active' : 'nav'} onClick={() => setTab('library')}><span aria-hidden="true">▦</span>Public library</button>
      {member && <><button aria-current={currentTab === 'dashboard' ? 'page' : undefined} className={currentTab === 'dashboard' ? 'nav active' : 'nav'} onClick={() => { setDashboardVisited(true); setTab('dashboard'); }}>Dashboard</button><button aria-current={currentTab === 'requests' ? 'page' : undefined} className={currentTab === 'requests' ? 'nav active' : 'nav'} onClick={() => openRequests('active')}>{member.role === 'admin' || member.role === 'reviewer' ? 'Requests' : 'My Requests'}</button></>}
      {member && <button aria-current={currentTab === 'workspace' ? 'page' : undefined} className={currentTab === 'workspace' ? 'nav active' : 'nav'} onClick={() => setTab('workspace')}><span aria-hidden="true">▤</span>My workspace</button>}
      {canReview && <button aria-current={currentTab === 'reviews' ? 'page' : undefined} className={currentTab === 'reviews' ? 'nav active' : 'nav'} onClick={() => setTab('reviews')}><span aria-hidden="true">✓</span>Policy reviews</button>}
      {member?.role === 'admin' && <button aria-current={currentTab === 'people' ? 'page' : undefined} className={currentTab === 'people' ? 'nav active' : 'nav'} onClick={() => setTab('people')}><span aria-hidden="true">♧</span>People & access</button>}
      {member?.role === 'admin' && <button aria-current={currentTab === 'settings' ? 'page' : undefined} className={currentTab === 'settings' ? 'nav active' : 'nav'} onClick={() => setTab('settings')}><span aria-hidden="true">⚙</span>Settings</button>}
    </nav><div className="sidebar-bottom"><span className="sandbox-dot"/>Local sandbox<p>Independent by design.<br/>Built for district ownership.</p></div></aside>
    <div className="main-shell"><header className="topbar"><span>Community edition <span className="divider">/</span> {currentTab === 'dashboard' ? 'Dashboard' : currentTab === 'requests' ? (member?.role === 'admin' || member?.role === 'reviewer' ? 'Requests' : 'My Requests') : currentTab === 'library' ? 'Public library' : currentTab === 'people' ? 'People & access' : currentTab === 'reviews' ? 'Policy reviews' : currentTab === 'settings' ? 'Settings' : 'My workspace'}</span><span className="pill">Local sandbox</span></header>
      <main id="main-content" ref={mainRef} tabIndex={-1} aria-label={currentTab === 'dashboard' ? 'Dashboard' : currentTab === 'requests' ? (member?.role === 'admin' || member?.role === 'reviewer' ? 'Requests' : 'My Requests') : currentTab === 'library' ? 'Public library' : currentTab === 'reviews' ? 'Policy reviews' : currentTab === 'settings' ? 'Settings' : currentTab === 'people' ? 'People & access' : 'My workspace'}>{currentTab !== 'library' && currentTab !== 'settings' && <div className="page-heading"><div><p className="eyebrow">YOUR DISTRICT WORKSPACE</p><h1>{currentTab === 'dashboard' ? 'Dashboard' : currentTab === 'requests' ? 'Tool requests' : currentTab === 'people' ? 'People & access' : currentTab === 'reviews' ? 'Evidence. Review. Publication.' : 'Welcome to your workspace.'}</h1><p>{currentTab === 'people' ? 'Give each colleague the access they need.' : `You’re signed in as ${member ? roleLabels[member.role].toLowerCase() : 'a district user'}.`}</p></div></div>}
        {error && <Notice>{error}</Notice>}
        <section className="session-bar" aria-label="Account"><div><strong>{user ? user.email : 'You’re viewing the public library'}</strong><p>{member ? roleLabels[member.role] : user ? accountReady ? 'No active membership. Ask your local administrator to assign access.' : 'Checking your membership…' : 'Anyone can browse. District team members can sign in below.'}</p></div>{user && <button className="secondary" disabled={signingOut} onClick={() => { void leaveAccount(); }}>Sign out</button>}</section>
        {confirmSignOut && <dialog ref={signOutDialog} className="draft-signout-dialog" aria-labelledby="draft-signout-title" aria-describedby="draft-signout-description" onCancel={e => { e.preventDefault(); if (!signingOut) keepEditing(); }}>
          <h2 id="draft-signout-title">Sign out and erase this tab’s drafts?</h2>
          <p id="draft-signout-description">Unsaved request text, policy text, evidence and decision drafts will be erased. An unconfirmed save may still complete; check your requests and review history when you return.</p>
          <div className="actions"><button type="button" className="secondary" autoFocus disabled={signingOut} onClick={keepEditing}>Keep editing</button><button type="button" disabled={signingOut} onClick={() => void leaveAccount(true)}>{signingOut ? 'Signing out…' : 'Erase drafts and sign out'}</button></div>
        </dialog>}
        {currentTab === 'library' && <>{libraryError && <Notice>{libraryError}</Notice>}{library ? <LibraryView settings={library} profiles={profiles} onCustomize={member?.role === 'admin' ? () => { setTab('settings'); setCustomizeRequest(n => n + 1); } : undefined}/> : !libraryError && <p role="status">Loading library settings…</p>}{!user && <Login client={client}/>}</>}
        {member?.role === 'admin' && user && (currentTab === 'settings' || settingsOwner === user.uid) && <div hidden={currentTab !== 'settings'}><DeferredScreen name="Settings"><Settings key={user.uid} user={user} openLibraryRequest={customizeRequest}/></DeferredScreen></div>}
        {currentTab === 'reviews' && returnRequest && canReview && <button onClick={() => { openRequests('active', returnRequest); setReturnRequest(undefined); }}>Return to request</button>}
        {currentTab === 'reviews' && canReview && user && drafts && <DeferredScreen name="Policy reviews"><Reviews onReturnRequest={id => openRequests('active', id)} key={`${user.uid}-${member.role}`} client={client} user={user} readOnly={member.role === 'viewer'} initialId={reviewTarget.id} openVisit={reviewTarget.visit}/></DeferredScreen>}
        {dashboardVisited && canReview && user && <div hidden={currentTab !== 'dashboard'}><DeferredScreen name="Review dashboard"><ReviewDashboard key={`${user.uid}/${member!.role}`} user={user} onOpen={openReview} active={currentTab === 'dashboard'}/></DeferredScreen></div>}
        {currentTab === 'dashboard' && member && user && <RequestDashboard key={`${user.uid}/${member.role}`} user={user} onOpen={openRequests}/>}
        {currentTab === 'requests' && member && user && <DeferredScreen name="Requests"><RequestPanel onCreateReview={requestId => { openReview(); setReturnRequest(requestId); }} client={client} onOpenReview={(id, requestId) => { openReview(id); setReturnRequest(requestId); }} key={`${user.uid}/${member.role}/${requestTarget.visit}`} user={user} role={member.role} scope={`${client.config.projectId}/${client.config.districtId}`} initialQueue={requestTarget.queue} initialId={requestTarget.id}/></DeferredScreen>}
        {currentTab === 'workspace' && member && user && <DistrictWork key={`${user.uid}-${member.role}`} client={client} user={user} member={member}/>}
        {currentTab === 'people' && member?.role === 'admin' && user && <People client={client} user={user}/>}
        <footer>PrivacyPal Community <span>District-owned tools. Informed decisions.</span></footer>
      </main></div></div>;
  return drafts ? <DraftProvider store={drafts}>{content}</DraftProvider> : content;
}

function Login({ client }: { client: Client }) {
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = new FormData(e.currentTarget); setBusy(true); setError('');
    try { await signInWithEmailAndPassword(client.auth, String(form.get('email')).trim(), String(form.get('password'))); }
    catch { setError('Could not sign in. Check your local account credentials and that the emulators are running.'); }
    finally { setBusy(false); }
  }
  return <section className="panel login-panel"><div><p className="eyebrow">FOR YOUR DISTRICT TEAM</p><h2>A workspace for thoughtful review.</h2><p>Sign in to request tools, review records, or manage your team’s access.</p><p className="subtle">Use a local account created by the operator. No real district account is needed.</p></div><form onSubmit={e => { void submit(e); }}><label>Email<input name="email" type="email" required autoComplete="username"/></label><label>Password<input name="password" type="password" required autoComplete="current-password"/></label>{error && <Notice>{error}</Notice>}<button disabled={busy}>{busy ? 'Signing in…' : 'Sign in to workspace →'}</button></form></section>;
}

function People({ user }: { client: Client; user: User }) {
  const [members, setMembers] = useState<Member[]>([]); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  const refresh = async () => setMembers(await api<Member[]>('/api/members', user));
  useEffect(() => { void refresh().catch(e => setNotice(message(e))); }, [user]);
  async function change(email: string, role: Role, active: boolean) {
    setBusy(true); setNotice('');
    try { await api('/api/members', user, { email, role, active }); await refresh(); setNotice('Membership saved. Permissions apply immediately.'); }
    catch (e) { setNotice(message(e)); }
    finally { setBusy(false); }
  }
  return <><div className="panel"><h2>Add a team member</h2><p>Create their local sign-in with <code>npm run local:user -- --email person@your-domain.example</code>, then assign a role here.</p><form className="member-form" onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); void change(String(data.get('email')), data.get('role') as Role, true); }}><label>Email<input name="email" type="email" required/></label><label>Role<select name="role" defaultValue="staff">{roles.map(role => <option key={role} value={role}>{roleLabels[role]}</option>)}</select></label><button disabled={busy}>Add member</button></form>{notice && <Notice>{notice}</Notice>}</div>
      <div className="panel"><h2>District team <span className="count">{members.length}</span></h2><div className="table-wrap"><table><thead><tr><th>Person</th><th>Role</th><th>Status</th><th>Access</th></tr></thead><tbody>{members.map(m => <tr key={m.uid}><td>{m.email}{m.protected && <small>Initial administrator · protected</small>}</td><td><select aria-label={`Role for ${m.email}`} disabled={busy || m.protected || m.uid === user.uid} value={m.role} onChange={e => { void change(m.email, e.target.value as Role, m.active); }}>{roles.map(role => <option key={role} value={role}>{roleLabels[role]}</option>)}</select></td><td>{m.active ? 'Active' : 'Revoked'}</td><td><button className="secondary" disabled={busy || m.protected || m.uid === user.uid} onClick={() => { void change(m.email, m.role, !m.active); }}>{m.active ? 'Revoke' : 'Restore'}</button></td></tr>)}</tbody></table></div></div>
      <div className="role-grid">{([['Staff', 'Browse the staff catalogue and submit personal requests.'], ['Read-only reviewer', 'Also read internal tool records. No editing or access management.'], ['Reviewer', 'Edit internal tool records and read district requests.'], ['Administrator', 'Manage membership and read private district settings.']] as const).map(([title, detail]) => <div key={title}><h3>{title}</h3><p>{detail}</p></div>)}</div></>;
}

function DistrictWork({ client, user, member }: { client: Client; user: User; member: Member }) {
  const [staffProfiles, setStaffProfiles] = useState<LibraryProfile[]>([]);
  const [staffSearch, setStaffSearch] = useState('');
  const [tools, setTools] = useState<Tool[]>([]); const [notice, setNotice] = useState('');
  const base = `districts/${client.config.districtId}`;
  const canReview = ['admin', 'reviewer'].includes(member.role);
  useEffect(() => {
    const stopStaff = onSnapshot(collection(client.db, `${base}/staffTools`), snap => setStaffProfiles(snap.docs.map(d => ({ id: d.id, ...d.data() } as LibraryProfile))), () => { setStaffProfiles([]); setNotice('Staff catalogue could not be loaded.'); });
    const stopTools = member.role !== 'staff' ? onSnapshot(collection(client.db, `${base}/tools`), snap => setTools(snap.docs.map(d => ({ id: d.id, ...d.data() } as Tool))), () => { setTools([]); setNotice('Internal tool access is unavailable.'); }) : () => {};
    return () => { stopTools(); stopStaff(); };
  }, [client, base, user.uid, member.role, canReview]);
  return <><section className="panel"><h2>Staff catalogue</h2><p>Check permitted use, grade scope and conditions before choosing a resource.</p><label>Search staff resources<input type="search" value={staffSearch} onChange={e => setStaffSearch(e.target.value)}/></label><div className="catalogue">{staffProfiles.filter(p => `${p.name} ${p.category}`.toLowerCase().includes(staffSearch.toLowerCase())).map(p => <article className="tool-card" key={p.id}><h3>{p.name}</h3><ServiceNotice profile={p} staff/></article>)}</div>{!staffProfiles.length && <p>No published staff resources yet.</p>}</section>
      {member.role !== 'staff' && <div className="panel"><h2>Internal tool records</h2><p>Reviewer notes stay inside your district workspace.</p>{tools.map(tool => <ToolEditor key={tool.id} tool={tool} canEdit={canReview} onSave={async notes => { await updateDoc(doc(client.db, `${base}/tools/${tool.id}`), { notes, updatedAt: serverTimestamp(), updatedBy: user.uid }); }}/>)}</div>}
    </>;
}
function ToolEditor({ tool, canEdit, onSave }: { tool: Tool; canEdit: boolean; onSave: (notes: string) => Promise<void> }) {
  const [notes, setNotes] = useState(tool.notes); const [status, setStatus] = useState(''); const [busy, setBusy] = useState(false);
  return <form className="tool-editor" onSubmit={e => { e.preventDefault(); setBusy(true); void onSave(notes).then(() => setStatus('Saved.')).catch(() => setStatus('Could not save. Check your permissions.')).finally(() => setBusy(false)); }}><h3>{tool.name}</h3><label>Internal notes<textarea readOnly={!canEdit} value={notes} onChange={e => setNotes(e.target.value)} maxLength={5000} rows={2}/></label>{canEdit && <button className="secondary" disabled={busy}>Save notes</button>}<span role="status">{status}</span></form>;
}
