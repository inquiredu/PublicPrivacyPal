// Read-only kickoff comparison. Never starts the app, accesses credentials or changes Git state.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
const root = realpathSync(resolve(directory, '../..'));
const args = process.argv.slice(2);
if (args.length > 1 || args.some(arg => arg !== '--implementation-only')) {
  console.error('Usage: node docs/parallel-work/check-baseline.mjs [--implementation-only]');
  process.exit(2);
}
const implementationOnly = args.includes('--implementation-only');
const gitEnv = { ...process.env };
// Inspect this checkout rather than an inherited Git metadata/worktree override.
for (const key of Object.keys(gitEnv)) if (key.startsWith('GIT_')) delete gitEnv[key];
const git = (...command) => execFileSync('git', ['-C', root, ...command], { encoding: 'utf8', env: gitEnv, stdio: ['ignore', 'pipe', 'pipe'], timeout: 15000 }).trim();

try {
  const manifest = JSON.parse(readFileSync(resolve(directory, 'baseline-manifest.json'), 'utf8'));
  if (manifest.version !== 1 || !Array.isArray(manifest.files) || !manifest.files.length) throw new Error('Unsupported or empty implementation manifest.');
  const branch = git('branch', '--show-current');
  const head = git('rev-parse', 'HEAD');
  const origins = [...git('remote', 'get-url', '--all', 'origin').split('\n'), ...git('remote', 'get-url', '--push', '--all', 'origin').split('\n')];
  const originOK = origins.every(url => /^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)inquiredu\/PublicPrivacyPal(?:\.git)?\/?$/.test(url));
  const missing = []; const changed = []; const invalid = []; const seen = new Set();
  let matching = 0;
  for (const entry of manifest.files) {
    const path = entry.path;
    if (typeof path !== 'string' || isAbsolute(path) || path.includes('\\') || path.split('/').some(part => !part || part === '.' || part === '..' || part.startsWith('.')) && path !== '.nvmrc'
      || path === 'config/local.json' || !/^[a-f0-9]{64}$/.test(entry.sha256) || seen.has(path)) {
      invalid.push(typeof path === 'string' ? path : '(invalid path)'); continue;
    }
    seen.add(path);
    const fullPath = resolve(root, path);
    try {
      const stat = lstatSync(fullPath);
      const actual = relative(root, realpathSync(fullPath));
      if (!stat.isFile() || stat.isSymbolicLink() || actual === '..' || actual.startsWith(`..${sep}`) || isAbsolute(actual)) { invalid.push(path); continue; }
      if (createHash('sha256').update(readFileSync(fullPath)).digest('hex') === entry.sha256) matching++;
      else changed.push(path);
    } catch (error) {
      if (error.code === 'ENOENT') missing.push(path); else throw error;
    }
  }
  const implementationMatches = !missing.length && !changed.length && !invalid.length;
  const comparisonPassed = originOK && implementationMatches && (implementationOnly || branch === 'main');
  console.log(JSON.stringify({ mode: implementationOnly ? 'implementation-only' : 'main-kickoff', branch: branch || '(detached)', head,
    originMatchesExpectedRepository: originOK, files: manifest.files.length, matching, missing, changed, invalid,
    implementationMatches, comparisonPassed,
    note: 'Read-only identity comparison. Review working-tree changes, additional files, source preservation, dependencies, runtime and tests before assigning implementation.' }, null, 2));
  if (!comparisonPassed) {
    console.error('Baseline prerequisite not satisfied. Read docs/parallel-work/baseline.md; preserve the existing implementation before any branch or integration action.');
    process.exitCode = 1;
  }
} catch (error) {
  console.error(`Baseline comparison could not complete: ${error.message}`);
  process.exitCode = 2;
}
