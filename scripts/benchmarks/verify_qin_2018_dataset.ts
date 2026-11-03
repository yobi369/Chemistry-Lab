import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { importQinTratnyek2018Csv } from '../../src/research/experimentalCsv';

const path = process.argv[2];
if (!path) throw new Error('Usage: bun run scripts/benchmarks/verify_qin_2018_dataset.ts <csv-path>');
const manifest = JSON.parse(readFileSync('data/experimental/qin-2018/manifest.json', 'utf8'));
const bytes = readFileSync(path);
const md5 = createHash('md5').update(bytes).digest('hex');
if (md5 !== manifest.md5) throw new Error('Qin dataset checksum mismatch: expected ' + manifest.md5 + ', got ' + md5);
const dataset = importQinTratnyek2018Csv(bytes.toString('utf8'), manifest.datasetDoi);
if (dataset.audit.experimentCount !== manifest.expectedExperimentCount)
  throw new Error('Expected ' + manifest.expectedExperimentCount + ' series, received ' + dataset.audit.experimentCount);
if (dataset.audit.maximumTimeHours !== 120)
  throw new Error('Expected maximum observation time of 120 h, received ' + dataset.audit.maximumTimeHours);
if (dataset.audit.measurementCount < dataset.audit.experimentCount * 5)
  throw new Error('Unexpectedly sparse experimental dataset: ' + dataset.audit.measurementCount + ' observations.');
console.log(JSON.stringify({
  file: basename(path), md5, source: manifest.datasetDoi,
  ...dataset.audit,
}, null, 2));
