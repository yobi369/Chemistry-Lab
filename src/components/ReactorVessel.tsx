import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ChemEngine } from '../engine/chemEngine';
import { MoleculeType } from '../types/chemistry';
import {
  Pipette,
  Zap,
  Wind,
  Magnet,
  Thermometer,
  Sliders,
  Plus,
  Eye,
  Info
} from 'lucide-react';

interface ReactorVesselProps {
  engine: ChemEngine;
  moleculeTypes: MoleculeType[];
  temperature: number;
  setTemperature: (t: number) => void;
  stirSpeed: number;
  setStirSpeed: (s: number) => void;
  onInject: (typeId: string, count: number, x?: number, y?: number) => void;
}

type ActiveTool = 'pipette' | 'zap' | 'attract' | 'repel' | 'stir';

export const ReactorVessel: React.FC<ReactorVesselProps> = ({
  engine,
  moleculeTypes,
  temperature,
  setTemperature,
  stirSpeed,
  setStirSpeed,
  onInject
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [activeTool, setActiveTool] = useState<ActiveTool>('pipette');
  const [selectedMoleculeId, setSelectedMoleculeId] = useState<string>(
    moleculeTypes[0]?.id || ''
  );
  const [injectCount, setInjectCount] = useState<number>(5);
  const [showTrails, setShowTrails] = useState<boolean>(true);
  const [showVectors, setShowVectors] = useState<boolean>(false);
  const [showSymbols, setShowSymbols] = useState<boolean>(true);
  const [isMouseDown, setIsMouseDown] = useState<boolean>(false);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  // Update default selected molecule when moleculeTypes change
  useEffect(() => {
    if (moleculeTypes.length > 0 && !moleculeTypes.some(m => m.id === selectedMoleculeId)) {
      setSelectedMoleculeId(moleculeTypes[0].id);
    }
  }, [moleculeTypes, selectedMoleculeId]);

  // Handle Resize
  const handleResize = useCallback(() => {
    if (containerRef.current && canvasRef.current) {
      const { clientWidth, clientHeight } = containerRef.current;
      const targetWidth = Math.max(400, clientWidth);
      const targetHeight = Math.max(350, clientHeight);

      canvasRef.current.width = targetWidth;
      canvasRef.current.height = targetHeight;
      engine.width = targetWidth;
      engine.height = targetHeight;
    }
  }, [engine]);

  useEffect(() => {
    handleResize();
    const observer = new ResizeObserver(() => handleResize());
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, [handleResize]);

  // Render loop
  useEffect(() => {
    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;

      // 1. Clear background
      ctx.fillStyle = '#090d0b';
      ctx.fillRect(0, 0, w, h);

      // 2. Draw subtle tech grid
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.04)';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < w; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // 3. Draw magnetic stirrer vortex indicator in center
      const cx = w / 2;
      const cy = h / 2;
      if (stirSpeed > 0) {
        const angle = (Date.now() * 0.003 * stirSpeed) % (Math.PI * 2);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);

        // Vortex ripple rings
        ctx.strokeStyle = `rgba(16, 185, 129, ${0.05 + stirSpeed * 0.02})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, 45, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = `rgba(6, 182, 212, ${0.08 + stirSpeed * 0.02})`;
        ctx.beginPath();
        ctx.arc(0, 0, 25, 0, Math.PI * 2);
        ctx.stroke();

        // Stir bar pill
        ctx.fillStyle = 'rgba(244, 244, 245, 0.25)';
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(-22, -5, 44, 10, 5);
        ctx.fill();
        ctx.stroke();

        ctx.restore();
      }

      // 4. Render Particle Trails
      if (showTrails) {
        ctx.lineWidth = 1.5;
        for (const p of engine.particles) {
          if (p.trail && p.trail.length > 1) {
            ctx.strokeStyle = p.color + '33'; // transparent hex
            ctx.beginPath();
            ctx.moveTo(p.trail[0].x, p.trail[0].y);
            for (let i = 1; i < p.trail.length; i++) {
              ctx.lineTo(p.trail[i].x, p.trail[i].y);
            }
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
          }
        }
      }

      // 5. Render Particles
      for (const p of engine.particles) {
        ctx.save();
        ctx.translate(p.x, p.y);

        // Glow halo
        const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, p.radius * 2);
        grad.addColorStop(0, p.color + 'aa');
        grad.addColorStop(0.5, p.color + '44');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius * 2, 0, Math.PI * 2);
        ctx.fill();

        // Solid particle core
        ctx.fillStyle = p.color;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Symbol label
        if (showSymbols && p.radius >= 10) {
          ctx.fillStyle = '#ffffff';
          ctx.font = `bold ${Math.max(9, Math.floor(p.radius * 0.75))}px 'Fira Code', monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(p.symbol, 0, 0);
        }

        // Velocity vector line
        if (showVectors) {
          ctx.strokeStyle = '#ffffff88';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(p.vx * 6, p.vy * 6);
          ctx.stroke();
        }

        ctx.restore();
      }

      // 6. Render Reaction Flashes & Floating Labels
      for (const f of engine.flashes) {
        ctx.save();
        ctx.strokeStyle = f.color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = Math.max(0, f.alpha);

        // Expanding shockwave circle
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
        ctx.stroke();

        // Inner flash glow
        ctx.fillStyle = f.color;
        ctx.globalAlpha = Math.max(0, f.alpha * 0.3);
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.radius * 0.5, 0, Math.PI * 2);
        ctx.fill();

        // Floating reaction text
        if (f.text) {
          ctx.globalAlpha = Math.max(0, f.alpha);
          ctx.fillStyle = '#ffffff';
          ctx.font = "bold 11px 'Fira Code', monospace";
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(f.text, f.x, f.y - f.radius - 2);
        }

        ctx.restore();
      }

      // 7. Render Tool Cursor Interaction preview
      if (mousePos) {
        ctx.save();
        if (activeTool === 'pipette') {
          const mol = engine.getMoleculeType(selectedMoleculeId);
          const color = mol?.color || '#10b981';
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(mousePos.x, mousePos.y, 25, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = color;
          ctx.font = "11px 'Fira Code', monospace";
          ctx.textAlign = 'center';
          ctx.fillText(`+${injectCount} ${mol?.symbol || ''}`, mousePos.x, mousePos.y - 30);
        } else if (activeTool === 'zap') {
          ctx.strokeStyle = '#eab308';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(mousePos.x, mousePos.y, 60, 0, Math.PI * 2);
          ctx.stroke();
        } else if (activeTool === 'attract' || activeTool === 'repel') {
          ctx.strokeStyle = activeTool === 'attract' ? '#06b6d4' : '#f43f5e';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.arc(mousePos.x, mousePos.y, 75, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      // 8. Vessel Border glow
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, w - 2, h - 2);

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [
    engine,
    stirSpeed,
    showTrails,
    showVectors,
    showSymbols,
    activeTool,
    selectedMoleculeId,
    injectCount,
    mousePos
  ]);

  // Handle Canvas Mouse Actions
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsMouseDown(true);
    triggerToolAction(e);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x, y });

    if (isMouseDown) {
      triggerToolAction(e);
    }
  };

  const handleCanvasMouseUp = () => {
    setIsMouseDown(false);
  };

  const handleCanvasMouseLeave = () => {
    setIsMouseDown(false);
    setMousePos(null);
  };

  const triggerToolAction = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (activeTool === 'pipette') {
      onInject(selectedMoleculeId, injectCount, x, y);
    } else if (activeTool === 'zap') {
      engine.zapEnergyAt(x, y, 70, 40);
    } else if (activeTool === 'attract') {
      engine.applyForceField(x, y, 'attract', 3.0);
    } else if (activeTool === 'repel') {
      engine.applyForceField(x, y, 'repel', 3.0);
    } else if (activeTool === 'stir') {
      const newStir = (stirSpeed + 1) % 10;
      setStirSpeed(newStir);
    }
  };

  return (
    <div id="reactor-vessel-view" className="flex flex-col lg:flex-row gap-3 p-3 bg-zinc-950/60 min-h-[580px]">
      {/* Left / Center: Reactor Containment Chamber */}
      <div className="flex-1 flex flex-col gap-2">
        {/* Toolbelt Bar */}
        <div id="vessel-toolbelt" className="flex flex-wrap items-center justify-between gap-2 p-2 bg-zinc-900/80 rounded-xl border border-zinc-800/80">
          {/* Tool Modes */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-mono text-zinc-400 mr-1 hidden sm:inline">Lab Tools:</span>
            
            <button
              id="tool-pipette"
              onClick={() => setActiveTool('pipette')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTool === 'pipette'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.2)]'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
              title="Pipette: Click to inject selected molecules"
            >
              <Pipette className="w-3.5 h-3.5" />
              <span>Pipette</span>
            </button>

            <button
              id="tool-zap"
              onClick={() => setActiveTool('zap')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTool === 'zap'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_8px_rgba(245,158,11,0.2)]'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
              title="Energy Laser: Click to excite molecules and trigger activation"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Energy Zap</span>
            </button>

            <button
              id="tool-attract"
              onClick={() => setActiveTool('attract')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTool === 'attract'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
              title="Gravity Field: Attract molecules to form dense reaction hot-spots"
            >
              <Magnet className="w-3.5 h-3.5" />
              <span>Attractor</span>
            </button>

            <button
              id="tool-repel"
              onClick={() => setActiveTool('repel')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTool === 'repel'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
              title="Repulsor Field: Disperse concentrated clusters"
            >
              <Wind className="w-3.5 h-3.5" />
              <span>Repulsor</span>
            </button>
          </div>

          {/* Canvas Display Overlays */}
          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
            <span className="text-[11px] font-mono mr-1 hidden md:inline">View:</span>

            <button
              id="toggle-trails"
              onClick={() => setShowTrails(!showTrails)}
              className={`px-2 py-1 rounded text-[11px] border font-mono transition-colors ${
                showTrails
                  ? 'bg-zinc-800 text-emerald-300 border-emerald-500/30'
                  : 'bg-zinc-900 text-zinc-500 border-zinc-800'
              }`}
            >
              Trails
            </button>

            <button
              id="toggle-vectors"
              onClick={() => setShowVectors(!showVectors)}
              className={`px-2 py-1 rounded text-[11px] border font-mono transition-colors ${
                showVectors
                  ? 'bg-zinc-800 text-emerald-300 border-emerald-500/30'
                  : 'bg-zinc-900 text-zinc-500 border-zinc-800'
              }`}
            >
              Vectors
            </button>

            <button
              id="toggle-symbols"
              onClick={() => setShowSymbols(!showSymbols)}
              className={`px-2 py-1 rounded text-[11px] border font-mono transition-colors ${
                showSymbols
                  ? 'bg-zinc-800 text-emerald-300 border-emerald-500/30'
                  : 'bg-zinc-900 text-zinc-500 border-zinc-800'
              }`}
            >
              Symbols
            </button>
          </div>
        </div>

        {/* The Live Interactive Canvas */}
        <div
          ref={containerRef}
          className="relative w-full flex-1 min-h-[420px] rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800 shadow-inner flex items-center justify-center cursor-crosshair select-none"
        >
          <canvas
            ref={canvasRef}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseLeave}
            className="block w-full h-full"
          />

          {/* Quick HUD Overlay */}
          <div className="absolute top-3 left-3 px-2.5 py-1.5 rounded-lg bg-zinc-950/80 border border-zinc-800/80 text-[11px] font-mono text-zinc-400 pointer-events-none backdrop-blur-sm flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>Click & Drag canvas to interact with {activeTool}</span>
          </div>
        </div>
      </div>

      {/* Right Sidebar: Reagent Tray & Environmental Controls */}
      <div id="vessel-sidebar" className="w-full lg:w-72 flex flex-col gap-3">
        {/* Reagent Pipette Palette */}
        <div className="p-3 bg-zinc-900/70 rounded-xl border border-zinc-800/80 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 font-mono flex items-center gap-1.5">
              <Pipette className="w-3.5 h-3.5 text-emerald-400" />
              <span>Reagent Injector</span>
            </h3>
            <div className="flex items-center gap-1 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800 text-[11px] font-mono text-zinc-300">
              <span>Qty:</span>
              <select
                value={injectCount}
                onChange={(e) => setInjectCount(parseInt(e.target.value))}
                className="bg-transparent text-emerald-400 font-bold focus:outline-none cursor-pointer"
              >
                <option value={1} className="bg-zinc-900">1</option>
                <option value={5} className="bg-zinc-900">5</option>
                <option value={15} className="bg-zinc-900">15</option>
                <option value={30} className="bg-zinc-900">30</option>
              </select>
            </div>
          </div>

          {/* Molecule Types List */}
          <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1">
            {moleculeTypes.map((m) => {
              const count = engine.particles.filter(p => p.typeId === m.id).length;
              const isSelected = selectedMoleculeId === m.id;

              return (
                <div
                  key={m.id}
                  onClick={() => setSelectedMoleculeId(m.id)}
                  className={`flex items-center justify-between p-2 rounded-lg cursor-pointer border transition-all text-xs ${
                    isSelected
                      ? 'bg-zinc-800/90 border-emerald-500/50 shadow-[0_0_8px_rgba(16,185,129,0.15)]'
                      : 'bg-zinc-950/60 border-zinc-800/60 hover:bg-zinc-800/40 text-zinc-400'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                      style={{ backgroundColor: m.color }}
                    />
                    <div className="leading-tight">
                      <div className="font-semibold text-zinc-200 flex items-center gap-1.5">
                        <span>{m.name}</span>
                        <span className="font-mono text-[10px] px-1 py-0.2 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                          {m.symbol}
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-400 font-mono">
                        {m.category} • E: {m.energyState}kJ
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-zinc-200 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800 text-[11px]">
                      {count}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onInject(m.id, injectCount);
                      }}
                      title={`Inject +${injectCount} ${m.symbol}`}
                      className="p-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500 hover:text-zinc-950 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Environmental Reactor Controls */}
        <div className="p-3 bg-zinc-900/70 rounded-xl border border-zinc-800/80 flex flex-col gap-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 font-mono flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            <span>Thermodynamic Bath</span>
          </h3>

          {/* Temperature Slider */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-zinc-400 flex items-center gap-1">
                <Thermometer className="w-3.5 h-3.5 text-rose-400" />
                <span>Temperature:</span>
              </span>
              <span className="font-bold text-rose-300">{temperature} K</span>
            </div>
            <input
              type="range"
              min="50"
              max="700"
              step="10"
              value={temperature}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setTemperature(val);
                engine.temperature = val;
              }}
              className="w-full accent-rose-500 cursor-pointer h-1.5 bg-zinc-800 rounded"
            />
            <div className="flex justify-between text-[10px] font-mono text-zinc-400">
              <button onClick={() => { setTemperature(100); engine.temperature = 100; }} className="hover:text-zinc-200">100K (Cryo)</button>
              <button onClick={() => { setTemperature(300); engine.temperature = 300; }} className="hover:text-zinc-200">300K (Std)</button>
              <button onClick={() => { setTemperature(550); engine.temperature = 550; }} className="hover:text-zinc-200">550K (Plasma)</button>
            </div>
          </div>

          {/* Stirrer RPM Slider */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-zinc-400 flex items-center gap-1">
                <Wind className="w-3.5 h-3.5 text-cyan-400" />
                <span>Magnetic Stirrer:</span>
              </span>
              <span className="font-bold text-cyan-300">{stirSpeed * 100} RPM</span>
            </div>
            <input
              type="range"
              min="0"
              max="9"
              step="1"
              value={stirSpeed}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setStirSpeed(val);
                engine.stirSpeed = val;
              }}
              className="w-full accent-cyan-500 cursor-pointer h-1.5 bg-zinc-800 rounded"
            />
          </div>
        </div>

        {/* Chemostat Continuous-Flow Influx / Outflux Pump */}
        <div className="p-3 bg-zinc-900/70 rounded-xl border border-zinc-800/80 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 font-mono flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-emerald-400" />
              <span>Chemostat Flow Pump</span>
            </h3>
            <button
              onClick={() => {
                engine.chemostatEnabled = !engine.chemostatEnabled;
                if (engine.chemostatEnabled && !engine.inflowSpeciesId && moleculeTypes[0]) {
                  engine.inflowSpeciesId = moleculeTypes[0].id;
                }
              }}
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition-colors ${
                engine.chemostatEnabled
                  ? 'bg-emerald-500 text-zinc-950 border-emerald-400'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700'
              }`}
            >
              {engine.chemostatEnabled ? 'ACTIVE' : 'STANDBY'}
            </button>
          </div>

          <div className="flex flex-col gap-2 text-xs font-mono">
            {/* Influx Reagent Selector */}
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400">Inlet Feed Stock:</span>
              <select
                value={engine.inflowSpeciesId || selectedMoleculeId}
                onChange={(e) => {
                  engine.inflowSpeciesId = e.target.value;
                }}
                className="bg-zinc-950 text-emerald-400 text-[10px] font-mono px-2 py-0.5 rounded border border-zinc-800 focus:outline-none"
              >
                {moleculeTypes.map(m => (
                  <option key={m.id} value={m.id} className="bg-zinc-900">
                    {m.symbol} ({m.name})
                  </option>
                ))}
              </select>
            </div>

            {/* Inflow Rate */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-zinc-400">Inflow Rate:</span>
                <span className="text-emerald-300 font-bold">{engine.inflowRate} mol/s</span>
              </div>
              <input
                type="range"
                min="0"
                max="30"
                step="1"
                value={engine.inflowRate}
                onChange={(e) => {
                  engine.inflowRate = parseInt(e.target.value);
                  if (engine.inflowRate > 0) engine.chemostatEnabled = true;
                }}
                className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-zinc-800 rounded"
              />
            </div>

            {/* Dilution Outflow Rate */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-zinc-400">Dilution Washout:</span>
                <span className="text-rose-300 font-bold">{(engine.outflowDilutionRate * 100).toFixed(0)}% /s</span>
              </div>
              <input
                type="range"
                min="0"
                max="0.15"
                step="0.01"
                value={engine.outflowDilutionRate}
                onChange={(e) => {
                  engine.outflowDilutionRate = parseFloat(e.target.value);
                  if (engine.outflowDilutionRate > 0) engine.chemostatEnabled = true;
                }}
                className="w-full accent-rose-500 cursor-pointer h-1.5 bg-zinc-800 rounded"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
