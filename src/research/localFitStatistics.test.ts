import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateLocalFitStatistics } from './localFitStatistics';

test('recovers covariance and correlation for a full-rank linear residual model', () => {
  const result = calculateLocalFitStatistics(['a','b'], [2,3],
    p => [p[0]-2, p[1]-3, p[0]+p[1]-5], 1);
  assert.equal(result.locallyIdentifiable, true);
  assert.equal(result.identifiableParameterCount, 2);
  assert.ok(result.standardErrors !== null);
  assert.ok(Math.abs(result.correlationMatrix!.a.a - 1) < 1e-12);
  assert.ok(Math.abs(result.correlationMatrix!.a.b) <= 1);
});

test('withholds covariance for rank-deficient parameters', () => {
  const result = calculateLocalFitStatistics(['a','b'], [1,1],
    p => [p[0]+p[1]-2, 2*p[0]+2*p[1]-4], 1);
  assert.equal(result.locallyIdentifiable, false);
  assert.ok(result.standardErrors !== null);
  assert.equal(Object.values(result.standardErrors!).filter(value => value !== null).length, 1);
  assert.equal(result.covarianceMatrix, null);
  assert.equal(result.identifiableParameterCount, 1);
});
