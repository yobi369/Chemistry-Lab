import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const commitSha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || 'local';
const buildId = process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_URL || 'local';
const material = [commitSha, buildId, packageJson.version, '2026.9.1'].join('|');
const buildFingerprint = createHash('sha256').update(material).digest('hex').slice(0, 16);
mkdirSync(resolve('public'), { recursive: true });
const metadata = {
  application: packageJson.name,
  version: packageJson.version,
  commitSha,
  buildId,
  buildFingerprint,
  rdkitVersion: '2026.9.1',
  builtAt: new Date().toISOString(),
};
writeFileSync(resolve('public/build-meta.json'), JSON.stringify(metadata, null, 2) + '\n');
console.log(JSON.stringify(metadata, null, 2));
