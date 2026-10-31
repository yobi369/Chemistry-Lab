import React, { useState, useRef } from 'react';
import { ChemEngine } from '../engine/chemEngine';
import { MoleculeType, ReactionRule, PresetSystem, TimeSeriesPoint } from '../types/chemistry';
import { encodeModelToUrl } from '../utils/urlState';
import {
  Download,
  Upload,
  FileSpreadsheet,
  FileCode,
  Save,
  Trash2,
  Check,
  X,
  Sparkles,
  Layers,
  Copy,
  Share2,
  Camera,
  Video,
  Link,
  Sliders
} from 'lucide-react';
import { globalAudioSynth } from '../engine/audioSynth';

interface ExportShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  engine: ChemEngine;
  moleculeTypes: MoleculeType[];
  reactionRules: ReactionRule[];
  currentPreset: PresetSystem;
  onImportCustomPreset: (preset: PresetSystem) => void;
}

interface SavedExperiment {
  id: string;
  name: string;
  timestamp: number;
  preset: PresetSystem;
}

export const ExportShareModal: React.FC<ExportShareModalProps> = ({
  isOpen,
  onClose,
  engine,
  moleculeTypes,
  reactionRules,
  currentPreset,
  onImportCustomPreset
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'export' | 'sharelink' | 'media' | 'import' | 'slots'>('sharelink');
  const [jsonInputText, setJsonInputText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [saveSlotName, setSaveSlotName] = useState('');
  const [savedSlots, setSavedSlots] = useState<SavedExperiment[]>(() => {
    try {
      const stored = localStorage.getItem('CHEM_LAB_SAVED_EXPERIMENTS');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  if (!isOpen) return null;

  // 1. Export CSV
  const handleExportCSV = () => {
    const history = engine.history;
    if (history.length === 0) {
      alert('No time-series kinetics data recorded yet. Let the simulation run for a few seconds!');
      return;
    }

    const molIds = moleculeTypes.map(m => m.id);
    const headers = ['Time_s', 'Tick', 'Total_Particles', 'Shannon_Entropy', ...molIds.map(id => `Count_${id}`)];

    const rows = history.map(pt => {
      const row = [
        pt.time,
        pt.tick,
        pt.totalCount,
        pt.entropy,
        ...molIds.map(id => pt.counts[id] || 0)
      ];
      return row.join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `chem_kinetics_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 2. Generate JSON Model Config
  const getCurrentModelConfig = (): PresetSystem => {
    const initialCounts: Record<string, number> = {};
    moleculeTypes.forEach(m => {
      const count = engine.particles.filter(p => p.typeId === m.id).length;
      if (count > 0) initialCounts[m.id] = count;
    });

    return {
      id: `CUSTOM_${Date.now()}`,
      name: `Custom Lab: ${currentPreset.name}`,
      category: 'Custom User Experiments',
      description: 'Exported from Artificial Chemistry Engine.',
      defaultTemp: engine.temperature,
      defaultStirSpeed: engine.stirSpeed,
      initialEnergy: Math.round(engine.energyPool),
      moleculeTypes: moleculeTypes,
      reactionRules: reactionRules,
      initialCounts
    };
  };

  const handleExportJSON = () => {
    const config = getCurrentModelConfig();
    const jsonStr = JSON.stringify(config, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `artificial_chemistry_model_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyJSON = () => {
    const config = getCurrentModelConfig();
    navigator.clipboard.writeText(JSON.stringify(config, null, 2));
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  // Generate One-Click Share URL
  const getShareableUrl = (): string => {
    const config = getCurrentModelConfig();
    const encoded = encodeModelToUrl(config);
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}#model=${encoded}`;
  };

  const handleCopyShareLink = () => {
    const url = getShareableUrl();
    navigator.clipboard.writeText(url);
    setLinkCopied(true);
    globalAudioSynth.playBlip(900);
    setTimeout(() => setLinkCopied(false), 2500);
  };

  // 3. Snapshot PNG
  const handleSnapshotPNG = () => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    if (!canvas) {
      alert('No active canvas found to capture.');
      return;
    }
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `reactor_snapshot_${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  };

  // 4. Video Recording
  const handleToggleRecord = () => {
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    } else {
      const canvas = document.querySelector('canvas') as HTMLCanvasElement;
      if (!canvas) {
        alert('No active simulation canvas available for video capture.');
        return;
      }

      try {
        const stream = canvas.captureStream(30);
        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
        recordedChunksRef.current = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) recordedChunksRef.current.push(e.data);
        };

        recorder.onstop = () => {
          const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `chem_reactor_capture_${Date.now()}.webm`;
          a.click();
          URL.revokeObjectURL(url);
        };

        recorder.start();
        mediaRecorderRef.current = recorder;
        setIsRecording(true);
        setRecordingSeconds(0);

        const timer = setInterval(() => {
          setRecordingSeconds(s => {
            if (s >= 10) {
              clearInterval(timer);
              if (recorder.state !== 'inactive') recorder.stop();
              setIsRecording(false);
              return 10;
            }
            return s + 1;
          });
        }, 1000);
      } catch (err) {
        console.error('Media recording error:', err);
        alert('Canvas video capture is not supported on this browser.');
      }
    }
  };

  // 5. Import JSON
  const handleImportJSON = () => {
    setImportError(null);
    try {
      const parsed = JSON.parse(jsonInputText);
      if (!parsed.moleculeTypes || !parsed.reactionRules) {
        throw new Error('Invalid experiment JSON: Missing moleculeTypes or reactionRules.');
      }
      onImportCustomPreset(parsed);
      onClose();
    } catch (err: unknown) {
      setImportError((err as Error).message || 'Failed to parse JSON.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = event => {
      const content = event.target?.result as string;
      setJsonInputText(content);
    };
    reader.readAsText(file);
  };

  // 6. Save Slot
  const handleSaveCurrentToSlot = () => {
    const name = saveSlotName.trim() || `Experiment ${savedSlots.length + 1}`;
    const newSlot: SavedExperiment = {
      id: `slot_${Date.now()}`,
      name,
      timestamp: Date.now(),
      preset: getCurrentModelConfig()
    };

    const updated = [newSlot, ...savedSlots];
    setSavedSlots(updated);
    localStorage.setItem('CHEM_LAB_SAVED_EXPERIMENTS', JSON.stringify(updated));
    setSaveSlotName('');
  };

  const handleDeleteSlot = (id: string) => {
    const updated = savedSlots.filter(s => s.id !== id);
    setSavedSlots(updated);
    localStorage.setItem('CHEM_LAB_SAVED_EXPERIMENTS', JSON.stringify(updated));
  };

  const handleLoadSlot = (slot: SavedExperiment) => {
    onImportCustomPreset(slot.preset);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-2xl w-full flex flex-col shadow-2xl overflow-hidden text-xs">
        {/* Modal Header */}
        <div className="p-3.5 bg-zinc-900/80 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <h3 className="font-bold text-sm font-mono text-zinc-100 uppercase tracking-wider">
              Export, Share & Media Capture
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-zinc-800 bg-zinc-900/40 p-1">
          <button
            onClick={() => setActiveSubTab('sharelink')}
            className={`flex-1 py-1.5 rounded-md font-mono text-xs font-semibold transition-all ${
              activeSubTab === 'sharelink'
                ? 'bg-zinc-800 text-emerald-400 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Shareable Link
          </button>
          <button
            onClick={() => setActiveSubTab('media')}
            className={`flex-1 py-1.5 rounded-md font-mono text-xs font-semibold transition-all ${
              activeSubTab === 'media'
                ? 'bg-zinc-800 text-pink-400 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Media Capture (PNG/Video)
          </button>
          <button
            onClick={() => setActiveSubTab('export')}
            className={`flex-1 py-1.5 rounded-md font-mono text-xs font-semibold transition-all ${
              activeSubTab === 'export'
                ? 'bg-zinc-800 text-cyan-400 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Datasets (CSV/JSON)
          </button>
          <button
            onClick={() => setActiveSubTab('import')}
            className={`flex-1 py-1.5 rounded-md font-mono text-xs font-semibold transition-all ${
              activeSubTab === 'import'
                ? 'bg-zinc-800 text-purple-400 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Import JSON
          </button>
          <button
            onClick={() => setActiveSubTab('slots')}
            className={`flex-1 py-1.5 rounded-md font-mono text-xs font-semibold transition-all ${
              activeSubTab === 'slots'
                ? 'bg-zinc-800 text-amber-400 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Saved Chambers ({savedSlots.length})
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 flex flex-col gap-3 max-h-[480px] overflow-y-auto">
          {activeSubTab === 'sharelink' && (
            <div className="flex flex-col gap-3">
              <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 flex flex-col gap-2.5">
                <div className="flex items-center gap-2 text-emerald-400 font-mono font-bold">
                  <Share2 className="w-4 h-4" />
                  <span>Instant URL Compressed Hash</span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Send this link to anyone. It embeds your complete reaction rules, thermodynamic parameters, and chemical concentrations directly in the URL hash for instant loading without needing a database.
                </p>

                <div className="p-2 rounded bg-zinc-950 border border-zinc-800 font-mono text-[10px] text-zinc-400 truncate select-all">
                  {getShareableUrl()}
                </div>

                <button
                  onClick={handleCopyShareLink}
                  className="w-full py-2.5 rounded-lg bg-emerald-500 text-zinc-950 font-bold hover:bg-emerald-400 transition-colors flex items-center justify-center gap-2 font-mono text-xs shadow-md shadow-emerald-950/40"
                >
                  {linkCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{linkCopied ? 'Shareable Link Copied to Clipboard!' : 'Copy Shareable Web Link'}</span>
                </button>
              </div>
            </div>
          )}

          {activeSubTab === 'media' && (
            <div className="flex flex-col gap-3">
              <p className="text-zinc-300 text-xs">
                Export publication-ready figures or short video clips of emergent chemical dynamics.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* PNG Snapshot */}
                <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 flex flex-col justify-between gap-3">
                  <div className="flex items-center gap-2 text-cyan-400 font-mono font-bold">
                    <Camera className="w-4 h-4" />
                    <span>High-Res PNG Snapshot</span>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Captures a crisp lossless PNG of the active canvas viewport (2D Vessel or 3D WebGL).
                  </p>
                  <button
                    onClick={handleSnapshotPNG}
                    className="w-full py-2 rounded-lg bg-cyan-500 text-zinc-950 font-bold hover:bg-cyan-400 transition-colors flex items-center justify-center gap-1.5 font-mono"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Download PNG Snapshot</span>
                  </button>
                </div>

                {/* Video Capture */}
                <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 flex flex-col justify-between gap-3">
                  <div className="flex items-center gap-2 text-pink-400 font-mono font-bold">
                    <Video className="w-4 h-4" />
                    <span>10-Second WebM Clip</span>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Records dynamic real-time particle kinematics and reaction flashes for social posts or slides.
                  </p>
                  <button
                    onClick={handleToggleRecord}
                    className={`w-full py-2 rounded-lg font-bold transition-colors flex items-center justify-center gap-1.5 font-mono ${
                      isRecording
                        ? 'bg-rose-500 text-zinc-100 animate-pulse'
                        : 'bg-pink-500 text-zinc-950 hover:bg-pink-400'
                    }`}
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>{isRecording ? `Recording... (${recordingSeconds}s / 10s)` : 'Record 10s Clip'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeSubTab === 'export' && (
            <div className="flex flex-col gap-3">
              <p className="text-zinc-300 text-xs">
                Export real-time simulation trajectories for analysis in Python/Pandas/R or save the full reaction network definition.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* CSV Export Card */}
                <div className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800 flex flex-col justify-between gap-2.5">
                  <div className="flex items-center gap-2 text-emerald-400 font-mono font-bold">
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Kinetics Time-Series (.CSV)</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Includes concentrations of all {moleculeTypes.length} species, Shannon chemical entropy $S(t)$, reaction fluxes, and time timestamps ({engine.history.length} logged data points).
                  </p>
                  <button
                    onClick={handleExportCSV}
                    className="w-full py-2 rounded-lg bg-emerald-500 text-zinc-950 font-bold hover:bg-emerald-400 transition-colors flex items-center justify-center gap-1.5 font-mono"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download CSV Dataset</span>
                  </button>
                </div>

                {/* JSON Model Export Card */}
                <div className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800 flex flex-col justify-between gap-2.5">
                  <div className="flex items-center gap-2 text-cyan-400 font-mono font-bold">
                    <FileCode className="w-4 h-4" />
                    <span>Model Grammar (.JSON)</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Full definition of molecule types, reaction rewrite rules, activation energy barriers, thermodynamic state, and particle counts.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleExportJSON}
                      className="flex-1 py-2 rounded-lg bg-cyan-500 text-zinc-950 font-bold hover:bg-cyan-400 transition-colors flex items-center justify-center gap-1.5 font-mono"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download JSON</span>
                    </button>
                    <button
                      onClick={handleCopyJSON}
                      className="px-3 py-2 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 transition-colors flex items-center justify-center"
                      title="Copy JSON to clipboard"
                    >
                      {copySuccess ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSubTab === 'import' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-zinc-300 font-mono">Upload or Paste Model JSON:</span>
                <label className="px-2.5 py-1 rounded bg-zinc-800 text-zinc-200 hover:bg-zinc-700 cursor-pointer font-mono flex items-center gap-1">
                  <Upload className="w-3 h-3" />
                  <span>Choose File</span>
                  <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>

              <textarea
                rows={7}
                placeholder="Paste preset / model JSON definition here..."
                value={jsonInputText}
                onChange={e => setJsonInputText(e.target.value)}
                className="w-full p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-[11px] text-zinc-200 focus:border-cyan-500 focus:outline-none"
              />

              {importError && (
                <div className="p-2 rounded bg-rose-950/50 border border-rose-800 text-rose-300 font-mono text-[11px]">
                  {importError}
                </div>
              )}

              <button
                onClick={handleImportJSON}
                disabled={!jsonInputText.trim()}
                className="w-full py-2 rounded-lg bg-cyan-500 text-zinc-950 font-bold hover:bg-cyan-400 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5 font-mono"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Instantiate & Load Model</span>
              </button>
            </div>
          )}

          {activeSubTab === 'slots' && (
            <div className="flex flex-col gap-3">
              {/* Save current snapshot slot */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Experiment title (e.g. My Custom Oscillation #1)"
                  value={saveSlotName}
                  onChange={e => setSaveSlotName(e.target.value)}
                  className="flex-1 p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 font-mono"
                />
                <button
                  onClick={handleSaveCurrentToSlot}
                  className="px-4 py-2 rounded-lg bg-purple-500 text-zinc-950 font-bold hover:bg-purple-400 transition-colors flex items-center gap-1.5 font-mono"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Chamber</span>
                </button>
              </div>

              {/* List of saved slots */}
              <div className="flex flex-col gap-2 max-h-[260px] overflow-y-auto">
                {savedSlots.length === 0 ? (
                  <div className="p-4 text-center text-zinc-500 font-mono">
                    No custom experiment chambers saved yet. Save one above!
                  </div>
                ) : (
                  savedSlots.map(slot => (
                    <div
                      key={slot.id}
                      className="p-2.5 rounded-lg bg-zinc-900/70 border border-zinc-800 flex items-center justify-between gap-2"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="font-mono font-bold text-zinc-200">{slot.name}</span>
                        <span className="font-mono text-[10px] text-zinc-500">
                          {new Date(slot.timestamp).toLocaleDateString()} • {slot.preset.moleculeTypes?.length || 0} Species • {slot.preset.reactionRules?.length || 0} Rules
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleLoadSlot(slot)}
                          className="px-2.5 py-1 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 hover:bg-purple-500/30 transition-colors font-mono font-semibold"
                        >
                          Load
                        </button>
                        <button
                          onClick={() => handleDeleteSlot(slot.id)}
                          className="p-1 rounded text-zinc-500 hover:text-rose-400 transition-colors"
                          title="Delete saved chamber"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

