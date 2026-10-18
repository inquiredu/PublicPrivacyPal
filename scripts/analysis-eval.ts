import { readFileSync, writeFileSync } from 'node:fs';
import { analysisCases } from '../test/fixtures/analysis-cases.ts';
import { gradeObservations, type BenchmarkObservation } from '../server/analysis/benchmark.ts';
const [mode, file] = process.argv.slice(2);
if (!file || !['export', 'grade'].includes(mode)) throw new Error('Use: npm run analysis:eval -- export NEW.jsonl | grade observations.jsonl. Neither command calls a provider.');
if (mode === 'export') {
  // Expected labels are deliberately excluded from model inputs.
  writeFileSync(file, analysisCases.map(c => JSON.stringify({ caseId: c.id, request: c.request })).join('\n') + '\n', { flag: 'wx', mode: 0o600 });
  console.log(`Exported ${analysisCases.length} synthetic development inputs. Labels need independent human review.`);
} else {
  const input = readFileSync(file, 'utf8');
  if (Buffer.byteLength(input) > 12 * 1024 * 1024) throw new Error('Benchmark results exceed 12 MiB.');
  const observations = input.trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) as BenchmarkObservation[];
  console.log(JSON.stringify(gradeObservations(analysisCases, observations), null, 2));
}
