import React, { useEffect, useMemo, useState } from 'react';
import {
  MINECRAFT_VERSIONS,
  MinecraftVersion,
  VERSION_ERAS,
  VersionEraId,
  PlatformTarget,
  PerformancePreset,
  GameMode,
} from '../data/versions';
import { getRustRuntimeSummary } from '../data/rustCrate';
import { SHADER_PACKS, ShaderPackId } from '../engine/shaderPacks';
import { SavedWorldState } from '../engine/worldStorage';
import { RustCrateModal } from './RustCrateModal';
import { PWAInstallButton } from './PWAInstallButton';
import {
  Monitor,
  Smartphone,
  Play,
  Search,
  Zap,
  Gauge,
  Sparkles,
  Volume2,
  VolumeX,
  FileCode2,
  HardDrive,
  RotateCcw,
} from 'lucide-react';

interface LauncherOverlayProps {
  selectedVersion: MinecraftVersion;
  onSelectVersion: (v: MinecraftVersion) => void;
  platform: PlatformTarget;
  onSelectPlatform: (p: PlatformTarget) => void;
  performance: PerformancePreset;
  onSelectPerformance: (perf: PerformancePreset) => void;
  shaderPack: ShaderPackId;
  onSelectShaderPack: (pack: ShaderPackId) => void;
  gameMode: GameMode;
  onSelectGameMode: (mode: GameMode) => void;
  seed: string;
  onChangeSeed: (seed: string) => void;
  muted: boolean;
  onToggleMute: () => void;
  savedWorld: SavedWorldState | null;
  onDeleteSave: () => void;
  onLaunch: () => void;
}

export const LauncherOverlay: React.FC<LauncherOverlayProps> = ({
  selectedVersion,
  onSelectVersion,
  platform,
  onSelectPlatform,
  performance,
  onSelectPerformance,
  shaderPack,
  onSelectShaderPack,
  gameMode,
  onSelectGameMode,
  seed,
  onChangeSeed,
  muted,
  onToggleMute,
  savedWorld,
  onDeleteSave,
  onLaunch,
}) => {
  const [eraFilter, setEraFilter] = useState<'all' | VersionEraId>('all');
  const [query, setQuery] = useState('');
  const [crateModalOpen, setCrateModalOpen] = useState(false);
  const [confirmDeleteSave, setConfirmDeleteSave] = useState(false);

  useEffect(() => {
    setConfirmDeleteSave(false);
  }, [selectedVersion.id, seed]);

  const filteredVersions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MINECRAFT_VERSIONS.filter((v) => {
      if (eraFilter !== 'all' && v.era !== eraFilter) return false;
      if (q && !v.id.toLowerCase().includes(q) && !v.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [eraFilter, query]);

  const rustRuntime = useMemo(
    () => getRustRuntimeSummary(selectedVersion, platform, performance),
    [selectedVersion, platform, performance],
  );

  return (
    <>
      <div className="fixed inset-0 z-20 flex flex-col justify-between p-4 sm:p-6 md:p-8 bg-gradient-to-b from-[#0b1016]/75 via-[#0b1016]/35 to-[#0b1016]/85 overflow-y-auto launcher-scroll">
        {/* Top Row: Bespoke Inline SVG Title Lockup + Install + Rust Crate + Mute */}
        <div className="w-full max-w-[1200px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <svg
              width="38"
              height="38"
              viewBox="0 0 42 42"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
              className="shrink-0"
            >
              <polygon points="21,3 38,12 21,21 4,12" fill="#6FC24E" stroke="#0F141A" strokeWidth="1.5" />
              <polygon points="4,12 21,21 21,39 4,30" fill="#D97736" stroke="#0F141A" strokeWidth="1.5" />
              <polygon points="38,12 21,21 21,39 38,30" fill="#9E4F1D" stroke="#0F141A" strokeWidth="1.5" />
              <polygon points="4,12 21,21 21,25 4,16" fill="#529B37" />
              <polygon points="38,12 21,21 21,25 38,16" fill="#46852F" />
            </svg>
            <div className="min-w-0">
              <h1 className="font-display text-xl sm:text-3xl font-extrabold tracking-tight text-white leading-none truncate">
                VoxelForge Rust Launcher
              </h1>
              <p className="text-[11px] sm:text-sm text-slate-300 mt-1 truncate">
                Rust wgpu Core · 1.0.0 to 1.26.3 · Android &amp; Windows
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <PWAInstallButton />
            <button
              type="button"
              onClick={() => setCrateModalOpen(true)}
              className="h-10 px-3 rounded-lg bg-[#141b24]/90 border border-amber-400/35 text-amber-300 hover:bg-[#1e2835] hover:text-amber-200 transition-colors flex items-center gap-1.5 text-xs sm:text-sm font-semibold cursor-pointer whitespace-nowrap shrink-0"
            >
              <FileCode2 className="w-4 h-4 shrink-0" />
              <span>Rust Crate (.rs)</span>
            </button>
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              className="h-10 px-3 rounded-lg bg-[#141b24]/90 border border-white/15 text-slate-200 hover:bg-[#1e2835] hover:text-white transition-colors flex items-center gap-1.5 text-xs sm:text-sm font-medium shrink-0 cursor-pointer whitespace-nowrap"
            >
              {muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
              <span>{muted ? 'Muted' : 'Audio'}</span>
            </button>
          </div>
        </div>

        {/* Main Launcher Workspace: 2-Column Balanced Split */}
        <div className="w-full max-w-[1200px] mx-auto my-auto py-4 grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Left Column: Version Selector (1.0 - 1.26.3) */}
          <section
            aria-label="Minecraft Version Library"
            className="lg:col-span-7 bg-[#10161e]/92 border border-white/12 rounded-xl p-4 sm:p-5 flex flex-col max-h-[58vh] lg:max-h-[64vh]"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
              <div>
                <h2 className="font-display text-lg font-bold text-white">Select Game Version</h2>
                <p className="text-xs text-slate-400">
                  Every release from 1.0.0 to 1.26.3 with live worldgen preview and Rust runtime tuning
                </p>
              </div>
              <div className="relative w-full sm:w-52">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search 1.8.9, 1.26.3..."
                  className="w-full h-9 pl-9 pr-3 rounded-lg bg-[#0b1016] border border-white/15 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400"
                />
              </div>
            </div>

            {/* Era Filter Segmented Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-3 shrink-0 launcher-scroll">
              {VERSION_ERAS.map((era) => {
                const active = eraFilter === era.id;
                return (
                  <button
                    key={era.id}
                    type="button"
                    onClick={() => setEraFilter(era.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                      active
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-[#17202b] text-slate-300 hover:bg-[#202c3b] hover:text-white'
                    }`}
                  >
                    {era.label}
                  </button>
                );
              })}
            </div>

            {/* Scrollable Version List */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 launcher-scroll min-h-[180px]">
              {filteredVersions.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-400">
                  No versions match "{query}". Try 1.26.3, 1.20.4, 1.16.5, 1.12.2, or 1.0.0.
                </div>
              ) : (
                filteredVersions.map((ver) => {
                  const isSelected = ver.id === selectedVersion.id;
                  return (
                    <button
                      key={ver.id}
                      type="button"
                      onClick={() => onSelectVersion(ver)}
                      className={`w-full text-left px-3.5 py-2.5 rounded-lg border transition-colors flex items-center justify-between gap-3 cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-500/15 border-emerald-400 text-white'
                          : 'bg-[#151d27]/80 border-white/8 text-slate-200 hover:bg-[#1c2633] hover:border-white/20'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono-tabular text-sm font-bold text-emerald-400 shrink-0">
                            {ver.id}
                          </span>
                          <span className="text-sm font-semibold truncate">{ver.name.replace(`${ver.id} — `, '')}</span>
                        </div>
                        <p className="text-xs text-slate-400 truncate mt-0.5">{ver.summary}</p>
                      </div>
                      <div className="text-right shrink-0 hidden sm:block">
                        <span className="text-xs text-slate-400 font-mono-tabular">
                          {ver.eraLabel} · {ver.year}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          {/* Right Column: Rust Target, Performance, Runtime Profile & Launch */}
          <section
            aria-label="Launch Configuration"
            className="lg:col-span-5 bg-[#10161e]/92 border border-white/12 rounded-xl p-4 sm:p-5 flex flex-col justify-between gap-4"
          >
            <div className="space-y-4">
              {/* Active Build Summary */}
              <div className="pb-3 border-b border-white/10">
                <div className="text-xs text-slate-400 font-mono-tabular">
                  {rustRuntime.targetTriple} · Java {rustRuntime.javaVersion} · {selectedVersion.year}
                </div>
                <h2 className="font-display text-xl font-bold text-white mt-0.5 truncate">
                  Minecraft {selectedVersion.name}
                </h2>
              </div>

              {/* Platform Target: Windows vs Android */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Native Rust Build Target &amp; Controls
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectPlatform('windows')}
                    className={`h-11 px-3 rounded-lg border flex items-center justify-center gap-2 text-sm font-semibold transition-colors cursor-pointer ${
                      platform === 'windows'
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                        : 'bg-[#17202b] text-slate-200 border-white/10 hover:bg-[#1f2b3a]'
                    }`}
                  >
                    <Monitor className="w-4 h-4 shrink-0" />
                    <span className="whitespace-nowrap">Windows x64</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectPlatform('android')}
                    className={`h-11 px-3 rounded-lg border flex items-center justify-center gap-2 text-sm font-semibold transition-colors cursor-pointer ${
                      platform === 'android'
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                        : 'bg-[#17202b] text-slate-200 border-white/10 hover:bg-[#1f2b3a]'
                    }`}
                  >
                    <Smartphone className="w-4 h-4 shrink-0" />
                    <span className="whitespace-nowrap">Android NDK</span>
                  </button>
                </div>
              </div>

              {/* Performance Profile */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Performance Profile
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectPerformance('ultra_fps')}
                    className={`py-2 px-2 rounded-lg border flex flex-col items-center gap-1 text-xs font-semibold transition-colors cursor-pointer ${
                      performance === 'ultra_fps'
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                        : 'bg-[#17202b] border-white/10 text-slate-300 hover:bg-[#1f2b3a]'
                    }`}
                  >
                    <Zap className="w-4 h-4" />
                    <span>Ultra FPS</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectPerformance('balanced')}
                    className={`py-2 px-2 rounded-lg border flex flex-col items-center gap-1 text-xs font-semibold transition-colors cursor-pointer ${
                      performance === 'balanced'
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                        : 'bg-[#17202b] border-white/10 text-slate-300 hover:bg-[#1f2b3a]'
                    }`}
                  >
                    <Gauge className="w-4 h-4" />
                    <span>Balanced</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectPerformance('vibrant')}
                    className={`py-2 px-2 rounded-lg border flex flex-col items-center gap-1 text-xs font-semibold transition-colors cursor-pointer ${
                      performance === 'vibrant'
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                        : 'bg-[#17202b] border-white/10 text-slate-300 hover:bg-[#1f2b3a]'
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Vibrant</span>
                  </button>
                </div>
              </div>

              {/* Game Mode + Seed */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Game Mode
                  </label>
                  <div className="grid grid-cols-2 gap-1 p-1 bg-[#0b1016] rounded-lg border border-white/10">
                    <button
                      type="button"
                      onClick={() => onSelectGameMode('creative')}
                      className={`py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                        gameMode === 'creative'
                          ? 'bg-slate-700 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Creative
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectGameMode('survival')}
                      className={`py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                        gameMode === 'survival'
                          ? 'bg-slate-700 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Survival
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="world-seed" className="block text-xs font-semibold text-slate-300 mb-1.5">
                    World Seed
                  </label>
                  <input
                    id="world-seed"
                    type="text"
                    value={seed}
                    onChange={(e) => onChangeSeed(e.target.value)}
                    placeholder="voxelforge"
                    className="w-full h-9 px-3 rounded-lg bg-[#0b1016] border border-white/15 text-xs font-mono-tabular text-white focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              {/* Shader Pack Selector */}
              <div>
                <label htmlFor="launcher-shader-pack" className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Shader Pack
                </label>
                <select
                  id="launcher-shader-pack"
                  value={shaderPack}
                  onChange={(e) => onSelectShaderPack(e.target.value as ShaderPackId)}
                  className="w-full h-9 px-3 rounded-lg bg-[#0b1016] border border-white/15 text-xs font-semibold text-white focus:outline-none focus:border-emerald-400 cursor-pointer"
                >
                  {SHADER_PACKS.map((pack) => (
                    <option key={pack.id} value={pack.id}>
                      {pack.name} — {pack.tagline}
                    </option>
                  ))}
                </select>
              </div>

              {/* Computed Rust / JVM Runtime Line */}
              <div className="px-3 py-2 rounded-lg bg-[#0b1016] border border-white/10 text-[11px] font-mono-tabular text-slate-300 space-y-0.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-amber-300 truncate">{rustRuntime.graphicsBackend}</span>
                  <span className="text-slate-400 shrink-0">{rustRuntime.presentMode}</span>
                </div>
                <div className="text-slate-400 truncate">{rustRuntime.flags}</div>
              </div>
            </div>

            {/* Saved World Readout + Primary Play CTA */}
            <div className="space-y-2.5 pt-1">
              {savedWorld && (
                <div className="px-3 py-2 rounded-lg bg-[#0b1016] border border-emerald-400/25 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <HardDrive className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-emerald-300">Saved Progress Found</div>
                      <div className="text-[11px] font-mono-tabular text-slate-400 truncate">
                        {Object.keys(savedWorld.blockEdits).length}{' '}
                        {Object.keys(savedWorld.blockEdits).length === 1 ? 'block' : 'blocks'} edited ·{' '}
                        {new Date(savedWorld.updatedAt).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!confirmDeleteSave) {
                        setConfirmDeleteSave(true);
                        return;
                      }
                      setConfirmDeleteSave(false);
                      onDeleteSave();
                    }}
                    className={`h-7 px-2.5 rounded-md border text-[11px] font-semibold flex items-center gap-1 shrink-0 cursor-pointer transition-colors ${
                      confirmDeleteSave
                        ? 'bg-rose-500/25 border-rose-400 text-rose-200'
                        : 'bg-[#17202b] border-white/10 text-slate-300 hover:bg-[#202c3b]'
                    }`}
                  >
                    <RotateCcw className="w-3 h-3 text-rose-400" />
                    <span>{confirmDeleteSave ? 'Confirm?' : 'Reset'}</span>
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={onLaunch}
                className="w-full h-13 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] text-slate-950 font-display font-extrabold text-lg tracking-tight flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-lg"
              >
                <Play className="w-5 h-5 fill-slate-950" />
                <span>Play Minecraft {selectedVersion.id}</span>
              </button>
            </div>
          </section>
        </div>

        {/* Bottom Single-Line Control Hint */}
        <div className="w-full max-w-[1200px] mx-auto text-center text-xs text-slate-300 shrink-0 pt-1">
          {platform === 'windows'
            ? 'WASD Move · Space Jump or Double-Tap Fly · Left Click Mine · Right Click Place · 1–9 Hotbar · Esc Pause'
            : 'Left Stick Move · Drag Right Side to Look · Tap Mine / Place / Jump / Fly · Tap Slots to Switch Blocks'}
        </div>
      </div>

      {crateModalOpen && (
        <RustCrateModal
          version={selectedVersion}
          platform={platform}
          runtime={rustRuntime}
          onClose={() => setCrateModalOpen(false)}
        />
      )}
    </>
  );
};
