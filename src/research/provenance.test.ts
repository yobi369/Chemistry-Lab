import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateGillespie } from './gillespie';
import { createExperimentRecord, parseExperimentRecord, serializeExperiment, simulationEventsToCsv } from './provenance';
import type { ReactionNetwork } from './types';

const model: ReactionNetwork = {
  species: [
    { id: 'A', label: 'A', composition: { H: 2 }, charge: 0 },
    { id: 'B', label: 'B', composition: { H: 2 }, charge: 0 },
  ],
  reactions: [{
    id: 'r1', label: 'A → B, first order',
    reactants: [{ speciesId: 'A', coefficient: 1 }],
    products: [{ speciesId: 'B', coefficient: 1 }],
    stochasticRateConstant: 1,
  }],
};

test('experiment provenance exports', async (t) => {
  const initialCounts = { A: 10, B: 0 };
  const options = { durationSeconds: 2, seed: 17, maxEvents: 100 };
  const result = simulateGillespie(model, initialCounts, options);
  const record = createExperimentRecord(model, initialCounts, options, result, '2026-01-01T00:00:00.000Z', [{
    reactionId: 'r1', kind: 'macroscopic_conversion', macroscopicRateConstant: 1, volumeLiters: 0.001,
    reactionOrder: 1, macroscopicUnits: 's^-1', stochasticRateConstant: 1,
  }]);

  await t.test('stores model, assumptions, seed and trajectory', () => {
    const parsed = JSON.parse(serializeExperiment(record));
    assert.equal(parsed.schemaVersion, 'chemistry-lab-experiment/v2');
    assert.equal(parsed.simulation.seed, 17);
    assert.equal(parsed.rateParameterisations[0].kind, 'macroscopic_conversion');
    assert.equal(parsed.rateParameterisations[0].volumeLiters, 0.001);
    assert.equal(parsed.result.events.length, result.events.length);
    assert.equal(parsed.model.reactions[0].label, 'A → B, first order');
    assert.ok(parsed.assumptions.length > 0);
  });


  await t.test('imports and validates a complete experiment record', () => {
    const imported = parseExperimentRecord(serializeExperiment(record));
    assert.equal(imported.model.reactions[0].id, 'r1');
    assert.equal(imported.result.finalCounts.A, result.finalCounts.A);
  });

  await t.test('rejects a tampered event population history', () => {
    const tampered = JSON.parse(serializeExperiment(record));
    if (tampered.result.events.length > 0) {
      tampered.result.events[0].countsAfter.A += 1;
    } else {
      tampered.result.finalCounts.A += 1;
    }
    assert.throws(() => parseExperimentRecord(JSON.stringify(tampered)), /inconsistent/);
  });


  await t.test('rejects parameter metadata that cannot reproduce the stored rate', () => {
    const tampered = JSON.parse(serializeExperiment(record));
    tampered.rateParameterisations[0].macroscopicRateConstant = 2;
    assert.throws(() => parseExperimentRecord(JSON.stringify(tampered)), /does not reproduce/);
  });

  await t.test('validates the Arrhenius-to-stochastic parameter pathway', () => {
    const Ea = 1000;
    const T = 300;
    const A = Math.exp(Ea / (8.31446261815324 * T));
    const k = A * Math.exp(-Ea / (8.31446261815324 * T));
    const arrheniusRecord = createExperimentRecord(model, initialCounts, options, result, '2026-01-01T00:00:00.000Z', [{
      reactionId: 'r1',
      kind: 'arrhenius_conversion',
      preExponentialFactor: A,
      activationEnergyJPerMol: Ea,
      temperatureKelvin: T,
      macroscopicRateConstant: k,
      volumeLiters: 0.001,
      reactionOrder: 1,
      macroscopicUnits: 's^-1',
      stochasticRateConstant: k,
    }]);
    assert.equal(parseExperimentRecord(serializeExperiment(arrheniusRecord)).rateParameterisations[0].kind, 'arrhenius_conversion');
  });

  await t.test('exports event rows with escaped CSV text', () => {
    const csv = simulationEventsToCsv(result, model);
    assert.ok(csv.startsWith('event_index,time_seconds,reaction_id,reaction_label,count_A,count_B'));
    if (result.events.length > 0) assert.ok(csv.includes('"A → B, first order"'));
  });
});
