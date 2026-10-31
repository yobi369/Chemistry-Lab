import React, { useState, useEffect, useRef } from 'react';
import { ChemEngine } from '../engine/chemEngine';
import { MoleculeType, ReactionRule } from '../types/chemistry';
import { GitFork, Info, Zap, Flame, CheckCircle, ArrowRight } from 'lucide-react';
import * as d3 from 'd3';

interface ReactionGraphProps {
  engine: ChemEngine;
  moleculeTypes: MoleculeType[];
  reactionRules: ReactionRule[];
}

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  symbol: string;
  color: string;
  type: 'molecule' | 'rule';
  radius: number;
  count?: number;
  ruleData?: ReactionRule;
  molData?: MoleculeType;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  isCatalyst?: boolean;
  isProduct?: boolean;
}

export const ReactionGraph: React.FC<ReactionGraphProps> = ({
  engine,
  moleculeTypes,
  reactionRules
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || 800;
    const height = 500;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // Clear previous render

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    // Build Nodes & Links
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];

    // 1. Add Molecule Nodes
    moleculeTypes.forEach((m) => {
      const count = engine.particles.filter(p => p.typeId === m.id).length;
      nodes.push({
        id: `mol_${m.id}`,
        name: m.name,
        symbol: m.symbol,
        color: m.color,
        type: 'molecule',
        radius: Math.max(16, Math.min(32, 16 + count * 0.4)),
        count,
        molData: m
      });
    });

    // 2. Add Reaction Rule Hub Nodes & Edges
    reactionRules.forEach((r) => {
      const ruleNodeId = `rule_${r.id}`;
      nodes.push({
        id: ruleNodeId,
        name: r.name,
        symbol: r.syscallType || 'RXN',
        color: r.energyDelta < 0 ? '#10b981' : '#f59e0b',
        type: 'rule',
        radius: 14,
        ruleData: r
      });

      // Reactant -> Rule Edge
      r.reactants.forEach(reactant => {
        links.push({
          source: `mol_${reactant.moleculeId}`,
          target: ruleNodeId,
          isProduct: false
        });
      });

      // Rule -> Product Edge
      r.products.forEach(product => {
        links.push({
          source: ruleNodeId,
          target: `mol_${product.moleculeId}`,
          isProduct: true
        });
      });

      // Catalysts (bidirectional dashed loop)
      r.catalysts.forEach(catId => {
        links.push({
          source: `mol_${catId}`,
          target: ruleNodeId,
          isCatalyst: true
        });
      });
    });

    // Define Arrow Marker in SVG defs
    const defs = svg.append('defs');

    defs.append('marker')
      .attr('id', 'arrow-reactant')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 22)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-4L8,0L0,4')
      .attr('fill', '#64748b');

    defs.append('marker')
      .attr('id', 'arrow-product')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 26)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-4L8,0L0,4')
      .attr('fill', '#10b981');

    const g = svg.append('g');

    // Zoom behavior
    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.5, 3])
        .on('zoom', (event) => {
          g.attr('transform', event.transform);
        })
    );

    // Force Simulation
    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(links).id(d => d.id).distance(90))
      .force('charge', d3.forceManyBody().strength(-240))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(d => (d as GraphNode).radius + 18));

    // Draw Links
    const link = g.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', d => d.isCatalyst ? '#eab308' : (d.isProduct ? '#10b981' : '#64748b'))
      .attr('stroke-width', d => d.isCatalyst ? 1.5 : (d.isProduct ? 2 : 1.5))
      .attr('stroke-dasharray', d => d.isCatalyst ? '4,4' : 'none')
      .attr('stroke-opacity', 0.6)
      .attr('marker-end', d => d.isProduct ? 'url(#arrow-product)' : 'url(#arrow-reactant)');

    // Draw Nodes
    const node = g.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .attr('cursor', 'pointer')
      .call(
        d3.drag<SVGGElement, GraphNode>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      )
      .on('click', (_, d) => {
        setSelectedNode(d);
      });

    // Node circles / boxes
    node.each(function(d) {
      const el = d3.select(this);
      if (d.type === 'molecule') {
        el.append('circle')
          .attr('r', d.radius)
          .attr('fill', d.color)
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 2)
          .attr('filter', 'drop-shadow(0 0 6px rgba(16,185,129,0.3))');

        el.append('text')
          .attr('text-anchor', 'middle')
          .attr('dy', '0.35em')
          .attr('fill', '#ffffff')
          .attr('font-size', Math.max(10, Math.floor(d.radius * 0.7)))
          .attr('font-family', 'Fira Code, monospace')
          .attr('font-weight', 'bold')
          .text(d.symbol);
      } else {
        // Reaction rule diamond/hub
        el.append('rect')
          .attr('x', -14)
          .attr('y', -14)
          .attr('width', 28)
          .attr('height', 28)
          .attr('rx', 6)
          .attr('fill', '#18181b')
          .attr('stroke', d.color)
          .attr('stroke-width', 2);

        el.append('text')
          .attr('text-anchor', 'middle')
          .attr('dy', '0.35em')
          .attr('fill', d.color)
          .attr('font-size', 9)
          .attr('font-family', 'Fira Code, monospace')
          .attr('font-weight', 'bold')
          .text(d.symbol.slice(0, 4));
      }
    });

    // Node Labels
    node.append('text')
      .attr('dy', d => d.radius + 14)
      .attr('text-anchor', 'middle')
      .attr('fill', '#cbd5e1')
      .attr('font-size', 11)
      .attr('font-family', 'Plus Jakarta Sans, sans-serif')
      .attr('font-weight', '500')
      .text(d => d.name);

    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as any).x ?? 0)
        .attr('y1', d => (d.source as any).y ?? 0)
        .attr('x2', d => (d.target as any).x ?? 0)
        .attr('y2', d => (d.target as any).y ?? 0);

      node.attr('transform', d => `translate(${(d as any).x ?? 0},${(d as any).y ?? 0})`);
    });

    return () => {
      simulation.stop();
    };
  }, [moleculeTypes, reactionRules, engine]);

  return (
    <div id="reaction-graph-view" className="flex flex-col lg:flex-row gap-3 p-3 bg-zinc-950/60 min-h-[580px]">
      {/* Main SVG Graph Container */}
      <div ref={containerRef} className="flex-1 flex flex-col gap-2">
        <div className="flex items-center justify-between p-2 bg-zinc-900/80 rounded-xl border border-zinc-800/80">
          <div className="flex items-center gap-2">
            <GitFork className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-300 font-mono">
              Reaction Rewrite Topology
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-mono text-zinc-400">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Molecule
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-zinc-800 border border-emerald-500" /> Rewrite Rule
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-amber-400 border-dashed" /> Catalyst Link
            </span>
          </div>
        </div>

        <div className="relative flex-1 min-h-[460px] rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800 shadow-inner flex items-center justify-center">
          <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
          <div className="absolute bottom-3 left-3 px-2 py-1 rounded bg-zinc-900/80 border border-zinc-800 text-[10px] font-mono text-zinc-400 pointer-events-none">
            Drag nodes to rearrange • Scroll to zoom • Click node to inspect
          </div>
        </div>
      </div>

      {/* Right: Node Details & Kinetics Inspector */}
      <div className="w-full lg:w-80 flex flex-col gap-3">
        <div className="p-3 bg-zinc-900/70 rounded-xl border border-zinc-800/80 flex flex-col gap-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 font-mono flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-emerald-400" />
            <span>Inspector Panel</span>
          </h3>

          {selectedNode ? (
            <div className="flex flex-col gap-3 text-xs">
              <div className="flex items-center gap-2.5 p-2 rounded-lg bg-zinc-950 border border-zinc-800">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-sm text-zinc-100 shadow-sm"
                  style={{ backgroundColor: selectedNode.color }}
                >
                  {selectedNode.symbol}
                </div>
                <div>
                  <div className="font-bold text-zinc-100">{selectedNode.name}</div>
                  <div className="text-[11px] font-mono text-emerald-400 uppercase">{selectedNode.type}</div>
                </div>
              </div>

              {selectedNode.type === 'molecule' && selectedNode.molData && (
                <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono">
                    <div className="p-2 rounded bg-zinc-950/60 border border-zinc-800">
                      <span className="text-zinc-400">Category:</span>
                      <div className="font-semibold text-zinc-200 uppercase">{selectedNode.molData.category}</div>
                    </div>
                    <div className="p-2 rounded bg-zinc-950/60 border border-zinc-800">
                      <span className="text-zinc-400">Mass / Radius:</span>
                      <div className="font-semibold text-zinc-200">{selectedNode.molData.mass} amu / {selectedNode.molData.radius}px</div>
                    </div>
                    <div className="p-2 rounded bg-zinc-950/60 border border-zinc-800">
                      <span className="text-zinc-400">Energy State:</span>
                      <div className="font-semibold text-amber-300">{selectedNode.molData.energyState} kJ/mol</div>
                    </div>
                    <div className="p-2 rounded bg-zinc-950/60 border border-zinc-800">
                      <span className="text-zinc-400">Current Qty:</span>
                      <div className="font-semibold text-emerald-300">
                        {engine.particles.filter(p => p.typeId === selectedNode.molData?.id).length} particles
                      </div>
                    </div>
                  </div>

                  <p className="text-zinc-300 text-xs bg-zinc-950/40 p-2 rounded border border-zinc-800/60">
                    {selectedNode.molData.description}
                  </p>
                </div>
              )}

              {selectedNode.type === 'rule' && selectedNode.ruleData && (
                <div className="flex flex-col gap-2">
                  <div className="p-2 rounded bg-zinc-950 border border-zinc-800 font-mono text-[11px] leading-relaxed">
                    <div className="text-zinc-400 mb-1">Rewrite Transformation:</div>
                    <div className="text-emerald-300 font-semibold flex items-center gap-1.5 flex-wrap">
                      <span>{selectedNode.ruleData.reactants.map(r => `${r.count > 1 ? r.count : ''}${r.moleculeId}`).join(' + ')}</span>
                      <ArrowRight className="w-3 h-3 text-zinc-400" />
                      <span>{selectedNode.ruleData.products.map(p => `${p.count > 1 ? p.count : ''}${p.moleculeId}`).join(' + ')}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono">
                    <div className="p-2 rounded bg-zinc-950/60 border border-zinc-800">
                      <span className="text-zinc-400">Activation Ea:</span>
                      <div className="font-semibold text-rose-300">{selectedNode.ruleData.activationEnergy} kJ</div>
                    </div>
                    <div className="p-2 rounded bg-zinc-950/60 border border-zinc-800">
                      <span className="text-zinc-400">Rate Constant k:</span>
                      <div className="font-semibold text-cyan-300">{selectedNode.ruleData.rateConstant}</div>
                    </div>
                    <div className="p-2 rounded bg-zinc-950/60 border border-zinc-800">
                      <span className="text-zinc-400">Enthalpy ΔE:</span>
                      <div className={`font-semibold ${selectedNode.ruleData.energyDelta < 0 ? 'text-emerald-300' : 'text-amber-300'}`}>
                        {selectedNode.ruleData.energyDelta} kJ ({selectedNode.ruleData.energyDelta < 0 ? 'Exothermic' : 'Endothermic'})
                      </div>
                    </div>
                    <div className="p-2 rounded bg-zinc-950/60 border border-zinc-800">
                      <span className="text-zinc-400">System Call:</span>
                      <div className="font-semibold text-purple-300">{selectedNode.ruleData.syscallType || 'NONE'}</div>
                    </div>
                  </div>

                  <p className="text-zinc-300 text-xs bg-zinc-950/40 p-2 rounded border border-zinc-800/60">
                    {selectedNode.ruleData.description}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 text-center text-zinc-400 font-mono text-xs">
              Click any molecule or reaction rule node to inspect its stoichiometric parameters, rate constant, and activation barriers.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
