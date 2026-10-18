// Proposed policy choices, intentionally outside application settings and scoring.
export type Requirement = { id: string; proposition: string; limited: string; opposed: string; decisive: boolean };
export type CandidateMeasure = { id: string; label: string; decision: string; requirements: Requirement[] };
const r = (id: string, proposition: string, limited: string, opposed: string, decisive = false): Requirement => ({ id, proposition, limited, opposed, decisive });
export const candidate = {
  version: 'pef-precision-proposal-v1', status: 'proposed-not-adopted', aggregation: 'requirements-proposal-v1',
  base: 'pef-2.0-snapshot-v1',
  scope: 'Policy assertions about school-managed K-12 student personal information, within the stated product and jurisdiction. Independent accounts are separate. This is not verification of practice, legal compliance, or an executed agreement.',
  measures: [
    { id: 'mon_001', label: 'Sale prohibition', decision: 'Permit a corporate transfer only with continuing equivalent protections; test notice and deletion choice under gov_001. Any explicit commercial sale defeats this measure.', requirements: [
      r('sale', 'Prohibits sale of student personal information for money or other commercial consideration, including corporate transfers unless equivalent protections continue.', 'Prohibits monetary sale but leaves other consideration or transfer safeguards unspecified.', 'Permits commercial sale or expressly permits corporate transfer without continuing protections.', true),
    ] },
    { id: 'gov_001', label: 'Corporate transfer safeguards', decision: 'Require continuity, advance notice and a pre-transfer deletion opportunity. Missing ancillary safeguards is partial; explicit loss of protection is decisive.', requirements: [
      r('continuity', 'Equivalent data protections continue through merger, acquisition and bankruptcy transfers.', 'Only some transactions or protections are covered.', 'Transfers may occur without continuing protections.', true),
      r('notice', 'The school receives notice before a transfer.', 'Notice is promised but its timing is unspecified.', 'Notice occurs only after transfer, or no notice will be provided.'),
      r('choice', 'The school can obtain deletion before transfer.', 'A deletion choice is conditional or its timing is unspecified.', 'Deletion is unavailable until after transfer or is expressly unavailable.'),
    ] },
    { id: 'do_003', label: 'Complete deletion', decision: 'Retain a strict all-copy goal. Bounded backups or anonymization are partial; indefinite identifiable retention is a decisive failure. Do not infer a deletion right from a request channel.', requirements: [
      r('active', 'Commits to deleting all active student personal records on an authorized deletion request.', 'Only some active records are deleted, or anonymization substitutes for deletion.', 'No active student records are deleted.', true),
      r('copies', 'Deletes identifiable backups and retained copies as part of the deletion process, with no retained identifiable exception.', 'Backups or identifiable exceptions remain for a stated finite period; or backup handling is discussed without a clear limit.', 'Identifiable copies are retained indefinitely.', true),
    ] },
    { id: 'do_005', label: 'School deletion request route', decision: 'For school-managed accounts, require school authority and an actionable route. Parent requests routed through the school do not fail this measure; independent-account rights require a separate scope.', requirements: [
      r('authority', 'The school is authorized to request deletion of its student personal information.', 'School authority is subject to an unexplained approval condition.', 'The school is expressly prohibited from requesting deletion.', true),
      r('route', 'Describes a usable school deletion request route, such as an account control or supplied contact.', 'Mentions requests but gives no actionable route, or the contact capture is obscured.', 'States that no school deletion request route is available.'),
    ] },
    { id: 'dr_003', label: 'Disposition at termination', decision: 'Require termination itself to trigger disposition, a deadline measured from termination, and all-copy completion. A separate request is an explicit trigger failure, even if request-based deletion is supported elsewhere.', requirements: [
      r('trigger', 'Termination itself triggers return or destruction of student data without a separate deletion request.', 'Termination disposition is promised but the trigger is unclear.', 'Disposition requires a separate request after termination, or termination never triggers disposition.', true),
      r('deadline', 'States a numeric disposition deadline measured from termination.', 'Uses an unquantified deadline or a clock starting only from a later request.', 'Expressly imposes no disposition deadline.'),
      r('completion', 'All student personal data, including identifiable copies, is returned or destroyed.', 'Only some copies are covered or identifiable backups remain for a finite period.', 'Identifiable student data is retained indefinitely.', true),
    ] },
    { id: 'sec_002', label: 'Transit encryption assertion', decision: 'For this candidate only, name TLS 1.2/1.3 as the accepted set. Generic encryption or SSL wording is partial; an explicitly permitted older protocol is a failure. A future equivalent needs a versioned owner decision.', requirements: [
      r('transit', 'All student personal data in transit uses TLS 1.2 or TLS 1.3, with no permitted older protocol.', 'Transit encryption is stated but protocol/version or full coverage is unspecified.', 'Allows unencrypted student traffic or explicitly permits SSLv2, SSLv3, TLS 1.0 or TLS 1.1.', true),
    ] },
    { id: 'sec_003', label: 'Storage encryption assertion', decision: 'Separate encryption coverage from a named algorithm. Record the algorithm without inferring that it verifies industry-standard practice or implementation.', requirements: [
      r('coverage', 'All stored student personal data, including backups, is encrypted.', 'Encryption covers only some stored data or backup coverage is unspecified.', 'Student personal data is expressly stored unencrypted.', true),
      r('algorithm', 'Names the at-rest encryption algorithm or technical standard.', 'Uses a generic security or industry-standard description without naming an algorithm.', 'Expressly uses no at-rest encryption algorithm.'),
    ] },
    { id: 'mon_002', label: 'Behavioral advertising', decision: 'Contextual advertising without student profiles can satisfy this particular prohibition. Advertising based on student behavior fails. Track cross-site activity separately.', requirements: [
      r('behavioral', 'Prohibits advertising based on student personal information, behavior or profiles; contextual ads without these inputs are allowed.', 'Restricts some behavioral advertising but leaves inputs or recipients unspecified.', 'Permits ads based on student personal information, behavior or profiles.', true),
    ] },
    { id: 'mon_004', label: 'Cross-context tracking', decision: 'Treat explicitly bounded school-authorized educational tracking as partial; commercial or unrestricted cross-context tracking fails. An advertising ban alone does not establish this requirement.', requirements: [
      r('tracking', 'Prohibits tracking or profiling student activity across other services or sites.', 'Allows only specified school-authorized educational cross-context tracking, with commercial use prohibited.', 'Permits commercial or unrestricted student cross-context tracking.', true),
    ] },
    { id: 'tp_001', label: 'Recipient identification', decision: 'Require named recipients and their purposes. A referenced but missing list is unavailable evidence, not a proven omission.', requirements: [
      r('names', 'Supplies the complete named list of recipients of student personal information.', 'Supplies some names or only recipient categories.', 'Explicitly refuses to identify any recipients.'),
      r('purposes', 'States the purpose for each recipient of student personal information.', 'Gives only general purposes or covers only some recipients.', 'Explicitly refuses to disclose recipient purposes.'),
    ] },
    { id: 'tp_006', label: 'Subprocessor governance', decision: 'Require identification, equivalent contractual protections and prior notice. Loss of contractual protections is decisive; missing notice with known protections is partial.', requirements: [
      r('identification', 'Supplies a complete named subprocessor list.', 'Lists only some subprocessors or categories.', 'Explicitly refuses to identify subprocessors.'),
      r('contract', 'Requires every subprocessor by contract to maintain equivalent student-data protections.', 'Describes expectations without an explicit contractual requirement or full coverage.', 'Allows subprocessors without equivalent contractual protections.', true),
      r('notice', 'Schools receive notice before subprocessor changes.', 'Notice is promised with no timing.', 'Notice is only after changes or is expressly withheld.'),
    ] },
    { id: 'child_002', label: 'Disclosed consent mechanism', decision: 'Replace inferred legal sufficiency with observable policy assertions. Separate parental consent and school authorization from FERPA roles; documentation availability remains a review question.', requirements: [
      r('route', 'Describes either parental consent with a stated verification step before under-13 collection, or school authorization before collection for school educational use only.', 'Claims consent or COPPA compliance without a verification/authorization mechanism or clear timing.', 'Expressly collects under-13 information without prior parent or school authorization.', true),
      r('boundary', 'Limits school-authorized student collection to school educational use and describes the parent information/review route.', 'States only the educational-use boundary or only the parent review route.', 'Uses school authorization for unrelated commercial collection or denies a parent information/review route.', true),
    ] },
    { id: 'ed_002', label: 'FERPA policy assertions', decision: 'Measure a FERPA commitment and asserted role separately. Neither proves legal eligibility, direct control, a signed agreement, or district authorization.', requirements: [
      r('commitment', 'Explicitly states a commitment to FERPA obligations for school data.', 'Mentions FERPA without a commitment.', 'Explicitly disclaims FERPA obligations for school data.', true),
      r('role', 'States that the service acts as a school official under school direction for the evaluated school scope.', 'Describes a conditional offered role whose applicability to the evaluated school scope is unresolved.', 'Disclaims any school-directed role for the evaluated school scope.'),
    ] },
    { id: 'ed_003', label: 'Educational use limitation', decision: 'Permit improvement of the contracted educational service; unrelated commercial product development is a failure. A broad improvement clause without boundaries is partial.', requirements: [
      r('purpose', 'Limits student personal information to providing and improving the contracted educational service, excluding unrelated commercial reuse.', 'States a primary educational purpose but leaves secondary uses or improvement boundaries unspecified.', 'Permits unrelated commercial reuse of student personal information.', true),
    ] },
  ] satisfies CandidateMeasure[],
} as const;
