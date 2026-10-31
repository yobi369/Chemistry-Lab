import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  X,
  Play,
  FlaskConical,
  Flame,
  Activity,
  Layers,
  Cpu,
  Trophy,
  Volume2,
  Check
} from 'lucide-react';
import { globalAudioSynth } from '../engine/audioSynth';

interface OnboardingTourProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: string) => void;
}

interface Step {
  title: string;
  badge: string;
  icon: React.ReactNode;
  content: string;
  tip: string;
  suggestedTab?: string;
}

export const OnboardingTour: React.FC<OnboardingTourProps> = ({
  isOpen,
  onClose,
  onNavigateTab
}) => {
  const [currentStep, setCurrentStep] = useState<number>(0);

  const steps: Step[] = [
    {
      title: 'Welcome to the Artificial Chemistry Laboratory',
      badge: 'Core Orientation',
      icon: <FlaskConical className="w-6 h-6 text-emerald-400" />,
      content: 'This platform is an interactive simulator of artificial chemistry, non-equilibrium thermodynamics, algorithmic program soups, and Turing morphogenesis. You can design molecules, rewrite rules, and observe emergent self-organization.',
      tip: 'Click anywhere inside the reaction vessel to pipette new molecules directly into the thermal bath.'
    },
    {
      title: '1. Particle Kinetics & Stirred Reactor',
      badge: 'Thermodynamics',
      icon: <Flame className="w-6 h-6 text-amber-400" />,
      content: 'The 2D and 3D chambers model Maxwell-Boltzmann thermal velocity, stirring vortices, and collision-based activation barriers ($E_a$). When particles collide with sufficient kinetic energy, chemical rewrite reactions fire with visible energy flashes.',
      tip: 'Use the Continuous-Flow Chemostat pump on the right to establish non-equilibrium open steady states.',
      suggestedTab: 'vessel'
    },
    {
      title: '2. 3D Volumetric Core & Spatial Shading',
      badge: 'WebGL Chamber',
      icon: <Layers className="w-6 h-6 text-cyan-400" />,
      content: 'Switch to the 3D Reactor Chamber for volumetric WebGL rendering with emissive particle blooms, orbit camera controls, and cylinder/sphere hull geometries.',
      tip: 'Click & drag the viewport to orbit around the core, or scroll to zoom.',
      suggestedTab: 'spatial3d'
    },
    {
      title: '3. AlChemy Genetic Soup & Instruction VM',
      badge: 'Digital Life',
      icon: <Cpu className="w-6 h-6 text-purple-400" />,
      content: 'Simulate Tierra-style instruction strings ($DUP, BIND, EMIT, MUT, SPLIT$). Watch autonomous algorithmic genomes compete for replication resources and evolve novel species in real time.',
      tip: 'Increase Darwinian mutation pressure to explore phylogenetic speciation branches.',
      suggestedTab: 'genetic'
    },
    {
      title: '4. Reaction-Diffusion (Turing Patterns)',
      badge: 'Morphogenesis',
      icon: <Activity className="w-6 h-6 text-pink-400" />,
      content: 'Solve Alan Turing’s 1952 Gray-Scott partial differential equations on a real-time 128×128 lattice. Paint chemical morphogen droplets to generate solitons, labyrinth meanders, and spots.',
      tip: 'Select different LUT palettes (Emerald, Cyberpunk, Bioluminescence) for enhanced contrast.',
      suggestedTab: 'turing'
    },
    {
      title: '5. Lab Quests & AI Synthesis Compiler',
      badge: 'Mastery & Creation',
      icon: <Trophy className="w-6 h-6 text-yellow-400" />,
      content: 'Take on guided research missions in Lab Quests, or write custom chemical rule grammars in the AI Synthesis DSL editor to instantly spawn novel reaction networks.',
      tip: 'You can export high-res canvas snapshots or generate one-click shareable links anytime.',
      suggestedTab: 'challenges'
    }
  ];

  if (!isOpen) return null;

  const step = steps[currentStep];

  const handleNext = () => {
    globalAudioSynth.playBlip(700 + currentStep * 80);
    if (currentStep < steps.length - 1) {
      const nextIdx = currentStep + 1;
      setCurrentStep(nextIdx);
      if (steps[nextIdx].suggestedTab) {
        onNavigateTab(steps[nextIdx].suggestedTab!);
      }
    } else {
      handleFinish();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      const prevIdx = currentStep - 1;
      setCurrentStep(prevIdx);
      if (steps[prevIdx].suggestedTab) {
        onNavigateTab(steps[prevIdx].suggestedTab!);
      }
    }
  };

  const handleFinish = () => {
    localStorage.setItem('CHEM_TOUR_COMPLETED', 'true');
    globalAudioSynth.playFanfare();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-xl bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl shadow-emerald-950/40 p-6 flex flex-col gap-4 text-zinc-100 font-sans">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold uppercase tracking-wider">
              {step.badge}
            </span>
            <span className="text-xs font-mono text-zinc-500">
              Step {currentStep + 1} of {steps.length}
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Visual & Title */}
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-zinc-800/80 border border-zinc-700/60 shrink-0">
            {step.icon}
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="text-base font-bold text-zinc-100 font-mono">
              {step.title}
            </h3>
            <p className="text-xs text-zinc-300 leading-relaxed">
              {step.content}
            </p>
          </div>
        </div>

        {/* Pro Tip Box */}
        <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/90 text-xs font-mono flex items-start gap-2 text-zinc-300">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="text-amber-400 font-bold">Pro-Tip: </span>
            <span className="text-zinc-400">{step.tip}</span>
          </div>
        </div>

        {/* Stepper Dots & Navigation Buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
          {/* Dots */}
          <div className="flex items-center gap-1.5">
            {steps.map((_, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setCurrentStep(idx);
                  if (steps[idx].suggestedTab) onNavigateTab(steps[idx].suggestedTab!);
                }}
                className={`h-1.5 rounded-full transition-all ${
                  idx === currentStep
                    ? 'w-6 bg-emerald-400'
                    : 'w-2 bg-zinc-700 hover:bg-zinc-500'
                }`}
              />
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 font-mono text-xs">
            {currentStep > 0 && (
              <button
                onClick={handlePrev}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}

            <button
              onClick={handleNext}
              className="px-4 py-1.5 rounded-lg bg-emerald-500 text-zinc-950 font-bold hover:bg-emerald-400 transition-colors flex items-center gap-1.5 shadow-md shadow-emerald-950/50"
            >
              <span>{currentStep === steps.length - 1 ? 'Start Exploring' : 'Next Step'}</span>
              {currentStep === steps.length - 1 ? <Check className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
