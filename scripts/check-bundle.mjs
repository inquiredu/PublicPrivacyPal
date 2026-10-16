import { readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { inspectFile } from './check-isolation.mjs';
let failures = [];
for (const name of readdirSync('dist', { recursive: true }).filter(n => /\.(?:js|html|css)$/.test(n))) {
  for (const issue of inspectFile(name, readFileSync(`dist/${name}`, 'utf8'))) failures.push(`${name}: ${issue}`);
}
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
else console.log('Built assets contain no known district connection or embedded provider key.');

// Measure the full initial dependency graph, not just a renamed entry chunk.
const manifest = JSON.parse(readFileSync('dist/.vite/manifest.json', 'utf8'));
const initial = new Set();
function visit(key) {
  if (initial.has(key)) return;
  if (!manifest[key]) throw new Error(`Missing bundle manifest entry: ${key}`);
  initial.add(key);
  for (const dependency of manifest[key].imports || []) visit(dependency);
}
visit('index.html');
const initialGzip = [...initial].reduce((sum, key) => sum + gzipSync(readFileSync(`dist/${manifest[key].file}`)).length, 0);
const entryBytes = readFileSync(`dist/${manifest['index.html'].file}`).length;
for (const key of ['src/Reviews.tsx', 'src/Settings.tsx', 'src/pdf-import.ts']) {
  if (!manifest[key]?.isDynamicEntry || initial.has(key)) failures.push(`${key} must stay outside the initial JavaScript graph.`);
}
// PDF's worker is a separate on-demand asset; it is not an application entry.
for (const entry of Object.values(manifest).filter(m => m.isEntry || m.isDynamicEntry || m.name)) {
  const size = readFileSync(`dist/${entry.file}`).length;
  if (size > 500_000) failures.push(`${entry.file} exceeds the 500 kB JavaScript chunk budget (${size}).`);
}
if (initialGzip > 290_000) failures.push(`Initial JavaScript exceeds 290 kB gzip (${initialGzip}).`);
if (entryBytes > 180_000) failures.push(`Application entry exceeds 180 kB (${entryBytes}).`);
console.log(`Initial JavaScript: ${(initialGzip / 1000).toFixed(2)} kB gzip across ${initial.size} chunks; entry: ${(entryBytes / 1000).toFixed(2)} kB.`);
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
else console.log('Bundle budgets and deferred-screen boundaries passed.');
