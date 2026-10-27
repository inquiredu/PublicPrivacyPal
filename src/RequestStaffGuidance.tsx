import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import type { Client } from './firebase';
import type { LibraryProfile } from '../shared/settings';
import { ServiceNotice } from './ServiceNotice';

/** Reads only the already-published staff projection, never a private review. */
export function RequestStaffGuidance({ client, reviewId }: { client: Client; reviewId: string }) {
  const [profile, setProfile] = useState<LibraryProfile>();
  const [state, setState] = useState<'loading' | 'available' | 'absent' | 'error'>('loading');
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    setProfile(undefined); setState('loading'); setExpanded(false);
    return onSnapshot(doc(client.db, `districts/${client.config.districtId}/staffTools/review-${reviewId}`), { includeMetadataChanges: true }, snap => {
      if (snap.metadata.fromCache) { setProfile(undefined); setState('error'); return; }
      if (!snap.exists()) { setProfile(undefined); setState('absent'); return; }
      setProfile({ ...snap.data(), id: snap.id } as LibraryProfile); setState('available');
    }, () => { setProfile(undefined); setState('error'); });
  }, [client, reviewId]);
  return <section aria-label="Current staff guidance"><h4>Current staff guidance</h4>
    <p>The recorded request outcome is historical. Only currently published staff guidance describes permitted use; a request link is not approval.</p>
    {state === 'loading' && <p role="status">Checking current staff guidance…</p>}
    {state === 'error' && <p role="alert">Current staff guidance cannot be verified. Do not rely on a previous copy. Reconnect or reopen this request to retry.</p>}
    {state === 'absent' && <p role="status">No staff guidance is currently published for this review. It may not yet be published or may have been withdrawn. Ask your district reviewer about permitted use.</p>}
    {state === 'available' && profile && <><button aria-expanded={expanded} onClick={() => setExpanded(v => !v)}>{expanded ? 'Hide' : 'View'} current staff guidance for {profile.name}</button>{expanded && <div><h4>{profile.name}</h4><ServiceNotice profile={profile} staff/></div>}</>}
  </section>;
}
