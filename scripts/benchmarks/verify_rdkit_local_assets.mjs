import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const directory = path.join(root, 'public', 'vendor', 'rdkit', '2026.9.1');
const manifest = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8'));
assert.equal(manifest.toolkit, 'RDKit.js');
assert.equal(manifest.version, '2026.9.1');
assert.ok(manifest.files.includes('RDKit_minimal.js'));
const wasmFiles = manifest.files.filter(file => file.endsWith('.wasm'));
assert.ok(wasmFiles.length > 0, 'RDKit MinimalLib WASM file must be present');

for (const file of manifest.files) {
  const filePath = path.join(directory, file);
  const info = await stat(filePath);
  assert.ok(info.isFile() && info.size > 0, `Missing or empty local RDKit asset: ${file}`);
}
const wasm = await readFile(path.join(directory, wasmFiles[0]));
assert.deepEqual([...wasm.subarray(0, 4)], [0, 97, 115, 109], 'WASM asset must have the WebAssembly magic header');
const glue = await readFile(path.join(directory, 'RDKit_minimal.js'), 'utf8');
assert.ok(glue.length > 10_000, 'RDKit JavaScript glue should be the actual runtime, not a placeholder');
const assets = await Promise.all(manifest.files.map(async file => ({ file, bytes: (await stat(path.join(directory, file))).size })));
console.log(JSON.stringify({version:manifest.version,assets,wasmMagicValid:true},null,2));
