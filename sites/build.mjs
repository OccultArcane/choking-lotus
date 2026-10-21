/* Assemble the deployable site into ./dist.
   Only real site files are copied — dev screenshots, tooling and logs stay out. */

import { cp, rm, mkdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');

const entries = ['index.html', 'css', 'js', 'assets', 'footer-note.txt'];

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const entry of entries) {
  const from = path.join(root, entry);
  const info = await stat(from);
  await cp(from, path.join(dist, entry), { recursive: info.isDirectory() });
}

console.log(`built ${path.relative(root, dist)}`);
