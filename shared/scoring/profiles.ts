/** Authored community candidates, not a legal or district-approved rubric. Versioned as a unit. */
export const criteria = [
  { id: 'collection', label: 'Data collected is identified', weight: 2, evidence: 'Names the categories of student information collected.', partial: 'Identifies some categories but leaves the scope open-ended.', failure: 'Explicitly declines to identify what is collected.' },
  { id: 'purpose', label: 'Use is limited to providing the service', weight: 2, evidence: 'Limits use of student information to delivering the learning service.', partial: 'Describes service purposes but allows unspecified additional uses.', failure: 'Permits unrelated commercial use of student information.' },
  { id: 'sale', label: 'Sale of student information is prohibited', weight: 2, evidence: 'Explicitly prohibits selling student information.', partial: 'Prohibits only some sales or leaves exceptions unspecified.', failure: 'Explicitly permits sale of student information.' },
  { id: 'deletion', label: 'Schools can request deletion', weight: 2, evidence: 'States that a school can request deletion of student information.', partial: 'Offers deletion with unclear scope or request authority.', failure: 'Explicitly refuses school deletion requests.' },
  { id: 'security', label: 'Security safeguards are described', weight: 2, evidence: 'Describes concrete safeguards for stored and transmitted information and access.', partial: 'Provides only a general security promise or incomplete safeguards.', failure: 'Explicitly disclaims safeguards for student information.' },
  { id: 'sharing', label: 'Service providers have restricted access', weight: 2, evidence: 'Restricts service-provider access to delivering the service.', partial: 'Mentions restrictions without defining permitted access or purposes.', failure: 'Allows providers to use student information for unrelated purposes.' },
  { id: 'contact', label: 'A privacy contact is provided', weight: 1, evidence: 'Provides an actionable contact for privacy questions.', partial: 'Refers to support without an actionable privacy contact.', failure: 'Explicitly states that privacy inquiries are not accepted.' },
  { id: 'changes', label: 'Schools receive notice of policy changes', weight: 1, evidence: 'Commits to notifying schools before material privacy changes take effect.', partial: 'Promises notice without specifying timing or who receives it.', failure: 'Explicitly allows material changes without notice to schools.' },
] as const;

export const profileVersions = ['community-evidence-v1', 'community-demo-v1'] as const;
export type ProfileVersion = typeof profileVersions[number];
export const DEFAULT_PROFILE: ProfileVersion = 'community-evidence-v1';
export const profiles = {
  'community-evidence-v1': {
    version: 'community-evidence-v1', name: 'Evidence-first candidate', engineVersion: 'evidence-weighted-v1',
    status: 'Candidate for district review',
    explanation: 'Missing evidence earns no credit. Partial evidence earns 50%. An explicit contradiction also earns zero, but remains a distinct finding.',
  },
  'community-demo-v1': {
    version: 'community-demo-v1', name: 'Inherited demonstration', engineVersion: 'upstream-weighted-v1',
    status: 'Preserved for comparison',
    explanation: 'The inherited formula gives missing evidence 60% credit and partial evidence 50%. Earlier results retain this formula.',
  },
} as const;
export function getProfile(version: string) {
  if (!Object.hasOwn(profiles, version)) throw new Error('Unknown scoring profile.');
  return profiles[version as ProfileVersion];
}
