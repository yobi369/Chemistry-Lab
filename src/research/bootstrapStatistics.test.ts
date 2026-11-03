import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeededRandom, empiricalPercentile, summarizeBootstrap } from './bootstrapStatistics';

test('seeded random stream is reproducible and bounded', () => {
  const a = createSeededRandom(20261103), b = createSeededRandom(20261103);
  const left = Array.from({ length: 20 }, a), right = Array.from({ length: 20 }, b);
  assert.deepEqual(left, right);
  assert.ok(left.every(value => value >= 0 && value < 1));
});

test('empirical percentile uses linear interpolation', () => {
  assert.equal(empiricalPercentile([4, 1, 3, 2], 0.5), 2.5);
  assert.equal(empiricalPercentile([1, 2, 3, 4], 0), 1);
  assert.equal(empiricalPercentile([1, 2, 3, 4], 1), 4);
});

test('bootstrap summary reports percentile interval and sample count', () => {
  const result = summarizeBootstrap(Array.from({ length: 101 }, (_, i) => i), 50, 100);
  assert.equal(result.estimate, 50);
  assert.equal(result.median, 50);
  assert.equal(result.lower, 2.5);
  assert.equal(result.upper, 97.5);
  assert.equal(result.sampleCount, 101);
});

test('rejects invalid seeds, probabilities, non-finite samples and undersized intervals', () => {
  assert.throws(() => createSeededRandom(-1));
  assert.throws(() => empiricalPercentile([], 0.5));
  assert.throws(() => empiricalPercentile([1, Number.NaN], 0.5));
  assert.throws(() => empiricalPercentile([1], 1.1));
  assert.throws(() => summarizeBootstrap([1, 2], 1, 3));
});
