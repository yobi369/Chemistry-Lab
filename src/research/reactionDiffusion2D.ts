import { SimulationInputError } from './gillespie';
import type { FirstOrderSpatialReaction } from './reactionDiffusion1D';

export interface DiffusionSpecies2D {
  readonly id: string;
  readonly diffusionCoefficientM2PerS: number;
  /** Constant transport velocity along x, m s^-1; positive toward increasing column index. */
  readonly velocityXMetersPerSecond?: number;
  /** Constant transport velocity along y, m s^-1; positive toward increasing row index. */
  readonly velocityYMetersPerSecond?: number;
  /** Rectangular row-major array [y][x] in mol m^-3. */
  readonly initialConcentrationMolPerM3: readonly (readonly number[])[];
}
export interface ReactionDiffusion2DInput {
  readonly widthMeters: number;
  readonly heightMeters: number;
  readonly timeStepSeconds: number;
  readonly steps: number;
  readonly species: readonly DiffusionSpecies2D[];
  readonly reactions: readonly FirstOrderSpatialReaction[];
  readonly boundaryCondition?: 'no-flux' | 'periodic';
}
export interface ReactionDiffusion2DResult {
  readonly cellWidthXMeters: number;
  readonly cellWidthYMeters: number;
  readonly elapsedSeconds: number;
  readonly timeStepSeconds: number;
  readonly steps: number;
  readonly stabilityNumber: number;
  readonly boundaryCondition: 'no-flux' | 'periodic';
  /** Species id -> row-major [y][x] concentration array in mol m^-3. */
  readonly concentrationsMolPerM3: Readonly<Record<string, readonly (readonly number[])[]>>;
}

/**
 * Conservative 2-D cell-centred finite-volume transport/reaction solver.
 * Diffusion uses centred face fluxes, advection first-order upwind face fluxes,
 * and the time integrator is explicit Euler. Reaction channels are unimolecular.
 */
export function simulateReactionDiffusion2D(input: ReactionDiffusion2DInput): ReactionDiffusion2DResult {
  const {widthMeters,heightMeters,timeStepSeconds:dt,steps,species,reactions}=input;
  const boundary=input.boundaryCondition??'no-flux';
  if(!Number.isFinite(widthMeters)||widthMeters<=0||!Number.isFinite(heightMeters)||heightMeters<=0||
     !Number.isFinite(dt)||dt<=0||!Number.isSafeInteger(steps)||steps<1||
     !Array.isArray(species)||species.length<1||!['no-flux','periodic'].includes(boundary)){
    throw new SimulationInputError('Domain dimensions, time step, steps, boundary condition and species must be valid.');
  }
  const rows=species[0].initialConcentrationMolPerM3.length;
  const columns=species[0].initialConcentrationMolPerM3[0]?.length??0;
  if(rows<2||columns<2)throw new SimulationInputError('A 2-D grid requires at least two rows and two columns.');
  const ids=new Set<string>();
  for(const item of species){
    if(!item.id||ids.has(item.id))throw new SimulationInputError('Species ids must be non-empty and unique.');
    ids.add(item.id);
    const ux=item.velocityXMetersPerSecond??0,uy=item.velocityYMetersPerSecond??0;
    if(!Number.isFinite(item.diffusionCoefficientM2PerS)||item.diffusionCoefficientM2PerS<0||
       !Number.isFinite(ux)||!Number.isFinite(uy)||
       item.initialConcentrationMolPerM3.length!==rows||
       item.initialConcentrationMolPerM3.some(row=>row.length!==columns||row.some(v=>!Number.isFinite(v)||v<0))){
      throw new SimulationInputError(`Species "${item.id}" has invalid transport or rectangular-grid concentration data.`);
    }
  }
  const outRates:Record<string,number>=Object.fromEntries(species.map(item=>[item.id,0]));
  for(const reaction of reactions){
    if(!reaction.id||!ids.has(reaction.reactantSpeciesId)||!Number.isFinite(reaction.rateConstantPerS)||reaction.rateConstantPerS<0||
       !Array.isArray(reaction.products)||reaction.products.some(p=>!ids.has(p.speciesId)||!Number.isSafeInteger(p.coefficient)||p.coefficient<1)){
      throw new SimulationInputError(`Reaction "${reaction.id}" is invalid.`);
    }
    outRates[reaction.reactantSpeciesId]+=reaction.rateConstantPerS;
  }
  const dx=widthMeters/columns,dy=heightMeters/rows;
  const maxD=Math.max(...species.map(s=>s.diffusionCoefficientM2PerS));
  const maxUx=Math.max(...species.map(s=>Math.abs(s.velocityXMetersPerSecond??0)));
  const maxUy=Math.max(...species.map(s=>Math.abs(s.velocityYMetersPerSecond??0)));
  const maxOut=Math.max(...Object.values(outRates));
  const stabilityNumber=dt*(2*maxD*(1/(dx*dx)+1/(dy*dy))+maxUx/dx+maxUy/dy+maxOut);
  if(stabilityNumber>1+1e-12)throw new SimulationInputError(`Explicit 2-D solver unstable: stability number ${stabilityNumber} exceeds 1.`);

  const values:Record<string,number[][]>=Object.fromEntries(species.map(s=>[s.id,s.initialConcentrationMolPerM3.map(row=>[...row])]));
  for(let step=0;step<steps;step++){
    const next:Record<string,number[][]>={};
    for(const item of species){
      const current=values[item.id],ux=item.velocityXMetersPerSecond??0,uy=item.velocityYMetersPerSecond??0;
      const updated=current.map((row,y)=>row.map((value,x)=>{
        const leftX=(x-1+columns)%columns,rightX=(x+1)%columns;
        const downY=(y-1+rows)%rows,upY=(y+1)%rows;
        const leftD=boundary==='no-flux'&&x===0?0:item.diffusionCoefficientM2PerS*(value-current[y][leftX])/dx;
        const rightD=boundary==='no-flux'&&x===columns-1?0:item.diffusionCoefficientM2PerS*(current[y][rightX]-value)/dx;
        const downD=boundary==='no-flux'&&y===0?0:item.diffusionCoefficientM2PerS*(value-current[downY][x])/dy;
        const upD=boundary==='no-flux'&&y===rows-1?0:item.diffusionCoefficientM2PerS*(current[upY][x]-value)/dy;
        const leftA=boundary==='no-flux'&&x===0?0:(ux>=0?ux*current[y][leftX]:ux*value);
        const rightA=boundary==='no-flux'&&x===columns-1?0:(ux>=0?ux*value:ux*current[y][rightX]);
        const downA=boundary==='no-flux'&&y===0?0:(uy>=0?uy*current[downY][x]:uy*value);
        const upA=boundary==='no-flux'&&y===rows-1?0:(uy>=0?uy*value:uy*current[upY][x]);
        return value+dt*((rightD-leftD)/dx+(upD-downD)/dy-(rightA-leftA)/dx-(upA-downA)/dy);
      }));
      next[item.id]=updated;
    }
    for(const reaction of reactions){
      const source=values[reaction.reactantSpeciesId];
      for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){
        const extent=dt*reaction.rateConstantPerS*source[y][x];
        next[reaction.reactantSpeciesId][y][x]-=extent;
        for(const product of reaction.products)next[product.speciesId][y][x]+=product.coefficient*extent;
      }
    }
    for(const item of species)for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){
      const value=next[item.id][y][x];
      if(!Number.isFinite(value)||value < -1e-10)throw new SimulationInputError('2-D solution became non-finite or negative; reduce the time step.');
      if(value<0)next[item.id][y][x]=0;
    }
    Object.assign(values,next);
  }
  return {
    cellWidthXMeters:dx,cellWidthYMeters:dy,elapsedSeconds:dt*steps,timeStepSeconds:dt,steps,
    stabilityNumber,boundaryCondition:boundary,
    concentrationsMolPerM3:Object.fromEntries(Object.entries(values).map(([id,grid])=>[id,grid])),
  };
}
