/**
 * Bio-Acoustic Molecular Sonification Engine
 * Uses Web Audio API to procedurally generate soundscapes based on
 * molecular collisions, reaction enthalpy releases, system calls, and stirring resonance.
 */

export type AudioSonificationMode = 'harmonic' | 'geiger' | 'ambient' | 'synth_pop';

export class AudioSynth {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = true;
  private volume: number = 0.3;
  private mode: AudioSonificationMode = 'harmonic';
  private masterGain: GainNode | null = null;
  private droneOsc: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;

  constructor() {
    // Lazy initialize upon first user gesture
  }

  private initContext() {
    if (this.ctx) return;
    try {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtxClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // Start subtle ambient background drone
      this.startDrone();
    } catch {
      // Web Audio might be restricted in some environments
    }
  }

  private startDrone() {
    if (!this.ctx || !this.masterGain) return;
    try {
      this.droneOsc = this.ctx.createOscillator();
      this.droneGain = this.ctx.createGain();

      this.droneOsc.type = 'sine';
      this.droneOsc.frequency.setValueAtTime(55, this.ctx.currentTime); // 55Hz (A1)
      this.droneGain.gain.setValueAtTime(0.02, this.ctx.currentTime);

      this.droneOsc.connect(this.droneGain);
      this.droneGain.connect(this.masterGain);
      this.droneOsc.start();
    } catch {
      // Ignore
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    this.initContext();
    if (this.ctx && this.masterGain) {
      if (this.ctx.state === 'suspended' && !muted) {
        this.ctx.resume();
      }
      this.masterGain.gain.setTargetAtTime(muted ? 0 : this.volume, this.ctx.currentTime, 0.05);
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.ctx && this.masterGain && !this.isMuted) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public setMode(mode: AudioSonificationMode) {
    this.mode = mode;
  }

  public getMode(): AudioSonificationMode {
    return this.mode;
  }

  public updateStirrerPitch(speed: number) {
    if (!this.ctx || !this.droneOsc || !this.droneGain || this.isMuted) return;
    try {
      const baseFreq = 55 + speed * 12; // Modulate drone pitch with stirrer RPM
      this.droneOsc.frequency.setTargetAtTime(baseFreq, this.ctx.currentTime, 0.1);
      const droneVol = speed > 0 ? 0.015 + (speed / 10) * 0.03 : 0.005;
      this.droneGain.gain.setTargetAtTime(droneVol, this.ctx.currentTime, 0.1);
    } catch {
      // Ignore
    }
  }

  public playReactionSound(energyDelta: number, syscall?: string) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain || this.ctx.state === 'suspended') return;

    const t = this.ctx.currentTime;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      // Determine frequency scale based on mode and energy delta
      let freq = 220;
      let duration = 0.08;
      const isExothermic = energyDelta < 0;

      if (this.mode === 'geiger') {
        // High-pitch click / tick
        osc.type = 'triangle';
        freq = 1200 + Math.random() * 800;
        duration = 0.02;
        gain.gain.setValueAtTime(0.08, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      } else if (this.mode === 'ambient') {
        // Soft bell-like sine tones
        osc.type = 'sine';
        const pentatonic = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 659.25];
        const noteIdx = Math.floor(Math.random() * pentatonic.length);
        freq = pentatonic[noteIdx] * (isExothermic ? 1.5 : 1.0);
        duration = 0.25;
        gain.gain.setValueAtTime(0.06, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      } else if (this.mode === 'synth_pop') {
        // FM / 8-bit blip
        osc.type = 'square';
        freq = isExothermic ? 440 + Math.abs(energyDelta) * 15 : 220 + Math.abs(energyDelta) * 10;
        duration = 0.05;
        gain.gain.setValueAtTime(0.04, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      } else {
        // Harmonic Mode (Default)
        osc.type = syscall ? 'sawtooth' : 'sine';
        if (syscall) {
          // Special syscall chord / chime
          freq = syscall === 'SYS_FORK' ? 587.33 : syscall === 'SYS_EXEC' ? 523.25 : 440.0;
          duration = 0.12;
          gain.gain.setValueAtTime(0.07, t);
        } else {
          freq = isExothermic ? 330 + Math.abs(energyDelta) * 8 : 220 + Math.abs(energyDelta) * 5;
          duration = 0.09;
          gain.gain.setValueAtTime(0.05, t);
        }
        gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      }

      osc.frequency.setValueAtTime(freq, t);
      if (isExothermic) {
        // Slight downward pitch bend for exothermic release
        osc.frequency.exponentialRampToValueAtTime(freq * 0.85, t + duration);
      }

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + duration);
    } catch {
      // Audio playback safety catch
    }
  }

  public playEnergyZap() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.exponentialRampToValueAtTime(110, t + 0.18);

      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.18);
    } catch {
      // Ignore
    }
  }

  public playFanfare() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    try {
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        if (!this.ctx || !this.masterGain) return;
        const t = this.ctx.currentTime + idx * 0.1;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.08, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(t);
        osc.stop(t + 0.35);
      });
    } catch {
      // Ignore
    }
  }

  public playBlip(freq: number = 600, duration: number = 0.05) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.06, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + duration);
    } catch {
      // Ignore
    }
  }
}

export const globalAudioSynth = new AudioSynth();
