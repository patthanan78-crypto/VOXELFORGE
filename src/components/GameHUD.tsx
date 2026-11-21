import React, { useEffect, useRef, useState } from 'react';
import {
  ALL_PLACEABLE_BLOCKS,
  BLOCK_META,
  BlockId,
} from '../engine/blocks';
import { EngineStats } from '../engine/voxelWorld';
import {
  GameMode,
  MinecraftVersion,
  PerformancePreset,
  PlatformTarget,
} from '../data/versions';
import { SHADER_PACKS, ShaderPackId } from '../engine/shaderPacks';
import {
  Pause,
  Volume2,
  VolumeX,
  Grid3X3,
  Monitor,
  Smartphone,
  ArrowUp,
  Feather,
  Pickaxe,
  Box,
  Save,
  Check,
  RotateCcw,
  Sun,
  Moon,
  Sunrise,
  Sunset,
} from 'lucide-react';

interface GameHUDProps {
  version: MinecraftVersion;
  platform: PlatformTarget;
  performance: PerformancePreset;
  gameMode: GameMode;
  shaderPack: ShaderPackId;
  dayCycleSpeed: number;
  stats: EngineStats;
  hotbar: BlockId[];
  activeSlot: number;
  tileIcons: Record<number, string>;
  muted: boolean;
  paused: boolean;
  saveStatus: 'idle' | 'saving' | 'saved';
  onSelectSlot: (idx: number) => void;
  onReplaceActiveBlock: (blockId: BlockId) => void;
  onToggleMute: () => void;
  onPause: () => void;
  onResume: () => void;
  onReturnToMainMenu: () => void;
  onReturnToLauncher: () => void;
  onSaveWorld: () => void;
  onResetWorld: () => void;
  onChangePlatform: (p: PlatformTarget) => void;
  onChangePerformance: (perf: PerformancePreset) => void;
  onChangeShaderPack: (pack: ShaderPackId) => void;
  onSetWorldTime: (t: number) => void;
  onChangeDayCycleSpeed: (speed: number) => void;
  onTouchJoystick: (x: number, y: number) => void;
  onTouchLookDelta: (dx: number, dy: number) => void;
  onTouchJump: () => void;
  onTouchFly: () => void;
  onTouchBreak: () => void;
  onTouchPlace: () => void;
  onRequestPointerLock: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  version,
  platform,
  performance,
  gameMode,
  shaderPack,
  dayCycleSpeed,
  stats,
  hotbar,
  activeSlot,
  tileIcons,
  muted,
  paused,
  saveStatus,
  onSelectSlot,
  onReplaceActiveBlock,
  onToggleMute,
  onPause,
  onResume,
  onReturnToMainMenu,
  onReturnToLauncher,
  onSaveWorld,
  onResetWorld,
  onChangePlatform,
  onChangePerformance,
  onChangeShaderPack,
  onSetWorldTime,
  onChangeDayCycleSpeed,
  onTouchJoystick,
  onTouchLookDelta,
  onTouchJump,
  onTouchFly,
  onTouchBreak,
  onTouchPlace,
  onRequestPointerLock,
}) => {
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (!paused) {
      setConfirmReset(false);
    }
  }, [paused]);

  // Virtual thumbstick state
  const joyRef = useRef<HTMLDivElement | null>(null);
  const joyPointerId = useRef<number | null>(null);
  const [joyKnob, setJoyKnob] = useState({ x: 0, y: 0 });

  // Touch look state
  const lookPointerId = useRef<number | null>(null);
  const lastLookPos = useRef({ x: 0, y: 0 });

  const activeBlockId = hotbar[activeSlot] ?? BlockId.Grass;
  const activeBlockName = BLOCK_META[activeBlockId]?.name ?? 'Block';

  const handleJoyDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    joyPointerId.current = e.pointerId;
    updateJoystick(e.clientX, e.clientY);
  };

  const handleJoyMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joyPointerId.current !== e.pointerId) return;
    e.stopPropagation();
    updateJoystick(e.clientX, e.clientY);
  };

  const handleJoyUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joyPointerId.current !== e.pointerId) return;
    e.stopPropagation();
    joyPointerId.current = null;
    setJoyKnob({ x: 0, y: 0 });
    onTouchJoystick(0, 0);
  };

  const updateJoystick = (clientX: number, clientY: number) => {
    const el = joyRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.38;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    setJoyKnob({ x: dx, y: dy });
    onTouchJoystick(dx / maxR, dy / maxR);
  };

  const handleLookDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (platform !== 'android' || paused || inventoryOpen) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    lookPointerId.current = e.pointerId;
    lastLookPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleLookMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (lookPointerId.current !== e.pointerId) return;
    const dx = e.clientX - lastLookPos.current.x;
    const dy = e.clientY - lastLookPos.current.y;
    lastLookPos.current = { x: e.clientX, y: e.clientY };
    onTouchLookDelta(dx, dy);
  };

  const handleLookUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (lookPointerId.current === e.pointerId) {
      lookPointerId.current = null;
    }
  };

  return (
    <div className="fixed inset-0 z-10 pointer-events-none select-none">
      {/* Android Right-Side Touch-Look Surface */}
      {platform === 'android' && !paused && !inventoryOpen && (
        <div
          onPointerDown={handleLookDown}
          onPointerMove={handleLookMove}
          onPointerUp={handleLookUp}
          onPointerCancel={handleLookUp}
          className="absolute inset-y-0 right-0 left-1/3 pointer-events-auto"
          aria-hidden="true"
        />
      )}

      {/* Top-Left Compact World Readout (tabular-nums) */}
      <div className="absolute top-3 left-3 sm:top-4 sm:left-4 bg-[#0f141a]/82 border border-white/12 rounded-lg px-3 py-2 text-xs text-slate-200 pointer-events-none">
        <div className="flex items-center gap-2 font-mono-tabular">
          <span className="font-bold text-emerald-400">MC {version.id}</span>
          <span className="text-slate-500">·</span>
          <span className="font-semibold text-white">{stats.fps} FPS</span>
          <span className="text-slate-500">·</span>
          <span className="text-amber-300">
            {stats.timeText} {stats.timePhase}
          </span>
          <span className="text-slate-500 hidden sm:inline">·</span>
          <span className="text-slate-300 hidden sm:inline">
            {stats.x}, {stats.y}, {stats.z}
          </span>
        </div>
        {(stats.targetBlockName || stats.flying) && (
          <div className="text-[11px] text-slate-400 mt-0.5 font-mono-tabular">
            {stats.targetBlockName ? `Target: ${stats.targetBlockName}` : ''}
            {stats.targetBlockName && stats.flying ? ' · ' : ''}
            {stats.flying ? 'Flying' : ''}
          </div>
        )}
      </div>

      {/* Top-Right Quick Actions */}
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex items-center gap-2 pointer-events-auto">
        <button
          type="button"
          onClick={() => setInventoryOpen((v) => !v)}
          aria-label="Open Block Palette"
          className="h-10 px-3 rounded-lg bg-[#0f141a]/85 border border-white/15 text-slate-100 hover:bg-[#19222e] flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
        >
          <Grid3X3 className="w-4 h-4 text-emerald-400" />
          <span className="hidden sm:inline">Blocks</span>
        </button>
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={muted ? 'Unmute' : 'Mute'}
          className="h-10 w-10 rounded-lg bg-[#0f141a]/85 border border-white/15 text-slate-100 hover:bg-[#19222e] flex items-center justify-center cursor-pointer"
        >
          {muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
        </button>
        <button
          type="button"
          onClick={onPause}
          aria-label="Pause Menu"
          className="h-10 px-3 rounded-lg bg-[#0f141a]/85 border border-white/15 text-slate-100 hover:bg-[#19222e] flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
        >
          <Pause className="w-4 h-4" />
          <span className="hidden sm:inline">Menu</span>
        </button>
      </div>

      {/* Windows Pointer Lock Prompt (non-blocking) */}
      {platform === 'windows' && !stats.pointerLocked && !paused && !inventoryOpen && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 pointer-events-auto">
          <button
            type="button"
            onClick={onRequestPointerLock}
            className="px-4 py-2 rounded-lg bg-[#0f141a]/88 border border-emerald-400/50 text-xs font-semibold text-white hover:bg-[#18222e] cursor-pointer"
          >
            Click Viewport to Lock Mouse &amp; Look Around
          </button>
        </div>
      )}

      {/* Center Crosshair */}
      {!paused && !inventoryOpen && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
            <path d="M11 4V18M4 11H18" stroke="white" strokeWidth="2" strokeOpacity="0.88" />
            <path d="M11 4V18M4 11H18" stroke="#0F141A" strokeWidth="0.6" strokeOpacity="0.5" />
          </svg>
        </div>
      )}

      {/* Bottom-Center 9-Slot Hotbar */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 pointer-events-auto">
        <div className="px-2.5 py-0.5 rounded bg-[#0f141a]/80 text-[11px] font-semibold text-slate-100">
          {activeBlockName}
        </div>
        <div className="flex items-center gap-1 p-1.5 rounded-xl bg-[#0f141a]/88 border border-white/15">
          {hotbar.map((blockId, idx) => {
            const active = idx === activeSlot;
            const iconUrl = tileIcons[blockId];
            return (
              <button
                key={`${idx}-${blockId}`}
                type="button"
                onClick={() => onSelectSlot(idx)}
                aria-label={`Slot ${idx + 1}: ${BLOCK_META[blockId]?.name}`}
                className={`relative w-10 h-10 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center transition-transform cursor-pointer ${
                  active
                    ? 'bg-emerald-500/25 border-2 border-emerald-400 scale-105'
                    : 'bg-[#17202b] border border-white/10 hover:bg-[#212d3d]'
                }`}
              >
                {iconUrl && (
                  <img
                    src={iconUrl}
                    alt={BLOCK_META[blockId]?.name}
                    className="w-7 h-7 object-contain"
                    style={{ imageRendering: 'pixelated' }}
                  />
                )}
                <span className="absolute top-0.5 left-1 text-[9px] font-mono-tabular text-slate-400">
                  {idx + 1}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Android Touch Controls */}
      {platform === 'android' && !paused && !inventoryOpen && (
        <>
          {/* Left Virtual Thumbstick */}
          <div
            ref={joyRef}
            onPointerDown={handleJoyDown}
            onPointerMove={handleJoyMove}
            onPointerUp={handleJoyUp}
            onPointerCancel={handleJoyUp}
            className="absolute bottom-24 left-4 sm:left-6 w-28 h-28 rounded-full bg-[#0f141a]/65 border-2 border-white/20 flex items-center justify-center pointer-events-auto touch-none"
            aria-label="Movement Joystick"
          >
            <div
              className="w-12 h-12 rounded-full bg-emerald-400/85 border-2 border-white shadow-md pointer-events-none"
              style={{
                transform: `translate(${joyKnob.x}px, ${joyKnob.y}px)`,
              }}
            />
          </div>

          {/* Right Tactile Action Buttons (>= 44px touch targets) */}
          <div className="absolute bottom-24 right-4 sm:right-6 grid grid-cols-2 gap-2.5 pointer-events-auto">
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                onTouchBreak();
              }}
              className="w-14 h-14 rounded-xl bg-[#0f141a]/82 border border-white/20 active:bg-rose-500/40 text-white flex flex-col items-center justify-center gap-0.5 cursor-pointer"
            >
              <Pickaxe className="w-5 h-5 text-rose-300" />
              <span className="text-[10px] font-semibold">Mine</span>
            </button>
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                onTouchPlace();
              }}
              className="w-14 h-14 rounded-xl bg-[#0f141a]/82 border border-white/20 active:bg-emerald-500/40 text-white flex flex-col items-center justify-center gap-0.5 cursor-pointer"
            >
              <Box className="w-5 h-5 text-emerald-300" />
              <span className="text-[10px] font-semibold">Place</span>
            </button>
            {gameMode === 'creative' && (
              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onTouchFly();
                }}
                className={`w-14 h-14 rounded-xl border flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                  stats.flying
                    ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                    : 'bg-[#0f141a]/82 border-white/20 text-white'
                }`}
              >
                <Feather className="w-5 h-5" />
                <span className="text-[10px] font-semibold">Fly</span>
              </button>
            )}
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                onTouchJump();
              }}
              className={`w-14 h-14 rounded-xl bg-[#0f141a]/82 border border-white/20 active:bg-sky-500/40 text-white flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                gameMode !== 'creative' ? 'col-span-2 w-full' : ''
              }`}
            >
              <ArrowUp className="w-5 h-5 text-sky-300" />
              <span className="text-[10px] font-semibold">Jump</span>
            </button>
          </div>
        </>
      )}

      {/* Block Palette Modal */}
      {inventoryOpen && !paused && (
        <div className="fixed inset-0 z-30 bg-[#0b1016]/80 flex items-center justify-center p-4 pointer-events-auto">
          <div className="w-full max-w-lg bg-[#111821] border border-white/15 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-bold text-white">Block Palette</h3>
                <p className="text-xs text-slate-400">
                  Select a block to equip into Hotbar Slot {activeSlot + 1}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInventoryOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-[#1a2430] hover:bg-[#243242] text-xs font-semibold text-white cursor-pointer"
              >
                Done
              </button>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {ALL_PLACEABLE_BLOCKS.map((bid) => {
                const meta = BLOCK_META[bid];
                const isEquipped = hotbar[activeSlot] === bid;
                return (
                  <button
                    key={bid}
                    type="button"
                    onClick={() => {
                      onReplaceActiveBlock(bid);
                      setInventoryOpen(false);
                    }}
                    className={`p-2 rounded-lg border flex flex-col items-center gap-1.5 transition-colors cursor-pointer ${
                      isEquipped
                        ? 'bg-emerald-500/20 border-emerald-400 text-white'
                        : 'bg-[#17202b] border-white/10 text-slate-200 hover:bg-[#202d3c]'
                    }`}
                  >
                    {tileIcons[bid] && (
                      <img
                        src={tileIcons[bid]}
                        alt={meta.name}
                        className="w-8 h-8 object-contain"
                        style={{ imageRendering: 'pixelated' }}
                      />
                    )}
                    <span className="text-[11px] font-medium truncate w-full text-center">
                      {meta.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Pause / Engine Settings Modal */}
      {paused && (
        <div className="fixed inset-0 z-30 bg-[#0b1016]/82 flex items-center justify-center p-4 pointer-events-auto overflow-y-auto launcher-scroll">
          <div className="w-full max-w-md bg-[#111821] border border-white/15 rounded-xl p-5 sm:p-6 space-y-4 my-auto">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs text-slate-400 font-mono-tabular">
                  Minecraft {version.id} · {gameMode === 'creative' ? 'Creative' : 'Survival'}
                </div>
                <h2 className="font-display text-2xl font-extrabold text-white mt-0.5">Game Paused</h2>
              </div>
              <div className="text-right font-mono-tabular text-xs text-amber-300 pt-1">
                {stats.timeText} · {stats.timePhase}
              </div>
            </div>

            {/* Shader Pack Selector */}
            <div>
              <label htmlFor="pause-shader-select" className="block text-xs font-semibold text-slate-300 mb-1.5">
                Shader Pack
              </label>
              <select
                id="pause-shader-select"
                value={shaderPack}
                onChange={(e) => onChangeShaderPack(e.target.value as ShaderPackId)}
                className="w-full h-10 px-3 rounded-lg bg-[#0b1016] border border-white/15 text-xs font-semibold text-white focus:outline-none focus:border-emerald-400 cursor-pointer"
              >
                {SHADER_PACKS.map((pack) => (
                  <option key={pack.id} value={pack.id}>
                    {pack.name} — {pack.tagline}
                  </option>
                ))}
              </select>
            </div>

            {/* Day / Night Time Presets + Speed */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">Day / Night Time</label>
                <div className="flex items-center gap-1">
                  {[
                    { speed: 0, label: 'Paused' },
                    { speed: 1, label: '1×' },
                    { speed: 6, label: '6×' },
                  ].map((s) => (
                    <button
                      key={s.speed}
                      type="button"
                      onClick={() => onChangeDayCycleSpeed(s.speed)}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                        dayCycleSpeed === s.speed
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-[#17202b] text-slate-300 hover:text-white'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
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

            {/* Quick Platform Switch */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Input Mode
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onChangePlatform('windows')}
                  className={`h-9 rounded-lg border flex items-center justify-center gap-2 text-xs font-semibold cursor-pointer ${
                    platform === 'windows'
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                      : 'bg-[#17202b] text-slate-200 border-white/10'
                  }`}
                >
                  <Monitor className="w-4 h-4" />
                  <span>Windows</span>
                </button>
                <button
                  type="button"
                  onClick={() => onChangePlatform('android')}
                  className={`h-9 rounded-lg border flex items-center justify-center gap-2 text-xs font-semibold cursor-pointer ${
                    platform === 'android'
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                      : 'bg-[#17202b] text-slate-200 border-white/10'
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Android Touch</span>
                </button>
              </div>
            </div>

            {/* Quick Performance Switch */}
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

            <div className="space-y-2.5 pt-1">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onSaveWorld}
                  disabled={saveStatus === 'saving'}
                  className={`h-10 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-semibold cursor-pointer transition-colors ${
                    saveStatus === 'saved'
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                      : 'bg-[#17202b] hover:bg-[#202c3b] border-white/12 text-slate-100'
                  }`}
                >
                  {saveStatus === 'saved' ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Save className="w-4 h-4 text-emerald-400" />
                  )}
                  <span>
                    {saveStatus === 'saving'
                      ? 'Saving...'
                      : saveStatus === 'saved'
                        ? 'Saved to Device'
                        : 'Save World'}
                  </span>
                </button>
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
                  className={`h-10 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-semibold cursor-pointer transition-colors ${
                    confirmReset
                      ? 'bg-rose-500/25 border-rose-400 text-rose-200'
                      : 'bg-[#17202b] hover:bg-[#202c3b] border-white/12 text-slate-300'
                  }`}
                >
                  <RotateCcw className="w-4 h-4 text-rose-400" />
                  <span>{confirmReset ? 'Confirm Reset?' : 'Reset World'}</span>
                </button>
              </div>
              <button
                type="button"
                onClick={onResume}
                className="w-full h-11 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold text-base cursor-pointer"
              >
                Resume Game
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onReturnToMainMenu}
                  className="h-10 rounded-xl bg-[#1a2430] hover:bg-[#233142] border border-white/12 text-white font-semibold text-xs cursor-pointer"
                >
                  Version Main Menu
                </button>
                <button
                  type="button"
                  onClick={onReturnToLauncher}
                  className="h-10 rounded-xl bg-[#1a2430] hover:bg-[#233142] border border-white/12 text-slate-300 hover:text-white font-semibold text-xs cursor-pointer"
                >
                  Version Launcher
                </button>
              </div>
              <p className="text-[11px] text-center text-slate-400">
                World changes auto-save locally to IndexedDB on this device
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
