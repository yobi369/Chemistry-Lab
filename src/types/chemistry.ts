/**
 * Artificial Chemistry & System Call Engine Types
 * Based on Fringe Coding: Digital Molecules, Rewrite Rules, Energy Resources & Artificial Life
 */

export type MoleculeCategory = 'substrate' | 'catalyst' | 'product' | 'system_call' | 'polymer' | 'waste';

export interface MoleculeType {
  id: string;
  name: string;
  symbol: string;
  color: string;
  mass: number;
  radius: number;
  energyState: number; // Potential energy in kJ/mol
  category: MoleculeCategory;
  description: string;
  syscallOpcode?: string; // e.g. SYS_ALLOC, SYS_FORK, SYS_EXEC, SYS_MUTATE
}

export interface ReactionComponent {
  moleculeId: string;
  count: number;
}

export interface ReactionRule {
  id: string;
  name: string;
  reactants: ReactionComponent[];
  products: ReactionComponent[];
  catalysts: string[]; // Molecule IDs that catalyze without being consumed
  activationEnergy: number; // in kJ or energy units
  rateConstant: number; // Probability factor k in (0, 1]
  energyDelta: number; // Negative = Exothermic (releases energy), Positive = Endothermic
  syscallType?: string; // System call triggered upon rewrite
  description: string;
  enabled: boolean;
}

export interface Particle {
  id: string;
  typeId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  energy: number;
  mass: number;
  radius: number;
  age: number;
  color: string;
  symbol: string;
  trail: { x: number; y: number }[];
  lastReactionTick?: number;
}

export interface ReactionFlash {
  id: string;
  x: number;
  y: number;
  color: string;
  radius: number;
  maxRadius: number;
  alpha: number;
  text?: string;
}

export interface ReactionEvent {
  id: string;
  tick: number;
  ruleId: string;
  ruleName: string;
  reactantNames: string[];
  productNames: string[];
  energyDelta: number;
  syscall?: string;
  location?: { x: number; y: number };
  timestamp: number;
}

export interface TimeSeriesPoint {
  tick: number;
  time: number;
  counts: Record<string, number>;
  totalCount: number;
  energy: number;
  temperature: number;
  entropy: number;
  reactionFlux: number;
}

export interface PresetSystem {
  id: string;
  name: string;
  tagline?: string;
  category: 'Fringe Artificial Chemistry' | 'Computational Syscalls' | 'Origin of Life & Hypercycles' | 'Oscillators & Chaos' | 'Chemical Ecology' | 'Custom User Experiments' | string;
  description: string;
  moleculeTypes: MoleculeType[];
  reactionRules: ReactionRule[];
  initialCounts: Record<string, number>;
  initialEnergy: number;
  defaultTemp: number;
  defaultStirSpeed: number;
  educationalNotes?: {
    title: string;
    content: string;
  }[];
}
