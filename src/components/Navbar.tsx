import React, { useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Trash2,
  FlaskConical,
  GitFork,
  LineChart,
  Terminal,
  Sliders,
  BookOpen,
  Sparkles,
  Layers,
  Dna,
  Volume2,
  VolumeX,
  Download,
  Music,
  Box,
  Trophy,
  Wand2,
  HelpCircle,
  Zap,
  Activity,
  Menu,
  X
} from 'lucide-react';
import { PRESET_SYSTEMS } from '../data/presets';
import { PresetSystem } from '../types/chemistry';
import { globalAudioSynth, AudioSonificationMode } from '../engine/audioSynth';
import { QualityTier } from '../utils/performanceConfig';

export type ActiveTab =
  | 'vessel'
  | 'spatial3d'
  | 'challenges'
  | 'compiler'
  | 'turing'
  | 'genetic'
  | 'network'
  | 'analytics'
  | 'syscalls'
  | 'rules'
  | 'guide'
  | 'research';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  currentPreset: PresetSystem;
  onSelectPreset: (preset: PresetSystem) => void;
  isRunning: boolean;
  onTogglePlay: () => void;
  onStep: () => void;
  onReset: () => void;
  onClear: () => void;
  simSpeed: number;
  setSimSpeed: (speed: number) => void;
  onOpenExportModal: () => void;
  onOpenTour: () => void;
  qualityTier: QualityTier;
  onToggleQualityTier: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  currentPreset,
  onSelectPreset,
  isRunning,
  onTogglePlay,
  onStep,
  onReset,
  onClear,
  simSpeed,
  setSimSpeed,
  onOpenExportModal,
  onOpenTour,
  qualityTier,
  onToggleQualityTier
}) => {
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(globalAudioSynth.getIsMuted());
  const [audioMode, setAudioMode] = useState<AudioSonificationMode>(globalAudioSynth.getMode());
  const [showAudioMenu, setShowAudioMenu] = useState<boolean>(false);
  const [showMobileMenu, setShowMobileMenu] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(globalAudioSynth.getVolume());

  const handleToggleAudio = () => {
    const nextState = !isAudioMuted;
    setIsAudioMuted(nextState);
    globalAudioSynth.setMuted(nextState);
  };

  const handleVolumeChange = (val: number) => {
    setVolume(val);
    globalAudioSynth.setVolume(val);
  };

  const handleModeChange = (mode: AudioSonificationMode) => {
    setAudioMode(mode);
    globalAudioSynth.setMode(mode);
  };

  const tabsList = [
    { id: 'vessel', label: '2D Reactor', icon: <FlaskConical className="w-3.5 h-3.5" />, color: 'emerald' },
    { id: 'spatial3d', label: '3D Chamber', icon: <Box className="w-3.5 h-3.5" />, color: 'cyan' },
    { id: 'challenges', label: 'Lab Quests', icon: <Trophy className="w-3.5 h-3.5" />, color: 'amber' },
    { id: 'compiler', label: 'AI Synthesis DSL', icon: <Wand2 className="w-3.5 h-3.5" />, color: 'purple' },
    { id: 'turing', label: 'Turing Patterns', icon: <Layers className="w-3.5 h-3.5" />, color: 'cyan' },
    { id: 'genetic', label: 'Genetic Soup', icon: <Dna className="w-3.5 h-3.5" />, color: 'emerald' },
    { id: 'network', label: 'Rewrite Graph', icon: <GitFork className="w-3.5 h-3.5" />, color: 'emerald' },
    { id: 'analytics', label: 'Kinetics & Phase', icon: <LineChart className="w-3.5 h-3.5" />, color: 'emerald' },
    { id: 'research', label: 'Research Lab · SSA', icon: <Activity className="w-3.5 h-3.5" />, color: 'cyan' },
    { id: 'syscalls', label: 'Syscall VM', icon: <Terminal className="w-3.5 h-3.5" />, color: 'emerald' },
    { id: 'rules', label: 'Rules Matrix', icon: <Sliders className="w-3.5 h-3.5" />, color: 'emerald' },
    { id: 'guide', label: 'Fringe Theory', icon: <BookOpen className="w-3.5 h-3.5" />, color: 'emerald' },
  ] as const;

  return (
    <header id="app-navbar" className="bg-zinc-950 border-b border-zinc-800/80 sticky top-0 z-40">
      {/* Top Banner */}
      <div className="px-3 sm:px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5 border-b border-zinc-900">
        {/* Left: Branding & Guided Tour trigger */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 md:hidden hover:text-white"
            title="Toggle Navigation Menu"
          >
            {showMobileMenu ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>

          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono font-bold text-sm shadow-[0_0_12px_rgba(16,185,129,0.25)]">
            01
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold tracking-widest text-emerald-400 uppercase">Fringe Coding</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono border border-zinc-700/60 hidden sm:inline">BEYOND CODE</span>
            </div>
            <h1 className="text-xs sm:text-sm md:text-base font-bold text-zinc-100 tracking-tight flex items-center gap-1.5">
              Artificial Chemistry Engine <span className="text-xs text-zinc-400 font-normal hidden lg:inline">/ System Call VM</span>
            </h1>
          </div>
        </div>

        {/* Center: Preset Selector */}
        <div className="flex items-center gap-2">
          <label htmlFor="preset-select" className="text-xs text-zinc-400 font-mono flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden lg:inline">Model:</span>
          </label>
          <select
            id="preset-select"
            value={currentPreset.id}
            onChange={(e) => {
              const selected = PRESET_SYSTEMS.find(p => p.id === e.target.value);
              if (selected) onSelectPreset(selected);
            }}
            className="bg-zinc-900 hover:bg-zinc-850 text-zinc-200 text-xs rounded-lg px-2.5 py-1.5 border border-zinc-700/80 focus:outline-none focus:border-emerald-500 cursor-pointer font-medium max-w-[150px] sm:max-w-[220px] truncate font-mono"
          >
            {PRESET_SYSTEMS.map(p => (
              <option key={p.id} value={p.id} className="bg-zinc-900 text-zinc-200 py-1">
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Right: Simulation, Performance, Audio, Tour & Share Controls */}
        <div className="flex items-center gap-1.5">
          {/* Guided Tour Trigger */}
          <button
            onClick={onOpenTour}
            className="p-1.5 px-2.5 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20 text-xs font-mono flex items-center gap-1 transition-colors"
            title="Open Interactive Guided Tour"
          >
            <HelpCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden xl:inline">Guided Tour</span>
          </button>

          {/* Performance & Quality Tier Toggle */}
          <button
            onClick={onToggleQualityTier}
            className={`p-1.5 px-2 rounded-lg border text-xs font-mono flex items-center gap-1 transition-colors ${
              qualityTier === 'high'
                ? 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:text-white'
                : qualityTier === 'balanced'
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
            }`}
            title={`Performance Tier: ${qualityTier.toUpperCase()} (Click to toggle)`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px] font-bold uppercase">{qualityTier}</span>
          </button>

          {/* Audio Sonification Button & Popover */}
          <div className="relative">
            <button
              onClick={() => setShowAudioMenu(!showAudioMenu)}
              className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-colors ${
                !isAudioMuted
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm shadow-cyan-950'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
              }`}
              title="Bio-Acoustic Molecular Sonification"
            >
              {!isAudioMuted ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span className="hidden xl:inline text-[11px] font-mono">{!isAudioMuted ? 'Audio ON' : 'Muted'}</span>
            </button>

            {showAudioMenu && (
              <div className="absolute right-0 top-full mt-2 w-56 p-3 rounded-xl bg-zinc-950 border border-zinc-800 shadow-2xl z-50 flex flex-col gap-2.5 font-mono text-xs">
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-1.5">
                  <span className="font-bold text-zinc-200 flex items-center gap-1.5">
                    <Music className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Bio-Sonification</span>
                  </span>
                  <button
                    onClick={handleToggleAudio}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      isAudioMuted ? 'bg-zinc-800 text-zinc-400' : 'bg-cyan-500 text-zinc-950'
                    }`}
                  >
                    {isAudioMuted ? 'Muted' : 'Active'}
                  </button>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px] text-zinc-400">
                    <span>Volume:</span>
                    <span>{(volume * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={volume}
                    onChange={e => handleVolumeChange(Number(e.target.value))}
                    className="w-full accent-cyan-400 h-1 bg-zinc-800 rounded"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-400">Sonification Profile:</span>
                  {(['harmonic', 'geiger', 'ambient', 'synth_pop'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => handleModeChange(m)}
                      className={`px-2 py-1 rounded capitalize text-left text-[11px] transition-colors ${
                        audioMode === m
                          ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                      }`}
                    >
                      {m.replace('_', ' ')} Mode
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Export & Share Modal Button */}
          <button
            onClick={onOpenExportModal}
            className="p-1.5 px-2.5 rounded-lg bg-zinc-900 text-emerald-400 border border-zinc-800 hover:bg-emerald-950/40 hover:border-emerald-500/40 text-xs font-mono flex items-center gap-1.5 transition-colors"
            title="Export Datasets & Share Link"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Share & Export</span>
          </button>

          {/* Play / Pause button */}
          <button
            id="btn-toggle-play"
            onClick={onTogglePlay}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              isRunning
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400 font-bold shadow-[0_0_12px_rgba(16,185,129,0.3)]'
            }`}
          >
            {isRunning ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span>{isRunning ? 'Pause' : 'Run'}</span>
          </button>

          <button
            id="btn-step"
            onClick={onStep}
            disabled={isRunning}
            title="Step 1 Frame"
            className="p-1.5 rounded-lg bg-zinc-900 text-zinc-300 border border-zinc-800 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs flex items-center gap-1 px-2.5"
          >
            <FastForward className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Step</span>
          </button>

          <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-xs">
            <span className="text-[11px] text-zinc-400 font-mono">{simSpeed}x</span>
            <input
              id="slider-sim-speed"
              type="range"
              min="0.25"
              max="3"
              step="0.25"
              value={simSpeed}
              onChange={(e) => setSimSpeed(parseFloat(e.target.value))}
              className="w-12 sm:w-16 accent-emerald-500 cursor-pointer h-1 bg-zinc-800 rounded"
              title="Simulation Speed"
            />
          </div>

          <button
            id="btn-reset"
            onClick={onReset}
            title="Reset to Preset State"
            className="p-1.5 rounded-lg bg-zinc-900 text-zinc-400 border border-zinc-800 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            id="btn-clear"
            onClick={onClear}
            title="Clear all particles"
            className="p-1.5 rounded-lg bg-zinc-900 text-rose-400 border border-zinc-800 hover:bg-rose-500/20 hover:border-rose-500/40 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Mobile Drawer (Visible on smaller screens when toggled) */}
      {showMobileMenu && (
        <div className="p-3 bg-zinc-900/95 border-b border-zinc-800 grid grid-cols-2 sm:grid-cols-3 gap-2 md:hidden animate-fade-in font-mono text-xs">
          {tabsList.map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as ActiveTab);
                setShowMobileMenu(false);
              }}
              className={`p-2 rounded-lg border flex items-center gap-2 text-left transition-all ${
                activeTab === tab.id
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200'
              }`}
            >
              {tab.icon}
              <span className="truncate">{tab.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Navigation Tabs (Desktop & Tablet horizontal scrollbar) */}
      <div className="px-3 sm:px-4 flex items-center gap-1 overflow-x-auto no-scrollbar py-1.5 bg-zinc-950/90 text-xs font-mono">
        <button
          id="tab-vessel"
          onClick={() => setActiveTab('vessel')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
            activeTab === 'vessel'
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
          }`}
        >
          <FlaskConical className="w-3.5 h-3.5" />
          <span>Reaction Vessel</span>
        </button>

        <button
          id="tab-spatial3d"
          onClick={() => setActiveTab('spatial3d')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
            activeTab === 'spatial3d'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
          }`}
        >
          <Box className="w-3.5 h-3.5 text-cyan-400" />
          <span>3D Reactor Chamber</span>
        </button>

        <button
          id="tab-challenges"
          onClick={() => setActiveTab('challenges')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
            activeTab === 'challenges'
              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
          }`}
        >
          <Trophy className="w-3.5 h-3.5 text-amber-400" />
          <span>Lab Quests & Missions</span>
        </button>

        <button
          id="tab-compiler"
          onClick={() => setActiveTab('compiler')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
            activeTab === 'compiler'
              ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
          }`}
        >
          <Wand2 className="w-3.5 h-3.5 text-purple-400" />
          <span>AI Synthesis & DSL</span>
        </button>

        <button
          id="tab-turing"
          onClick={() => setActiveTab('turing')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
            activeTab === 'turing'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-cyan-400" />
          <span>Turing Patterns (PDE)</span>
        </button>

        <button
          id="tab-genetic"
          onClick={() => setActiveTab('genetic')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
            activeTab === 'genetic'
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
          }`}
        >
          <Dna className="w-3.5 h-3.5 text-emerald-400" />
          <span>Genetic String Soup</span>
        </button>

        <button
          id="tab-network"
          onClick={() => setActiveTab('network')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
            activeTab === 'network'
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
          }`}
        >
          <GitFork className="w-3.5 h-3.5" />
          <span>Rewrite Graph</span>
        </button>

        <button
          id="tab-analytics"
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
            activeTab === 'analytics'
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
          }`}
        >
          <LineChart className="w-3.5 h-3.5" />
          <span>Kinetics & Phase Space</span>
        </button>

        <button
          id="tab-syscalls"
          onClick={() => setActiveTab('syscalls')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
            activeTab === 'syscalls'
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Syscall VM</span>
        </button>

        <button
          id="tab-rules"
          onClick={() => setActiveTab('rules')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
            activeTab === 'rules'
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Rules Matrix</span>
        </button>

        <button
          id="tab-guide"
          onClick={() => setActiveTab('guide')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
            activeTab === 'guide'
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Fringe Theory</span>
        </button>
      </div>
    </header>
  );
};
