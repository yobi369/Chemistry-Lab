import { createHash } from 'node:crypto';
import { readFileSync, existsSync, statSync } from 'node:fs';

const assetRoot = 'dist/vendor/rdkit/2026.9.1';
const manifest = JSON.parse(readFileSync(assetRoot + '/manifest.json', 'utf8'));
if (manifest.toolkit !== 'RDKit.js' || manifest.version !== '2026.9.1') {
  throw new Error('Built RDKit asset manifest has an unexpected toolkit version.');
}
for (const [name, expected] of Object.entries(manifest.files ?? {})) {
  const path = assetRoot + '/' + name;
  if (!existsSync(path)) throw new Error('Missing built RDKit asset: ' + path);
  const bytes = readFileSync(path);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const integrity = 'sha256-' + createHash('sha256').update(bytes).digest('base64');
  if (sha256 !== expected.sha256 || integrity !== expected.integrity || bytes.length !== expected.bytes) {
    throw new Error('RDKit asset checksum/size mismatch: ' + name);
  }
}
const wasm = readFileSync(assetRoot + '/RDKit_minimal.wasm');
if (wasm.subarray(0, 4).toString('hex') !== '0061736d') {
  throw new Error('RDKit WASM asset does not have the WebAssembly magic header.');
}
const serviceWorker = readFileSync('dist/service-worker.js', 'utf8');
for (const name of ['RDKit_minimal.js', 'RDKit_minimal.wasm', 'manifest.json']) {
  if (!serviceWorker.includes('/vendor/rdkit/2026.9.1/' + name)) {
    throw new Error('Generated service worker does not precache ' + name);
  }
}
const buildMeta = JSON.parse(readFileSync('dist/build-meta.json', 'utf8'));
if (buildMeta.rdkitVersion !== '2026.9.1') throw new Error('Build metadata RDKit version mismatch.');
const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
const csp = vercel.headers.flatMap(rule => rule.headers ?? [])
  .find(header => header.key.toLowerCase() === 'content-security-policy')?.value ?? '';
if (!csp.includes("'wasm-unsafe-eval'") || !csp.includes("worker-src 'self'") ||
    csp.includes('cdn.jsdelivr.net')) {
  throw new Error('CSP must permit same-origin WebAssembly/service workers and must not depend on jsDelivr.');
}
console.log(JSON.stringify({
  toolkit: manifest.toolkit,
  version: manifest.version,
  assets: Object.fromEntries(Object.entries(manifest.files).map(([name, value]) => [name, {
    bytes: value.bytes, sha256: value.sha256,
  }])),
  serviceWorkerPrecacheCount: (serviceWorker.match(/"\/vendor\/rdkit\/2026\.9\.1\//g) ?? []).length,
  buildCommit: buildMeta.commitSha,
  csp: 'same-origin scripts + wasm-unsafe-eval + service worker; no RDKit CDN dependency',
}, null, 2));
