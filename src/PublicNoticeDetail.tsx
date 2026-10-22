import { publicPolicyUrl } from '../shared/public-policy';
import { useEffect, useId, useRef } from 'react';
import type { LibraryProfile } from '../shared/settings';

/** Public projection only. Never fetch the internal review to fill missing notice fields. */
export function PublicNoticeDetail({ profile: p, contactEmail, onClose }: { profile: LibraryProfile; contactEmail: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  const policyUrl = publicPolicyUrl(p.policyUrl);
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const element = dialog.current!;
    element.showModal();
    return () => { element.close(); if (opener?.isConnected) opener.focus(); };
  }, []);
  return <dialog ref={dialog} className="public-notice-dialog" aria-labelledby={heading} onCancel={e => { e.preventDefault(); onClose(); }}>
    <header><h2 id={heading}>{p.name}</h2><button type="button" className="secondary" aria-label="Close notice" autoFocus onClick={onClose}>×</button></header>
    <div className="public-notice-body">
      {p.tierLevel && <p className="library-tier">{p.tierLevel}</p>}
      {p.outcome && <p>{p.outcome === 'conditional' ? 'District approval is conditional. Follow the recorded conditions below.' : p.outcome === 'approved' ? 'District approval is recorded for the use described below.' : 'See the district’s recorded guidance below.'}</p>}
      <section><h3>Who uses this</h3><p>{p.grades || 'Grade scope has not been provided in this public notice.'}</p></section>
      <section><h3>Student data involved</h3><p>{p.dataUse === 'student_data' ? p.dataCategories || 'Student data is involved; specific categories have not been provided.' : p.dataUse === 'no_student_data' ? 'No student data in the recorded use conditions.' : 'Student-data involvement has not been confirmed in this public notice.'}</p></section>
      <section><h3>Summary</h3><p>{p.summary}</p></section>
      {p.conditions && <section><h3>Decision conditions</h3><p>{p.conditions}</p></section>}
      {p.approvedWhen && <section><h3>Permitted use</h3><p>{p.approvedWhen}</p></section>}
      {p.permissionWhen && <section><h3>Parent permission</h3><p>{p.permissionWhen}</p></section>}
      {p.alternative && <section><h3>Alternative activity</h3><p>{p.alternative}</p></section>}
      {policyUrl && <section><h3>The vendor’s privacy policy</h3><a href={policyUrl} target="_blank" rel="noopener noreferrer">Read the full policy ↗<span className="sr-only"> (opens in a new tab)</span></a><p className="subtle">Review the vendor’s policy for complete terms.</p></section>}
      {p.reviewedAt && <p className="subtle">Decision recorded {new Date(p.reviewedAt).toLocaleDateString()}</p>}
      <footer><p>For questions about this tool or its vendor policy and agreement, contact {contactEmail ? <a href={`mailto:${contactEmail}`}>{contactEmail}</a> : 'your district office'}.</p></footer>
    </div>
  </dialog>;
}
