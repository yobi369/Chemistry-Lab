import test from 'node:test';
import assert from 'node:assert/strict';
import { fitQinAlternativeModel } from './qinHydrogenModels';
import { QinExperimentSeries } from './qinHydrogenModel';

function series(id: string, ironType: 'Alfa' | 'Beijing', model: '1' | '2' | '3'): QinExperimentSeries {
  const times = [0, 2, 4, 8, 24, 48, 72, 96, 120];
  const k1 = ironType === 'Alfa' ? 0.42 : 0.18;
  const k2 = ironType === 'Alfa' ? 0.008 : 0.002;
  const ratio = 3;
  const scale = id.endsWith('1') ? 0.5 : 0.8;
  return {
    experimentId: id, label: id + ' ' + ironType, ironType,
    observations: times.map(timeHours => {
      const e1 = -Math.expm1(-k1 * timeHours);
      const e2 = -Math.expm1(-k2 * timeHours);
      const value = model === '1' ? scale * e1 :
        model === '2' ? scale * (timeHours + (ratio - 1) * e1 / k1) :
          scale * (ratio * e1 / k1 + (Math.abs(k2-k1) < 1e-7
            ? (1 - Math.exp(-k1*timeHours)*(1+k1*timeHours))/k1
            : k1/(k2-k1)*(e1/k1-e2/k2)));
      return { timeHours, hydrogenMicromoles: value, standardDeviationMicromoles: 0.1 };
    }),
  };
}

for (const model of ['1', '2', '3'] as const) {
  test('Model ' + model + ' recovers its global rate parameters and local scale terms', () => {
    const data = [series('a1', 'Alfa', model), series('a2', 'Alfa', model),
      series('b1', 'Beijing', model), series('b2', 'Beijing', model)];
    const fit = fitQinAlternativeModel(model, data, {
      weighting: 'unweighted', zeroStandardDeviation: 'unweighted',
      initialRatesByIronType: {
        Alfa: { k1PerHour: 0.4, k2PerHour: 0.008 },
        Beijing: { k1PerHour: 0.2, k2PerHour: 0.002 },
      },
    });
    assert.equal(fit.converged, true);
    assert.ok(Math.abs(fit.rateParametersByIronType.Alfa.k1PerHour - 0.42) < 1e-4);
    assert.ok(Math.abs(fit.rateParametersByIronType.Beijing.k1PerHour - 0.18) < 1e-4);
    if (model === '2' || model === '3') {
      assert.ok(Math.abs(fit.rateParametersByIronType.Alfa.ratio! - 3) < 1e-3);
      assert.ok(Math.abs(fit.rateParametersByIronType.Beijing.ratio! - 3) < 1e-3);
    }
    if (model === '3') {
      assert.ok(Math.abs(fit.rateParametersByIronType.Alfa.k2PerHour! - 0.008) < 1e-4);
      assert.ok(Math.abs(fit.rateParametersByIronType.Beijing.k2PerHour! - 0.002) < 1e-4);
    }
    assert.ok(fit.sumSquaredResiduals < 1e-7);
  });
}
