import type { LibraryProfile } from '../shared/settings';
/** Shared by the actual audience view and its reviewer preview. */
export function ServiceNotice({ profile: p, staff = false, showTier = true }: { profile: LibraryProfile; staff?: boolean; showTier?: boolean }) {
  return <div className="service-notice">
    {showTier && p.tierLevel && <p><strong>{p.tierLevel}</strong></p>}
    <p>{p.summary}</p>
    {p.conditions && <p><strong>Decision conditions: </strong>{p.conditions}</p>}
    {p.approvedWhen && <p><strong>Permitted use: </strong>{p.approvedWhen}</p>}
    {p.permissionWhen && <p><strong>Parent permission: </strong>{p.permissionWhen}</p>}
    {p.alternative && <p><strong>Alternative: </strong>{p.alternative}</p>}
    {p.grades && <p><strong>Grades: </strong>{p.grades}</p>}
    {p.dataUse && <p><strong>Student data: </strong>{p.dataUse === 'student_data' ? p.dataCategories || 'Categories not recorded' : p.dataUse === 'no_student_data' ? 'No student data in the recorded use conditions' : 'Not yet confirmed'}</p>}
    {staff && <>{p.support && <p><strong>Support: </strong>{p.support}</p>}{p.ageGuidance && <p><strong>Age guidance: </strong>{p.ageGuidance}</p>}{p.curriculum && <p><strong>Curriculum: </strong>{p.curriculum}</p>}{p.educationNotes && <p><strong>Education version: </strong>{p.educationNotes}</p>}{p.score != null && <p className="subtle">Policy evidence score: {p.score}/100 · {p.evidenceCount}/{p.measureCount} measures cited. This describes policy statements, not permission to use the service.</p>}</>}
    {p.reviewedAt && <small>Decision recorded {new Date(p.reviewedAt).toLocaleDateString()}</small>}
  </div>;
}
