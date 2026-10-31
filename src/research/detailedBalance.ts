import { GAS_CONSTANT_J_PER_MOL_K } from './arrhenius';
import { SimulationInputError } from './gillespie';

export interface DetailedBalanceTerm { readonly speciesId: string; readonly coefficient: number }
export interface ReversibleThermodynamicReaction {
  readonly id: string;
  readonly reactants: readonly DetailedBalanceTerm[];
  readonly products: readonly DetailedBalanceTerm[];
  /** Forward rate coefficient in s^-1 when all reactant activities are dimensionless. */
  readonly forwardRateConstantPerSecond: number;
}
export interface DetailedBalanceReactionResult {
  readonly reactionId: string;
  readonly temperatureKelvin: number;
  readonly standardGibbsEnergyJPerMol: number;
  readonly logEquilibriumConstant: number;
  readonly equilibriumConstant: number | null;
  readonly forwardRateConstantPerSecond: number;
  readonly reverseRateConstantPerSecond: number;
}
export interface EquilibriumValidation {
  readonly reactionId: string;
  readonly logReactionQuotient: number;
  readonly logEquilibriumConstant: number;
  readonly reactionGibbsEnergyJPerMol: number;
  readonly forwardFluxPerSecond: number;
  readonly reverseFluxPerSecond: number;
  readonly netFluxPerSecond: number;
  readonly relativeFluxImbalance: number;
  readonly equilibriumConsistent: boolean;
}
export interface ReversibleActivitySimulationInput {
  readonly speciesIds: readonly string[];
  readonly initialActivities: Readonly<Record<string, number>>;
  readonly reactions: readonly ReversibleThermodynamicReaction[];
  readonly standardGibbsFormationJPerMol: Readonly<Record<string, number>>;
  readonly temperatureKelvin: number;
  readonly timeStepSeconds: number;
  readonly steps: number;
}
export interface ReversibleActivitySimulationResult {
  readonly elapsedSeconds: number;
  readonly timeStepSeconds: number;
  readonly steps: number;
  readonly activities: Readonly<Record<string, number>>;
  readonly reactionRates: readonly DetailedBalanceReactionResult[];
}

/** Derive k_reverse from k_forward and the thermodynamic equilibrium constant. */
export function deriveDetailedBalanceRates(args: {
  reaction: ReversibleThermodynamicReaction;
  standardGibbsFormationJPerMol: Readonly<Record<string, number>>;
  temperatureKelvin: number;
}): DetailedBalanceReactionResult {
  const {reaction,standardGibbsFormationJPerMol:formation,temperatureKelvin}=args;
  if (!Number.isFinite(temperatureKelvin) || temperatureKelvin<=0) throw new SimulationInputError('Temperature must be finite and greater than zero kelvin.');
  if (!reaction.id || !Number.isFinite(reaction.forwardRateConstantPerSecond) || reaction.forwardRateConstantPerSecond<=0) {
    throw new SimulationInputError('Reaction id and positive finite forward rate coefficient are required.');
  }
  if (!reaction.reactants.length || !reaction.products.length ||
      [...reaction.reactants,...reaction.products].some(term=>!term.speciesId || !Number.isSafeInteger(term.coefficient) || term.coefficient<1)) {
    throw new SimulationInputError('A reversible reaction requires non-empty sides and positive integer stoichiometric coefficients.');
  }
  const sum=(terms:readonly DetailedBalanceTerm[])=>terms.reduce((total,term)=>{
    const value=formation[term.speciesId];
    if (!Number.isFinite(value)) throw new SimulationInputError(`Missing finite standard Gibbs formation energy for "${term.speciesId}".`);
    return total+value*term.coefficient;
  },0);
  const deltaG=sum(reaction.products)-sum(reaction.reactants);
  const logK=-deltaG/(GAS_CONSTANT_J_PER_MOL_K*temperatureKelvin);
  const logReverse=Math.log(reaction.forwardRateConstantPerSecond)-logK;
  const reverse=Math.exp(logReverse);
  if (!Number.isFinite(reverse) || reverse<=0) throw new SimulationInputError('Detailed-balance reverse rate is outside the representable numeric range.');
  const equilibrium=Math.exp(logK);
  return {
    reactionId:reaction.id,temperatureKelvin,standardGibbsEnergyJPerMol:deltaG,
    logEquilibriumConstant:logK,
    equilibriumConstant:Number.isFinite(equilibrium)&&equilibrium>0?equilibrium:null,
    forwardRateConstantPerSecond:reaction.forwardRateConstantPerSecond,
    reverseRateConstantPerSecond:reverse,
  };
}

/** Check Q=K and equality of forward/reverse mass-action fluxes at supplied activities. */
export function validateDetailedBalanceEquilibrium(args: {
  reaction: ReversibleThermodynamicReaction;
  standardGibbsFormationJPerMol: Readonly<Record<string, number>>;
  temperatureKelvin: number;
  activities: Readonly<Record<string, number>>;
  logEquilibriumTolerance?: number;
  relativeFluxTolerance?: number;
}): EquilibriumValidation {
  const rates=deriveDetailedBalanceRates(args);
  const logActivity=(id:string)=>{
    const value=args.activities[id];
    if (!Number.isFinite(value)||value<=0) throw new SimulationInputError(`Equilibrium activity for "${id}" must be finite and positive.`);
    return Math.log(value);
  };
  const logProduct=(terms:readonly DetailedBalanceTerm[])=>terms.reduce((sum,term)=>sum+term.coefficient*logActivity(term.speciesId),0);
  const logQ=logProduct(args.reaction.products)-logProduct(args.reaction.reactants);
  const qMinusK=logQ-rates.logEquilibriumConstant;
  const reactionGibbs=GAS_CONSTANT_J_PER_MOL_K*args.temperatureKelvin*qMinusK;
  const product=(terms:readonly DetailedBalanceTerm[],k:number)=>k*Math.exp(terms.reduce((sum,term)=>sum+term.coefficient*logActivity(term.speciesId),0));
  const forward=product(args.reaction.reactants,rates.forwardRateConstantPerSecond);
  const reverse=product(args.reaction.products,rates.reverseRateConstantPerSecond);
  const net=forward-reverse;
  const relative=Math.abs(net)/Math.max(forward,reverse,Number.MIN_VALUE);
  const logTolerance=args.logEquilibriumTolerance??1e-8;
  const fluxTolerance=args.relativeFluxTolerance??1e-8;
  if (![logTolerance,fluxTolerance].every(Number.isFinite)||logTolerance<0||fluxTolerance<0) {
    throw new SimulationInputError('Equilibrium tolerances must be finite and non-negative.');
  }
  return {
    reactionId:args.reaction.id,logReactionQuotient:logQ,
    logEquilibriumConstant:rates.logEquilibriumConstant,
    reactionGibbsEnergyJPerMol:reactionGibbs,
    forwardFluxPerSecond:forward,reverseFluxPerSecond:reverse,
    netFluxPerSecond:net,relativeFluxImbalance:relative,
    equilibriumConsistent:Math.abs(qMinusK)<=logTolerance&&relative<=fluxTolerance,
  };
}

/**
 * Deterministic reversible mass-action ODE in dimensionless activities:
 * da_i/dt = Σ_r ν_ir (k_f Π a_reactants - k_r Π a_products).
 * All activity components share the same standard-state convention. Coefficients
 * are in s^-1 because activities are dimensionless. This is an ideal-activity,
 * well-mixed model, not a concentration-unit conversion utility.
 */
export function simulateDetailedBalanceReversible(
  input:ReversibleActivitySimulationInput,
):ReversibleActivitySimulationResult {
  const {speciesIds,initialActivities,reactions,standardGibbsFormationJPerMol:formation,temperatureKelvin, timeStepSeconds:dt,steps}=input;
  const ids=new Set(speciesIds);
  if (!speciesIds.length||ids.size!==speciesIds.length||!Number.isFinite(dt)||dt<=0||!Number.isSafeInteger(steps)||steps<1) {
    throw new SimulationInputError('Unique species ids, positive time step and positive integer step count are required.');
  }
  for(const id of ids) if(!Number.isFinite(initialActivities[id])||initialActivities[id]<0) throw new SimulationInputError(`Initial activity for "${id}" must be finite and non-negative.`);
  const reactionIds=new Set<string>();
  const rates=reactions.map(reaction=>{
    if(reactionIds.has(reaction.id)) throw new SimulationInputError(`Duplicate reversible reaction id "${reaction.id}".`);
    reactionIds.add(reaction.id);
    for(const term of [...reaction.reactants,...reaction.products]) if(!ids.has(term.speciesId)) throw new SimulationInputError(`Unknown species "${term.speciesId}" in reaction "${reaction.id}".`);
    return deriveDetailedBalanceRates({reaction,standardGibbsFormationJPerMol:formation,temperatureKelvin});
  });
  const y=speciesIds.map(id=>initialActivities[id]);
  const stoich=reactions.map(r=>speciesIds.map(id=>
    (r.products.find(t=>t.speciesId===id)?.coefficient??0)-
    (r.reactants.find(t=>t.speciesId===id)?.coefficient??0)));
  const flux=(terms:readonly DetailedBalanceTerm[],k:number,state:readonly number[])=>{
    let value=k;
    for(const term of terms) value*=state[speciesIds.indexOf(term.speciesId)]**term.coefficient;
    return value;
  };
  const derivative=(state:readonly number[])=>{
    const dy=speciesIds.map(()=>0);
    reactions.forEach((reaction,r)=>{
      const net=flux(reaction.reactants,rates[r].forwardRateConstantPerSecond,state)-
        flux(reaction.products,rates[r].reverseRateConstantPerSecond,state);
      for(let i=0;i<dy.length;i++) dy[i]+=stoich[r][i]*net;
    });
    return dy;
  };
  const add=(state:readonly number[],k:readonly number[],scale:number)=>state.map((v,i)=>v+scale*k[i]);
  for(let step=0;step<steps;step++){
    const h=dt,k1=derivative(y),k2=derivative(add(y,k1,h/2)),k3=derivative(add(y,k2,h/2)),k4=derivative(add(y,k3,h));
    for(let i=0;i<y.length;i++) y[i]+=h*(k1[i]+2*k2[i]+2*k3[i]+k4[i])/6;
    if(y.some(value=>!Number.isFinite(value)||value < -1e-9)) throw new SimulationInputError('Reversible ODE integration became non-finite or negative; reduce the time step.');
    for(let i=0;i<y.length;i++) if(y[i]<0)y[i]=0;
  }
  return {
    elapsedSeconds:dt*steps,timeStepSeconds:dt,steps,
    activities:Object.fromEntries(speciesIds.map((id,i)=>[id,y[i]])),
    reactionRates:rates,
  };
}
