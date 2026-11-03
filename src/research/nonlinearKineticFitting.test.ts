import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fitMassActionMechanism } from './nonlinearKineticFitting';

const sequential = {
  speciesIds:['A','B','C'],
  initialConcentrations:{A:1,B:0,C:0},
  reactions:[
    {id:'k1',reactants:[{speciesId:'A',coefficient:1}],products:[{speciesId:'B',coefficient:1}]},
    {id:'k2',reactants:[{speciesId:'B',coefficient:1}],products:[{speciesId:'C',coefficient:1}]},
  ],
};
const parameters = [
  {reactionId:'k1',initialGuess:0.2,lowerBound:0.001,upperBound:2,units:'s^-1'},
  {reactionId:'k2',initialGuess:0.2,lowerBound:0.001,upperBound:2,units:'s^-1'},
];
test('multi-step nonlinear mass-action kinetic fitting', async t => {
  await t.test('recovers two sequential first-order rate constants from multi-species observations', () => {
    const trueFit = fitMassActionMechanism(sequential, [
      {...parameters[0],initialGuess:0.7},{...parameters[1],initialGuess:0.25},
    ], [0,0.5,1,1.5,2,3,4,5].flatMap(timeSeconds => [
      {timeSeconds,speciesId:'A',value:Math.exp(-0.7*timeSeconds)},
      {timeSeconds,speciesId:'B',value:0.7/(0.25-0.7)*(Math.exp(-0.7*timeSeconds)-Math.exp(-0.25*timeSeconds))},
      {timeSeconds,speciesId:'C',value:1-Math.exp(-0.7*timeSeconds)-0.7/(0.25-0.7)*(Math.exp(-0.7*timeSeconds)-Math.exp(-0.25*timeSeconds))},
    ]), {maxIntegrationStepSeconds:0.002});
    assert.ok(Math.abs(trueFit.parameterEstimates.k1-0.7)<0.002);
    assert.ok(Math.abs(trueFit.parameterEstimates.k2-0.25)<0.002);
    assert.ok(trueFit.locallyIdentifiable);
    assert.equal(trueFit.parameterCount,2);
    assert.ok(trueFit.correlationMatrix);
  });
  await t.test('supports weighted observations and reports covariance/correlation diagnostics', () => {
    const observations = [0,0.5,1,1.5,2,3,4,5].flatMap(timeSeconds => [
      {timeSeconds,speciesId:'A',value:Math.exp(-0.7*timeSeconds),standardDeviation:0.01},
      {timeSeconds,speciesId:'B',value:0.7/(0.25-0.7)*(Math.exp(-0.7*timeSeconds)-Math.exp(-0.25*timeSeconds)),standardDeviation:0.01},
    ]);
    const fit=fitMassActionMechanism(sequential,parameters,observations,{maxIntegrationStepSeconds:0.002});
    assert.ok(fit.parameterEstimates.k1>0);
    assert.ok(fit.standardErrors);
    assert.ok(fit.covarianceMatrix);
  });
  await t.test('flags unidentifiable parameters when only one species time series constrains two rates', () => {
    const observations=[0,1,2,3,4,5].map(timeSeconds=>({timeSeconds,speciesId:'A',value:Math.exp(-0.7*timeSeconds)}));
    const fit=fitMassActionMechanism(sequential,parameters,observations);
    assert.equal(fit.locallyIdentifiable,false);
    assert.equal(fit.identifiableParameterCount,1);
    assert.equal(fit.parameterCount,2);
    assert.equal(fit.covarianceMatrix,null);
    assert.ok(fit.warnings.some(w=>w.includes('locally unidentifiable')));
  });
  await t.test('rejects missing parameter bounds, unknown species and incomplete uncertainty', () => {
    assert.throws(()=>fitMassActionMechanism(sequential,[parameters[0]],[
      {timeSeconds:0,speciesId:'A',value:1},
      {timeSeconds:1,speciesId:'A',value:0.5},
      {timeSeconds:2,speciesId:'A',value:0.2},
    ],{}),/one unique kinetic parameter/);
    assert.throws(()=>fitMassActionMechanism(sequential,parameters,[
      {timeSeconds:0,speciesId:'X',value:1},
      {timeSeconds:1,speciesId:'X',value:0.5},
      {timeSeconds:2,speciesId:'X',value:0.2},
    ]),/invalid species/);
    assert.throws(()=>fitMassActionMechanism(sequential,parameters,[
      {timeSeconds:0,speciesId:'A',value:1,standardDeviation:0.1},
      {timeSeconds:1,speciesId:'A',value:0.5},
      {timeSeconds:2,speciesId:'A',value:0.2},
    ]),/standard deviations for all/);
  });

  await t.test('fits a stiff sequential mechanism through the adaptive implicit integrator and matches SciPy BDF', () => {
    const fixture = JSON.parse(readFileSync(new URL('../../scripts/benchmarks/fixtures/stiff-sequential-kinetic-fit.json', import.meta.url), 'utf8'));
    const mechanism = {
      speciesIds: fixture.species_ids,
      initialConcentrations: fixture.initial_concentrations,
      reactions: fixture.reactions.map((reaction: any) => ({
        id: reaction.id,
        reactants: reaction.reactants.map((term: any) => ({ speciesId: term.species_id, coefficient: term.coefficient })),
        products: reaction.products.map((term: any) => ({ speciesId: term.species_id, coefficient: term.coefficient })),
      })),
    };
    const observations = fixture.times_seconds.flatMap((timeSeconds: number, timeIndex: number) =>
      fixture.species_ids.map((speciesId: string, speciesIndex: number) => ({
        timeSeconds, speciesId,
        value: fixture.observed_concentrations[timeIndex][speciesIndex],
        standardDeviation: fixture.standard_deviation,
      })),
    );
    const parameters = ['k1', 'k2'].map((reactionId, index) => ({
      reactionId,
      initialGuess: fixture.typescript_fit.initial_guess[index],
      lowerBound: fixture.parameter_bounds.lower[index],
      upperBound: fixture.parameter_bounds.upper[index],
      units: 's^-1',
    }));
    const fit = fitMassActionMechanism(mechanism, parameters, observations, {
      integrator: 'adaptive-implicit',
      adaptiveImplicitOptions: {
        relativeTolerance: fixture.typescript_fit.relative_tolerance,
        absoluteTolerance: fixture.typescript_fit.absolute_tolerance,
        maximumSteps: fixture.typescript_fit.maximum_steps,
        maximumNewtonIterations: fixture.typescript_fit.maximum_newton_iterations,
      },
      maxIterations: fixture.typescript_fit.maximum_iterations,
      convergenceTolerance: fixture.typescript_fit.convergence_tolerance,
    });
    const reference = fixture.scipy_reference;
    assert.equal(fit.integrator, 'adaptive-implicit');
    assert.equal(fit.model, 'mass-action-mechanism-adaptive-implicit-levenberg-marquardt');
    assert.equal(fit.converged, true, fit.warnings.join('; '));
    assert.ok(Math.abs(fit.parameterEstimates.k1 - reference.parameters.k1) <= fixture.typescript_fit.parameter_tolerance[0]);
    assert.ok(Math.abs(fit.parameterEstimates.k2 - reference.parameters.k2) <= fixture.typescript_fit.parameter_tolerance[1]);
    assert.ok(fit.weightedResidualSumSquares <= fixture.typescript_fit.weighted_rss_tolerance, JSON.stringify({ rss: fit.weightedResidualSumSquares, estimates: fit.parameterEstimates, diagnostics: fit.integrationDiagnostics, failures: fit.integrationFailures, warnings: fit.warnings }));
    assert.ok(fit.integrationDiagnostics);
    assert.ok(fit.integrationDiagnostics.acceptedSteps > 0);
    assert.ok(fit.integrationDiagnostics.newtonIterations > 0);
    assert.equal(fit.integrationFailures, 0);
    for (const row of fit.fitted) {
      assert.ok(Math.abs(row.predicted - row.observed) <= fixture.typescript_fit.prediction_tolerance,
        'stiff fit prediction mismatch at t=' + row.timeSeconds + ' species=' + row.speciesId);
    }
  });

  await t.test('fits a stiff reversible relaxation and slow-drain network against independent SciPy BDF', () => {
    const fixture = JSON.parse(readFileSync(new URL('../../scripts/benchmarks/fixtures/stiff-reversible-slow-drain-fit.json', import.meta.url), 'utf8'));
    const mechanism = {
      speciesIds: fixture.species_ids,
      initialConcentrations: fixture.initial_concentrations,
      reactions: fixture.reactions.map((reaction: any) => ({
        id: reaction.id,
        reactants: reaction.reactants.map((term: any) => ({ speciesId: term.species_id, coefficient: term.coefficient })),
        products: reaction.products.map((term: any) => ({ speciesId: term.species_id, coefficient: term.coefficient })),
      })),
    };
    const observations = fixture.times_seconds.flatMap((timeSeconds: number, timeIndex: number) =>
      fixture.species_ids.map((speciesId: string, speciesIndex: number) => ({
        timeSeconds, speciesId,
        value: fixture.observed_concentrations[timeIndex][speciesIndex],
        standardDeviation: fixture.standard_deviation,
      })),
    );
    const parameters = ['forward', 'reverse', 'drain'].map((reactionId, index) => ({
      reactionId,
      initialGuess: fixture.fit.initial_guess[index],
      lowerBound: fixture.fit.lower_bounds[index],
      upperBound: fixture.fit.upper_bounds[index],
      units: 's^-1',
    }));
    const fit = fitMassActionMechanism(mechanism, parameters, observations, {
      integrator: 'adaptive-implicit',
      adaptiveImplicitOptions: {
        relativeTolerance: fixture.fit.relative_tolerance,
        absoluteTolerance: fixture.fit.absolute_tolerance,
        maximumSteps: fixture.fit.maximum_steps,
        maximumNewtonIterations: fixture.fit.maximum_newton_iterations,
      },
      maxIterations: fixture.fit.maximum_iterations,
      convergenceTolerance: fixture.fit.convergence_tolerance,
    });
    const reference = fixture.scipy_reference;
    assert.equal(fit.integrator, 'adaptive-implicit');
    assert.equal(fit.converged, true, fit.warnings.join('; '));
    assert.equal(fit.integrationFailures, 0, JSON.stringify({ diagnostics: fit.integrationDiagnostics, warnings: fit.warnings }));
    for (const reactionId of ['forward', 'reverse', 'drain']) {
      const tolerance = reference.parameter_tolerance[['forward', 'reverse', 'drain'].indexOf(reactionId)];
      assert.ok(Math.abs(fit.parameterEstimates[reactionId] - reference.parameters[reactionId]) <= tolerance,
        reactionId + ' parameter estimate differs from SciPy BDF: ' + JSON.stringify(fit.parameterEstimates));
    }
    assert.ok(fit.weightedResidualSumSquares <= reference.weighted_residual_sum_squares + reference.weighted_rss_tolerance, JSON.stringify({ rss: fit.weightedResidualSumSquares, estimates: fit.parameterEstimates, diagnostics: fit.integrationDiagnostics, fittedMaxError: Math.max(...fit.fitted.map(row => Math.abs(row.predicted - row.observed))) }));
    assert.ok(fit.integrationDiagnostics);
    assert.ok(fit.integrationDiagnostics.acceptedSteps > 0);
    assert.ok(fit.fitted.every(row => Math.abs(row.predicted - row.observed) <= reference.prediction_tolerance));
  });

  await t.test('matches the pinned SciPy reference on the shared weighted-observation fixture', () => {
    const fixture = JSON.parse(readFileSync(new URL('../../scripts/benchmarks/fixtures/sequential-kinetic-fit.json', import.meta.url), 'utf8'));
    const mechanism = {
      speciesIds: fixture.species_ids,
      initialConcentrations: fixture.initial_concentrations,
      reactions: [
        {id:'k1',reactants:[{speciesId:'A',coefficient:1}],products:[{speciesId:'B',coefficient:1}]},
        {id:'k2',reactants:[{speciesId:'B',coefficient:1}],products:[{speciesId:'C',coefficient:1}]},
      ],
    };
    const observations = fixture.times_seconds.flatMap((timeSeconds: number, timeIndex: number) =>
      fixture.species_ids.map((speciesId: string, speciesIndex: number) => ({
        timeSeconds,
        speciesId,
        value: fixture.observed_concentrations[timeIndex][speciesIndex],
        standardDeviation: fixture.standard_deviation,
      })),
    );
    const parameters = ['k1','k2'].map((reactionId, index) => ({
      reactionId,
      initialGuess: fixture.typescript_fit.initial_guess[index],
      lowerBound: fixture.parameter_bounds.lower[index],
      upperBound: fixture.parameter_bounds.upper[index],
      units: 's^-1',
    }));
    const fit = fitMassActionMechanism(mechanism, parameters, observations, {
      maxIntegrationStepSeconds: fixture.typescript_fit.max_integration_step_seconds,
      maxIterations: fixture.typescript_fit.max_iterations,
      convergenceTolerance: fixture.typescript_fit.convergence_tolerance,
    });
    const scipy = fixture.scipy_reference;
    assert.equal(fit.converged, true, fit.warnings.join('; '));
    assert.equal(fit.locallyIdentifiable, true);
    assert.ok(Math.abs(fit.parameterEstimates.k1-scipy.parameters.k1) <= fixture.typescript_fit.parameter_tolerance);
    assert.ok(Math.abs(fit.parameterEstimates.k2-scipy.parameters.k2) <= fixture.typescript_fit.parameter_tolerance);
    assert.ok(Math.abs(fit.weightedResidualSumSquares-scipy.weighted_residual_sum_squares) <= fixture.typescript_fit.weighted_rss_tolerance);
  });
});
