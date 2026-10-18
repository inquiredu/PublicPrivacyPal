import { candidate } from './candidate.ts';
import { measureFor, requestFor, type LabCase, type LabOutput, type Status, type State } from './engine.ts';

// Authored synthetic policy excerpts and PROVISIONAL interpretations. They are not model runs.
// Entries follow the explicitly named requirement order checked in the unit suite.
const examples: Record<string, { ids: string[]; positive: string[]; limited: string[]; adverse: string[] }> = {
  mon_001: { ids: ['sale'],
    positive: ['We do not sell student information for money or other consideration; a corporate transfer is permitted only if equivalent protections continue.'],
    limited: ['We do not sell student information for money.'],
    adverse: ['We may sell student information to commercial data brokers.'] },
  gov_001: { ids: ['continuity', 'notice', 'choice'],
    positive: ['Equivalent student-data protections survive mergers, acquisitions and bankruptcy transfers.', 'Schools receive notice before any transfer.', 'Schools can have their data deleted before any transfer.'],
    limited: ['Equivalent student-data protections survive mergers, acquisitions and bankruptcy transfers.', 'Schools receive notice of transfers.', 'Schools can have their data deleted before any transfer.'],
    adverse: ['A business purchaser may discard our student-data protections.', 'Schools receive notice before any transfer.', 'Schools can have their data deleted before any transfer.'] },
  do_003: { ids: ['active', 'copies'],
    positive: ['On an authorized deletion request we delete all active student personal records.', 'Every identifiable backup and retained copy is also deleted as part of that deletion, with no identifiable data retained.'],
    limited: ['On an authorized deletion request we delete all active student personal records.', 'Identifiable backup copies remain for 18 months after deletion and are then destroyed.'],
    adverse: ['On an authorized deletion request we delete all active student personal records.', 'We keep identifiable backup copies indefinitely.'] },
  do_005: { ids: ['authority', 'route'],
    positive: ['Schools are authorized to request deletion of their student data.', 'A school administrator submits deletion requests using Settings > Delete student data.'],
    limited: ['Schools are authorized to request deletion of their student data.', 'Contact us to make a deletion request.'],
    adverse: ['Schools are expressly prohibited from requesting deletion of student data.', 'No school deletion request route is available.'] },
  dr_003: { ids: ['trigger', 'deadline', 'completion'],
    positive: ['Agreement termination automatically triggers destruction of student data without a separate request.', 'Destruction is completed within 30 days after termination.', 'All student personal data, including identifiable backups and copies, is destroyed.'],
    limited: ['Agreement termination automatically triggers destruction of student data without a separate request.', 'Destruction is completed promptly after termination.', 'All student personal data, including identifiable backups and copies, is destroyed.'],
    adverse: ['After termination we destroy data only if the school sends a separate deletion request.', 'Destruction is completed within 30 days after the request.', 'All student personal data, including identifiable backups and copies, is destroyed.'] },
  sec_002: { ids: ['transit'],
    positive: ['All student personal data in transit uses only TLS 1.3.'],
    limited: ['We use SSL encryption to protect student data in transit.'],
    adverse: ['Student personal data connections may use TLS 1.0.'] },
  sec_003: { ids: ['coverage', 'algorithm'],
    positive: ['All stored student personal data, including backups, is encrypted.', 'At-rest encryption uses AES-256.'],
    limited: ['All stored student personal data, including backups, is encrypted.', 'Our at-rest encryption uses industry-standard methods.'],
    adverse: ['Student personal data and backups are stored unencrypted.', 'We use no at-rest encryption algorithm.'] },
  mon_002: { ids: ['behavioral'],
    positive: ['Student accounts receive only contextual ads based on lesson content, never on student personal information, behavior or profiles.'],
    limited: ['Some uses of student information for personalized advertising are restricted.'],
    adverse: ['Student browsing behavior and personal profiles are used to select personalized ads.'] },
  mon_004: { ids: ['tracking'],
    positive: ['We do not track or profile students across other services or websites.'],
    limited: ['We track student activity across school-authorized learning sites only to synchronize lesson progress, with commercial use prohibited.'],
    adverse: ['We track students across unrelated websites for commercial profiling.'] },
  tp_001: { ids: ['names', 'purposes'],
    positive: ['Our complete list of student-data recipients is Cedar Hosting and Pine Mail.', 'Cedar Hosting stores school records; Pine Mail delivers school notices.'],
    limited: ['Our student-data recipients include hosting companies and email providers.', 'Recipients store school records and deliver school notices.'],
    adverse: ['We expressly refuse to identify our student-data recipients.', 'We expressly refuse to disclose recipient purposes.'] },
  tp_006: { ids: ['identification', 'contract', 'notice'],
    positive: ['Cedar Hosting is our only subprocessor.', 'Every subprocessor is contractually required to provide equivalent student-data protections.', 'Schools receive notice before any subprocessor changes.'],
    limited: ['Cedar Hosting is our only subprocessor.', 'Every subprocessor is contractually required to provide equivalent student-data protections.', 'Schools receive notice of subprocessor changes.'],
    adverse: ['Cedar Hosting is our only subprocessor.', 'Subprocessors may handle student data without equivalent contractual protections.', 'Schools receive notice before any subprocessor changes.'] },
  child_002: { ids: ['route', 'boundary'],
    positive: ['Before collecting information from children under 13, we obtain school authorization for school educational use only.', 'School-authorized collection is exclusively for school educational use; parents can review information through the school administrator.'],
    limited: ['We comply with COPPA and obtain consent.', 'School-authorized collection is exclusively for school educational use; parents can review information through the school administrator.'],
    adverse: ['We collect information from children under 13 without prior parent or school authorization.', 'School-authorized collection is exclusively for school educational use; parents can review information through the school administrator.'] },
  ed_002: { ids: ['commitment', 'role'],
    positive: ['We commit to FERPA obligations for school data.', 'For these school accounts we act as a school official under school direction.'],
    limited: ['FERPA is a federal education privacy law.', 'For these school accounts we act as a school official under school direction.'],
    adverse: ['We disclaim FERPA obligations for school data.', 'For these school accounts we act as a school official under school direction.'] },
  ed_003: { ids: ['purpose'],
    positive: ['We use student personal information only to provide and improve the contracted educational service, with unrelated commercial reuse prohibited.'],
    limited: ['We primarily use student information for education and may also use it to improve our products.'],
    adverse: ['We use student personal information to develop unrelated commercial products.'] },
};
const scope = 'United States; school-managed K-12 student accounts and student personal information.';
const prefix = 'These terms apply to United States school-managed K-12 student accounts and student personal information.\n';
const limitedStatuses: Record<string, Status[]> = {
  mon_001: ['limited'], gov_001: ['established', 'limited', 'established'], do_003: ['established', 'limited'],
  do_005: ['established', 'limited'], dr_003: ['established', 'limited', 'established'], sec_002: ['limited'],
  sec_003: ['established', 'limited'], mon_002: ['limited'], mon_004: ['limited'], tp_001: ['limited', 'limited'],
  tp_006: ['established', 'established', 'limited'], child_002: ['limited', 'established'], ed_002: ['limited', 'established'], ed_003: ['limited'],
};
const adverseStatuses: Record<string, Status[]> = {
  mon_001: ['opposed'], gov_001: ['opposed', 'established', 'established'], do_003: ['established', 'opposed'],
  do_005: ['opposed', 'opposed'], dr_003: ['opposed', 'limited', 'established'], sec_002: ['opposed'],
  sec_003: ['opposed', 'opposed'], mon_002: ['opposed'], mon_004: ['opposed'], tp_001: ['opposed', 'opposed'],
  tp_006: ['established', 'opposed', 'established'], child_002: ['opposed', 'established'], ed_002: ['opposed', 'established'], ed_003: ['opposed'],
};
function make(id: string, category: string, texts: string[], statuses: Status[], state: State, extra = ''): LabCase {
  const ids = examples[id].ids;
  if (ids.join() !== measureFor(id).requirements.map(r => r.id).join() || texts.length !== ids.length || statuses.length !== ids.length) throw new Error('Fixture requirement order mismatch.');
  return { id: `${id}-${category}`, measureId: id, category, scope,
    source: prefix + texts.filter(Boolean).join('\n') + extra,
    coverage: Object.fromEntries(ids.map((id, i) => [id, statuses[i] === 'unavailable' ? 'missing_dependency' : 'complete'])),
    expected: { state, scopeStatus: category === 'scope' ? 'unresolved' : 'matched',
      requirements: Object.fromEntries(ids.map((id, i) => [id, { status: statuses[i], evidence: texts[i] ? [texts[i]] : [] }])) } };
}
export const labCases: LabCase[] = candidate.measures.flatMap(m => {
  const e = examples[m.id], all = (s: Status) => e.ids.map(() => s);
  const missingTexts = [...e.positive]; missingTexts[missingTexts.length - 1] = '';
  const missingStatus = all('established'); missingStatus[missingStatus.length - 1] = 'unavailable';
  const scoped = make(m.id, 'scope', e.positive, all('established'), 'unresolved');
  scoped.source = 'The following clauses apply to some accounts. Whether they cover school-managed accounts is unspecified.\n' + e.positive.join('\n');
  return [make(m.id, 'positive', e.positive, all('established'), 'supported'),
    make(m.id, 'limited', e.limited, limitedStatuses[m.id], 'partial'),
    make(m.id, 'adverse', e.adverse, adverseStatuses[m.id], 'contradicted'),
    make(m.id, 'silence', e.ids.map(() => ''), all('not_stated'), 'not_addressed', 'Our service offers arithmetic lessons.'),
    make(m.id, 'missing', missingTexts, missingStatus, 'unresolved', '\nThe remaining terms are in Annex A, which was not supplied.'), scoped];
});

// Deliberate cross-concept contrasts, beyond the regular boundary matrix.
labCases.push(
  make('gov_001', 'post-transfer-notice', [examples.gov_001.positive[0], 'Schools receive notice only after transfer.', 'Schools may request deletion only after transfer.'], ['established', 'opposed', 'opposed'], 'partial'),
  make('sec_003', 'transit-is-not-storage', ['', ''], ['not_stated', 'not_stated'], 'not_addressed', 'All student traffic uses TLS 1.3.'),
  make('mon_004', 'ads-are-not-tracking', [''], ['not_stated'], 'not_addressed', 'We prohibit all advertising to students.'),
  make('mon_002', 'separate-adult-accounts', [examples.mon_002.positive[0]], ['established'], 'supported', '\nSeparate independent adult accounts receive behavioral ads based on adult browsing.'),
  make('do_005', 'parent-school-route', examples.do_005.positive, ['established', 'established'], 'supported', '\nParents must send their deletion requests to the school administrator.'),
  make('ed_002', 'claim-is-not-contract', examples.ed_002.positive, ['established', 'established'], 'supported', '\nThis policy is not a signed district agreement.'),
);
const conflict = make('mon_004', 'conflict', ['We prohibit all cross-site student tracking. However, we also allow student tracking across unrelated sites for commercial profiling.'], ['ambiguous'], 'unresolved');
labCases.push(conflict);
// Do not reveal the expected outcome through exported case identifiers.
labCases.forEach((c, i) => { c.id = `rubric-${String(i + 1).padStart(3, '0')}`; });

/** Labeled reference output only: never present it as model-generated or benchmark accuracy. */
export function referenceOutput(c: LabCase): LabOutput {
  return { requestId: requestFor(c).requestId, scopeStatus: c.expected.scopeStatus,
    scopeQuestion: c.expected.scopeStatus === 'unresolved' ? 'Do these clauses apply to the evaluated school accounts?' : '',
    requirements: Object.entries(c.expected.requirements).map(([id, e]) => ({ id, status: e.status,
      rationale: 'Authored provisional fixture interpretation; requires owner adjudication.',
      question: ['unavailable', 'ambiguous'].includes(e.status) ? 'Supply the applicable terms or reconcile these passages.' : '',
      quotes: e.evidence.map(quote => ({ quote, role: e.status === 'opposed' ? 'opposition' : e.status === 'limited' ? 'limitation' : e.status === 'ambiguous' ? 'conflict' : 'support' })),
    })) };
}
