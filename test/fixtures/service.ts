import { emptyService, type ServiceValues } from '../../shared/service.ts';
export const serviceValues: ServiceValues = {
  ...emptyService(), tier: 'Tier 2: Site/Department Approved', support: 'Site/Department Support',
  policyUrl: 'https://cedar.example/fictional-policy', ageGuidance: 'Teacher-guided use in grades 6–8.',
  educationVersion: 'yes', educationNotes: 'Fictional education workspace; personal accounts are outside this review.', communication: 'no',
  dpaStatus: 'recorded', dpaReference: 'Synthetic agreement CEDAR-1', dpaSigned: '2026-01-01', dpaExpires: '2099-01-01', dpaScope: 'Fictional middle-school pilot only.',
  rostering: 'manual', sso: 'no', rosteringNotes: 'Synthetic classroom codes; no external integration.',
  grades: '6–8', curriculum: 'Science', dataUse: 'student_data', dataCategories: 'Names; classroom activity',
  approvedWhen: 'Use the education workspace with teacher supervision and classroom codes.',
  permissionWhen: 'Any optional personal account requires district review and parent permission first.', alternative: 'Use the equivalent paper activity.',
  governance: 'Synthetic department sponsor confirms scope and curriculum alignment.',
};
