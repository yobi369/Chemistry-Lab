import test from 'node:test';
import assert from 'node:assert/strict';
import { ExperimentalCsvError, importQinTratnyek2018Csv } from './experimentalCsv';

const csv = [
  '#35 (Alfa),,,#44 (AW Alfa),,',
  'time_hr,H2_aver_uMol,H2_stdev,time_hr,H2_aver_uMol,H2_stdev',
  '0,-0.006,0,0,0.1,0.02',
  '2,1.5,0.1,2,2.2,0.2',
  '4,2.3,0.08,,,',
].join('\n');

test('imports series and preserves negative values, zero SD and source coordinates', () => {
  const data = importQinTratnyek2018Csv(csv);
  assert.equal(data.audit.experimentCount, 2);
  assert.equal(data.audit.measurementCount, 5);
  assert.equal(data.audit.negativeHydrogenMeasurements, 1);
  assert.equal(data.audit.zeroStandardDeviationMeasurements, 1);
  assert.equal(data.measurements[0].hydrogenMicromoles, -0.006);
  assert.equal(data.measurements[0].sourceRow, 3);
  assert.equal(data.measurements[0].sourceColumn, 1);
  assert.equal(data.audit.maximumTimeHours, 4);
});

test('accepts BOM, CRLF and quoted labels', () => {
  const data = importQinTratnyek2018Csv('\uFEFF"#7, sample",,,\r\ntime_hr,H2_aver_uMol,H2_stdev\r\n1,2,0.3');
  assert.equal(data.measurements[0].experimentLabel, '#7, sample');
});

test('rejects partial records, malformed headers and invalid uncertainty', () => {
  assert.throws(() => importQinTratnyek2018Csv(csv.replace('2,1.5,0.1', '2,,0.1')), /Partially missing/);
  assert.throws(() => importQinTratnyek2018Csv(csv.replace('2,1.5,0.1', '2,1.5,-0.1')), /Negative SD/);
  assert.throws(() => importQinTratnyek2018Csv(csv.replace('2,1.5,0.1', '2,NaN,0.1')), /Non-finite/);
  assert.throws(() => importQinTratnyek2018Csv('label,,,\ntime,H2,sd\n1,2,0'), ExperimentalCsvError);
});
