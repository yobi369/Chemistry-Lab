/**
 * Reaction-Diffusion Partial Differential Equation (PDE) Grid Engine
 * Implements Gray-Scott & Belousov-Zhabotinsky morphogen diffusion equations:
 * 
 * ∂u/∂t = Du * ∇²u - u * v² + F * (1 - u)
 * ∂v/∂t = Dv * ∇²v + u * v² - (F + k) * v
 * 
 * Producing emergent Turing patterns (solitons, mitosis, stripes, chemical chaos, spiral waves).
 */

export interface TuringPreset {
  id: string;
  name: string;
  category: string;
  feedRate: number; // F
  killRate: number; // k
  diffU: number;    // Du
  diffV: number;    // Dv
  description: string;
  palette: 'emerald_glow' | 'cyberpunk' | 'bioluminescence' | 'fire' | 'monochrome';
}

export const TURING_PRESETS: TuringPreset[] = [
  {
    id: 'mitosis',
    name: 'Mitosis (Self-Dividing Cells)',
    category: 'Biological Emergence',
    feedRate: 0.0367,
    killRate: 0.0649,
    diffU: 0.2097,
    diffV: 0.105,
    description: 'Autonomous circular spots that grow, deform, and undergo binary fission / mitosis.',
    palette: 'emerald_glow'
  },
  {
    id: 'solitons',
    name: 'Soliton Wave Packets',
    category: 'Nonlinear Physics',
    feedRate: 0.030,
    killRate: 0.062,
    diffU: 0.2097,
    diffV: 0.105,
    description: 'Stable solitary wave pulses that bounce elastically without losing energy.',
    palette: 'cyberpunk'
  },
  {
    id: 'coral',
    name: 'Coral Reef Growth',
    category: 'Morphogenesis',
    feedRate: 0.0545,
    killRate: 0.062,
    diffU: 0.2097,
    diffV: 0.105,
    description: 'Branching dendritic crystallization resembling marine coral colonies and lichen.',
    palette: 'bioluminescence'
  },
  {
    id: 'stripes',
    name: 'Turing Zebra Stripes',
    category: 'Animal Coat Patterns',
    feedRate: 0.022,
    killRate: 0.051,
    diffU: 0.2097,
    diffV: 0.105,
    description: 'Classic Alan Turing labyrinthine stripe morphogenesis from uniform instability.',
    palette: 'emerald_glow'
  },
  {
    id: 'chaos_spirals',
    name: 'Belousov Chemical Chaos',
    category: 'Excitable Media',
    feedRate: 0.026,
    killRate: 0.055,
    diffU: 0.2097,
    diffV: 0.105,
    description: 'Rotating Archimedean spiral chemical waves and turbulent spatio-temporal chaos.',
    palette: 'fire'
  },
  {
    id: 'worms',
    name: 'Meandering Worms',
    category: 'Active Matter',
    feedRate: 0.058,
    killRate: 0.065,
    diffU: 0.2097,
    diffV: 0.105,
    description: 'Elongated crawling structures that snake around the grid and self-prune.',
    palette: 'cyberpunk'
  }
];

export class ReactionDiffusionEngine {
  public width: number;
  public height: number;
  public u: Float32Array;
  public v: Float32Array;
  public nextU: Float32Array;
  public nextV: Float32Array;

  public feedRate: number = 0.0367;
  public killRate: number = 0.0649;
  public diffU: number = 0.2097;
  public diffV: number = 0.105;
  public timeStep: number = 1.0;
  public currentPresetId: string = 'mitosis';
  public iterationCount: number = 0;

  constructor(width: number = 180, height: number = 130) {
    this.width = width;
    this.height = height;
    const size = width * height;
    this.u = new Float32Array(size);
    this.v = new Float32Array(size);
    this.nextU = new Float32Array(size);
    this.nextV = new Float32Array(size);

    this.reset();
  }

  public reset(presetId?: string) {
    if (presetId) {
      const preset = TURING_PRESETS.find(p => p.id === presetId);
      if (preset) {
        this.feedRate = preset.feedRate;
        this.killRate = preset.killRate;
        this.diffU = preset.diffU;
        this.diffV = preset.diffV;
        this.currentPresetId = preset.id;
      }
    }

    const size = this.width * this.height;
    // Initial state: U = 1.0 everywhere, V = 0.0 everywhere
    this.u.fill(1.0);
    this.v.fill(0.0);
    this.nextU.fill(1.0);
    this.nextV.fill(0.0);

    // Seed center with a cluster of chemical V
    const cx = Math.floor(this.width / 2);
    const cy = Math.floor(this.height / 2);
    const seedRadius = 12;

    for (let dy = -seedRadius; dy <= seedRadius; dy++) {
      for (let dx = -seedRadius; dx <= seedRadius; dx++) {
        if (dx * dx + dy * dy <= seedRadius * seedRadius) {
          const px = cx + dx;
          const py = cy + dy;
          if (px >= 0 && px < this.width && py >= 0 && py < this.height) {
            const idx = py * this.width + px;
            this.u[idx] = 0.5 + (Math.random() - 0.5) * 0.1;
            this.v[idx] = 0.25 + (Math.random() - 0.5) * 0.1;
          }
        }
      }
    }

    // Seed a couple of random droplets
    for (let drop = 0; drop < 3; drop++) {
      const rx = Math.floor(Math.random() * (this.width - 30)) + 15;
      const ry = Math.floor(Math.random() * (this.height - 30)) + 15;
      const r = 6;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy <= r * r) {
            const px = rx + dx;
            const py = ry + dy;
            const idx = py * this.width + px;
            this.u[idx] = 0.5;
            this.v[idx] = 0.25;
          }
        }
      }
    }

    this.iterationCount = 0;
  }

  public step(substeps: number = 8) {
    const w = this.width;
    const h = this.height;
    const F = this.feedRate;
    const k = this.killRate;
    const Du = this.diffU;
    const Dv = this.diffV;
    const dt = this.timeStep;

    for (let s = 0; s < substeps; s++) {
      for (let y = 0; y < h; y++) {
        const yTop = (y - 1 + h) % h;
        const yBottom = (y + 1) % h;
        const row = y * w;
        const rowTop = yTop * w;
        const rowBottom = yBottom * w;

        for (let x = 0; x < w; x++) {
          const xLeft = (x - 1 + w) % w;
          const xRight = (x + 1) % w;

          const idx = row + x;

          // 5-point discrete Laplace operator with periodic boundary conditions
          const lapU = (
            this.u[rowTop + x] * 0.2 +
            this.u[rowBottom + x] * 0.2 +
            this.u[row + xLeft] * 0.2 +
            this.u[row + xRight] * 0.2 +
            this.u[rowTop + xLeft] * 0.05 +
            this.u[rowTop + xRight] * 0.05 +
            this.u[rowBottom + xLeft] * 0.05 +
            this.u[rowBottom + xRight] * 0.05 -
            this.u[idx]
          );

          const lapV = (
            this.v[rowTop + x] * 0.2 +
            this.v[rowBottom + x] * 0.2 +
            this.v[row + xLeft] * 0.2 +
            this.v[row + xRight] * 0.2 +
            this.v[rowTop + xLeft] * 0.05 +
            this.v[rowTop + xRight] * 0.05 +
            this.v[rowBottom + xLeft] * 0.05 +
            this.v[rowBottom + xRight] * 0.05 -
            this.v[idx]
          );

          const uVal = this.u[idx];
          const vVal = this.v[idx];
          const uvv = uVal * vVal * vVal;

          const du = (Du * lapU - uvv + F * (1.0 - uVal)) * dt;
          const dv = (Dv * lapV + uvv - (F + k) * vVal) * dt;

          this.nextU[idx] = Math.max(0, Math.min(1.0, uVal + du));
          this.nextV[idx] = Math.max(0, Math.min(1.0, vVal + dv));
        }
      }

      // Swap buffers
      const tempU = this.u;
      this.u = this.nextU;
      this.nextU = tempU;

      const tempV = this.v;
      this.v = this.nextV;
      this.nextV = tempV;
    }

    this.iterationCount += substeps;
  }

  public injectChemicalAt(gridX: number, gridY: number, radius: number = 5, amountV: number = 0.5) {
    const r2 = radius * radius;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy <= r2) {
          const px = (gridX + dx + this.width) % this.width;
          const py = (gridY + dy + this.height) % this.height;
          const idx = py * this.width + px;
          this.v[idx] = Math.min(1.0, this.v[idx] + amountV);
          this.u[idx] = Math.max(0.0, this.u[idx] - amountV * 0.5);
        }
      }
    }
  }

  public clearSubstrate() {
    this.u.fill(1.0);
    this.v.fill(0.0);
  }
}
