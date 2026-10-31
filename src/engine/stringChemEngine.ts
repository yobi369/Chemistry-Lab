/**
 * Genetic String-Rewriting Chemistry Engine (AlChemy & Tierra-style digital soup)
 * 
 * Digital molecules are string programs composed of instruction opcodes:
 * [DUP, SWAP, SPLICE, BIND, MUT, EMIT, FORK, ROT, NOOP, CAT]
 * 
 * When two string programs collide, String A executes upon String B as an operator,
 * generating offspring strings or undergoing syntactic rewrite.
 * Includes lineage ancestry tracking, Shannon program diversity, and spontaneous self-replicator emergence.
 */

export const INSTRUCTION_SET = ['DUP', 'SWAP', 'SPLICE', 'BIND', 'MUT', 'EMIT', 'FORK', 'ROT', 'NOOP', 'CAT'] as const;
export type Instruction = typeof INSTRUCTION_SET[number];

export interface StringOrganism {
  id: string;
  code: Instruction[];
  generation: number;
  parentId: string | null;
  replicationCount: number;
  fitness: number;
  energy: number;
  length: number;
  color: string;
  signature: string;
  timestamp: number;
}

export interface LineageNode {
  id: string;
  signature: string;
  generation: number;
  parentId: string | null;
  count: number;
}

export class StringChemEngine {
  public population: StringOrganism[] = [];
  public maxPopulation: number = 100;
  public mutationRate: number = 0.08;
  public totalCollisions: number = 0;
  public totalReplications: number = 0;
  public lineageHistory: Map<string, LineageNode> = new Map();
  public historyDiversity: number[] = [];
  public historyAvgLength: number[] = [];

  constructor() {
    this.seedInitialSoup();
  }

  private generateColor(signature: string): string {
    let hash = 0;
    for (let i = 0; i < signature.length; i++) {
      hash = signature.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash % 360);
    return `hsl(${h}, 80%, 60%)`;
  }

  public seedInitialSoup(presetType: 'random' | 'replicator' | 'hypercycle' = 'replicator') {
    this.population = [];
    this.lineageHistory.clear();
    this.totalCollisions = 0;
    this.totalReplications = 0;
    this.historyDiversity = [];
    this.historyAvgLength = [];

    const now = Date.now();

    if (presetType === 'replicator') {
      // Seed with minimal self-copying instruction templates
      const seedCode: Instruction[] = ['DUP', 'BIND', 'SPLICE', 'EMIT'];
      const sig = seedCode.join('-');
      const color = this.generateColor(sig);

      for (let i = 0; i < 40; i++) {
        const id = `ORG_${i}_${Math.random().toString(36).slice(2, 6)}`;
        this.population.push({
          id,
          code: [...seedCode],
          generation: 0,
          parentId: null,
          replicationCount: 0,
          fitness: 1.0,
          energy: 50,
          length: seedCode.length,
          color,
          signature: sig,
          timestamp: now
        });
      }

      // Add a few mutant strains
      for (let i = 0; i < 15; i++) {
        const variant: Instruction[] = ['SWAP', 'DUP', 'MUT', 'FORK', 'EMIT'];
        const varSig = variant.join('-');
        const varColor = this.generateColor(varSig);
        this.population.push({
          id: `MUT_${i}_${Math.random().toString(36).slice(2, 6)}`,
          code: variant,
          generation: 0,
          parentId: null,
          replicationCount: 0,
          fitness: 1.0,
          energy: 50,
          length: variant.length,
          color: varColor,
          signature: varSig,
          timestamp: now
        });
      }
    } else if (presetType === 'hypercycle') {
      // 3 mutually reproducing species: A produces B, B produces C, C produces A
      const codes: Instruction[][] = [
        ['DUP', 'SWAP', 'BIND', 'EMIT'],
        ['SWAP', 'SPLICE', 'ROT', 'FORK'],
        ['ROT', 'BIND', 'DUP', 'CAT']
      ];

      for (let s = 0; s < 3; s++) {
        const code = codes[s];
        const sig = code.join('-');
        const color = this.generateColor(sig);
        for (let i = 0; i < 20; i++) {
          this.population.push({
            id: `HYPER_${s}_${i}`,
            code: [...code],
            generation: 0,
            parentId: null,
            replicationCount: 0,
            fitness: 1.0,
            energy: 60,
            length: code.length,
            color,
            signature: sig,
            timestamp: now
          });
        }
      }
    } else {
      // Random soup
      for (let i = 0; i < 50; i++) {
        const len = Math.floor(Math.random() * 4) + 3;
        const code: Instruction[] = [];
        for (let l = 0; l < len; l++) {
          code.push(INSTRUCTION_SET[Math.floor(Math.random() * INSTRUCTION_SET.length)]);
        }
        const sig = code.join('-');
        this.population.push({
          id: `RND_${i}`,
          code,
          generation: 0,
          parentId: null,
          replicationCount: 0,
          fitness: 1.0,
          energy: 50,
          length: code.length,
          color: this.generateColor(sig),
          signature: sig,
          timestamp: now
        });
      }
    }

    this.updateLineage();
  }

  public step(reactionCycles: number = 5) {
    if (this.population.length < 2) return;

    for (let c = 0; c < reactionCycles; c++) {
      if (this.population.length < 2) break;

      // Random collision pair from well-stirred vessel
      const idxA = Math.floor(Math.random() * this.population.length);
      let idxB = Math.floor(Math.random() * this.population.length);
      while (idxB === idxA) {
        idxB = Math.floor(Math.random() * this.population.length);
      }

      const orgA = this.population[idxA];
      const orgB = this.population[idxB];
      this.totalCollisions++;

      // Execute syntactic rewrite evaluation: orgA operates on orgB
      const offspring = this.executeRewrite(orgA, orgB);

      if (offspring) {
        this.totalReplications++;
        orgA.replicationCount++;
        orgA.energy += 10;
        orgB.energy = Math.max(5, orgB.energy - 8);

        // Add offspring
        this.population.push(offspring);

        // Record lineage
        if (!this.lineageHistory.has(offspring.signature)) {
          this.lineageHistory.set(offspring.signature, {
            id: offspring.id,
            signature: offspring.signature,
            generation: offspring.generation,
            parentId: orgA.id,
            count: 1
          });
        } else {
          const node = this.lineageHistory.get(offspring.signature)!;
          node.count++;
        }

        // Dilution / Chemostat outflux if over capacity
        if (this.population.length > this.maxPopulation) {
          // Weighted removal favoring older / lower energy organisms (natural selection pressure)
          let removeIdx = 0;
          let minEnergy = Infinity;
          for (let i = 0; i < Math.min(10, this.population.length); i++) {
            const testIdx = Math.floor(Math.random() * this.population.length);
            if (this.population[testIdx].energy < minEnergy) {
              minEnergy = this.population[testIdx].energy;
              removeIdx = testIdx;
            }
          }
          this.population.splice(removeIdx, 1);
        }
      } else {
        // Incompatible collision / neutral decay
        orgA.energy = Math.max(2, orgA.energy - 1);
        orgB.energy = Math.max(2, orgB.energy - 1);
      }
    }

    // Telemetry tracking
    if (this.totalCollisions % 10 === 0) {
      this.recordTelemetry();
    }
  }

  private executeRewrite(parentA: StringOrganism, parentB: StringOrganism): StringOrganism | null {
    const codeA = parentA.code;
    const codeB = parentB.code;

    // Evaluator: Look for operator combinations
    let childCode: Instruction[] = [];

    const hasOp = (code: Instruction[], op: Instruction) => code.includes(op);

    if (hasOp(codeA, 'DUP') || hasOp(codeA, 'BIND')) {
      // Replicator operator: Synthesizes a copy of B or cross-over splice
      if (hasOp(codeA, 'SPLICE') && codeB.length >= 2) {
        // Crossover: Half of A + Half of B
        const cutA = Math.floor(codeA.length / 2);
        const cutB = Math.floor(codeB.length / 2);
        childCode = [...codeA.slice(0, cutA), ...codeB.slice(cutB)];
      } else {
        // Direct replication with variation
        childCode = [...codeB];
      }
    } else if (hasOp(codeA, 'SWAP')) {
      // Permutation operator
      childCode = [...codeB].reverse();
    } else if (hasOp(codeA, 'CAT')) {
      // Concat
      if (codeA.length + codeB.length <= 10) {
        childCode = [...codeA.slice(0, 2), ...codeB.slice(0, 2)];
      } else {
        childCode = [...codeB];
      }
    } else {
      // Neutral bounce / low probability emergence
      if (Math.random() < 0.15) {
        childCode = [...codeB];
      } else {
        return null;
      }
    }

    // Apply point mutations and indels based on mutation rate
    if (Math.random() < this.mutationRate || hasOp(codeA, 'MUT')) {
      childCode = this.mutate(childCode);
    }

    // Constrain length
    if (childCode.length < 2) childCode.push('DUP', 'EMIT');
    if (childCode.length > 12) childCode = childCode.slice(0, 12);

    const sig = childCode.join('-');
    const newId = `GEN_${Date.now().toString().slice(-4)}_${Math.random().toString(36).slice(2, 5)}`;

    return {
      id: newId,
      code: childCode,
      generation: Math.max(parentA.generation, parentB.generation) + 1,
      parentId: parentA.id,
      replicationCount: 0,
      fitness: 1.0 + (childCode.length === 4 ? 0.5 : 0),
      energy: 40,
      length: childCode.length,
      color: this.generateColor(sig),
      signature: sig,
      timestamp: Date.now()
    };
  }

  private mutate(code: Instruction[]): Instruction[] {
    const mutated = [...code];
    const roll = Math.random();

    if (roll < 0.5 && mutated.length > 0) {
      // Point mutation: replace 1 opcode
      const randIdx = Math.floor(Math.random() * mutated.length);
      mutated[randIdx] = INSTRUCTION_SET[Math.floor(Math.random() * INSTRUCTION_SET.length)];
    } else if (roll < 0.8 && mutated.length < 10) {
      // Insertion
      const randIdx = Math.floor(Math.random() * mutated.length);
      const newOp = INSTRUCTION_SET[Math.floor(Math.random() * INSTRUCTION_SET.length)];
      mutated.splice(randIdx, 0, newOp);
    } else if (mutated.length > 2) {
      // Deletion
      const randIdx = Math.floor(Math.random() * mutated.length);
      mutated.splice(randIdx, 1);
    }

    return mutated;
  }

  private updateLineage() {
    this.population.forEach(org => {
      if (!this.lineageHistory.has(org.signature)) {
        this.lineageHistory.set(org.signature, {
          id: org.id,
          signature: org.signature,
          generation: org.generation,
          parentId: org.parentId,
          count: 1
        });
      }
    });
  }

  private recordTelemetry() {
    // Shannon diversity: - sum(p * log2(p))
    const counts: { [sig: string]: number } = {};
    let totalLen = 0;
    this.population.forEach(org => {
      counts[org.signature] = (counts[org.signature] || 0) + 1;
      totalLen += org.length;
    });

    const total = this.population.length || 1;
    let entropy = 0;
    Object.values(counts).forEach(c => {
      const p = c / total;
      if (p > 0) entropy -= p * Math.log2(p);
    });

    this.historyDiversity.push(Number(entropy.toFixed(3)));
    this.historyAvgLength.push(Number((totalLen / total).toFixed(2)));

    if (this.historyDiversity.length > 60) {
      this.historyDiversity.shift();
      this.historyAvgLength.shift();
    }
  }

  public getSpeciesDistribution(): { signature: string; count: number; color: string; code: string }[] {
    const map: { [sig: string]: { count: number; color: string; code: string } } = {};
    this.population.forEach(org => {
      if (!map[org.signature]) {
        map[org.signature] = {
          count: 0,
          color: org.color,
          code: org.code.join(' • ')
        };
      }
      map[org.signature].count++;
    });

    return Object.entries(map)
      .map(([sig, data]) => ({ signature: sig, count: data.count, color: data.color, code: data.code }))
      .sort((a, b) => b.count - a.count);
  }
}
