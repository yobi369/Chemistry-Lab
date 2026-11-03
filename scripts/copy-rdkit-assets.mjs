import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const entry = require.resolve('@rdkit/rdkit');
let packageRoot = dirname(entry);
while (packageRoot !== dirname(packageRoot)) {
  const manifestPath = join(packageRoot, 'package.json');
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    if (manifest.name === '@rdkit/rdkit') {
      if (manifest.version !== '2026.9.1') {
        throw new Error('Expected @rdkit/rdkit 2026.9.1, received ' + manifest.version);
      }
      break;
    }
  }
  packageRoot = dirname(packageRoot);
}
const packageManifestPath = join(packageRoot, 'package.json');
if (!existsSync(packageManifestPath)) throw new Error('Could not locate the pinned @rdkit/rdkit package root.');
const packageManifest = JSON.parse(readFileSync(packageManifestPath, 'utf8'));
if (packageManifest.name !== '@rdkit/rdkit' || packageManifest.version !== '2026.9.1') {
  throw new Error('RDKit package identity/version mismatch.');
}
const candidates = [
  join(packageRoot, 'dist', 'RDKit_minimal.js'),
  join(packageRoot, 'dist', 'RDKit_minimal.wasm'),
  join(packageRoot, 'RDKit_minimal.js'),
  join(packageRoot, 'RDKit_minimal.wasm'),
];
const jsSource = candidates.find(path => path.endsWith('.js') && existsSync(path));
const wasmSource = candidates.find(path => path.endsWith('.wasm') && existsSync(path));
if (!jsSource || !wasmSource) {
  throw new Error('Pinned RDKit package is missing RDKit_minimal.js or RDKit_minimal.wasm. Checked: ' + candidates.join(', '));
}
const destination = resolve('public/vendor/rdkit/2026.9.1');
mkdirSync(destination, { recursive: true });
const files = {};
for (const source of [jsSource, wasmSource]) {
  const name = source.endsWith('.js') ? 'RDKit_minimal.js' : 'RDKit_minimal.wasm';
  const target = join(destination, name);
  copyFileSync(source, target);
  const bytes = readFileSync(target);
  files[name] = {
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}
const assetManifest = {
  toolkit: 'RDKit.js',
  version: '2026.9.1',
  sourcePackage: '@rdkit/rdkit@2026.9.1',
  files,
};
writeFileSync(join(destination, 'manifest.json'), JSON.stringify(assetManifest, null, 2) + '\n');
console.log(JSON.stringify({ destination, ...assetManifest }, null, 2));
