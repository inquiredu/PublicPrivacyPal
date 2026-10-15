import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Deliberately check known production connections as well as private file paths.
// These patterns are an accidental-import guard, not a general secret scanner.
const protectedValues = [
  [/privacy-pal-\d{5}/i, 'district Firebase project connection'],
  [/orono[.]k12[.]mn[.]us|oronoschools[.]org/i, 'district email domain'],
  [/AIza[0-9A-Za-z_-]{35}/, 'embedded Google API key'],
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, 'private key'],
];

export function inspectFile(name, contents) {
  const issues = [];
  const parts = name.replaceAll('\\', '/').split('/');
  const base = parts.at(-1);
  if (parts.includes('.private')) issues.push('private audit material included in source');
  if (parts.includes('.local') || name === 'config/local.json') issues.push('local instance data or configuration included in source');
  if (parts.some(p => /^firebase-export-/.test(p) || ['auth_export', 'firestore_export'].includes(p)) || ['privacypal-backup.json', 'firebase-export-metadata.json'].includes(base)) {
    issues.push('local emulator backup data included in source');
  }
  if (base === '.firebaserc' || parts.includes('.firebase')) issues.push('local Firebase binding/cache included');
  if ((base === '.env' || base.startsWith('.env.')) && !base.endsWith('.example')) {
    issues.push('environment file included');
  }
  if (/service[-_]?account|adminsdk/i.test(base) && base.endsWith('.json')) {
    issues.push('possible service account credentials included');
  }
  for (const [pattern, description] of protectedValues) {
    if (pattern.test(contents)) issues.push(description);
  }
  return issues;
}

export function inspectOrigin(url) {
  return /^(?:https:\/\/github[.]com\/|git@github[.]com:|ssh:\/\/git@github[.]com\/)inquiredu\/PublicPrivacyPal(?:[.]git)?\/?$/i.test(url.trim())
    ? [] : ['origin does not point to the independent PublicPrivacyPal repository'];
}

function main() {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
  const failures = git('remote', 'get-url', '--push', '--all', 'origin').split('\n').flatMap(inspectOrigin);
  const names = new Set(git('ls-files', '-z', '--cached', '--others', '--exclude-standard').split('\0').filter(Boolean));
  for (const name of names) {
    const path = resolve(root, name);
    let stat;
    try { stat = lstatSync(path); } catch (error) {
      if (error.code === 'ENOENT') continue; // A tracked file deleted in this working copy.
      throw error;
    }
    if (stat.isSymbolicLink()) {
      failures.push(`${name}: symlinks require manual review`);
      continue;
    }
    if (!stat.isFile()) continue;
    const bytes = readFileSync(path);
    const contents = bytes.includes(0) ? '' : bytes.toString('utf8');
    for (const issue of inspectFile(name, contents)) failures.push(`${name}: ${issue}`);
  }
  if (failures.length) {
    console.error(failures.join('\n'));
    process.exitCode = 1;
  } else {
    console.log(`Isolation check passed for ${names.size} tracked/unignored files. No known district connections found.`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
