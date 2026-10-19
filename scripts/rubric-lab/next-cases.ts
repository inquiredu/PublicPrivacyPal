import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { digest } from '../../server/evaluation.ts';
import type { LabCase, Status, State } from './engine.ts';
import { assessNext, gradeNext, nextCandidate, nextCandidateId, nextMeasure, nextRequest, type NextOutput } from './next-candidate.ts';

// Authored development examples and provisional labels. These are not independent holdouts.
const scope = 'Fictional district; school-managed accounts, identifiable student records and student work; requests by authorized school staff.';
const prefix = 'These terms apply to school-managed accounts and all identifiable student records and student work.\n';
const examples = {
  do_001: {
    positive: ['Schools and users retain ownership of all student records and student work; we acquire no ownership of that data.', 'Our license is only to operate the contracted school service and ends when the service ends.'],
    limited: ['Schools and users retain ownership of all student records and student work; we acquire no ownership of that data.', 'Our license is to operate the school service; its duration is unspecified.'],
    adverse: ['Schools and users retain ownership of all student records and student work; we acquire no ownership of that data.', 'Our license to student records and student work is perpetual and irrevocable, including after the service ends.'],
    limitedStatuses: ['established', 'limited'], adverseStatuses: ['established', 'opposed'],
  },
  do_002: {
    positive: ['School administrators can inspect all student records using Records > View all.', 'School administrators can download an external copy of all student records using Records > Export all.', 'The copy is CSV, a structured machine-readable format readable without our software or subscription.'],
    limited: ['School administrators can inspect all student records using Records > View all.', 'School administrators can download an external copy of all student records using Records > Export all.', 'The copy is supplied only as a human-readable PDF.'],
    adverse: ['We expressly refuse schools access to their student records.', 'School administrators can download an external copy of all student records using Records > Export all.', 'The copy is CSV, a structured machine-readable format readable without our software or subscription.'],
    limitedStatuses: ['established', 'established', 'limited'], adverseStatuses: ['opposed', 'established', 'established'],
  },
  do_004: {
    positive: ['Schools may request correction of factual inaccuracies in all student records; we assess each request for accuracy.', 'Authorized school staff submit correction requests to corrections@cedar.example.'],
    limited: ['Schools may request correction of factual inaccuracies in all student records; we assess each request for accuracy.', 'Contact support about corrections; no contact details or request path are supplied.'],
    adverse: ['We expressly refuse correction requests for factual inaccuracies in student records.', 'Authorized school staff submit correction requests to corrections@cedar.example.'],
    limitedStatuses: ['established', 'limited'], adverseStatuses: ['opposed', 'established'],
  },
} satisfies Record<string, { positive: string[]; limited: string[]; adverse: string[]; limitedStatuses: Status[]; adverseStatuses: Status[] }>;
type BatchId = keyof typeof examples;
function make(measureId: BatchId, category: string, texts: string[], statuses: Status[], state: State, extra = ''): LabCase {
  const ids = nextMeasure(measureId).requirements.map(r => r.id);
  if (ids.length !== texts.length || ids.length !== statuses.length) throw new Error('Provisional example requirement order mismatch.');
  return { id: '', measureId, category, scope, source: prefix + texts.filter(Boolean).join('\n') + extra,
    coverage: Object.fromEntries(ids.map((id, i) => [id, statuses[i] === 'unavailable' ? 'missing_dependency' : 'complete'])),
    expected: { state, scopeStatus: 'matched', requirements: Object.fromEntries(ids.map((id, i) => [id, { status: statuses[i], evidence: texts[i] ? [texts[i]] : [] }])) } };
}
export const nextCases: LabCase[] = (Object.keys(examples) as BatchId[]).flatMap(id => {
  const e = examples[id], all = (status: Status) => e.positive.map(() => status);
  const missing = [...e.positive]; missing[missing.length - 1] = '';
  const statuses = all('established'); statuses[statuses.length - 1] = 'unavailable';
  const scoped = make(id, 'scope', e.positive, all('established'), 'unresolved');
  scoped.source = 'These clauses govern some accounts; whether they apply to school accounts is unspecified.\n' + e.positive.join('\n');
  scoped.expected.scopeStatus = 'unresolved';
  return [make(id, 'positive', e.positive, all('established'), 'supported'),
    make(id, 'limited', e.limited, e.limitedStatuses, 'partial'),
    make(id, 'adverse', e.adverse, e.adverseStatuses, 'contradicted'),
    make(id, 'silence', e.positive.map(() => ''), all('not_stated'), 'not_addressed', 'The service provides fictional arithmetic lessons.'),
    make(id, 'missing', missing, statuses, 'unresolved', '\nThe required remaining terms are in a separate annex that was not supplied.'), scoped];
});
nextCases.push(
  make('do_001', 'ownership-is-not-license', [examples.do_001.positive[0], ''], ['established', 'not_stated'], 'partial'),
  make('do_001', 'separate-provider-software', examples.do_001.positive, ['established', 'established'], 'supported', '\nWe own our software and documentation; this does not include student records or student work.'),
  make('do_001', 'uncertain-analytics-identifiability', [examples.do_001.positive[0], 'We license analytics forever; these terms do not say whether the analytics retain identifiable student information.'], ['established', 'ambiguous'], 'unresolved'),
  make('do_001', 'conflicting-ownership', ['Schools retain ownership of all student work. We also claim ownership of all student work, with no precedence between these clauses.', examples.do_001.positive[1]], ['ambiguous', 'established'], 'unresolved'),
  make('do_001', 'known-opposition-missing-license', ['We acquire ownership of all student records and student work.', ''], ['opposed', 'unavailable'], 'unresolved', '\nThe licensing annex was not supplied.'),
  make('do_002', 'access-is-not-export', [examples.do_002.positive[0], '', ''], ['established', 'not_stated', 'not_stated'], 'partial'),
  make('do_002', 'export-without-usable-route', [examples.do_002.positive[0], 'Schools may export all student records, but no control, request contact or path is stated.', examples.do_002.positive[2]], ['established', 'limited', 'established'], 'partial'),
  make('do_002', 'vendor-dependent-format', [examples.do_002.positive[0], examples.do_002.positive[1], 'The downloaded file can be opened only in our service with an active subscription.'], ['established', 'established', 'opposed'], 'partial'),
  make('do_002', 'express-export-refusal', [examples.do_002.positive[0], 'Schools may view records, but we expressly prohibit any external copy.', ''], ['established', 'opposed', 'not_stated'], 'contradicted'),
  make('do_002', 'school-route-for-parents', examples.do_002.positive, ['established', 'established', 'established'], 'supported', '\nParents seeking their child’s school records must contact the school administrator.'),
  make('do_004', 'deletion-is-not-amendment', ['', ''], ['not_stated', 'not_stated'], 'not_addressed', 'Schools can delete student records using Records > Delete.'),
  make('do_004', 'requester-verification', examples.do_004.positive, ['established', 'established'], 'supported', '\nWe verify that the requester is authorized school staff before processing the correction request.'),
  make('do_004', 'profile-fields-only', ['Schools may correct only a display name and avatar; amendment of other factual student records is not described.', examples.do_004.positive[1]], ['limited', 'established'], 'partial'),
);
// Opaque stable IDs contain no category, expected state or reference-output label.
for (const c of nextCases) c.id = `ownership-${digest({ measureId: c.measureId, source: c.source, scope: c.scope, coverage: c.coverage }).slice(0, 16)}`;

/** An authored consistency fixture, never a model-generated result or independently judged label. */
export function nextReference(c: LabCase): NextOutput {
  return { requestId: nextRequest(c).requestId, scopeStatus: c.expected.scopeStatus,
    scopeQuestion: c.expected.scopeStatus === 'unresolved' ? 'Do these terms govern the declared school accounts?' : '',
    requirements: Object.entries(c.expected.requirements).map(([id, e]) => ({ id, status: e.status,
      rationale: 'Authored provisional interpretation; independent challenge and qualified human adjudication remain required.',
      question: ['ambiguous', 'unavailable'].includes(e.status) ? 'Supply the applicable material or resolve this specific uncertainty.' : '',
      quotes: e.evidence.map(quote => ({ quote, role: e.status === 'opposed' ? 'opposition' : e.status === 'limited' ? 'limitation' : e.status === 'ambiguous' ? 'conflict' : 'support' })),
    })) };
}
export function exportNextInputs(path: string) {
  writeFileSync(path, nextCases.map(c => JSON.stringify(nextRequest(c))).join('\n') + '\n', { flag: 'wx', mode: 0o600 });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, file, ...extra] = process.argv.slice(2);
  if (extra.length || !['check', 'export', 'grade'].includes(mode) || (mode === 'check' ? !!file : !file)) throw new Error('Use next-cases.ts check | export NEW.jsonl | grade observations.jsonl. No provider calls or adoption.');
  if (mode === 'export') { exportNextInputs(file); console.log(`Exported ${nextCases.length} unlabeled synthetic development inputs. This is not a holdout or provider run.`); }
  else if (mode === 'grade') {
    if (statSync(file).size > 4 * 1024 * 1024) throw new Error('Observation file exceeds 4 MiB.');
    const observation = z.object({ caseId: z.string(), output: z.unknown() }).strict();
    const rows = readFileSync(file, 'utf8').split('\n').filter(line => line.trim()).map(line => observation.parse(JSON.parse(line)));
    console.log(JSON.stringify(gradeNext(nextCases, rows), null, 2));
  } else {
    const report = gradeNext(nextCases, nextCases.map(c => ({ caseId: c.id, output: nextReference(c) })));
    if (report.correct !== nextCases.length) throw new Error(JSON.stringify(report.rows.filter(r => !r.correct)));
    console.log(JSON.stringify({ purpose: 'Authored fixture consistency only; no semantic accuracy or human adjudication claim', candidateId: nextCandidateId, version: nextCandidate.version, cases: nextCases.length, correct: report.correct, outcomes: nextCases.map(c => ({ caseId: c.id, measureId: c.measureId, category: c.category, state: assessNext(c, nextReference(c)).state })) }, null, 2));
  }
}
