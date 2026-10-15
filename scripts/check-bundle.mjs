import { readdirSync, readFileSync } from 'node:fs';
import { inspectFile } from './check-isolation.mjs';
let failures = [];
for (const name of readdirSync('dist', { recursive: true }).filter(n => /\.(?:js|html|css)$/.test(n))) {
  for (const issue of inspectFile(name, readFileSync(`dist/${name}`, 'utf8'))) failures.push(`${name}: ${issue}`);
}
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
else console.log('Built assets contain no known district connection or embedded provider key.');
