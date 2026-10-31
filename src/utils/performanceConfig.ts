export type QualityTier = 'high' | 'balanced' | 'eco';

export interface PerformanceSettings {
  tier: QualityTier;
  maxParticles: number;
  enableGlowEffects: boolean;
  enableMotionBlur: boolean;
  turingGridResolution: 64 | 96 | 128;
  targetFPS: number;
  autoDegrade: boolean;
}

export const QUALITY_PRESETS: Record<QualityTier, PerformanceSettings> = {
  high: {
    tier: 'high',
    maxParticles: 1200,
    enableGlowEffects: true,
    enableMotionBlur: true,
    turingGridResolution: 128,
    targetFPS: 60,
    autoDegrade: true
  },
  balanced: {
    tier: 'balanced',
    maxParticles: 650,
    enableGlowEffects: true,
    enableMotionBlur: false,
    turingGridResolution: 96,
    targetFPS: 60,
    autoDegrade: true
  },
  eco: {
    tier: 'eco',
    maxParticles: 300,
    enableGlowEffects: false,
    enableMotionBlur: false,
    turingGridResolution: 64,
    targetFPS: 30,
    autoDegrade: false
  }
};
