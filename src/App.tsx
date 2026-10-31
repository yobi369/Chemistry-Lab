import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChemEngine } from './engine/chemEngine';
import { PRESET_SYSTEMS } from './data/presets';
import { PresetSystem, MoleculeType, ReactionRule, ReactionEvent, TimeSeriesPoint } from './types/chemistry';
import { Navbar, ActiveTab } from './components/Navbar';
import { StatsBanner } from './components/StatsBanner';
import { ReactorVessel } from './components/ReactorVessel';
import { ReactionGraph } from './components/ReactionGraph';
import { AnalyticsCharts } from './components/AnalyticsCharts';
import { SystemCallInspector } from './components/SystemCallInspector';
import { RuleEditor } from './components/RuleEditor';
import { EducationalGuide } from './components/EducationalGuide';
import { ReactionDiffusionGrid } from './components/ReactionDiffusionGrid';
import { GeneticStringSoup } from './components/GeneticStringSoup';
import { ExportShareModal } from './components/ExportShareModal';
import { ThreeSpatialChamber } from './components/ThreeSpatialChamber';
import { LabChallenges } from './components/LabChallenges';
import { AiSynthesisCompiler } from './components/AiSynthesisCompiler';
import { OnboardingTour } from './components/OnboardingTour';
import { decodeModelFromUrl } from './utils/urlState';
import { QualityTier, QUALITY_PRESETS } from './utils/performanceConfig';

export default function App() {
  const [currentPreset, setCurrentPreset] = useState<PresetSystem>(() => {
    // Check if a shared model is present in URL hash
    if (typeof window !== 'undefined' && window.location.hash.startsWith('#model=')) {
      const hashData = window.location.hash.replace('#model=', '');
      const decoded = decodeModelFromUrl(hashData);
      if (decoded) return decoded;
    }
    return PRESET_SYSTEMS[0];
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>('vessel');
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [simSpeed, setSimSpeed] = useState<number>(1.0);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isTourOpen, setIsTourOpen] = useState<boolean>(() => {
    try {
      return !localStorage.getItem('CHEM_TOUR_COMPLETED');
    } catch {
      return false;
    }
  });
  const [qualityTier, setQualityTier] = useState<QualityTier>('balanced');

  // Molecule types and Reaction rules state (synchronized with engine)
  const [moleculeTypes, setMoleculeTypes] = useState<MoleculeType[]>(currentPreset.moleculeTypes);
  const [reactionRules, setReactionRules] = useState<ReactionRule[]>(currentPreset.reactionRules);
  const [temperature, setTemperature] = useState<number>(currentPreset.defaultTemp);
  const [stirSpeed, setStirSpeed] = useState<number>(currentPreset.defaultStirSpeed);

  // Engine instance reference
  const engineRef = useRef<ChemEngine | null>(null);

  // Telemetry state for UI re-renders
  const [telemetry, setTelemetry] = useState({
    particleCount: 0,
    reactionRate: 0,
    energyPool: 500,
    temperature: 300,
    entropy: 0,
    totalReactions: 0
  });

  const [logs, setLogs] = useState<ReactionEvent[]>([]);
  const [history, setHistory] = useState<TimeSeriesPoint[]>([]);

  // Toggle Performance Quality Tier
  const handleToggleQualityTier = () => {
    setQualityTier(prev => {
      const next: QualityTier = prev === 'high' ? 'balanced' : prev === 'balanced' ? 'eco' : 'high';
      if (engineRef.current) {
        const config = QUALITY_PRESETS[next];
        // Enforce particle cap
        if (engineRef.current.particles.length > config.maxParticles) {
          engineRef.current.particles = engineRef.current.particles.slice(0, config.maxParticles);
        }
      }
      return next;
    });
  };

  // Initialize Engine
  useEffect(() => {
    const engine = new ChemEngine(currentPreset, 800, 550);
    engineRef.current = engine;
    setMoleculeTypes(engine.moleculeTypes);
    setReactionRules(engine.reactionRules);
    setTemperature(engine.temperature);
    setStirSpeed(engine.stirSpeed);
    setLogs([...engine.logs]);
    setHistory([...engine.history]);
  }, [currentPreset]);

  // Main Simulation Loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();
    let frameAccumulator = 0;
    const fixedStepFrames = 1;
    const maxCatchUpSteps = 6;

    const loop = (time: number) => {
      // The visual particle engine uses a fixed frame-sized integration step.
      // Accumulate wall-clock time so fast and slow displays advance consistently.
      const elapsedSeconds = Math.min(Math.max((time - lastTime) / 1000, 0), 0.1);
      lastTime = time;

      if (isRunning && engineRef.current) {
        frameAccumulator += elapsedSeconds * 60 * Math.max(0.05, simSpeed);
        let steps = 0;
        while (frameAccumulator >= fixedStepFrames && steps < maxCatchUpSteps) {
          engineRef.current.update(1.0);
          frameAccumulator -= fixedStepFrames;
          steps += 1;
        }
        // Drop excessive backlog instead of entering a spiral of death after tab suspension.
        if (steps === maxCatchUpSteps && frameAccumulator >= fixedStepFrames) {
          frameAccumulator = 0;
        }

        // Periodically sync React state with engine
        const eng = engineRef.current;
        if (eng.tickCount % 6 === 0) {
          const currentPt = eng.history[eng.history.length - 1];
          setTelemetry({
            particleCount: eng.particles.length,
            reactionRate: eng.reactionFluxRate,
            energyPool: Math.round(eng.energyPool),
            temperature: Math.round(eng.temperature),
            entropy: currentPt?.entropy || 0,
            totalReactions: eng.totalReactionsCount
          });
          setLogs([...eng.logs]);
          setHistory([...eng.history]);
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isRunning, simSpeed]);

  // Handler: Change Preset
  const handleSelectPreset = (preset: PresetSystem) => {
    setCurrentPreset(preset);
    if (engineRef.current) {
      engineRef.current.loadPreset(preset);
      setMoleculeTypes(engineRef.current.moleculeTypes);
      setReactionRules(engineRef.current.reactionRules);
      setTemperature(engineRef.current.temperature);
      setStirSpeed(engineRef.current.stirSpeed);
      setLogs([]);
      setHistory([]);
    }
  };

  // Handler: Play / Pause
  const handleTogglePlay = () => {
    setIsRunning(prev => !prev);
  };

  // Handler: Single Step Frame
  const handleStep = () => {
    if (engineRef.current) {
      engineRef.current.update(1.0);
      const eng = engineRef.current;
      const currentPt = eng.history[eng.history.length - 1];
      setTelemetry({
        particleCount: eng.particles.length,
        reactionRate: eng.reactionFluxRate,
        energyPool: Math.round(eng.energyPool),
        temperature: Math.round(eng.temperature),
        entropy: currentPt?.entropy || 0,
        totalReactions: eng.totalReactionsCount
      });
      setLogs([...eng.logs]);
      setHistory([...eng.history]);
    }
  };

  // Handler: Reset
  const handleReset = () => {
    handleSelectPreset(currentPreset);
  };

  // Handler: Clear All
  const handleClear = () => {
    if (engineRef.current) {
      engineRef.current.clearAll();
      setTelemetry({
        particleCount: 0,
        reactionRate: 0,
        energyPool: engineRef.current.energyPool,
        temperature: engineRef.current.temperature,
        entropy: 0,
        totalReactions: 0
      });
      setLogs([]);
      setHistory([]);
    }
  };

  // Handler: Inject Molecules
  const handleInject = (typeId: string, count: number, x?: number, y?: number) => {
    if (engineRef.current) {
      engineRef.current.injectMolecules(typeId, count, x, y);
    }
  };

  // Handler: Dispatch System Call manually
  const handleDispatchSyscall = (syscallName: string) => {
    if (!engineRef.current) return;
    const eng = engineRef.current;

    // Find rules matching this syscall
    const matchingRule = eng.reactionRules.find(r => r.syscallType === syscallName && r.enabled);
    if (matchingRule) {
      // Find candidate particles matching reactants
      const rId = matchingRule.reactants[0]?.moleculeId;
      const candidates = eng.particles.filter(p => p.typeId === rId);
      if (candidates.length > 0) {
        const p1 = candidates[0];
        // Inject a complementary particle right next to it to force reaction
        const r2Id = matchingRule.reactants[1]?.moleculeId || matchingRule.catalysts[0] || rId;
        const mol2 = eng.getMoleculeType(r2Id);
        if (mol2) {
          eng.spawnParticle(mol2, p1.x + 4, p1.y + 4, -p1.vx * 2, -p1.vy * 2);
          eng.createFlash(p1.x, p1.y, '#3b82f6', 40, `[TRIGGER: ${syscallName}]`);
        }
      } else {
        // Spawn reactants directly
        matchingRule.reactants.forEach(r => {
          eng.injectMolecules(r.moleculeId, 2, eng.width / 2, eng.height / 2);
        });
      }
    } else {
      // Generic dispatch
      eng.zapEnergyAt(eng.width / 2, eng.height / 2, 80, 50);
    }
  };

  return (
    <div id="artificial-chemistry-app" className="min-h-screen bg-[#080d0a] text-zinc-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Top Navbar with Simulation Controls */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentPreset={currentPreset}
        onSelectPreset={handleSelectPreset}
        isRunning={isRunning}
        onTogglePlay={handleTogglePlay}
        onStep={handleStep}
        onReset={handleReset}
        onClear={handleClear}
        simSpeed={simSpeed}
        setSimSpeed={setSimSpeed}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onOpenTour={() => setIsTourOpen(true)}
        qualityTier={qualityTier}
        onToggleQualityTier={handleToggleQualityTier}
      />

      {/* Real-Time Telemetry Bar */}
      <StatsBanner
        particleCount={telemetry.particleCount}
        reactionRate={telemetry.reactionRate}
        energyPool={telemetry.energyPool}
        temperature={telemetry.temperature}
        entropy={telemetry.entropy}
        totalReactions={telemetry.totalReactions}
      />

      {/* Main Content Workspace View */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-2 sm:p-4">
        {engineRef.current && (
          <>
            {activeTab === 'vessel' && (
              <ReactorVessel
                engine={engineRef.current}
                moleculeTypes={moleculeTypes}
                temperature={temperature}
                setTemperature={setTemperature}
                stirSpeed={stirSpeed}
                setStirSpeed={setStirSpeed}
                onInject={handleInject}
              />
            )}

            {activeTab === 'spatial3d' && (
              <ThreeSpatialChamber
                engine={engineRef.current}
                moleculeTypes={moleculeTypes}
                onInject={handleInject}
              />
            )}

            {activeTab === 'challenges' && (
              <LabChallenges
                engine={engineRef.current}
                moleculeTypes={moleculeTypes}
                onSelectPreset={handleSelectPreset}
                onInject={handleInject}
              />
            )}

            {activeTab === 'compiler' && (
              <AiSynthesisCompiler
                engine={engineRef.current}
                onApplyCustomSystem={(system) => {
                  handleSelectPreset(system);
                  setActiveTab('vessel');
                }}
              />
            )}

            {activeTab === 'turing' && (
              <ReactionDiffusionGrid />
            )}

            {activeTab === 'genetic' && (
              <GeneticStringSoup />
            )}

            {activeTab === 'network' && (
              <ReactionGraph
                engine={engineRef.current}
                moleculeTypes={moleculeTypes}
                reactionRules={reactionRules}
              />
            )}

            {activeTab === 'analytics' && (
              <AnalyticsCharts
                engine={engineRef.current}
                moleculeTypes={moleculeTypes}
                history={history}
              />
            )}

            {activeTab === 'syscalls' && (
              <SystemCallInspector
                engine={engineRef.current}
                moleculeTypes={moleculeTypes}
                logs={logs}
                onDispatchSyscall={handleDispatchSyscall}
              />
            )}

            {activeTab === 'rules' && (
              <RuleEditor
                engine={engineRef.current}
                moleculeTypes={moleculeTypes}
                setMoleculeTypes={setMoleculeTypes}
                reactionRules={reactionRules}
                setReactionRules={setReactionRules}
              />
            )}

            {activeTab === 'guide' && <EducationalGuide />}
          </>
        )}
      </main>

      {/* Guided Tour Modal */}
      <OnboardingTour
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
        onNavigateTab={(tab) => setActiveTab(tab as ActiveTab)}
      />

      {/* Export & Share Modal */}
      {engineRef.current && (
        <ExportShareModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          engine={engineRef.current}
          moleculeTypes={moleculeTypes}
          reactionRules={reactionRules}
          currentPreset={currentPreset}
          onImportCustomPreset={(preset) => {
            handleSelectPreset(preset);
            setActiveTab('vessel');
          }}
        />
      )}
    </div>
  );
}


