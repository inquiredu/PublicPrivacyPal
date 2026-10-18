import { lstatSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { captureSourceBundle } from '../server/source-bundle.ts';
import { newSegmentArchive, readSegmentArchive, inspectSegmentArchive, appendSegmentAttempt, appendSynthesis, buildSynthesisRequest, budget, type SegmentArchive } from '../server/analysis/segments.ts';
import { SEGMENT_LIMITS } from '../shared/source-segments.ts';

process.umask(0o077);
function read(path: string, limit = SEGMENT_LIMITS.archiveBytes) {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > limit) throw new Error('Use a bounded ordinary local file.');
  const bytes = readFileSync(path);
  const decoded = bytes.toString('utf8');
  if (!Buffer.from(decoded, 'utf8').equals(bytes)) throw new Error('Use valid UTF-8; original output will not be repaired or replaced.');
  return decoded;
}
function save(path: string, value: unknown) {
  budget(value, SEGMENT_LIMITS.archiveBytes, 'Output archive');
  const serialized = JSON.stringify(value) + '\n';
  if (Buffer.byteLength(serialized) > SEGMENT_LIMITS.archiveBytes) throw new Error('Output archive exceeds its byte budget.');
  writeFileSync(path, serialized, { flag: 'wx', mode: 0o600 });
}
const [command, ...args] = process.argv.slice(2);
try {
  if (command === 'capture' && args.length === 2) {
    const input = JSON.parse(read(args[0]));
    const bundle = captureSourceBundle(input.sourceBundle, input.contract, new Date().toISOString());
    save(args[1], newSegmentArchive(bundle, input.contract));
    console.log('Saved immutable offline source, requests and pending coverage. No provider was called.');
  } else {
    const archive = JSON.parse(read(args[0])) as SegmentArchive;
    readSegmentArchive(archive);
    if (command === 'requests' && args.length === 2) {
      mkdirSync(args[1], { mode: 0o700 });
      for (const r of archive.requests) save(join(args[1], `${r.segment.id}.json`), r);
      console.log(`Saved ${archive.requests.length} bounded requests. No provider was called.`);
    } else if (command === 'returned' && args.length === 4) {
      const request = archive.requests.find(r => r.segment.id === args[1]); if (!request) throw new Error('Unknown segment.');
      const next = appendSegmentAttempt(archive, { segmentId: args[1], requestKey: request.key, outcome: { kind: 'returned', raw: read(args[2], SEGMENT_LIMITS.outputBytes) } });
      save(args[3], next);
      console.log(`Preserved original output; segment state: ${readSegmentArchive(next).ledger.find(s => s.id === args[1])!.state}.`);
    } else if (command === 'failed' && args.length === 4) {
      const request = archive.requests.find(r => r.segment.id === args[1]); if (!request) throw new Error('Unknown segment.');
      save(args[3], appendSegmentAttempt(archive, { segmentId: args[1], requestKey: request.key, outcome: { kind: 'failed', reason: args[2] } }));
      console.log('Preserved explicit failed segment.');
    } else if (command === 'synthesis-request' && args.length === 2) {
      save(args[1], buildSynthesisRequest(archive)); console.log('Saved bounded complete-source synthesis request, including gaps.');
    } else if (command === 'synthesis-returned' && args.length === 3) {
      const next = appendSynthesis(archive, read(args[1], SEGMENT_LIMITS.outputBytes)); save(args[2], next);
      console.log(`Preserved synthesis output; validation state: ${inspectSegmentArchive(next).syntheses.at(-1)!.state}.`);
    } else if (command === 'inspect' && args.length === 1) {
      const state = inspectSegmentArchive(archive);
      console.log(JSON.stringify({ bundleId: archive.bundle.id, planId: archive.plan.id, ledger: state.ledger.map(({ id, state, error }) => ({ id, state, error })), readyTargets: state.coverage.filter(t => t.ready).length, totalTargets: state.coverage.length, retainedCandidates: state.candidates.length, syntheses: state.syntheses.map(s => ({ state: s.state, current: s.current, ...(s.result ? { complete: s.result.complete } : { error: s.error }) })) }, null, 2));
    } else throw new Error('Unknown command or argument count.');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Offline segment operation failed.');
  console.error('Usage: analysis:segments -- capture INPUT OUT | requests ARCHIVE NEW_DIR | returned ARCHIVE SEGMENT RAW OUT | failed ARCHIVE SEGMENT REASON OUT | synthesis-request ARCHIVE OUT | synthesis-returned ARCHIVE RAW OUT | inspect ARCHIVE');
  process.exitCode = 1;
}
