import { mkdir, readdir, copyFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'node_modules', '@rdkit', 'rdkit', 'dist');
const destination = path.join(root, 'public', 'vendor', 'rdkit', '2026.9.1');
const required = process.env.CI === 'true' || process.env.VERCEL === '1' || process.env.REQUIRE_RDKIT_LOCAL_ASSETS === '1';

let entries;
try {
  entries = await readdir(source, { withFileTypes: true });
} catch (error) {
  if (required) throw new Error('Pinned @rdkit/rdkit@2026.9.1 must be installed before the production build.', { cause: error });
  console.warn('RDKit package is not installed locally; browser adapter will use its pinned CDN fallback.');
  process.exit(0);
}

const files = entries
  .filter(entry => entry.isFile() && /^RDKit_minimal.*\.(?:js|wasm|data)$/.test(entry.name))
  .map(entry => entry.name)
  .sort();
if (!files.includes('RDKit_minimal.js') || !files.some(name => name.endsWith('.wasm'))) {
  throw new Error('RDKit package is missing the expected MinimalLib JavaScript or WebAssembly runtime asset.');
}

await mkdir(destination, { recursive: true });
for (const file of files) await copyFile(path.join(source, file), path.join(destination, file));
await writeFile(path.join(destination, 'manifest.json'), JSON.stringify({
  toolkit: 'RDKit.js',
  version: '2026.9.1',
  files,
}, null, 2) + '\n');
console.log('Copied pinned RDKit.js assets:', files.join(', '));
