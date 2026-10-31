import { createSeededRandom, SimulationInputError } from './gillespie';
import { simulateMassActionMechanism, type KineticMechanism, type KineticParameterBound } from './nonlinearKineticFitting';

export interface CorrelatedUncertaintyOptions {
  readonly sampleCount?: number;
  readonly seed?: number;
  readonly confidenceLevel?: number;
  readonly maxAttempts?: number;
  readonly maxIntegrationStepSeconds?: number;
}
export interface CorrelatedPredictionBand {
  readonly timeSeconds: number;
  readonly speciesId: string;
  readonly mean: number;
  readonly standardDeviation: number;
  readonly lowerQuantile: number;
  readonly median: number;
  readonly upperQuantile: number;
}
export interface CorrelatedKineticUncertaintyResult {
  readonly method: 'correlated-multivariate-normal-parameter-propagation';
  readonly seed: number;
  readonly requestedSamples: number;
  readonly acceptedSamples: number;
  readonly attempts: number;
  readonly confidenceLevel: number;
  readonly bands: readonly CorrelatedPredictionBand[];
}

function cholesky(matrix: readonly (readonly number[])[]): number[][] {
  const n=matrix.length;
  if(!n||matrix.some(row=>row.length!==n||row.some(value=>!Number.isFinite(value)))) {
    throw new SimulationInputError('Covariance matrix must be a non-empty finite square matrix.');
  }
  for(let i=0;i<n;i++)for(let j=0;j<n;j++)if(Math.abs(matrix[i][j]-matrix[j][i])>1e-9*Math.max(1,Math.abs(matrix[i][j]),Math.abs(matrix[j][i]))) {
    throw new SimulationInputError('Covariance matrix must be symmetric.');
  }
  const lower=Array.from({length:n},()=>Array(n).fill(0));
  for(let i=0;i<n;i++)for(let j=0;j<=i;j++){
    let sum=matrix[i][j];
    for(let k=0;k<j;k++)sum-=lower[i][k]*lower[j][k];
    if(i===j){
      if(sum < -1e-10*Math.max(1,Math.abs(matrix[i][i])))throw new SimulationInputError('Covariance matrix must be positive semidefinite.');
      lower[i][j]=Math.sqrt(Math.max(0,sum));
    }else if(lower[j][j]>1e-14){
      lower[i][j]=sum/lower[j][j];
    }else if(Math.abs(sum)>1e-9){
      throw new SimulationInputError('Covariance matrix is numerically non-positive-semidefinite.');
    }
  }
  return lower;
}
function quantile(sorted:readonly number[],probability:number):number {
  const position=(sorted.length-1)*probability;
  const lower=Math.floor(position),upper=Math.ceil(position);
  if(lower===upper)return sorted[lower];
  return sorted[lower]+(sorted[upper]-sorted[lower])*(position-lower);
}

/**
 * Propagate the full fitted parameter covariance through the nonlinear mechanism.
 * Samples are drawn jointly from a multivariate normal and rejected if outside
 * supplied physical parameter bounds. Prediction bands are conditional on this
 * local Gaussian approximation and the fixed model/initial concentrations.
 */
export function propagateCorrelatedKineticUncertainty(
  mechanism:KineticMechanism,
  parameters:readonly KineticParameterBound[],
  parameterMeans:Readonly<Record<string,number>>,
  covarianceMatrix:readonly (readonly number[])[],
  requestedTimesSeconds:readonly number[],
  options:CorrelatedUncertaintyOptions={},
):CorrelatedKineticUncertaintyResult {
  const sampleCount=options.sampleCount??1000,seed=options.seed??1;
  const confidence=options.confidenceLevel??0.95;
  const maxAttempts=options.maxAttempts??sampleCount*100;
  const maxStep=options.maxIntegrationStepSeconds??0.01;
  const n=parameters.length;
  if(!Number.isSafeInteger(sampleCount)||sampleCount<2||
     !Number.isSafeInteger(seed)||seed<0||seed>4294967295||
     !Number.isFinite(confidence)||confidence<=0||confidence>=1||
     !Number.isSafeInteger(maxAttempts)||maxAttempts<sampleCount||
     !Number.isFinite(maxStep)||maxStep<=0||!requestedTimesSeconds.length||
     requestedTimesSeconds.some(t=>!Number.isFinite(t)||t<0)) {
    throw new SimulationInputError('Correlated uncertainty options or requested times are invalid.');
  }
  if(parameters.length!==mechanism.reactions.length||new Set(parameters.map(p=>p.reactionId)).size!==n||
     parameters.some(p=>!mechanism.reactions.some(r=>r.id===p.reactionId))) {
    throw new SimulationInputError('Provide exactly one parameter bound for every mechanism reaction.');
  }
  const means=parameters.map(p=>{
    const mean=parameterMeans[p.reactionId];
    if(!Number.isFinite(mean)||mean<p.lowerBound||mean>p.upperBound||
       !Number.isFinite(p.lowerBound)||!Number.isFinite(p.upperBound)||p.lowerBound<0||p.upperBound<=p.lowerBound) {
      throw new SimulationInputError(`Mean or bounds for "${p.reactionId}" are invalid.`);
    }
    return mean;
  });
  if(covarianceMatrix.length!==n||covarianceMatrix.some(row=>row.length!==n)) {
    throw new SimulationInputError('Covariance dimensions must match the fitted parameter count.');
  }
  const lower=cholesky(covarianceMatrix);
  const random=createSeededRandom(seed);
  const standardNormals=()=>{
    const values:number[]=[];
    while(values.length<n){
      const u1=Math.max(Number.EPSILON,random()),u2=random();
      const radius=Math.sqrt(-2*Math.log(u1)),angle=2*Math.PI*u2;
      values.push(radius*Math.cos(angle));
      if(values.length<n)values.push(radius*Math.sin(angle));
    }
    return values;
  };
  const sortedTimes=[...new Set(requestedTimesSeconds)].sort((a,b)=>a-b);
  const samples:Record<string,number[]>={};
  for(const time of sortedTimes)for(const id of mechanism.speciesIds)samples[`${time}| ${id}`]=[];
  let accepted=0,attempts=0;
  while(accepted<sampleCount&&attempts<maxAttempts){
    attempts++;
    const z=standardNormals();
    const draw=means.map((mean,i)=>mean+lower[i].reduce((sum,value,j)=>sum+value*z[j],0));
    if(draw.some((value,i)=>value<parameters[i].lowerBound||value>parameters[i].upperBound))continue;
    const rates=Object.fromEntries(parameters.map((p,i)=>[p.reactionId,draw[i]]));
    const trajectory=simulateMassActionMechanism(mechanism,rates,sortedTimes,maxStep);
    for(const state of trajectory)for(const id of mechanism.speciesIds)samples[`${state.timeSeconds}| ${id}`].push(state.concentrations[id]);
    accepted++;
  }
  if(accepted<sampleCount)throw new SimulationInputError(`Only ${accepted} of ${sampleCount} bounded correlated parameter samples were accepted after ${attempts} attempts; review bounds/covariance or increase maxAttempts.`);
  const tail=(1-confidence)/2;
  const bands:CorrelatedPredictionBand[]=[];
  for(const time of sortedTimes)for(const id of mechanism.speciesIds){
    const values=samples[`${time}| ${id}`].sort((a,b)=>a-b);
    const mean=values.reduce((sum,value)=>sum+value,0)/values.length;
    const variance=values.reduce((sum,value)=>sum+(value-mean)**2,0)/(values.length-1);
    bands.push({timeSeconds:time,speciesId:id,mean,standardDeviation:Math.sqrt(variance),
      lowerQuantile:quantile(values,tail),median:quantile(values,0.5),upperQuantile:quantile(values,1-tail)});
  }
  return {method:'correlated-multivariate-normal-parameter-propagation',seed,requestedSamples:sampleCount,
    acceptedSamples:accepted,attempts,confidenceLevel:confidence,bands};
}
