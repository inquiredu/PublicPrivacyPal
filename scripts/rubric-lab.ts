import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { candidate } from './rubric-lab/candidate.ts';
import { labCases, referenceOutput } from './rubric-lab/cases.ts';
import { aggregate, candidateId, grade, requestFor } from './rubric-lab/engine.ts';

const [mode, file, ...extra] = process.argv.slice(2);
if (extra.length || !['check', 'export', 'grade'].includes(mode) || (mode === 'check' ? !!file : !file)) {
  throw new Error('Use npm run rubric:lab -- check | export NEW.jsonl | grade observations.jsonl. No provider calls or adoption.');
}
if (mode === 'export') {
  writeFileSync(file, labCases.map(c => JSON.stringify(requestFor(c))).join('\n') + '\n', { flag: 'wx', mode: 0o600 });
  console.log(`Exported ${labCases.length} synthetic inputs without labels. Preserve first outputs; this is a proposed, unadjudicated rubric.`);
} else if (mode === 'grade') {
  if (statSync(file).size > 12 * 1024 * 1024) throw new Error('Observation file exceeds 12 MiB.');
  const schema = z.object({ caseId: z.string(), output: z.unknown() }).strict();
  const observations = readFileSync(file, 'utf8').split('\n').filter(s => s.trim()).map(s => schema.parse(JSON.parse(s)));
  console.log(JSON.stringify(grade(labCases, observations), null, 2));
} else {
  const observations = labCases.map(c => ({ caseId: c.id, output: referenceOutput(c) }));
  const report = grade(labCases, observations);
  if (report.correct !== labCases.length) throw new Error(JSON.stringify(report.rows.filter(r => !r.correct)));
  console.log(JSON.stringify({ purpose: 'Deterministic reference-fixture consistency, not model performance', candidateId,
    candidateVersion: candidate.version, status: candidate.status, measures: candidate.measures.length,
    requirements: candidate.measures.reduce((n, m) => n + m.requirements.length, 0), cases: labCases.length,
    consistentReferenceCases: report.correct,
    outcomes: labCases.map(c => ({ caseId: c.id, measureId: c.measureId, category: c.category, ...aggregate(c, referenceOutput(c)) })),
  }, null, 2));
}
