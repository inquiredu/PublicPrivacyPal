import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { candidate } from '../../shared/rubrics/precision-candidate.ts';
import { deriveRequirementReview, requirementFinding, PRECISION_DEFINITION, requirementCitations, type RequirementReview } from '../../shared/requirements.ts';
import { defaultEvaluation, evaluationSettingsSchema, SETTINGS_DEFINITION_VERSION, type EvaluationSettings } from '../../shared/settings.ts';
import { districtContract, practiceContract, digest } from '../../server/evaluation.ts';
import { buildAnalysisRequest, validateSuggestions, LEGACY_PROMPT_VERSION } from '../../server/analysis/contract.ts';
import { recordedPrecisionExample } from '../../server/analysis/offline.ts';
import { suggestedEvidence, suggestionWireOutput, type PrecisionModelOutput } from '../../shared/assistance.ts';
import { evidenceDraftSchema } from '../../shared/drafts.ts';
import { editAnalysis, validateEvidence } from '../../server/evidence.ts';
import { BYTE_LIMITS, bounded } from '../../server/review-storage.ts';
import { ANALYSIS_EXAMPLE } from '../../shared/analysis-example.ts';
import { labCases } from '../../scripts/rubric-lab/cases.ts';
import { RequirementFindings, RequirementEditor } from '../../src/RequirementReview.tsx';

function contract(profile: EvaluationSettings['starterProfile'] = 'pef-precision-v1', engine: 'evidence-weighted-v1' | 'upstream-weighted-v1' = 'evidence-weighted-v1') {
  const values = evaluationSettingsSchema.parse({ ...defaultEvaluation(), state: 'Colorado', starterProfile: profile });
  return districtContract({ schemaVersion: 1, revision: 1, complete: true, values, updatedAt: null, updatedBy: null, definitionVersion: SETTINGS_DEFINITION_VERSION,
    contentHash: createHash('sha256').update(JSON.stringify({ definitionVersion: SETTINGS_DEFINITION_VERSION, values })).digest('hex') }, 1, engine);
}
test('new profile keeps all fifty weights and adds only the 14 approved pilot definitions', () => {
  const old = contract('pef-2.0'), next = contract();
  assert.equal(defaultEvaluation().starterProfile, 'pef-2.0'); assert.equal(next.version, 2); assert.equal(next.definitionVersion, PRECISION_DEFINITION);
  assert.equal(next.criteria.length, 50); assert.deepEqual(next.criteria.map(c => [c.id, c.area, c.weight]), old.criteria.map(c => [c.id, c.area, c.weight]));
  assert.equal(next.criteria.filter(c => c.requirements).length, 14); assert.equal(next.criteria.flatMap(c => c.requirements || []).length, 26);
  for (const c of next.criteria.filter(c => !c.requirements)) assert.deepEqual(c, old.criteria.find(o => o.id === c.id));
  assert.notEqual(next.id, old.id); assert.doesNotThrow(() => bounded('definition', next));
  assert.equal(digest(candidate), 'e8e01a94339fc4c5c8e44009cec4d7c9a878e95941374337691b01986dae3dc3');
});
test('frozen pre-adoption definition and prompt hashes remain exact', () => {
  const practice = practiceContract('community-evidence-v1'), district = contract('pef-2.0');
  assert.equal(practice.id, '1e6bc03f335e5174255ca93a00aa185e34b814c861379d2fae5fcb1dd4e77fb1');
  assert.equal(buildAnalysisRequest(ANALYSIS_EXAMPLE, practice).key, 'e528d5c13b787f3ed7f98c84a8ed172ba28cb9c7ea11763b8b53e0c4f4d7cab2');
  assert.equal(district.id, 'dda7a8909d80144774332e228daf5abd03222a8803cb448864c76b9efad99adb');
  assert.equal(buildAnalysisRequest(ANALYSIS_EXAMPLE, district).key, '0bbeb6b58c4595ca58ae3261ab680ffba7d463eb01e1a1484e00768034fac50e');
  assert.throws(() => buildAnalysisRequest(ANALYSIS_EXAMPLE, contract(), LEGACY_PROMPT_VERSION), /requires/);
});
for (const c of labCases) test(`adopted prompt and human review: ${c.measureId} ${c.category}`, () => {
  const full = contract(), definition = full.criteria.find(m => m.id === c.measureId)!;
  const { id: _, ...narrow } = { ...full, criteria: [definition] }; const adopted = { ...narrow, id: digest(narrow) };
  const request = buildAnalysisRequest(c.source, adopted);
  const citations: PrecisionModelOutput['citations'] = [];
  const requirements = Object.entries(c.expected.requirements).map(([id, e]) => ({ id, status: e.status, rationale: 'Authored provisional boundary interpretation.',
    question: ['ambiguous','unavailable'].includes(e.status) ? 'Supply or clarify the required terms.' : '',
    evidence: e.evidence.map(quote => {
      let q = citations.find(q => q.quote === quote);
      if (!q) { q = { id: `c${citations.length}`, sourceId: request.sourceHash, passageId: request.source.passages.find(p => p.text.includes(quote))!.id, quote }; citations.push(q); }
      return { citationId: q.id, role: e.status === 'opposed' ? 'opposition' as const : e.status === 'limited' ? 'limitation' as const : e.status === 'ambiguous' ? 'conflict' as const : 'support' as const };
    }) }));
  const output: PrecisionModelOutput = { schemaVersion: 'policy-suggestions-v3', sourceStatus: 'usable', citations,
    findings: [{ measureId: c.measureId, rationale: 'Authored provisional interpretation.', scope: c.scope, scopeStatus: c.expected.scopeStatus,
      scopeQuestion: c.expected.scopeStatus === 'unresolved' ? 'Does this apply to the intended school accounts?' : '', requirements }] };
  const validated = validateSuggestions(request, c.source, output), f = validated.findings[0];
  assert.deepEqual(validateSuggestions(request, c.source, suggestionWireOutput(validated)), validated);
  assert.equal(deriveRequirementReview(definition.requirements!, f.requirements!).state, c.expected.state);
  const edit = suggestedEvidence(f, validated)!;
  assert.equal(edit.finding, requirementFinding(c.expected.state));
  const analysis = editAnalysis(c.source, 'community-evidence-v1', null, edit, 'test-version', 'human-reviewer', '2026-10-17', adopted);
  assert.equal(analysis.schemaVersion, 'findings-v4'); assert.equal(analysis.findings[0].finding, edit.finding);
  assert.equal(analysis.score.total === null, c.expected.state === 'unresolved');
  assert.doesNotThrow(() => bounded('finding', analysis.findings[0]));
});
test('v3 mixed full-rubric recordings survive wire storage and conversion with no aggregate authority from the model', () => {
  const adopted = contract(), request = buildAnalysisRequest(ANALYSIS_EXAMPLE, adopted), raw = recordedPrecisionExample(request);
  assert.equal(request.promptVersion, 'evidence-extraction-v3');
  const result = validateSuggestions(request, ANALYSIS_EXAMPLE, raw);
  assert.equal(result.findings.length, 50); assert.equal(result.findings.filter(f => f.requirements).length, 14);
  assert.deepEqual(validateSuggestions(request, ANALYSIS_EXAMPLE, suggestionWireOutput(result)), result);
  const bad = structuredClone(raw); const f = bad.findings.find(f => f.measureId === 'sec_002')!;
  assert.ok('requirements' in f); Object.assign(f, { state: 'supported' });
  assert.throws(() => validateSuggestions(request, ANALYSIS_EXAMPLE, bad));
  const missing = structuredClone(raw); const m = missing.findings.find(f => f.measureId === 'gov_001')!;
  assert.ok('requirements' in m); m.requirements.pop();
  assert.throws(() => validateSuggestions(request, ANALYSIS_EXAMPLE, missing), /every adopted/);
  const incomplete = { ...raw, sourceStatus: 'incomplete' };
  assert.throws(() => validateSuggestions(request, ANALYSIS_EXAMPLE, incomplete), /silence|omission/);
});
test('manual edits cannot bypass aggregate rules, quote integrity or a missing adopted clause', () => {
  const adopted = contract(), request = buildAnalysisRequest(ANALYSIS_EXAMPLE, adopted), result = validateSuggestions(request, ANALYSIS_EXAMPLE, recordedPrecisionExample(request));
  const edit = suggestedEvidence(result.findings.find(f => f.measureId === 'do_003')!, result)!;
  assert.equal(edit.finding, 'partial');
  assert.throws(() => validateEvidence(ANALYSIS_EXAMPLE, { ...edit, finding: 'yes' }, adopted), /deterministic/);
  assert.throws(() => validateEvidence(ANALYSIS_EXAMPLE, { ...edit, requirements: undefined }, adopted), /subrequirements/);
  assert.throws(() => validateEvidence(ANALYSIS_EXAMPLE, edit, contract('pef-2.0')), /no adopted/);
  const tampered = structuredClone(edit); tampered.requirements!.requirements[0].citations[0].end--;
  assert.throws(() => validateEvidence(ANALYSIS_EXAMPLE, tampered, adopted), /match/);
  const duplicate = structuredClone(edit); duplicate.requirements!.requirements[0].citations.push(duplicate.requirements!.requirements[0].citations[0]);
  assert.throws(() => validateEvidence(ANALYSIS_EXAMPLE, duplicate, adopted), /twice/);
});
test('draft schema retains empty in-progress requirement text and complete evidence after reload', () => {
  const adopted = contract(), request = buildAnalysisRequest(ANALYSIS_EXAMPLE, adopted), result = validateSuggestions(request, ANALYSIS_EXAMPLE, recordedPrecisionExample(request));
  const edit = suggestedEvidence(result.findings.find(f => f.measureId === 'sec_003')!, result)!;
  edit.requirements!.requirements[0].rationale = ''; edit.requirements!.scope = '';
  const draft = { revision: 1, ...edit, citations: requirementCitations(edit.requirements!), quoteText: '' };
  assert.deepEqual(evidenceDraftSchema.parse(JSON.parse(JSON.stringify(draft))), draft);
  assert.throws(() => validateEvidence(ANALYSIS_EXAMPLE, draft, adopted));
});
test('requirement displays expose scope, decision boundaries, questions and evidence roles', () => {
  const adopted = contract(), request = buildAnalysisRequest(ANALYSIS_EXAMPLE, adopted), result = validateSuggestions(request, ANALYSIS_EXAMPLE, recordedPrecisionExample(request));
  const value = result.findings.find(f => f.measureId === 'do_003')!.requirements!;
  const html = renderToStaticMarkup(createElement(RequirementEditor, { definitions: adopted.criteria.find(c => c.id === 'do_003')!.requirements!, value, passages: requirementCitations(value), onChange: () => {} }));
  assert.match(html, /decisive for this measure/); assert.match(html, /Requirement rationale/); assert.match(html, /evidence role/);
  const saved = renderToStaticMarkup(createElement(RequirementFindings, { value }));
  assert.match(saved, /School-managed accounts/); assert.match(saved, /limitation/); assert.match(saved, /unspecified period/);
});
test('bounded requirements preserve known failures when coverage is incomplete without changing weights', () => {
  const adopted = contract(), definitions = adopted.criteria.find(c => c.id === 'dr_003')!.requirements!;
  const review: RequirementReview = { version: 'requirements-v1', sourceStatus: 'incomplete', scope: 'School data', scopeStatus: 'matched', scopeQuestion: '',
    requirements: definitions.map(d => ({ id: d.id, status: d.id === 'trigger' ? 'opposed' : 'unavailable', rationale: 'Known fact or missing source.', question: d.id === 'trigger' ? '' : 'Supply missing terms.', citations: [] })) };
  const derived = deriveRequirementReview(definitions, review);
  assert.equal(derived.state, 'unresolved'); assert.deepEqual(derived.establishedFailures, ['trigger']);
  assert.equal(BYTE_LIMITS.finding, 64 * 1024); assert.equal(BYTE_LIMITS.detail, 4 * 1024 * 1024);
});
