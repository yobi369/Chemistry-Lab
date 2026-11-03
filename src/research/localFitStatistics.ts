export interface LocalFitStatistics {
  readonly parameterNames: readonly string[];
  readonly standardErrors: Readonly<Record<string, number>> | null;
  readonly covarianceMatrix: readonly (readonly number[])[] | null;
  readonly correlationMatrix: Readonly<Record<string, Readonly<Record<string, number>>>> | null;
  readonly identifiableParameterCount: number;
  readonly locallyIdentifiable: boolean;
  readonly informationConditionNumber: number;
  readonly warnings: readonly string[];
}

/** Local finite-difference covariance for a weighted residual function at an optimum. */
export function calculateLocalFitStatistics(
  parameterNames: readonly string[],
  parameterValues: readonly number[],
  residualAt: (parameters: readonly number[]) => readonly number[],
  covarianceScale: number,
): LocalFitStatistics {
  const n = parameterValues.length;
  if (parameterNames.length !== n || new Set(parameterNames).size !== n ||
      parameterValues.some(v => !Number.isFinite(v)) ||
      !Number.isFinite(covarianceScale) || covarianceScale < 0) {
    throw new Error('Invalid parameter metadata or covariance scale.');
  }
  if (n === 0) return {
    parameterNames, standardErrors: {}, covarianceMatrix: [], correlationMatrix: {},
    identifiableParameterCount: 0, locallyIdentifiable: true,
    informationConditionNumber: 1, warnings: [],
  };
  const base = residualAt(parameterValues);
  if (!base.length || base.some(v => !Number.isFinite(v))) {
    return {
      parameterNames, standardErrors: null, covarianceMatrix: null, correlationMatrix: null,
      identifiableParameterCount: 0, locallyIdentifiable: false,
      informationConditionNumber: Number.POSITIVE_INFINITY,
      warnings: ['Covariance unavailable because the residual vector is empty or non-finite.'],
    };
  }
  const columns = parameterValues.map((value, j) => {
    const h = Math.max(Math.abs(value) * 1e-5, 1e-8);
    const plus = [...parameterValues], minus = [...parameterValues];
    plus[j] = value + h;
    minus[j] = value - h;
    const rp = residualAt(plus), rm = residualAt(minus);
    const width = plus[j] - minus[j];
    return base.map((_, i) => (rp[i] - rm[i]) / width);
  });
  const jacobian = base.map((_, i) => columns.map(column => column[i]));
  const norms = columns.map(column => Math.sqrt(column.reduce((sum, v) => sum + v*v, 0)));
  const basis: number[][] = [];
  for (let c = 0; c < n; c++) {
    if (norms[c] <= 1e-14) continue;
    const v = columns[c].map(x => x / norms[c]);
    for (let pass = 0; pass < 2; pass++) for (const q of basis) {
      const projection = v.reduce((sum, x, i) => sum + x*q[i], 0);
      for (let i = 0; i < v.length; i++) v[i] -= projection*q[i];
    }
    const norm = Math.sqrt(v.reduce((sum, x) => sum + x*x, 0));
    if (norm > 1e-8) basis.push(v.map(x => x / norm));
  }
  const rank = basis.length;
  const information = Array.from({ length: n }, (_, a) =>
    Array.from({ length: n }, (_, b) => dotColumn(columns[a], columns[b])));
  const eigen = symmetricEigenvalues(information);
  const maxEigen = Math.max(...eigen), minEigen = Math.min(...eigen);
  const condition = minEigen <= maxEigen * 1e-14 || minEigen <= 0
    ? Number.POSITIVE_INFINITY : maxEigen / minEigen;
  const inverse = invert(information);
  if (!inverse || rank < n) return {
    parameterNames, standardErrors: null, covarianceMatrix: null, correlationMatrix: null,
    identifiableParameterCount: rank, locallyIdentifiable: false,
    informationConditionNumber: condition,
    warnings: ['Local covariance is singular or rank deficient; parameter standard errors are not reported.'],
  };
  const covariance = inverse.map(row => row.map(v => v * covarianceScale));
  const errors = Object.fromEntries(parameterNames.map((name, i) =>
    [name, Math.sqrt(Math.max(0, covariance[i][i]))]));
  const correlations = Object.fromEntries(parameterNames.map((name, i) => [
    name, Object.fromEntries(parameterNames.map((other, j) => [
      other, covariance[i][i] > 0 && covariance[j][j] > 0
        ? covariance[i][j] / Math.sqrt(covariance[i][i] * covariance[j][j])
        : (i === j ? 1 : 0),
    ])),
  ]));
  const warnings = condition > 1e10 ? ['The weighted sensitivity information matrix is ill-conditioned; local standard errors may be unstable.'] : [];
  return {
    parameterNames, standardErrors: errors, covarianceMatrix: covariance,
    correlationMatrix: correlations, identifiableParameterCount: rank,
    locallyIdentifiable: true, informationConditionNumber: condition, warnings,
  };
}
function dotColumn(a: readonly number[], b: readonly number[]): number {
  return a.reduce((sum, v, i) => sum + v*b[i], 0);
}
function invert(matrix: number[][]): number[][] | null {
  const n = matrix.length, a = matrix.map((row, i) => [...row, ...Array.from({length:n},(_,j)=>i===j?1:0)]);
  const scale = Math.max(1, ...matrix.flat().map(Math.abs));
  for (let c = 0; c < n; c++) {
    let pivot = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[pivot][c])) pivot = r;
    if (Math.abs(a[pivot][c]) < scale * 1e-12) return null;
    [a[c],a[pivot]]=[a[pivot],a[c]];
    const d=a[c][c]; for(let j=0;j<2*n;j++) a[c][j]/=d;
    for(let r=0;r<n;r++) if(r!==c){const f=a[r][c];for(let j=0;j<2*n;j++)a[r][j]-=f*a[c][j];}
  }
  return a.map(row=>row.slice(n));
}
function symmetricEigenvalues(matrix: number[][]): number[] {
  const n=matrix.length, a=matrix.map(row=>[...row]);
  for(let sweep=0;sweep<50*n*n;sweep++){
    let p=0,q=0,largest=0;
    for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)if(Math.abs(a[i][j])>largest){largest=Math.abs(a[i][j]);p=i;q=j;}
    if(largest<1e-12)break;
    const angle=0.5*Math.atan2(2*a[p][q],a[q][q]-a[p][p]),c=Math.cos(angle),s=Math.sin(angle);
    const app=c*c*a[p][p]-2*s*c*a[p][q]+s*s*a[q][q];
    const aqq=s*s*a[p][p]+2*s*c*a[p][q]+c*c*a[q][q];
    for(let k=0;k<n;k++){if(k===p||k===q)continue;const kp=c*a[k][p]-s*a[k][q],kq=s*a[k][p]+c*a[k][q];a[k][p]=a[p][k]=kp;a[k][q]=a[q][k]=kq;}
    a[p][p]=app;a[q][q]=aqq;a[p][q]=a[q][p]=0;
  }
  return a.map((row,i)=>row[i]);
}
