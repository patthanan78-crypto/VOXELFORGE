import React, { useEffect, useState } from 'react';
import {
  GameMode,
  MinecraftVersion,
  PerformancePreset,
  PlatformTarget,
} from '../data/versions';
import { getShaderPack, SHADER_PACKS, ShaderPackId } from '../engine/shaderPacks';
import { normalizeSeed, SavedWorldState } from '../engine/worldStorage';
import { TimePhase } from '../engine/voxelWorld';
import {
  Play,
  Sparkles,
  SlidersHorizontal,
  ArrowLeft,
  Sun,
  Moon,
  Sunrise,
  Sunset,
  Monitor,
  Smartphone,
  Volume2,
  VolumeX,
  RotateCcw,
  ChevronRight,
  Check,
} from 'lucide-react';

interface GameMainMenuProps {
  version: MinecraftVersion;
  seed: string;
  gameMode: GameMode;
  platform: PlatformTarget;
  performance: PerformancePreset;
  shaderPack: ShaderPackId;
  dayCycleSpeed: number;
  timeText: string;
  timePhase: TimePhase;
  muted: boolean;
  savedWorld: SavedWorldState | null;
  onEnterWorld: () => void;
  onBackToLauncher: () => void;
  onChangeGameMode: (mode: GameMode) => void;
  onChangePlatform: (p: PlatformTarget) => void;
  onChangePerformance: (perf: PerformancePreset) => void;
  onChangeShaderPack: (pack: ShaderPackId) => void;
  onSetWorldTime: (t: number) => void;
  onChangeDayCycleSpeed: (speed: number) => void;
  onToggleMute: () => void;
  onResetWorld: () => void;
}

export const GameMainMenu: React.FC<GameMainMenuProps> = ({
  version,
  seed,
  gameMode,
  platform,
  performance,
  shaderPack,
  dayCycleSpeed,
  timeText,
  timePhase,
  muted,
  savedWorld,
  onEnterWorld,
  onBackToLauncher,
  onChangeGameMode,
  onChangePlatform,
  onChangePerformance,
  onChangeShaderPack,
  onSetWorldTime,
  onChangeDayCycleSpeed,
  onToggleMute,
  onResetWorld,
}) => {
  const [subView, setSubView] = useState<'main' | 'shaders' | 'options'>('main');
  const [confirmReset, setConfirmReset] = useState(false);

  const activePack = getShaderPack(shaderPack);
  const editCount = savedWorld ? Object.keys(savedWorld.blockEdits).length : 0;

  useEffect(() => {
    if (subView !== 'options') {
      setConfirmReset(false);
    }
  }, [subView]);

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between p-4 sm:p-6 md:p-8 bg-gradient-to-b from-[#0b1016]/60 via-[#0b1016]/25 to-[#0b1016]/75 overflow-y-auto launcher-scroll">
      {/* Top Bar: Quiet Live Panorama Status */}
      <div className="w-full max-w-[1120px] mx-auto flex items-center justify-between gap-3 shrink-0">
        <button
          type="button"
          onClick={onBackToLauncher}
          className="h-9 px-3 rounded-lg bg-[#10161e]/90 border border-white/12 text-slate-200 hover:bg-[#1a2330] hover:text-white transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Launcher</span>
        </button>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-200 font-mono-tabular bg-[#10161e]/85 border border-white/12 rounded-lg px-3 py-1.5">
            {timePhase === 'Night' ? (
              <Moon className="w-3.5 h-3.5 text-sky-300" />
            ) : (
              <Sun className="w-3.5 h-3.5 text-amber-300" />
            )}
            <span>
              {timeText} · {timePhase}
            </span>
          </div>
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
            className="h-9 px-3 rounded-lg bg-[#10161e]/90 border border-white/12 text-slate-200 hover:bg-[#1a2330] flex items-center gap-1.5 text-xs font-medium cursor-pointer whitespace-nowrap shrink-0"
          >
            {muted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
            <span>{muted ? 'Muted' : 'Audio'}</span>
          </button>
        </div>
      </div>

      {/* Centered Version Main Menu */}
      <div className="w-full max-w-lg mx-auto my-auto py-4 flex flex-col items-center gap-5">
        <div className="text-center space-y-1.5">
          <div className="text-xs text-emerald-400 font-mono-tabular font-semibold tracking-wide">
            {version.eraLabel} · {version.year}
          </div>
          <h1 className="font-display text-3xl sm:text-5xl font-extrabold tracking-tight text-white">
            Minecraft {version.id}
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 font-mono-tabular">
            {version.name.replace(`${version.id} — `, '')} · Seed: {normalizeSeed(seed)}
          </p>
        </div>

        {subView === 'main' && (
          <div className="w-full bg-[#10161e]/92 border border-white/14 rounded-xl p-5 space-y-3">
            {savedWorld && (
              <div className="pb-2 border-b border-white/10 flex items-center justify-between text-xs">
                <span className="text-emerald-300 font-semibold">Saved World Ready</span>
                <span className="font-mono-tabular text-slate-400">
                  {editCount} {editCount === 1 ? 'block' : 'blocks'} edited ·{' '}
                  {new Date(savedWorld.updatedAt).toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={onEnterWorld}
              className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] text-slate-950 font-display font-extrabold text-base sm:text-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Play className="w-5 h-5 fill-slate-950" />
              <span>{savedWorld ? 'Singleplayer — Resume World' : 'Singleplayer — Enter World'}</span>
            </button>

            <button
              type="button"
              onClick={() => setSubView('shaders')}
              className="w-full h-11 px-4 rounded-xl bg-[#17202b] hover:bg-[#1f2b3a] border border-white/12 text-slate-100 flex items-center justify-between gap-3 text-sm font-semibold transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Shader Packs</span>
              </span>
              <span className="flex items-center gap-1.5 text-xs text-slate-300 font-normal truncate">
                <span className="truncate">{activePack.name}</span>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSubView('options')}
              className="w-full h-11 px-4 rounded-xl bg-[#17202b] hover:bg-[#1f2b3a] border border-white/12 text-slate-100 flex items-center justify-between gap-3 text-sm font-semibold transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-sky-300" />
                <span>World &amp; Time Options</span>
              </span>
              <span className="flex items-center gap-1.5 text-xs text-slate-300 font-normal">
                <span>
                  {gameMode === 'creative' ? 'Creative' : 'Survival'} ·{' '}
                  {dayCycleSpeed === 0 ? 'Time Paused' : `${dayCycleSpeed}× Cycle`}
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </span>
            </button>

            <button
              type="button"
              onClick={onBackToLauncher}
              className="w-full h-10 rounded-xl bg-[#0b1016] hover:bg-[#161f2b] border border-white/10 text-slate-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Quit to Version Launcher (1.0 – 1.26.3)
            </button>
          </div>
        )}

        {subView === 'shaders' && (
          <div className="w-full bg-[#10161e]/92 border border-white/14 rounded-xl p-5 space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div>
                <h2 className="font-display text-lg font-bold text-white">Shader Packs</h2>
                <p className="text-xs text-slate-400">
                  Live preview updates the 3D voxel world behind the menu
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSubView('main')}
                className="px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 text-xs font-bold cursor-pointer hover:bg-emerald-400"
              >
                Done
              </button>
            </div>

            <div className="space-y-2 max-h-[44vh] overflow-y-auto launcher-scroll pr-1">
              {SHADER_PACKS.map((pack) => {
                const selected = pack.id === shaderPack;
                return (
                  <button
                    key={pack.id}
                    type="button"
                    onClick={() => onChangeShaderPack(pack.id)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-lg border transition-colors flex items-center justify-between gap-3 cursor-pointer ${
                      selected
                        ? 'bg-emerald-500/15 border-emerald-400 text-white'
                        : 'bg-[#17202b] border-white/10 text-slate-200 hover:bg-[#1f2b3a]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">{pack.name}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{pack.tagline}</div>
                    </div>
                    {selected && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {subView === 'options' && (
          <div className="w-full bg-[#10161e]/92 border border-white/14 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div>
                <h2 className="font-display text-lg font-bold text-white">World &amp; Time Options</h2>
                <p className="text-xs text-slate-400 font-mono-tabular">
                  {timeText} · {timePhase}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSubView('main')}
                className="px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 text-xs font-bold cursor-pointer hover:bg-emerald-400"
              >
                Done
              </button>
            </div>

            {/* Day / Night Quick Time Jumps */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Time of Day
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => onSetWorldTime(0.01)}
                  className="h-9 rounded-lg bg-[#17202b] hover:bg-[#202d3c] border border-white/10 text-xs font-semibold text-amber-200 flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Sunrise className="w-3.5 h-3.5" />
                  <span>Dawn</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSetWorldTime(0.25)}
                  className="h-9 rounded-lg bg-[#17202b] hover:bg-[#202d3c] border border-white/10 text-xs font-semibold text-sky-200 flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Sun className="w-3.5 h-3.5" />
                  <span>Noon</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSetWorldTime(0.49)}
                  className="h-9 rounded-lg bg-[#17202b] hover:bg-[#202d3c] border border-white/10 text-xs font-semibold text-orange-300 flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Sunset className="w-3.5 h-3.5" />
                  <span>Dusk</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSetWorldTime(0.75)}
                  className="h-9 rounded-lg bg-[#17202b] hover:bg-[#202d3c] border border-white/10 text-xs font-semibold text-indigo-200 flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Moon className="w-3.5 h-3.5" />
                  <span>Night</span>
                </button>
              </div>
            </div>

            {/* Day/Night Cycle Pace */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Day / Night Cycle Speed
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { speed: 0, label: 'Paused' },
                  { speed: 1, label: '1× Normal' },
                  { speed: 6, label: '6× Fast' },
                ].map((opt) => (
                  <button
                    key={opt.speed}
                    type="button"
                    onClick={() => onChangeDayCycleSpeed(opt.speed)}
                    className={`h-9 rounded-lg border text-xs font-semibold cursor-pointer ${
                      dayCycleSpeed === opt.speed
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                        : 'bg-[#17202b] border-white/10 text-slate-300 hover:bg-[#202d3c]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Game Mode + Platform */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Game Mode
                </label>
                <div className="grid grid-cols-2 gap-1 p-1 bg-[#0b1016] rounded-lg border border-white/10">
                  <button
                    type="button"
                    onClick={() => onChangeGameMode('creative')}
                    className={`py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                      gameMode === 'creative' ? 'bg-slate-700 text-white' : 'text-slate-400'
                    }`}
                  >
                    Creative
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeGameMode('survival')}
                    className={`py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                      gameMode === 'survival' ? 'bg-slate-700 text-white' : 'text-slate-400'
                    }`}
                  >
                    Survival
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Controls
                </label>
                <div className="grid grid-cols-2 gap-1 p-1 bg-[#0b1016] rounded-lg border border-white/10">
                  <button
                    type="button"
                    onClick={() => onChangePlatform('windows')}
                    className={`py-1.5 rounded-md text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer ${
                      platform === 'windows' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span>PC</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangePlatform('android')}
                    className={`py-1.5 rounded-md text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer ${
                      platform === 'android' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Touch</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Performance Preset */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Performance Preset
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['ultra_fps', 'balanced', 'vibrant'] as PerformancePreset[]).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => onChangePerformance(preset)}
                    className={`h-9 rounded-lg border text-xs font-semibold cursor-pointer ${
                      performance === preset
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                        : 'bg-[#17202b] border-white/10 text-slate-300'
                    }`}
                  >
                    {preset === 'ultra_fps' ? 'Ultra FPS' : preset === 'balanced' ? 'Balanced' : 'Vibrant'}
                  </button>
                ))}
              </div>
            </div>

            {savedWorld && (
              <button
                type="button"
                onClick={() => {
                  if (!confirmReset) {
                    setConfirmReset(true);
                    return;
                  }
                  setConfirmReset(false);
                  onResetWorld();
                }}
                className={`w-full h-9 rounded-lg border flex items-center justify-center gap-1.5 text-xs font-semibold cursor-pointer transition-colors ${
                  confirmReset
                    ? 'bg-rose-500/25 border-rose-400 text-rose-200'
                    : 'bg-[#17202b] border-white/10 text-slate-300 hover:bg-[#202c3b]'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                <span>{confirmReset ? 'Confirm Reset Saved World?' : 'Reset Saved World'}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bottom Quiet Control Hint */}
      <div className="w-full max-w-[1120px] mx-auto text-center text-xs text-slate-300 shrink-0 pt-1">
        {platform === 'windows'
          ? 'WASD Move · Space Jump or Double-Tap Fly · Left Click Mine · Right Click Place · 1–9 Hotbar · Esc Pause'
          : 'Left Stick Move · Drag Right Side to Look · Tap Mine / Place / Jump / Fly · Tap Slots to Switch Blocks'}
      </div>
    </div>
  );
};
