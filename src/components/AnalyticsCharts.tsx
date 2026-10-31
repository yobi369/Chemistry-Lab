import React, { useState } from 'react';
import { ChemEngine } from '../engine/chemEngine';
import { MoleculeType, TimeSeriesPoint } from '../types/chemistry';
import { LineChart, Orbit, Zap, Compass, Activity } from 'lucide-react';

interface AnalyticsChartsProps {
  engine: ChemEngine;
  moleculeTypes: MoleculeType[];
  history: TimeSeriesPoint[];
}

export const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({
  engine,
  moleculeTypes,
  history
}) => {
  const [phaseXId, setPhaseXId] = useState<string>(moleculeTypes[0]?.id || '');
  const [phaseYId, setPhaseYId] = useState<string>(moleculeTypes[1]?.id || moleculeTypes[0]?.id || '');
  const [visibleMolecules, setVisibleMolecules] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    moleculeTypes.forEach(m => { init[m.id] = true; });
    return init;
  });

  const toggleMolecule = (id: string) => {
    setVisibleMolecules(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Find max concentration in history for scaling
  let maxCount = 20;
  history.forEach(pt => {
    Object.entries(pt.counts).forEach(([id, c]) => {
      const countVal = Number(c);
      if (visibleMolecules[id] && countVal > maxCount) maxCount = countVal;
    });
  });
  maxCount = Math.ceil(maxCount * 1.15);

  // Time-series SVG dimensions
  const tsWidth = 700;
  const tsHeight = 240;
  const padding = { top: 20, right: 30, bottom: 30, left: 40 };
  const plotW = tsWidth - padding.left - padding.right;
  const plotH = tsHeight - padding.top - padding.bottom;

  // Generate SVG path for a molecule type
  const generatePath = (typeId: string): string => {
    if (history.length < 2) return '';
    const n = history.length;
    return history.map((pt, i) => {
      const x = padding.left + (i / Math.max(1, n - 1)) * plotW;
      const count = pt.counts[typeId] || 0;
      const y = padding.top + plotH - (count / maxCount) * plotH;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
  };

  // Phase Space 2D Portrait path
  const phaseWidth = 320;
  const phaseHeight = 240;
  const phasePad = 35;
  const phasePlotW = phaseWidth - phasePad * 2;
  const phasePlotH = phaseHeight - phasePad * 2;

  let maxPhaseX = 10;
  let maxPhaseY = 10;
  history.forEach(pt => {
    const cx = pt.counts[phaseXId] || 0;
    const cy = pt.counts[phaseYId] || 0;
    if (cx > maxPhaseX) maxPhaseX = cx;
    if (cy > maxPhaseY) maxPhaseY = cy;
  });
  maxPhaseX = Math.ceil(maxPhaseX * 1.2);
  maxPhaseY = Math.ceil(maxPhaseY * 1.2);

  const phasePath = history.length > 1
    ? history.map((pt, i) => {
        const cx = pt.counts[phaseXId] || 0;
        const cy = pt.counts[phaseYId] || 0;
        const x = phasePad + (cx / maxPhaseX) * phasePlotW;
        const y = phasePad + phasePlotH - (cy / maxPhaseY) * phasePlotH;
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      }).join(' ')
    : '';

  const currentPoint = history[history.length - 1];
  const currentPhaseXPos = currentPoint
    ? phasePad + ((currentPoint.counts[phaseXId] || 0) / maxPhaseX) * phasePlotW
    : phasePad;
  const currentPhaseYPos = currentPoint
    ? phasePad + phasePlotH - ((currentPoint.counts[phaseYId] || 0) / maxPhaseY) * phasePlotH
    : phasePad + phasePlotH;

  const molX = moleculeTypes.find(m => m.id === phaseXId);
  const molY = moleculeTypes.find(m => m.id === phaseYId);

  return (
    <div id="analytics-view" className="flex flex-col gap-3 p-3 bg-zinc-950/60">
      {/* Top: Concentration Time Series & Legend */}
      <div className="p-3 bg-zinc-900/70 rounded-xl border border-zinc-800/80 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <LineChart className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 font-mono">
              Real-Time Concentration Kinetics [N vs Time]
            </h3>
          </div>

          {/* Molecule Visibility Toggles */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {moleculeTypes.map(m => (
              <button
                key={m.id}
                onClick={() => toggleMolecule(m.id)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-mono border transition-all ${
                  visibleMolecules[m.id]
                    ? 'bg-zinc-800 text-zinc-200 border-zinc-700'
                    : 'bg-zinc-950/60 text-zinc-400 border-zinc-800 line-through'
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
                <span>{m.symbol} ({engine.particles.filter(p => p.typeId === m.id).length})</span>
              </button>
            ))}
          </div>
        </div>

        {/* SVG Time Series Chart */}
        <div className="w-full bg-zinc-950 rounded-lg border border-zinc-800 p-2 overflow-x-auto">
          <svg viewBox={`0 0 ${tsWidth} ${tsHeight}`} className="w-full h-48 sm:h-56">
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
              const y = padding.top + plotH * (1 - ratio);
              const label = Math.round(maxCount * ratio);
              return (
                <g key={idx}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={tsWidth - padding.right}
                    y2={y}
                    stroke="rgba(255,255,255,0.06)"
                    strokeDasharray="3,3"
                  />
                  <text
                    x={padding.left - 8}
                    y={y + 3}
                    fill="#71717a"
                    fontSize="9"
                    fontFamily="Fira Code"
                    textAnchor="end"
                  >
                    {label}
                  </text>
                </g>
              );
            })}

            {/* Render Concentration Curves */}
            {moleculeTypes.map(m => {
              if (!visibleMolecules[m.id]) return null;
              const d = generatePath(m.id);
              if (!d) return null;
              return (
                <path
                  key={m.id}
                  d={d}
                  fill="none"
                  stroke={m.color}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.9"
                />
              );
            })}

            {/* Time Axis labels */}
            <text x={padding.left} y={tsHeight - 8} fill="#71717a" fontSize="9" fontFamily="Fira Code">
              -{(history.length * 0.25).toFixed(0)}s
            </text>
            <text x={tsWidth - padding.right} y={tsHeight - 8} fill="#71717a" fontSize="9" fontFamily="Fira Code" textAnchor="end">
              Now
            </text>
          </svg>
        </div>
      </div>

      {/* Bottom Grid: Phase Portrait & Thermodynamic Flux */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Phase Space Portrait */}
        <div className="p-3 bg-zinc-900/70 rounded-xl border border-zinc-800/80 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Orbit className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 font-mono">
                2D Phase Portrait (Attractor Trajectory)
              </h3>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono">
              <select
                value={phaseXId}
                onChange={e => setPhaseXId(e.target.value)}
                className="bg-zinc-950 text-zinc-200 px-2 py-0.5 rounded border border-zinc-800 focus:outline-none"
              >
                {moleculeTypes.map(m => (
                  <option key={m.id} value={m.id}>X: {m.symbol}</option>
                ))}
              </select>
              <span className="text-zinc-400">vs</span>
              <select
                value={phaseYId}
                onChange={e => setPhaseYId(e.target.value)}
                className="bg-zinc-950 text-zinc-200 px-2 py-0.5 rounded border border-zinc-800 focus:outline-none"
              >
                {moleculeTypes.map(m => (
                  <option key={m.id} value={m.id}>Y: {m.symbol}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-zinc-950 rounded-lg border border-zinc-800 p-2 flex items-center justify-center relative">
            <svg viewBox={`0 0 ${phaseWidth} ${phaseHeight}`} className="w-full h-48">
              {/* Axes */}
              <line
                x1={phasePad}
                y1={phasePad + phasePlotH}
                x2={phasePad + phasePlotW}
                y2={phasePad + phasePlotH}
                stroke="#3f3f46"
                strokeWidth="1.5"
              />
              <line
                x1={phasePad}
                y1={phasePad}
                x2={phasePad}
                y2={phasePad + phasePlotH}
                stroke="#3f3f46"
                strokeWidth="1.5"
              />

              {/* Trajectory line */}
              {phasePath && (
                <path
                  d={phasePath}
                  fill="none"
                  stroke="#06b6d4"
                  strokeWidth="1.8"
                  strokeDasharray="none"
                  opacity="0.85"
                />
              )}

              {/* Current trajectory head dot */}
              <circle
                cx={currentPhaseXPos}
                cy={currentPhaseYPos}
                r="4.5"
                fill="#10b981"
                stroke="#ffffff"
                strokeWidth="1.5"
              />

              {/* Axis labels */}
              <text
                x={phasePad + phasePlotW / 2}
                y={phaseHeight - 6}
                fill="#a1a1aa"
                fontSize="10"
                fontFamily="Fira Code"
                textAnchor="middle"
              >
                [{molX?.symbol || 'X'}]
              </text>
              <text
                x={12}
                y={phasePad + phasePlotH / 2}
                fill="#a1a1aa"
                fontSize="10"
                fontFamily="Fira Code"
                textAnchor="middle"
                transform={`rotate(-90 12 ${phasePad + phasePlotH / 2})`}
              >
                [{molY?.symbol || 'Y'}]
              </text>
            </svg>
          </div>
          <div className="text-[11px] font-mono text-zinc-400">
            Closed orbital loops indicate non-linear limit cycles (e.g. Brusselator / Predator-Prey). Spirals indicate damped convergence toward equilibrium.
          </div>
        </div>

        {/* Thermodynamic & Information Entropy */}
        <div className="p-3 bg-zinc-900/70 rounded-xl border border-zinc-800/80 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-purple-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 font-mono">
              Thermodynamic & Information Metrics
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex flex-col gap-1">
              <div className="text-zinc-400 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Free Energy Pool</span>
              </div>
              <div className="text-lg font-bold text-amber-300">
                {engine.energyPool} <span className="text-xs text-zinc-400 font-normal">kJ</span>
              </div>
              <div className="text-[10px] text-zinc-400">Dynamic chemical reservoir driving endothermic transforms.</div>
            </div>

            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex flex-col gap-1">
              <div className="text-zinc-400 flex items-center gap-1">
                <Compass className="w-3.5 h-3.5 text-purple-400" />
                <span>Shannon Entropy S</span>
              </div>
              <div className="text-lg font-bold text-purple-300">
                {(currentPoint?.entropy || 0).toFixed(2)} <span className="text-xs text-zinc-400 font-normal">bits</span>
              </div>
              <div className="text-[10px] text-zinc-400">Chemical diversity metric: higher entropy = richer emergent species mix.</div>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-zinc-950/80 border border-zinc-800 text-xs font-mono text-zinc-300 leading-relaxed">
            <div className="text-emerald-400 font-bold mb-1 flex items-center gap-1.5">
              <span>Reaction Flux Rate:</span>
              <span>{engine.reactionFluxRate} rxn/sec</span>
            </div>
            <p className="text-zinc-400 text-[11px]">
              Kinetics follow Mass Action: reaction probability scales with local collision frequency, reactant concentrations $[A][B]$, and thermal excitation overcoming activation barrier $E_a$.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
