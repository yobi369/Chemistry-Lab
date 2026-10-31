import {
  MoleculeType,
  ReactionRule,
  Particle,
  ReactionFlash,
  ReactionEvent,
  TimeSeriesPoint,
  PresetSystem
} from '../types/chemistry';
import { globalAudioSynth } from './audioSynth';

export class ChemEngine {
  public moleculeTypes: MoleculeType[] = [];
  public reactionRules: ReactionRule[] = [];
  public particles: Particle[] = [];
  public flashes: ReactionFlash[] = [];
  public logs: ReactionEvent[] = [];
  public history: TimeSeriesPoint[] = [];

  public tickCount: number = 0;
  public simTime: number = 0; // seconds
  public energyPool: number = 500;
  public temperature: number = 300; // Kelvin
  public stirSpeed: number = 3; // 0 to 10
  public width: number = 800;
  public height: number = 550;

  public totalReactionsCount: number = 0;
  public recentReactionsInWindow: number = 0;
  public reactionFluxRate: number = 0; // reactions per sec

  // Chemostat Continuous-Flow Parameters
  public chemostatEnabled: boolean = false;
  public inflowRate: number = 0; // molecules / sec
  public inflowSpeciesId: string = '';
  public outflowDilutionRate: number = 0; // dilution fraction / sec (0 to 0.2)
  private inflowAccumulator: number = 0;

  private lastFluxUpdate: number = 0;
  private particleIdCounter: number = 0;
  private flashIdCounter: number = 0;
  private eventIdCounter: number = 0;

  // Spatial hashing grid for collision optimization
  private cellSize: number = 40;
  private grid: Map<string, Particle[]> = new Map();

  constructor(preset?: PresetSystem, width: number = 800, height: number = 550) {
    this.width = width;
    this.height = height;
    if (preset) {
      this.loadPreset(preset);
    }
  }

  public loadPreset(preset: PresetSystem) {
    this.moleculeTypes = JSON.parse(JSON.stringify(preset.moleculeTypes));
    this.reactionRules = JSON.parse(JSON.stringify(preset.reactionRules));
    this.particles = [];
    this.flashes = [];
    this.logs = [];
    this.history = [];
    this.tickCount = 0;
    this.simTime = 0;
    this.energyPool = preset.initialEnergy;
    this.temperature = preset.defaultTemp;
    this.stirSpeed = preset.defaultStirSpeed;
    this.totalReactionsCount = 0;
    this.recentReactionsInWindow = 0;
    this.reactionFluxRate = 0;

    // Seed initial particles
    Object.entries(preset.initialCounts).forEach(([typeId, count]) => {
      const molType = this.getMoleculeType(typeId);
      if (!molType) return;
      for (let i = 0; i < count; i++) {
        this.spawnParticle(molType);
      }
    });

    this.recordHistoryPoint();
  }

  public getMoleculeType(typeId: string): MoleculeType | undefined {
    return this.moleculeTypes.find(m => m.id === typeId);
  }

  public spawnParticle(
    molType: MoleculeType,
    x?: number,
    y?: number,
    vx?: number,
    vy?: number
  ): Particle {
    const radius = molType.radius;
    const px = x !== undefined ? x : radius + Math.random() * (this.width - 2 * radius);
    const py = y !== undefined ? y : radius + Math.random() * (this.height - 2 * radius);

    // Speed proportional to thermal energy: v ~ sqrt(T / mass)
    const baseSpeed = Math.sqrt((this.temperature / 300) / (molType.mass || 1)) * 1.5;
    const angle = Math.random() * Math.PI * 2;
    const speed = (0.5 + Math.random() * 1.0) * baseSpeed;

    const pvx = vx !== undefined ? vx : Math.cos(angle) * speed;
    const pvy = vy !== undefined ? vy : Math.sin(angle) * speed;

    const p: Particle = {
      id: `p_${++this.particleIdCounter}`,
      typeId: molType.id,
      x: px,
      y: py,
      vx: pvx,
      vy: pvy,
      energy: molType.energyState,
      mass: molType.mass,
      radius: molType.radius,
      age: 0,
      color: molType.color,
      symbol: molType.symbol,
      trail: []
    };

    this.particles.push(p);
    return p;
  }

  public injectMolecules(typeId: string, count: number, atX?: number, atY?: number) {
    const molType = this.getMoleculeType(typeId);
    if (!molType) return;
    for (let i = 0; i < count; i++) {
      const spreadX = atX !== undefined ? atX + (Math.random() - 0.5) * 40 : undefined;
      const spreadY = atY !== undefined ? atY + (Math.random() - 0.5) * 40 : undefined;
      this.spawnParticle(molType, spreadX, spreadY);
    }
    this.createFlash(
      atX ?? this.width / 2,
      atY ?? this.height / 2,
      molType.color,
      35,
      `+${count} ${molType.symbol}`
    );
  }

  public zapEnergyAt(x: number, y: number, radius: number = 80, amount: number = 50) {
    let affected = 0;
    for (const p of this.particles) {
      const dx = p.x - x;
      const dy = p.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < radius) {
        const force = (1 - dist / radius) * 4;
        p.vx += (dx / (dist || 1)) * force + (Math.random() - 0.5) * 2;
        p.vy += (dy / (dist || 1)) * force + (Math.random() - 0.5) * 2;
        p.energy += amount * 0.2;
        affected++;
      }
    }
    this.energyPool += amount;
    this.createFlash(x, y, '#eab308', radius, `⚡ +${amount}J Energy Impulse`);
    globalAudioSynth.playEnergyZap();
  }

  public applyForceField(x: number, y: number, mode: 'attract' | 'repel' = 'attract', strength: number = 2.5) {
    const factor = mode === 'attract' ? -1 : 1;
    for (const p of this.particles) {
      const dx = p.x - x;
      const dy = p.y - y;
      const distSq = dx * dx + dy * dy;
      if (distSq > 400 && distSq < 90000) {
        const dist = Math.sqrt(distSq);
        const force = (strength / (dist * 0.1)) * factor;
        p.vx += (dx / dist) * force * 0.1;
        p.vy += (dy / dist) * force * 0.1;
      }
    }
  }

  public clearAll() {
    this.particles = [];
    this.flashes = [];
    this.logs = [];
    this.history = [];
    this.totalReactionsCount = 0;
    this.reactionFluxRate = 0;
    this.recordHistoryPoint();
  }

  public update(dt: number = 1.0) {
    this.tickCount++;
    this.simTime += dt * 0.016;

    const cx = this.width / 2;
    const cy = this.height / 2;
    const stirAngularVel = (this.stirSpeed / 10) * 0.08;
    const thermalSpeedFactor = Math.sqrt(Math.max(10, this.temperature) / 300);

    // 1. Move and update particles
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.age++;

      // Magnetic stirrer vortex force
      if (this.stirSpeed > 0) {
        const dx = p.x - cx;
        const dy = p.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 10 && dist < Math.min(this.width, this.height) * 0.45) {
          // Tangential swirl
          const tx = -dy / dist;
          const ty = dx / dist;
          const vortexStrength = stirAngularVel * (1 - dist / (this.width * 0.5));
          p.vx += tx * vortexStrength;
          p.vy += ty * vortexStrength;
        }
      }

      // Brownian / Thermal jitter
      if (this.temperature > 50) {
        const jitter = (this.temperature / 1000) * 0.15;
        p.vx += (Math.random() - 0.5) * jitter;
        p.vy += (Math.random() - 0.5) * jitter;
      }

      // Velocity damping / thermostat regulation
      const currentSpeed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      const targetSpeed = (1.5 * thermalSpeedFactor) / Math.sqrt(p.mass || 1);
      if (currentSpeed > 0) {
        p.vx = p.vx * 0.99 + (p.vx / currentSpeed) * targetSpeed * 0.01;
        p.vy = p.vy * 0.99 + (p.vy / currentSpeed) * targetSpeed * 0.01;
      }

      // Integration
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Container boundary bounces
      if (p.x < p.radius) {
        p.x = p.radius;
        p.vx = Math.abs(p.vx) * 0.95;
      } else if (p.x > this.width - p.radius) {
        p.x = this.width - p.radius;
        p.vx = -Math.abs(p.vx) * 0.95;
      }

      if (p.y < p.radius) {
        p.y = p.radius;
        p.vy = Math.abs(p.vy) * 0.95;
      } else if (p.y > this.height - p.radius) {
        p.y = this.height - p.radius;
        p.vy = -Math.abs(p.vy) * 0.95;
      }

      // Record trail occasionally
      if (this.tickCount % 4 === 0) {
        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > 5) {
          p.trail.shift();
        }
      }
    }

    // 2. Spatial Hash Grid for Collision & Reaction Detection
    this.buildGrid();
    this.handleCollisionsAndReactions();

    // 3. Update Visual Flashes
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.radius += (f.maxRadius - f.radius) * 0.15 + 0.8;
      f.alpha -= 0.035;
      if (f.alpha <= 0 || f.radius >= f.maxRadius) {
        this.flashes.splice(i, 1);
      }
    }

    // 4. Chemostat Continuous-Flow Operations (Inlet & Dilution Outlet)
    if (this.chemostatEnabled) {
      // Inflow Pump
      if (this.inflowRate > 0 && this.inflowSpeciesId) {
        const mol = this.getMoleculeType(this.inflowSpeciesId);
        if (mol) {
          this.inflowAccumulator += this.inflowRate * (dt * 0.016);
          while (this.inflowAccumulator >= 1 && this.particles.length < 500) {
            this.spawnParticle(mol, 30 + Math.random() * 20, 30 + Math.random() * 20, 2 + Math.random() * 2, (Math.random() - 0.5) * 2);
            this.inflowAccumulator -= 1;
          }
        }
      }

      // Outflow Dilution Washout Pump (stochastic removal proportional to dilution rate)
      if (this.outflowDilutionRate > 0 && this.particles.length > 0) {
        const washoutProbPerTick = this.outflowDilutionRate * (dt * 0.016);
        for (let i = this.particles.length - 1; i >= 0; i--) {
          if (Math.random() < washoutProbPerTick) {
            this.particles.splice(i, 1);
          }
        }
      }
    }

    // 5. Update Stats & History every 15 ticks
    if (this.tickCount % 15 === 0) {
      this.calculateReactionFlux();
      this.recordHistoryPoint();
    }
  }

  private buildGrid() {
    this.grid.clear();
    for (const p of this.particles) {
      const cellX = Math.floor(p.x / this.cellSize);
      const cellY = Math.floor(p.y / this.cellSize);
      const key = `${cellX},${cellY}`;
      let list = this.grid.get(key);
      if (!list) {
        list = [];
        this.grid.set(key, list);
      }
      list.push(p);
    }
  }

  private handleCollisionsAndReactions() {
    const toRemoveParticleIds = new Set<string>();
    const particlesToSpawn: { molType: MoleculeType; x: number; y: number; vx: number; vy: number }[] = [];

    // Check pairs in each grid cell and neighboring cells
    for (const [key, cellParticles] of this.grid.entries()) {
      const [cellX, cellY] = key.split(',').map(Number);

      // Check pairs within same cell
      for (let i = 0; i < cellParticles.length; i++) {
        const p1 = cellParticles[i];
        if (toRemoveParticleIds.has(p1.id)) continue;

        for (let j = i + 1; j < cellParticles.length; j++) {
          const p2 = cellParticles[j];
          if (toRemoveParticleIds.has(p2.id)) continue;
          this.evaluatePair(p1, p2, toRemoveParticleIds, particlesToSpawn);
        }

        // Check neighboring cells (right, bottom-left, bottom, bottom-right)
        const neighborOffsets = [
          [1, 0],
          [-1, 1],
          [0, 1],
          [1, 1]
        ];

        for (const [ox, oy] of neighborOffsets) {
          const nKey = `${cellX + ox},${cellY + oy}`;
          const nList = this.grid.get(nKey);
          if (!nList) continue;

          for (let k = 0; k < nList.length; k++) {
            const p2 = nList[k];
            if (toRemoveParticleIds.has(p2.id)) continue;
            this.evaluatePair(p1, p2, toRemoveParticleIds, particlesToSpawn);
          }
        }
      }
    }

    // Apply removals
    if (toRemoveParticleIds.size > 0) {
      this.particles = this.particles.filter(p => !toRemoveParticleIds.has(p.id));
    }

    // Spawn products
    for (const sp of particlesToSpawn) {
      this.spawnParticle(sp.molType, sp.x, sp.y, sp.vx, sp.vy);
    }
  }

  private evaluatePair(
    p1: Particle,
    p2: Particle,
    toRemove: Set<string>,
    toSpawn: { molType: MoleculeType; x: number; y: number; vx: number; vy: number }[]
  ) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const distSq = dx * dx + dy * dy;
    const minDist = p1.radius + p2.radius;

    if (distSq <= minDist * minDist) {
      const dist = Math.sqrt(distSq) || 1;
      const normalX = dx / dist;
      const normalY = dy / dist;

      // Relative velocity & kinetic collision energy
      const rvx = p2.vx - p1.vx;
      const rvy = p2.vy - p1.vy;
      const velAlongNormal = rvx * normalX + rvy * normalY;

      // Check if they are moving towards each other
      if (velAlongNormal < 0) {
        const m1 = p1.mass || 1;
        const m2 = p2.mass || 1;
        const reducedMass = (m1 * m2) / (m1 + m2);
        const collisionKineticEnergy = 0.5 * reducedMass * (velAlongNormal * velAlongNormal) * 10;
        const totalEffectiveEnergy = collisionKineticEnergy + (this.temperature / 30);

        // Check if a reaction rule matches this collision pair
        const matchingRule = this.findMatchingRule(p1.typeId, p2.typeId, totalEffectiveEnergy);

        if (matchingRule) {
          // Execute reaction!
          this.executeReaction(matchingRule, p1, p2, toRemove, toSpawn);
          return;
        }

        // Otherwise: Standard elastic collision impulse
        const restitution = 0.9;
        const impulseMagnitude = -(1 + restitution) * velAlongNormal / (1 / m1 + 1 / m2);
        const ix = impulseMagnitude * normalX;
        const iy = impulseMagnitude * normalY;

        p1.vx -= ix / m1;
        p1.vy -= iy / m1;
        p2.vx += ix / m2;
        p2.vy += iy / m2;

        // Separate overlapping particles slightly
        const overlap = minDist - dist;
        p1.x -= normalX * overlap * 0.5;
        p1.y -= normalY * overlap * 0.5;
        p2.x += normalX * overlap * 0.5;
        p2.y += normalY * overlap * 0.5;
      }
    }
  }

  private findMatchingRule(typeA: string, typeB: string, availableEnergy: number): ReactionRule | null {
    for (const rule of this.reactionRules) {
      if (!rule.enabled) continue;

      // Check activation energy barrier
      if (availableEnergy < rule.activationEnergy) {
        continue;
      }

      // Check reactants match
      const rList: string[] = [];
      rule.reactants.forEach(r => {
        for (let i = 0; i < r.count; i++) rList.push(r.moleculeId);
      });

      // 2-particle collision case
      if (rList.length === 2) {
        const matchesDirect = (rList[0] === typeA && rList[1] === typeB) ||
                              (rList[0] === typeB && rList[1] === typeA);
        if (matchesDirect && Math.random() < rule.rateConstant) {
          return rule;
        }
      } else if (rList.length === 1 && rule.catalysts.length > 0) {
        // 1 reactant catalyzed by collision partner
        const isReactantAndCatalyst = (rList[0] === typeA && rule.catalysts.includes(typeB)) ||
                                      (rList[0] === typeB && rule.catalysts.includes(typeA));
        if (isReactantAndCatalyst && Math.random() < rule.rateConstant) {
          return rule;
        }
      }
    }
    return null;
  }

  private executeReaction(
    rule: ReactionRule,
    p1: Particle,
    p2: Particle,
    toRemove: Set<string>,
    toSpawn: { molType: MoleculeType; x: number; y: number; vx: number; vy: number }[]
  ) {
    const rx = (p1.x + p2.x) / 2;
    const ry = (p1.y + p2.y) / 2;

    this.totalReactionsCount++;
    this.recentReactionsInWindow++;

    // Determine which particle gets consumed
    const rIds: string[] = [];
    rule.reactants.forEach(r => {
      for (let i = 0; i < r.count; i++) rIds.push(r.moleculeId);
    });

    if (rIds.includes(p1.typeId)) {
      toRemove.add(p1.id);
      const idx = rIds.indexOf(p1.typeId);
      if (idx >= 0) rIds.splice(idx, 1);
    }

    if (rIds.includes(p2.typeId)) {
      toRemove.add(p2.id);
      const idx = rIds.indexOf(p2.typeId);
      if (idx >= 0) rIds.splice(idx, 1);
    }

    // Spawn products
    const productTypesList: MoleculeType[] = [];
    rule.products.forEach(pDef => {
      const molType = this.getMoleculeType(pDef.moleculeId);
      if (molType) {
        for (let i = 0; i < pDef.count; i++) {
          productTypesList.push(molType);
        }
      }
    });

    const angleStep = (Math.PI * 2) / Math.max(1, productTypesList.length);
    const baseBlastSpeed = 2.0 + Math.abs(rule.energyDelta) * 0.05;

    productTypesList.forEach((pType, idx) => {
      const outAngle = idx * angleStep + (Math.random() - 0.5) * 0.5;
      const blastVx = Math.cos(outAngle) * baseBlastSpeed + (p1.vx + p2.vx) * 0.25;
      const blastVy = Math.sin(outAngle) * baseBlastSpeed + (p1.vy + p2.vy) * 0.25;

      toSpawn.push({
        molType: pType,
        x: rx + Math.cos(outAngle) * 8,
        y: ry + Math.sin(outAngle) * 8,
        vx: blastVx,
        vy: blastVy
      });
    });

    // Handle energy delta
    this.energyPool -= rule.energyDelta; // Exothermic (negative delta) increases energy pool

    // Visual Flash & Sound Tag
    const primaryColor = productTypesList[0]?.color || '#10b981';
    this.createFlash(rx, ry, primaryColor, 28, rule.syscallType ? `[${rule.syscallType}]` : rule.name.split('(')[0]);

    // Sonification trigger
    globalAudioSynth.playReactionSound(rule.energyDelta, rule.syscallType);

    // Log reaction event
    const event: ReactionEvent = {
      id: `evt_${++this.eventIdCounter}`,
      tick: this.tickCount,
      ruleId: rule.id,
      ruleName: rule.name,
      reactantNames: [p1.symbol, p2.symbol],
      productNames: productTypesList.map(p => p.symbol),
      energyDelta: rule.energyDelta,
      syscall: rule.syscallType,
      location: { x: Math.round(rx), y: Math.round(ry) },
      timestamp: Date.now()
    };

    this.logs.unshift(event);
    if (this.logs.length > 80) {
      this.logs.pop();
    }
  }

  public createFlash(x: number, y: number, color: string, maxRadius: number = 30, text?: string) {
    this.flashes.push({
      id: `f_${++this.flashIdCounter}`,
      x,
      y,
      color,
      radius: 4,
      maxRadius,
      alpha: 1.0,
      text
    });
  }

  private calculateReactionFlux() {
    this.reactionFluxRate = this.recentReactionsInWindow * 4; // Normalized per second
    this.recentReactionsInWindow = 0;
  }

  public recordHistoryPoint() {
    const counts: Record<string, number> = {};
    this.moleculeTypes.forEach(m => {
      counts[m.id] = 0;
    });

    for (const p of this.particles) {
      counts[p.typeId] = (counts[p.typeId] || 0) + 1;
    }

    // Calculate Shannon chemical entropy S = -sum(p_i * ln(p_i))
    const total = this.particles.length;
    let entropy = 0;
    if (total > 0) {
      Object.values(counts).forEach(c => {
        if (c > 0) {
          const pi = c / total;
          entropy -= pi * Math.log2(pi);
        }
      });
    }

    const pt: TimeSeriesPoint = {
      tick: this.tickCount,
      time: Math.round(this.simTime * 10) / 10,
      counts,
      totalCount: total,
      energy: Math.round(this.energyPool),
      temperature: Math.round(this.temperature),
      entropy: Math.round(entropy * 100) / 100,
      reactionFlux: this.reactionFluxRate
    };

    this.history.push(pt);
    if (this.history.length > 120) {
      this.history.shift();
    }
  }
}
