import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ReactionDiffusionEngine, TURING_PRESETS, TuringPreset } from '../engine/reactionDiffusionEngine';
import {
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Layers,
  Palette,
  Sliders,
  Paintbrush,
  Flame,
  Zap,
  Info,
  Maximize2,
  Minimize2
} from 'lucide-react';

export const ReactionDiffusionGrid: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<ReactionDiffusionEngine | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [currentPreset, setCurrentPreset] = useState<TuringPreset>(TURING_PRESETS[0]);
  const [brushSize, setBrushSize] = useState<number>(6);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [palette, setPalette] = useState<'emerald_glow' | 'cyberpunk' | 'bioluminescence' | 'fire' | 'monochrome'>('emerald_glow');
  const [feedRate, setFeedRate] = useState<number>(TURING_PRESETS[0].feedRate);
  const [killRate, setKillRate] = useState<number>(TURING_PRESETS[0].killRate);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(8);
  const [iteration, setIteration] = useState<number>(0);

  // Initialize engine
  useEffect(() => {
    const engine = new ReactionDiffusionEngine(200, 140);
    engineRef.current = engine;
    engine.reset(currentPreset.id);
    setFeedRate(engine.feedRate);
    setKillRate(engine.killRate);
  }, []);

  // Update engine params when sliders change
  const handleFeedChange = (val: number) => {
    setFeedRate(val);
    if (engineRef.current) engineRef.current.feedRate = val;
  };

  const handleKillChange = (val: number) => {
    setKillRate(val);
    if (engineRef.current) engineRef.current.killRate = val;
  };

  const handleSelectPreset = (preset: TuringPreset) => {
    setCurrentPreset(preset);
    setPalette(preset.palette);
    setFeedRate(preset.feedRate);
    setKillRate(preset.killRate);
    if (engineRef.current) {
      engineRef.current.reset(preset.id);
    }
  };

  const handleReset = () => {
    if (engineRef.current) {
      engineRef.current.reset(currentPreset.id);
      setIteration(0);
    }
  };

  const handleClear = () => {
    if (engineRef.current) {
      engineRef.current.clearSubstrate();
      setIteration(0);
    }
  };

  // Render Loop
  useEffect(() => {
    let animId: number;

    const render = () => {
      const engine = engineRef.current;
      const canvas = canvasRef.current;

      if (engine && canvas) {
        if (isRunning) {
          engine.step(speedMultiplier);
          setIteration(engine.iterationCount);
        }

        const ctx = canvas.getContext('2d');
        if (ctx) {
          const w = engine.width;
          const h = engine.height;
          const imgData = ctx.createImageData(w, h);
          const data = imgData.data;
          const uArr = engine.u;
          const vArr = engine.v;

          for (let i = 0; i < uArr.length; i++) {
            const u = uArr[i];
            const v = vArr[i];
            const px = i * 4;

            // Palette mapping
            if (palette === 'emerald_glow') {
              // Dark obsidian background to vivid emerald/cyan
              const val = Math.max(0, Math.min(1, v * 2.2));
              data[px] = Math.floor(val * 16);                 // R
              data[px + 1] = Math.floor(val * 230 + (1 - u) * 40); // G
              data[px + 2] = Math.floor(val * 140 + u * 15);   // B
              data[px + 3] = 255;
            } else if (palette === 'cyberpunk') {
              // Deep purple to neon cyan & magenta
              const val = Math.max(0, Math.min(1, v * 2.5));
              data[px] = Math.floor(val * 240 + (1 - u) * 60);  // R
              data[px + 1] = Math.floor(val * 60 + u * 20);     // G
              data[px + 2] = Math.floor(val * 255 + 40);        // B
              data[px + 3] = 255;
            } else if (palette === 'bioluminescence') {
              // Deep ocean cyan to glowing electric teal
              const val = Math.max(0, Math.min(1, v * 2.2));
              data[px] = Math.floor(val * 20);
              data[px + 1] = Math.floor(val * 210 + (1 - u) * 70);
              data[px + 2] = Math.floor(val * 255);
              data[px + 3] = 255;
            } else if (palette === 'fire') {
              // Black to intense amber, orange and white
              const val = Math.max(0, Math.min(1, v * 2.8));
              data[px] = Math.floor(val * 255);
              data[px + 1] = Math.floor(val * val * 200);
              data[px + 2] = Math.floor(val * val * val * 80);
              data[px + 3] = 255;
            } else {
              // Monochrome high contrast
              const val = Math.max(0, Math.min(255, Math.floor(v * 3.0 * 255)));
              data[px] = val;
              data[px + 1] = val;
              data[px + 2] = val;
              data[px + 3] = 255;
            }
          }

          ctx.putImageData(imgData, 0, 0);
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [isRunning, palette, speedMultiplier]);

  // Interactive mouse drawing
  const handleCanvasInteraction = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    if (!canvas || !engine) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = engine.width / rect.width;
    const scaleY = engine.height / rect.height;

    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const gx = Math.floor(clientX * scaleX);
    const gy = Math.floor(clientY * scaleY);

    engine.injectChemicalAt(gx, gy, brushSize, 0.6);
  }, [brushSize]);

  return (
    <div id="turing-patterns-view" className="flex flex-col gap-3 p-3 bg-zinc-950/60 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="p-3 bg-zinc-900/70 rounded-xl border border-zinc-800/80 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-200 font-mono">
            Spatial Reaction-Diffusion Grid (Turing Morphogenesis)
          </h3>
          <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
            Gray-Scott PDE Model
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-zinc-400">Step: <b className="text-zinc-200">{iteration.toLocaleString()}</b></span>
          <span className="text-zinc-600">•</span>
          <span className="text-zinc-400">Grid: <b className="text-emerald-400">200 × 140</b></span>
        </div>
      </div>

      {/* Preset Selector Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {TURING_PRESETS.map(p => (
          <button
            key={p.id}
            onClick={() => handleSelectPreset(p)}
            className={`p-2.5 rounded-lg border text-left transition-all flex flex-col justify-between ${
              currentPreset.id === p.id
                ? 'bg-cyan-950/40 border-cyan-500/60 text-cyan-200 shadow-md shadow-cyan-950/50'
                : 'bg-zinc-900/50 border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
            }`}
          >
            <div className="text-[11px] font-bold font-mono tracking-tight line-clamp-1">{p.name}</div>
            <div className="text-[9px] font-mono text-zinc-500 mt-1">F={p.feedRate} | k={p.killRate}</div>
          </button>
        ))}
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Left: Canvas Viewer */}
        <div className="lg:col-span-8 flex flex-col gap-2 bg-zinc-900/60 p-3 rounded-xl border border-zinc-800/80">
          <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
            <span className="flex items-center gap-1.5 text-zinc-300">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Morphogen Concentration Field V(x, y)</span>
            </span>
            <span className="text-[11px] text-zinc-500">
              Tip: Click / Drag on canvas to paint chemical V droplets
            </span>
          </div>

          {/* Canvas */}
          <div className="relative rounded-lg overflow-hidden border border-zinc-800 bg-black aspect-[200/140] w-full flex items-center justify-center cursor-crosshair">
            <canvas
              ref={canvasRef}
              width={200}
              height={140}
              className="w-full h-full object-contain image-rendering-pixelated"
              onMouseDown={e => {
                setIsDrawing(true);
                handleCanvasInteraction(e);
              }}
              onMouseMove={e => {
                if (isDrawing) handleCanvasInteraction(e);
              }}
              onMouseUp={() => setIsDrawing(false)}
              onMouseLeave={() => setIsDrawing(false)}
            />
          </div>

          {/* Canvas Bottom Control Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsRunning(!isRunning)}
                className={`px-3 py-1.5 rounded-lg font-mono font-bold flex items-center gap-1.5 transition-colors ${
                  isRunning
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30'
                    : 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400'
                }`}
              >
                {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isRunning ? 'Pause PDE' : 'Run PDE'}</span>
              </button>

              <button
                onClick={handleReset}
                className="px-2.5 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors flex items-center gap-1 font-mono"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Seed</span>
              </button>

              <button
                onClick={handleClear}
                className="px-2.5 py-1.5 rounded-lg bg-zinc-800/80 text-zinc-400 hover:text-rose-300 hover:bg-rose-950/40 transition-colors font-mono"
              >
                Clear Substrate
              </button>
            </div>

            {/* Brush size & speed */}
            <div className="flex items-center gap-3 font-mono text-[11px] text-zinc-400">
              <div className="flex items-center gap-1.5">
                <Paintbrush className="w-3 h-3 text-cyan-400" />
                <span>Brush:</span>
                <input
                  type="range"
                  min="2"
                  max="16"
                  value={brushSize}
                  onChange={e => setBrushSize(Number(e.target.value))}
                  className="w-16 accent-cyan-400"
                />
                <span className="w-4 text-zinc-200">{brushSize}px</span>
              </div>

              <div className="flex items-center gap-1.5">
                <Flame className="w-3 h-3 text-amber-400" />
                <span>Speed:</span>
                <select
                  value={speedMultiplier}
                  onChange={e => setSpeedMultiplier(Number(e.target.value))}
                  className="bg-zinc-950 text-zinc-200 px-1.5 py-0.5 rounded border border-zinc-800"
                >
                  <option value={2}>2x</option>
                  <option value={4}>4x</option>
                  <option value={8}>8x (Smooth)</option>
                  <option value={16}>16x (Fast)</option>
                  <option value={32}>32x (Warp)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Parameters, Color Palette & Mathematical Explanation */}
        <div className="lg:col-span-4 flex flex-col gap-3">
          {/* PDE Thermodynamic Parameters */}
          <div className="p-3 bg-zinc-900/70 rounded-xl border border-zinc-800/80 flex flex-col gap-3 text-xs">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300 font-mono flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-emerald-400" />
              <span>PDE Kinetic Parameters</span>
            </h4>

            {/* Feed Rate F */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between font-mono text-[11px]">
                <span className="text-zinc-400">Feed Rate (F):</span>
                <span className="text-cyan-300 font-bold">{feedRate.toFixed(4)}</span>
              </div>
              <input
                type="range"
                min="0.010"
                max="0.080"
                step="0.0005"
                value={feedRate}
                onChange={e => handleFeedChange(Number(e.target.value))}
                className="w-full accent-cyan-400"
              />
              <span className="text-[10px] text-zinc-500 font-mono">Rate at which substrate U is continuously replenished</span>
            </div>

            {/* Kill Rate k */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between font-mono text-[11px]">
                <span className="text-zinc-400">Kill Rate (k):</span>
                <span className="text-rose-300 font-bold">{killRate.toFixed(4)}</span>
              </div>
              <input
                type="range"
                min="0.040"
                max="0.075"
                step="0.0005"
                value={killRate}
                onChange={e => handleKillChange(Number(e.target.value))}
                className="w-full accent-rose-400"
              />
              <span className="text-[10px] text-zinc-500 font-mono">Rate at which reactant V decays or exits the reaction vessel</span>
            </div>

            {/* Palette selector */}
            <div className="flex flex-col gap-1.5 pt-1 border-t border-zinc-800/80">
              <label className="text-[11px] font-mono text-zinc-400 flex items-center gap-1">
                <Palette className="w-3 h-3 text-purple-400" />
                <span>Color LUT Palette:</span>
              </label>
              <div className="grid grid-cols-3 gap-1 font-mono text-[10px]">
                {(['emerald_glow', 'cyberpunk', 'bioluminescence', 'fire', 'monochrome'] as const).map(pal => (
                  <button
                    key={pal}
                    onClick={() => setPalette(pal)}
                    className={`p-1 rounded capitalize border transition-all ${
                      palette === pal
                        ? 'bg-purple-950/40 border-purple-500 text-purple-200'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {pal.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Description & Mathematical Foundation */}
          <div className="p-3 bg-zinc-900/70 rounded-xl border border-zinc-800/80 flex flex-col gap-2 text-xs">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300 font-mono flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-amber-400" />
              <span>Pattern Profile: {currentPreset.name}</span>
            </h4>

            <p className="text-zinc-300 leading-relaxed text-[11px]">
              {currentPreset.description}
            </p>

            <div className="p-2 rounded bg-zinc-950 border border-zinc-800 font-mono text-[10px] text-zinc-400 flex flex-col gap-1">
              <div className="text-zinc-300 font-bold">Gray-Scott Reaction:</div>
              <div>U + 2V → 3V (Autocatalytic Replication)</div>
              <div>V → P (Decay with rate k)</div>
              <div>Diffusion: Du = 0.21, Dv = 0.105</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
