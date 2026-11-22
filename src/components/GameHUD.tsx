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
import { WorldType } from '../engine/worldStorage';
import { FORGE_MODS_CATALOG, ForgeModId, ModCodeLanguage } from '../data/forgeMods';
import { EFFORTLESS_BUILD_MODES, EffortlessBuildMode } from '../data/effortlessBuild';
import {
  MtrDepotConfig,
  MtrStationAnnouncement,
  MtrTrackBuilderOptions,
  MtrTrackSummary,
  MtrTrainScheduleData,
  MtrTrainTelemetry,
  MtrTurnCurveSpan,
} from '../data/mtrTransit';
import { RailwayDashboardModal } from './RailwayDashboardModal';
import {
  Anchor,
  Volume2,
  VolumeX,
  Monitor,
  Smartphone,
  Save,
  Check,
  RotateCcw,
  Sun,
  Moon,
  Sunrise,
  Sunset,
  Send,
  TrainFront,
  Package,
  PlusCircle,
  PowerOff,
  Hammer,
  Undo2,
  X,
} from 'lucide-react';

interface GameHUDProps {
  version: MinecraftVersion;
  platform: PlatformTarget;
  performance: PerformancePreset;
  gameMode: GameMode;
  worldType: WorldType;
  shaderPack: ShaderPackId;
  dayCycleSpeed: number;
  stats: EngineStats;
  hotbar: BlockId[];
  activeSlot: number;
  tileIcons: Record<number, string>;
  muted: boolean;
  paused: boolean;
  saveStatus: 'idle' | 'saving' | 'saved';
  activeMods: ForgeModId[];
  onChangeActiveMods: (next: ForgeModId[]) => void;
  modCodeLang: ModCodeLanguage;
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
  onChangeWorldType: (wt: WorldType) => void;
  onChangeShaderPack: (pack: ShaderPackId) => void;
  onSetWorldTime: (t: number) => void;
  onChangeDayCycleSpeed: (speed: number) => void;
  onTouchJoystick: (x: number, y: number) => void;
  onTouchLookDelta: (dx: number, dy: number) => void;
  onTouchJump: () => void;
  onTouchDescend: (active: boolean) => void;
  onTouchSprint: (active: boolean) => void;
  onTouchFly: () => void;
  onTouchBreak: () => void;
  onTouchPlace: () => void;
  onExecuteCommand: (cmd: string) => string;
  onRequestPointerLock: () => void;
  onScanMtrTracks: () => MtrTrackSummary;
  onGetMtrDepots: () => MtrDepotConfig[];
  onGetMtrTelemetry: () => MtrTrainTelemetry[];
  onGetMtrSchedule: () => MtrTrainScheduleData;
  onUpsertMtrDepot: (depot: MtrDepotConfig) => void;
  onDeleteMtrDepot: (depotId: string) => void;
  onReverseMtrTrain: (depotId: string) => void;
  onBuildStarterMtrLine: () => { depotPos: [number, number, number]; stationPos: [number, number, number] };
  onPlaceMtrTrackSegment: (
    opts: MtrTrackBuilderOptions,
  ) => { placedCount: number; endPos: [number, number, number]; stationPlaced: boolean };
  onBuildCurvedMtrLoop: (
    straightLen: number,
    turnSpan: MtrTurnCurveSpan,
  ) => { depotPos: [number, number, number]; stationPos: [number, number, number]; trackCount: number };
  onToggleRideTrain: (depotId: string) => boolean;
  onBoardOrExitTrain: () => boolean;
  onToggleSitInTrain: () => boolean;
  onToggleTrainDoors: (depotId?: string) => boolean;
  onSwitchTrainCar: (delta: -1 | 1) => void;
  onWarpToPoint: (x: number, y: number, z: number) => void;
  onSetTrackWalkMode: (enabled: boolean) => void;
  onSetTrackCurveStyle: (style: 'smooth' | 'straight') => void;
  onConfirmTrackAnchor: () => { placedCount: number; endPos: [number, number, number] } | null;
  onCancelTrackAnchor: () => void;
  onSetMtrAnnouncement: (ann: MtrStationAnnouncement) => void;
  onDeleteMtrAnnouncement: (stationId: string) => void;
  onTestMtrAnnouncement: (stationId: string) => void;
  onSetEffortlessMode: (mode: EffortlessBuildMode) => void;
  onSetEffortlessOption: (opt: 'mirrorX' | 'mirrorZ' | 'radial' | 'hollow', value: boolean) => void;
  onSetEffortlessMirrorCenterHere: () => void;
  onCancelEffortlessAnchor: () => void;
  onUndoEffortless: () => void;
}

const PIXEL_BTN_BASE =
  'rounded-none bg-[#6a6f77]/80 hover:bg-[#7b818b]/90 active:bg-[#4e5259] border-2 border-[#1e2024] shadow-[inset_1px_1px_0_rgba(255,255,255,0.45),inset_-1px_-1px_0_rgba(0,0,0,0.35)] flex items-center justify-center cursor-pointer transition-colors';

const TOP_PIXEL_BTN_BASE =
  'w-9 h-9 rounded-none bg-[#555f6e]/72 hover:bg-[#667285]/88 active:bg-[#414956] border-2 border-[#1e242d]/85 shadow-[inset_1px_1px_0_rgba(255,255,255,0.42),inset_-1px_-1px_0_rgba(0,0,0,0.3)] flex items-center justify-center cursor-pointer transition-colors';

export const GameHUD: React.FC<GameHUDProps> = ({
  version,
  platform,
  performance,
  gameMode,
  worldType,
  shaderPack,
  dayCycleSpeed,
  stats,
  hotbar,
  activeSlot,
  tileIcons,
  muted,
  paused,
  saveStatus,
  activeMods,
  onChangeActiveMods,
  modCodeLang,
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
  onChangeWorldType,
  onChangeShaderPack,
  onSetWorldTime,
  onChangeDayCycleSpeed,
  onTouchJoystick,
  onTouchLookDelta,
  onTouchJump,
  onTouchDescend,
  onTouchSprint,
  onTouchFly,
  onTouchBreak,
  onTouchPlace,
  onExecuteCommand,
  onRequestPointerLock,
  onScanMtrTracks,
  onGetMtrDepots,
  onGetMtrTelemetry,
  onGetMtrSchedule,
  onUpsertMtrDepot,
  onDeleteMtrDepot,
  onReverseMtrTrain,
  onBuildStarterMtrLine,
  onPlaceMtrTrackSegment,
  onBuildCurvedMtrLoop,
  onToggleRideTrain,
  onBoardOrExitTrain,
  onToggleSitInTrain,
  onToggleTrainDoors,
  onSwitchTrainCar,
  onWarpToPoint,
  onSetTrackWalkMode,
  onSetTrackCurveStyle,
  onConfirmTrackAnchor,
  onCancelTrackAnchor,
  onSetMtrAnnouncement,
  onDeleteMtrAnnouncement,
  onTestMtrAnnouncement,
  onSetEffortlessMode,
  onSetEffortlessOption,
  onSetEffortlessMirrorCenterHere,
  onCancelEffortlessAnchor,
  onUndoEffortless,
}) => {
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [railwayOpen, setRailwayOpen] = useState(false);
  const [modImporterOpen, setModImporterOpen] = useState(false);
  const [effortlessBarOpen, setEffortlessBarOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatLog, setChatLog] = useState<string[]>([
    'Type /time set day|night, /gamemode creative|survival, /fly, or /tp x y z',
  ]);
  const [sprintActive, setSprintActive] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (!paused) {
      setConfirmReset(false);
    }
  }, [paused]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (paused || chatOpen || inventoryOpen || railwayOpen || modImporterOpen) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.code === 'KeyB' && activeMods.includes('effortless_building')) {
        e.preventDefault();
        setEffortlessBarOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [paused, chatOpen, inventoryOpen, railwayOpen, modImporterOpen, activeMods]);

  // Virtual thumbstick state
  const joyRef = useRef<HTMLDivElement | null>(null);
  const joyPointerId = useRef<number | null>(null);
  const [joyKnob, setJoyKnob] = useState({ x: 0, y: 0 });

  // Touch look state (full-screen background drag on touch devices)
  const lookPointerId = useRef<number | null>(null);
  const lastLookPos = useRef({ x: 0, y: 0 });

  const activeBlockId = hotbar[activeSlot] ?? BlockId.OakPlanks;
  const activeBlockName = BLOCK_META[activeBlockId]?.name ?? 'Block';
  const isHoldingRail =
    activeBlockId === BlockId.RailNormal ||
    activeBlockId === BlockId.RailStation ||
    activeBlockId === BlockId.RailDepot;

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
    const maxR = rect.width * 0.34;
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
    if (platform !== 'android' || paused || inventoryOpen || chatOpen || railwayOpen || modImporterOpen) return;
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

  const handleSubmitChat = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed) {
      setChatOpen(false);
      return;
    }
    if (trimmed.startsWith('/')) {
      const reply = onExecuteCommand(trimmed);
      setChatLog((prev) => [...prev.slice(-4), reply || `Executed ${trimmed}`]);
    } else {
      setChatLog((prev) => [...prev.slice(-4), `<Player> ${trimmed}`]);
    }
    setChatInput('');
  };

  const toggleSprint = () => {
    const next = !sprintActive;
    setSprintActive(next);
    onTouchSprint(next);
  };

  return (
    <div className="fixed inset-0 z-10 pointer-events-none select-none">
      {/* Android Touch-Look Surface across viewport */}
      {platform === 'android' && !paused && !inventoryOpen && !chatOpen && !railwayOpen && !modImporterOpen && (
        <div
          onPointerDown={handleLookDown}
          onPointerMove={handleLookMove}
          onPointerUp={handleLookUp}
          onPointerCancel={handleLookUp}
          className="absolute inset-0 pointer-events-auto"
          aria-hidden="true"
        />
      )}

      {/* Top-Left Compact World Readout (zero pills, square frame) */}
      <div className="absolute top-2.5 left-2.5 bg-[#0f141a]/78 border-2 border-[#2c333d] rounded-none px-2.5 py-1.5 text-[11px] text-slate-100 pointer-events-none">
        <div className="flex items-center gap-2 font-mono-tabular">
          <span className="font-bold text-emerald-400">Sandbox {version.id}</span>
          <span className="text-slate-500">·</span>
          <span className="font-semibold text-white">{stats.fps} FPS</span>
          <span className="text-slate-500 hidden sm:inline">·</span>
          <span className="text-amber-300 hidden sm:inline">
            {stats.timeText} {stats.timePhase}
          </span>
          <span className="text-slate-500 hidden md:inline">·</span>
          <span className="text-slate-300 hidden md:inline">
            {stats.x}, {stats.y}, {stats.z}
          </span>
        </div>
        {(stats.targetBlockName || stats.flying) && (
          <div className="text-[10px] text-slate-300 mt-0.5 font-mono-tabular">
            {stats.targetBlockName ? `Target: ${stats.targetBlockName}` : ''}
            {stats.targetBlockName && stats.flying ? ' · ' : ''}
            {stats.flying ? 'Flying' : ''}
          </div>
        )}
      </div>

      {/* Top-Center Classic Pixelated Icon Strip (Fly/Emote, Chat, Pause, Settings, Blocks) */}
      <div className="absolute top-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 pointer-events-auto">
        <button
          type="button"
          onClick={onTouchFly}
          title={gameMode === 'creative' ? 'Toggle Flight' : 'Creative Only'}
          aria-label="Toggle Flight"
          className={`${TOP_PIXEL_BTN_BASE} ${stats.flying ? 'ring-2 ring-emerald-300' : ''}`}
        >
          {/* Pixelated Player / Flight Icon */}
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="5" y="2" width="6" height="5" fill="#DCE3EE" />
            <rect x="6" y="4" width="1" height="1" fill="#1E242D" />
            <rect x="9" y="4" width="1" height="1" fill="#1E242D" />
            <rect x="3" y="7" width="10" height="5" fill="#B8C2D1" />
            <rect x="5" y="12" width="2" height="3" fill="#94A3B8" />
            <rect x="9" y="12" width="2" height="3" fill="#94A3B8" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => setChatOpen((v) => !v)}
          aria-label="Open Chat and Commands"
          className={`${TOP_PIXEL_BTN_BASE} ${chatOpen ? 'ring-2 ring-white' : ''}`}
        >
          {/* Pixelated Speech Bubble Icon */}
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="2" y="3" width="12" height="8" fill="#DCE3EE" />
            <rect x="4" y="11" width="3" height="2" fill="#DCE3EE" />
            <rect x="4" y="5" width="8" height="1" fill="#3B424E" />
            <rect x="4" y="7" width="6" height="1" fill="#3B424E" />
          </svg>
        </button>

        <button
          type="button"
          onClick={onPause}
          aria-label="Pause Game"
          className={TOP_PIXEL_BTN_BASE}
        >
          {/* Pixelated Pause || Bars */}
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="4" y="3" width="3" height="10" fill="#E5EBF5" />
            <rect x="9" y="3" width="3" height="10" fill="#E5EBF5" />
          </svg>
        </button>

        <button
          type="button"
          onClick={onPause}
          aria-label="Settings"
          className={TOP_PIXEL_BTN_BASE}
        >
          {/* Pixelated Gear Icon */}
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="6" y="1" width="4" height="2" fill="#DCE3EE" />
            <rect x="6" y="13" width="4" height="2" fill="#DCE3EE" />
            <rect x="1" y="6" width="2" height="4" fill="#DCE3EE" />
            <rect x="13" y="6" width="2" height="4" fill="#DCE3EE" />
            <rect x="3" y="3" width="10" height="10" fill="#B8C2D1" />
            <rect x="6" y="6" width="4" height="4" fill="#3B424E" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => setInventoryOpen((v) => !v)}
          aria-label="Open Block Palette"
          className={`${TOP_PIXEL_BTN_BASE} ${inventoryOpen ? 'ring-2 ring-white' : ''}`}
        >
          {/* Pixelated Inventory Bag/Grid Icon */}
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="2" y="2" width="12" height="12" fill="#DCE3EE" />
            <rect x="4" y="4" width="3" height="3" fill="#475569" />
            <rect x="9" y="4" width="3" height="3" fill="#475569" />
            <rect x="4" y="9" width="3" height="3" fill="#475569" />
            <rect x="9" y="9" width="3" height="3" fill="#475569" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => {
            if (!activeMods.includes('minecraft_transit_railway')) {
              onChangeActiveMods([...activeMods, 'minecraft_transit_railway']);
            }
            setRailwayOpen((v) => !v);
          }}
          title="MTR Railway, Schedule & Track Length"
          aria-label="Open Railway Dashboard"
          className={`h-9 px-2.5 rounded-none bg-[#555f6e]/82 hover:bg-[#667285]/92 active:bg-[#414956] border-2 border-[#1e242d]/85 shadow-[inset_1px_1px_0_rgba(255,255,255,0.42),inset_-1px_-1px_0_rgba(0,0,0,0.3)] flex items-center gap-1.5 cursor-pointer transition-colors ${
            railwayOpen ? 'ring-2 ring-amber-300' : ''
          }`}
        >
          <TrainFront className="w-4 h-4 text-amber-300" />
          <span className="text-[11px] font-bold text-amber-200 hidden sm:inline">MTR</span>
        </button>

        {activeMods.includes('effortless_building') && (
          <button
            type="button"
            onClick={() => setEffortlessBarOpen((v) => !v)}
            title="Effortless Building Tools [B] · Cycle Mode [Alt] · Undo [Z]"
            aria-label="Toggle Effortless Building Bar"
            className={`h-9 px-2.5 rounded-none bg-[#555f6e]/82 hover:bg-[#667285]/92 active:bg-[#414956] border-2 border-[#1e242d]/85 shadow-[inset_1px_1px_0_rgba(255,255,255,0.42),inset_-1px_-1px_0_rgba(0,0,0,0.3)] flex items-center gap-1.5 cursor-pointer transition-colors ${
              effortlessBarOpen || stats.effortless.mode !== 'normal' ? 'ring-2 ring-sky-300' : ''
            }`}
          >
            <Hammer className="w-4 h-4 text-sky-300" />
            <span className="text-[11px] font-bold text-sky-200 hidden sm:inline">Build</span>
          </button>
        )}
      </div>

      {/* Top-Right Mute Button */}
      <div className="absolute top-2.5 right-2.5 pointer-events-auto">
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={muted ? 'Unmute' : 'Mute'}
          className={TOP_PIXEL_BTN_BASE}
        >
          {muted ? <VolumeX className="w-4 h-4 text-rose-300" /> : <Volume2 className="w-4 h-4 text-emerald-300" />}
        </button>
      </div>

      {/* Windows Pointer Lock Prompt */}
      {platform === 'windows' && !stats.pointerLocked && !paused && !inventoryOpen && !chatOpen && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 pointer-events-auto">
          <button
            type="button"
            onClick={onRequestPointerLock}
            className="px-3 py-1.5 rounded-none bg-[#10161e]/88 border-2 border-emerald-400/70 text-xs font-semibold text-white hover:bg-[#18222e] cursor-pointer"
          >
            Click Viewport to Lock Mouse &amp; Look Around
          </button>
        </div>
      )}

      {/* In-Game Chat & Slash Commands Overlay */}
      {chatOpen && !paused && (
        <div className="absolute top-14 left-2.5 right-2.5 sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-lg z-30 bg-[#0b1016]/88 border-2 border-[#3c434d] rounded-none p-2.5 space-y-2 pointer-events-auto">
          {activeMods.includes('drin_anchors') && (
            <div className="flex flex-wrap items-center gap-1.5 pb-1.5 border-b border-white/10">
              <span className="text-[11px] font-semibold text-amber-300 flex items-center gap-1">
                <Anchor className="w-3 h-3" />
                Drin Anchors:
              </span>
              <button
                type="button"
                onClick={() => {
                  const reply = onExecuteCommand('/anchor village');
                  setChatLog((prev) => [...prev.slice(-4), reply || 'Warped to Plains Village']);
                }}
                className="px-2 py-0.5 rounded-none bg-[#17202b] hover:bg-[#223040] border border-amber-400/35 text-[11px] font-semibold text-amber-200 cursor-pointer"
              >
                Warp Village
              </button>
              <button
                type="button"
                onClick={() => {
                  const reply = onExecuteCommand('/anchor spawn');
                  setChatLog((prev) => [...prev.slice(-4), reply || 'Warped to Spawn']);
                }}
                className="px-2 py-0.5 rounded-none bg-[#17202b] hover:bg-[#223040] border border-emerald-400/35 text-[11px] font-semibold text-emerald-200 cursor-pointer"
              >
                Warp Spawn
              </button>
            </div>
          )}
          <div className="space-y-1 max-h-24 overflow-y-auto font-mono-tabular text-xs text-slate-200">
            {chatLog.map((line, i) => (
              <div key={i} className="leading-snug">
                {line}
              </div>
            ))}
          </div>
          <form onSubmit={handleSubmitChat} className="flex items-center gap-1.5">
            <input
              type="text"
              autoFocus
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="/time set day | /anchor village | /fly"
              className="flex-1 h-8 px-2.5 rounded-none bg-[#161c24] border border-white/20 text-xs font-mono-tabular text-white focus:outline-none focus:border-emerald-400"
            />
            <button
              type="submit"
              aria-label="Send Command"
              className="h-8 px-3 rounded-none bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* Classic Dark Outline Center Crosshair */}
      {!paused && !inventoryOpen && !chatOpen && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <rect x="9" y="3" width="2" height="14" fill="#18181b" fillOpacity="0.85" />
            <rect x="3" y="9" width="14" height="2" fill="#18181b" fillOpacity="0.85" />
            <rect x="9.5" y="4" width="1" height="12" fill="#e2e8f0" fillOpacity="0.45" />
            <rect x="4" y="9.5" width="12" height="1" fill="#e2e8f0" fillOpacity="0.45" />
          </svg>
        </div>
      )}

      {/* Bottom-Center Classic Pixelated 9-Slot Hotbar + Train Interior / Track Length Bar */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 pointer-events-auto max-w-[96vw]">
        {(stats.trainInteraction.riding || stats.trainInteraction.nearbyTrain) &&
          !paused &&
          !inventoryOpen &&
          !railwayOpen && (
            <div className="bg-[#0b1016]/92 border-2 border-amber-400/75 rounded-none px-2.5 py-1.5 flex flex-wrap items-center justify-center gap-1.5 text-[11px] shadow-lg">
              <div className="flex items-center gap-1.5 pr-1 border-r border-white/15">
                <TrainFront className="w-3.5 h-3.5 text-amber-300" />
                <span className="font-bold text-white truncate max-w-[160px]">
                  {stats.trainInteraction.riding
                    ? stats.trainInteraction.trainName
                    : stats.trainInteraction.nearbyTrain?.trainName}
                </span>
                {stats.trainInteraction.riding && (
                  <span className="font-mono-tabular text-sky-300">
                    Car {stats.trainInteraction.carIndex + 1}/{stats.trainInteraction.carCount}
                  </span>
                )}
              </div>

              <span
                className={`font-mono-tabular font-bold px-1.5 py-0.5 border ${
                  (
                    stats.trainInteraction.riding
                      ? stats.trainInteraction.doorOpen
                      : stats.trainInteraction.nearbyTrain?.doorOpen
                  )
                    ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                    : 'bg-[#17202b] border-white/15 text-slate-300'
                }`}
              >
                {(
                  stats.trainInteraction.riding
                    ? stats.trainInteraction.doorOpen
                    : stats.trainInteraction.nearbyTrain?.doorOpen
                )
                  ? 'DOORS OPEN'
                  : 'DOORS CLOSED'}
              </span>

              {stats.trainInteraction.riding && (
                <span className="font-mono-tabular text-amber-200 px-1">
                  NPCs: {stats.trainInteraction.onboardNpcCount}
                </span>
              )}

              <button
                type="button"
                onClick={() => onBoardOrExitTrain()}
                className="px-2 py-0.5 rounded-none bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold cursor-pointer"
              >
                {stats.trainInteraction.riding ? '[F] Exit' : '[F] Board'}
              </button>

              <button
                type="button"
                onClick={() =>
                  onToggleTrainDoors(
                    stats.trainInteraction.depotId ??
                      stats.trainInteraction.nearbyTrain?.depotId,
                  )
                }
                className="px-2 py-0.5 rounded-none bg-[#17202b] hover:bg-[#223040] border border-amber-400/50 text-amber-200 font-semibold cursor-pointer"
              >
                [G] Doors
              </button>

              {stats.trainInteraction.riding && (
                <>
                  <button
                    type="button"
                    onClick={() => onToggleSitInTrain()}
                    className={`px-2 py-0.5 rounded-none border font-semibold cursor-pointer ${
                      stats.trainInteraction.seated
                        ? 'bg-sky-500 text-slate-950 border-sky-300'
                        : 'bg-[#17202b] hover:bg-[#223040] border-sky-400/50 text-sky-200'
                    }`}
                  >
                    {stats.trainInteraction.seated ? '[R] Stand' : '[R] Sit'}
                  </button>

                  {stats.trainInteraction.carCount > 1 && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onSwitchTrainCar(-1)}
                        disabled={stats.trainInteraction.carIndex <= 0}
                        className="px-1.5 py-0.5 rounded-none bg-[#17202b] hover:bg-[#223040] disabled:opacity-40 border border-white/15 text-slate-200 cursor-pointer"
                      >
                        Prev Car
                      </button>
                      <button
                        type="button"
                        onClick={() => onSwitchTrainCar(1)}
                        disabled={
                          stats.trainInteraction.carIndex >=
                          stats.trainInteraction.carCount - 1
                        }
                        className="px-1.5 py-0.5 rounded-none bg-[#17202b] hover:bg-[#223040] disabled:opacity-40 border border-white/15 text-slate-200 cursor-pointer"
                      >
                        Next Car
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

        {(isHoldingRail || stats.trackAnchor) && !paused && !inventoryOpen && !railwayOpen && (
          <div className="bg-[#0b1016]/90 border-2 border-emerald-400/60 px-2.5 py-1.5 flex flex-wrap items-center justify-center gap-2 text-[11px] shadow-lg">
            <button
              type="button"
              onClick={() => onSetTrackWalkMode(!stats.trackWalkMode)}
              className={`px-2 py-0.5 border font-bold cursor-pointer ${
                stats.trackWalkMode
                  ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                  : 'bg-[#17202b] text-slate-300 border-white/15'
              }`}
            >
              Walk-Extend: {stats.trackWalkMode ? 'ON' : 'OFF'}
            </button>

            {stats.trackWalkMode && (
              <button
                type="button"
                onClick={() =>
                  onSetTrackCurveStyle(stats.trackCurveStyle === 'smooth' ? 'straight' : 'smooth')
                }
                className="px-2 py-0.5 bg-[#17202b] hover:bg-[#223040] border border-amber-400/45 text-amber-200 font-semibold cursor-pointer"
              >
                {stats.trackCurveStyle === 'smooth' ? 'Curve: Smooth Turn' : 'Curve: Straight'}
              </button>
            )}

            {stats.trackAnchor ? (
              <>
                <span className="font-mono-tabular text-emerald-300 font-bold">
                  Length: {stats.trackAnchor.lengthBlocks}m{' '}
                  {stats.trackAnchor.isCurve ? '(Long Curve)' : '(Line)'}
                </span>
                <button
                  type="button"
                  onClick={() => onConfirmTrackAnchor()}
                  className="px-2.5 py-0.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold cursor-pointer"
                >
                  Place {stats.trackAnchor.lengthBlocks}m Track
                </button>
                <button
                  type="button"
                  onClick={() => onCancelTrackAnchor()}
                  className="px-2 py-0.5 bg-[#17202b] hover:bg-rose-500/30 border border-white/15 text-rose-200 cursor-pointer"
                >
                  Cancel
                </button>
              </>
            ) : (
              <span className="text-slate-300">
                {stats.trackWalkMode
                  ? 'Place 1st rail → Walk length → Place 2nd rail to connect'
                  : 'Single-block rail placement'}
              </span>
            )}
          </div>
        )}

        {activeMods.includes('effortless_building') &&
          (effortlessBarOpen ||
            stats.effortless.mode !== 'normal' ||
            stats.effortless.mirrorX ||
            stats.effortless.mirrorZ ||
            stats.effortless.radial ||
            stats.effortless.hasAnchor) &&
          !paused &&
          !inventoryOpen &&
          !railwayOpen &&
          !(isHoldingRail && stats.trackWalkMode) && (
            <div className="bg-[#0b1016]/92 border-2 border-sky-400/70 rounded-none px-2.5 py-1.5 flex flex-col items-center gap-1.5 text-[11px] shadow-lg">
              <div className="flex flex-wrap items-center justify-center gap-1">
                <span className="font-bold text-sky-300 flex items-center gap-1 pr-1.5 border-r border-white/15">
                  <Hammer className="w-3.5 h-3.5" />
                  <span>Effortless</span>
                  <span className="text-[9px] font-mono-tabular px-1 py-0.5 bg-sky-400/20 border border-sky-400/40 text-sky-200">
                    RUST
                  </span>
                </span>

                {EFFORTLESS_BUILD_MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onSetEffortlessMode(m.id)}
                    title={m.hint}
                    className={`px-2 py-0.5 rounded-none border font-bold cursor-pointer ${
                      stats.effortless.mode === m.id
                        ? 'bg-sky-400 text-slate-950 border-sky-200'
                        : 'bg-[#17202b] hover:bg-[#223040] text-slate-300 border-white/15'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-1.5">
                {(stats.effortless.mode === 'cube' || stats.effortless.mode === 'circle') && (
                  <button
                    type="button"
                    onClick={() => onSetEffortlessOption('hollow', !stats.effortless.hollow)}
                    className={`px-2 py-0.5 rounded-none border font-semibold cursor-pointer ${
                      stats.effortless.hollow
                        ? 'bg-amber-400 text-slate-950 border-amber-200'
                        : 'bg-[#17202b] text-slate-300 border-white/15'
                    }`}
                  >
                    Hollow: {stats.effortless.hollow ? 'ON' : 'OFF'}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onSetEffortlessOption('mirrorX', !stats.effortless.mirrorX)}
                  className={`px-2 py-0.5 rounded-none border font-semibold cursor-pointer ${
                    stats.effortless.mirrorX
                      ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                      : 'bg-[#17202b] text-slate-300 border-white/15'
                  }`}
                >
                  Mirror X
                </button>

                <button
                  type="button"
                  onClick={() => onSetEffortlessOption('mirrorZ', !stats.effortless.mirrorZ)}
                  className={`px-2 py-0.5 rounded-none border font-semibold cursor-pointer ${
                    stats.effortless.mirrorZ
                      ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                      : 'bg-[#17202b] text-slate-300 border-white/15'
                  }`}
                >
                  Mirror Z
                </button>

                <button
                  type="button"
                  onClick={() => onSetEffortlessOption('radial', !stats.effortless.radial)}
                  className={`px-2 py-0.5 rounded-none border font-semibold cursor-pointer ${
                    stats.effortless.radial
                      ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                      : 'bg-[#17202b] text-slate-300 border-white/15'
                  }`}
                >
                  Radial 4×
                </button>

                <button
                  type="button"
                  onClick={() => onSetEffortlessMirrorCenterHere()}
                  title="Set Mirror & Radial Center to Your Feet"
                  className="px-2 py-0.5 rounded-none bg-[#17202b] hover:bg-[#223040] border border-white/15 font-mono-tabular text-amber-200 cursor-pointer"
                >
                  Center [{stats.effortless.mirrorCenter[0]}, {stats.effortless.mirrorCenter[2]}]
                </button>

                {stats.effortless.hasAnchor && (
                  <button
                    type="button"
                    onClick={() => onCancelEffortlessAnchor()}
                    className="px-2 py-0.5 rounded-none bg-rose-500/20 hover:bg-rose-500/40 border border-rose-400/50 text-rose-200 font-semibold cursor-pointer"
                  >
                    Cancel Anchor
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onUndoEffortless()}
                  disabled={stats.effortless.undoCount === 0}
                  className="px-2 py-0.5 rounded-none bg-[#17202b] hover:bg-[#223040] disabled:opacity-40 border border-sky-400/40 text-sky-200 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Undo2 className="w-3 h-3" />
                  <span>Undo [Z] ({stats.effortless.undoCount})</span>
                </button>

                {stats.effortless.previewCount > 0 && (
                  <span className="font-mono-tabular text-sky-300 font-bold pl-1">
                    Preview: {stats.effortless.previewCount} blk
                  </span>
                )}
              </div>
            </div>
          )}

        <div className="px-2 py-0.5 rounded-none bg-[#0f141a]/72 text-[11px] font-semibold text-white">
          {activeBlockName}
        </div>
        <div className="flex items-center gap-1">
          <div className="flex items-center p-[2px] rounded-none bg-[#23252a]/92 border-2 border-[#111215] shadow-[inset_1px_1px_0_rgba(255,255,255,0.2)]">
            {hotbar.map((blockId, idx) => {
              const active = idx === activeSlot;
              const iconUrl = tileIcons[blockId];
              return (
                <button
                  key={`${idx}-${blockId}`}
                  type="button"
                  onClick={() => onSelectSlot(idx)}
                  aria-label={`Slot ${idx + 1}: ${BLOCK_META[blockId]?.name}`}
                  className={`relative w-9 h-9 sm:w-10 sm:h-10 rounded-none flex items-center justify-center cursor-pointer ${
                    active
                      ? 'bg-[#6b7078]/95 border-2 border-white z-10'
                      : 'bg-[#3d4047]/85 border border-[#1d1f23] hover:bg-[#4e525b]'
                  }`}
                >
                  {iconUrl && (
                    <img
                      src={iconUrl}
                      alt={BLOCK_META[blockId]?.name}
                      className="w-6 h-6 sm:w-7 sm:h-7 object-contain"
                      style={{ imageRendering: 'pixelated' }}
                    />
                  )}
                </button>
              );
            })}
          </div>
          {/* Classic "..." Inventory Overflow Button beside Hotbar */}
          <button
            type="button"
            onClick={() => setInventoryOpen(true)}
            aria-label="More Blocks"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-none bg-[#4a4e57]/88 hover:bg-[#5e636e] border-2 border-[#16181c] shadow-[inset_1px_1px_0_rgba(255,255,255,0.35)] text-white font-bold text-sm flex items-center justify-center cursor-pointer"
          >
            ...
          </button>
        </div>
      </div>

      {/* Classic Pixelated Touch Controls (matching Android Minecraft layout) */}
      {platform === 'android' && !paused && !inventoryOpen && !chatOpen && !railwayOpen && !modImporterOpen && (
        <>
          {/* Bottom-Left Square Pixelated Joystick Box */}
          <div
            ref={joyRef}
            onPointerDown={handleJoyDown}
            onPointerMove={handleJoyMove}
            onPointerUp={handleJoyUp}
            onPointerCancel={handleJoyUp}
            className="absolute bottom-6 left-4 sm:left-6 w-28 h-28 sm:w-32 sm:h-32 rounded-none bg-[#8f959f]/30 border-2 border-[#181b20]/85 shadow-[inset_2px_2px_0_rgba(255,255,255,0.35),inset_-2px_-2px_0_rgba(0,0,0,0.28)] flex items-center justify-center pointer-events-auto touch-none"
            aria-label="Movement Joystick"
          >
            <div className="w-20 h-20 border border-white/25 pointer-events-none flex items-center justify-center">
              <div
                className="w-11 h-11 rounded-none bg-[#a8aeb8]/75 border-2 border-[#2b2f37] shadow-[inset_1px_1px_0_rgba(255,255,255,0.5)] pointer-events-none"
                style={{
                  transform: `translate(${joyKnob.x}px, ${joyKnob.y}px)`,
                }}
              />
            </div>
          </div>

          {/* Bottom-Right Pixelated Action Cluster: Place/Use, Sword Break, Sprint >>, Descend, Jump */}
          <div className="absolute bottom-4 right-3 sm:right-5 pointer-events-auto flex flex-col items-end gap-2">
            {/* Upper Row: Sword Break (left) + Place Crosshair (right) */}
            <div className="flex items-end gap-4">
              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onTouchBreak();
                }}
                aria-label="Break or Attack"
                className={`w-12 h-12 sm:w-13 sm:h-13 ${PIXEL_BTN_BASE}`}
              >
                {/* Pixel Sword Icon */}
                <svg width="24" height="24" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <rect x="11" y="2" width="3" height="3" fill="#272A30" />
                  <rect x="9" y="4" width="3" height="3" fill="#272A30" />
                  <rect x="7" y="6" width="3" height="3" fill="#272A30" />
                  <rect x="4" y="7" width="2" height="2" fill="#272A30" />
                  <rect x="7" y="10" width="2" height="2" fill="#272A30" />
                  <rect x="4" y="10" width="2" height="2" fill="#272A30" />
                  <rect x="2" y="12" width="2" height="2" fill="#272A30" />
                </svg>
              </button>

              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onTouchPlace();
                }}
                aria-label="Place Block"
                className={`w-12 h-12 sm:w-13 sm:h-13 -translate-y-4 ${PIXEL_BTN_BASE}`}
              >
                {/* Pixel Target/Place Crosshair Icon */}
                <svg width="24" height="24" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <rect x="7" y="2" width="2" height="4" fill="#272A30" />
                  <rect x="7" y="10" width="2" height="4" fill="#272A30" />
                  <rect x="2" y="7" width="4" height="2" fill="#272A30" />
                  <rect x="10" y="7" width="4" height="2" fill="#272A30" />
                </svg>
              </button>
            </div>

            {/* Bottom Row: Sprint >>, Descend, Jump */}
            <div className="flex items-end gap-2">
              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  toggleSprint();
                }}
                aria-label="Toggle Sprint"
                className={`w-11 h-11 ${PIXEL_BTN_BASE} ${
                  sprintActive ? 'ring-2 ring-white bg-[#8792a3]/90' : ''
                }`}
              >
                {/* Pixel >> Double Chevron */}
                <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M3 4L7 8L3 12V4ZM9 4L13 8L9 12V4Z" fill="#272A30" />
                </svg>
              </button>

              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onTouchDescend(true);
                }}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  onTouchDescend(false);
                }}
                onPointerCancel={() => onTouchDescend(false)}
                aria-label="Descend"
                className={`w-11 h-11 translate-y-2 ${PIXEL_BTN_BASE}`}
              >
                {/* Pixel Arrow Down onto Platform */}
                <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <rect x="7" y="2" width="2" height="6" fill="#272A30" />
                  <rect x="5" y="6" width="6" height="2" fill="#272A30" />
                  <rect x="3" y="11" width="10" height="2" fill="#272A30" />
                </svg>
              </button>

              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onTouchJump();
                }}
                aria-label="Jump or Ascend"
                className={`w-12 h-12 sm:w-13 sm:h-13 ${PIXEL_BTN_BASE}`}
              >
                {/* Pixel Arrow Up from Platform */}
                <svg width="22" height="22" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <rect x="7" y="3" width="2" height="6" fill="#272A30" />
                  <rect x="5" y="5" width="6" height="2" fill="#272A30" />
                  <rect x="3" y="11" width="10" height="2" fill="#272A30" />
                </svg>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Block Palette Modal */}
      {inventoryOpen && !paused && (
        <div className="fixed inset-0 z-30 bg-[#0b1016]/82 flex items-center justify-center p-4 pointer-events-auto">
          <div className="w-full max-w-lg bg-[#2c2f36] border-2 border-[#16181c] shadow-[inset_1px_1px_0_rgba(255,255,255,0.22)] rounded-none p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-bold text-white">Block Inventory</h3>
                <p className="text-xs text-slate-300">
                  Select a block to equip into Hotbar Slot {activeSlot + 1}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setInventoryOpen(false);
                    setRailwayOpen(true);
                  }}
                  className="px-2.5 py-1.5 rounded-none bg-amber-400 hover:bg-amber-300 text-xs font-bold text-slate-950 flex items-center gap-1 cursor-pointer"
                >
                  <TrainFront className="w-3.5 h-3.5" />
                  <span>Railway Dashboard</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInventoryOpen(false)}
                  className="px-3 py-1.5 rounded-none bg-emerald-500 hover:bg-emerald-400 text-xs font-bold text-slate-950 cursor-pointer"
                >
                  Done
                </button>
              </div>
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
                    className={`p-2 rounded-none border-2 flex flex-col items-center gap-1.5 transition-colors cursor-pointer ${
                      isEquipped
                        ? 'bg-[#5d626e] border-white text-white'
                        : 'bg-[#1c1e24] border-[#111317] text-slate-200 hover:bg-[#3a3e48]'
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
                  WebGL Sandbox {version.id} · {gameMode === 'creative' ? 'Creative' : 'Survival'}
                </div>
                <h2 className="font-display text-2xl font-extrabold text-white mt-0.5">Sandbox Paused</h2>
              </div>
              <div className="text-right font-mono-tabular text-xs text-amber-300 pt-1">
                {stats.timeText} · {stats.timePhase}
              </div>
            </div>

            {/* World Generator Toggle */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                World Terrain Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onChangeWorldType('superflat')}
                  className={`h-9 rounded-lg border text-xs font-semibold cursor-pointer ${
                    worldType === 'superflat'
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                      : 'bg-[#17202b] text-slate-200 border-white/10'
                  }`}
                >
                  Superflat + Village
                </button>
                <button
                  type="button"
                  onClick={() => onChangeWorldType('normal')}
                  className={`h-9 rounded-lg border text-xs font-semibold cursor-pointer ${
                    worldType === 'normal'
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                      : 'bg-[#17202b] text-slate-200 border-white/10'
                  }`}
                >
                  Normal Hills
                </button>
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

            {/* Active Forge Mods & Drin Anchors Summary */}
            <div className="p-2.5 rounded-lg bg-[#0b1016] border border-white/10 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs">
                <span className="font-semibold text-amber-300">
                  Active Forge Mods ({activeMods.length})
                </span>
                <div className="flex items-center gap-1.5">
                  {activeMods.includes('drin_anchors') && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          onExecuteCommand('/anchor village');
                          onResume();
                        }}
                        className="px-2 py-0.5 rounded bg-[#17202b] hover:bg-[#223040] border border-amber-400/35 text-[11px] font-semibold text-amber-200 cursor-pointer"
                      >
                        Anchor: Village
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onExecuteCommand('/anchor spawn');
                          onResume();
                        }}
                        className="px-2 py-0.5 rounded bg-[#17202b] hover:bg-[#223040] border border-emerald-400/35 text-[11px] font-semibold text-emerald-200 cursor-pointer"
                      >
                        Anchor: Spawn
                      </button>
                    </>
                  )}
                  {activeMods.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onChangeActiveMods([])}
                      className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500 hover:text-white border border-rose-400/40 text-[11px] font-semibold text-rose-200 flex items-center gap-1 cursor-pointer"
                    >
                      <PowerOff className="w-3 h-3" />
                      <span>Disable All</span>
                    </button>
                  )}
                </div>
              </div>
              {activeMods.length === 0 ? (
                <div className="text-[11px] text-slate-400 leading-snug">
                  No mods enabled. Click Manage / Import Mods below to enable any mod.
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {activeMods.map((id) => {
                    const modName = FORGE_MODS_CATALOG.find((m) => m.id === id)?.name ?? id;
                    return (
                      <div
                        key={id}
                        className="flex items-center gap-1.5 pl-2 pr-1 py-0.5 rounded bg-[#17202b] border border-white/12 text-[11px] text-slate-200"
                      >
                        <span className="truncate max-w-[140px]">{modName}</span>
                        <button
                          type="button"
                          onClick={() => onChangeActiveMods(activeMods.filter((m) => m !== id))}
                          title={`Disable ${modName}`}
                          className="px-1.5 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500 text-rose-200 hover:text-white text-[10px] font-bold cursor-pointer"
                        >
                          Disable
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onResume();
                    setModImporterOpen(true);
                  }}
                  className="w-full h-8 rounded bg-[#17202b] hover:bg-[#223040] border border-emerald-400/35 text-xs font-semibold text-emerald-200 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>Manage / Import Mods</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!activeMods.includes('minecraft_transit_railway')) {
                      onChangeActiveMods([...activeMods, 'minecraft_transit_railway']);
                    }
                    onResume();
                    setRailwayOpen(true);
                  }}
                  className="w-full h-8 rounded bg-[#17202b] hover:bg-[#223040] border border-amber-400/35 text-xs font-semibold text-amber-200 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <TrainFront className="w-3.5 h-3.5" />
                  <span>MTR Railway Dashboard</span>
                </button>
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

      {railwayOpen && !paused && (
        <RailwayDashboardModal
          modCodeLang={modCodeLang}
          trackWalkMode={stats.trackWalkMode}
          trackCurveStyle={stats.trackCurveStyle}
          trackAnchor={stats.trackAnchor}
          onClose={() => setRailwayOpen(false)}
          onScanTracks={onScanMtrTracks}
          onGetDepots={onGetMtrDepots}
          onGetTelemetry={onGetMtrTelemetry}
          onGetSchedule={onGetMtrSchedule}
          onUpsertDepot={onUpsertMtrDepot}
          onDeleteDepot={onDeleteMtrDepot}
          onReverseTrain={onReverseMtrTrain}
          onBuildStarterLine={onBuildStarterMtrLine}
          onPlaceTrackSegment={onPlaceMtrTrackSegment}
          onBuildCurvedLoop={onBuildCurvedMtrLoop}
          onToggleRideTrain={onToggleRideTrain}
          onToggleDoors={(depotId) => onToggleTrainDoors(depotId)}
          onWarpToPoint={onWarpToPoint}
          onEquipBlock={onReplaceActiveBlock}
          onSetTrackWalkMode={onSetTrackWalkMode}
          onSetTrackCurveStyle={onSetTrackCurveStyle}
          onConfirmTrackAnchor={onConfirmTrackAnchor}
          onCancelTrackAnchor={onCancelTrackAnchor}
          onSetAnnouncement={onSetMtrAnnouncement}
          onDeleteAnnouncement={onDeleteMtrAnnouncement}
          onTestAnnouncement={onTestMtrAnnouncement}
        />
      )}

      {modImporterOpen && !paused && (
        <div className="fixed inset-0 z-40 bg-[#090d12]/86 flex items-center justify-center p-3 sm:p-5 pointer-events-auto overflow-y-auto launcher-scroll">
          <div className="w-full max-w-2xl bg-[#10161e] border border-white/15 rounded-xl p-4 sm:p-5 space-y-3 my-auto">
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-white/10">
              <div>
                <div className="text-[11px] font-mono-tabular text-emerald-300">
                  {modCodeLang === 'java' ? 'Java @Mod Loader' : 'Rust JNI Module Loader'} · {activeMods.length} enabled
                </div>
                <h3 className="font-display text-lg font-bold text-white">
                  Manage &amp; Import Forge Mods
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {activeMods.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onChangeActiveMods([])}
                    className="h-8 px-2.5 rounded-lg bg-rose-500/20 hover:bg-rose-500 hover:text-white border border-rose-400/45 text-xs font-bold text-rose-200 flex items-center gap-1 cursor-pointer"
                  >
                    <PowerOff className="w-3.5 h-3.5" />
                    <span>Disable All</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setModImporterOpen(false)}
                  aria-label="Close Mod Importer"
                  className="h-8 w-8 rounded-lg bg-[#17202b] hover:bg-[#223040] border border-white/15 text-slate-200 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="max-h-[58vh] overflow-y-auto space-y-2 pr-1 launcher-scroll">
              {FORGE_MODS_CATALOG.map((mod) => {
                const enabled = activeMods.includes(mod.id);
                return (
                  <div
                    key={mod.id}
                    className="p-2.5 rounded-lg bg-[#0b1016] border border-white/10 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-bold text-white truncate">{mod.name}</span>
                        {mod.remakeTag && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-400/20 border border-amber-400/45 text-[9px] font-mono-tabular font-bold text-amber-200 shrink-0">
                            {mod.remakeTag}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">{mod.sandboxActiveHint}</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {enabled ? (
                        <>
                          <span className="h-8 px-2 rounded-md bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[11px] font-bold flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            <span>Active</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => onChangeActiveMods(activeMods.filter((id) => id !== mod.id))}
                            className="h-8 px-2.5 rounded-md border bg-rose-500/20 hover:bg-rose-500 hover:text-white border-rose-400/45 text-rose-200 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <PowerOff className="w-3.5 h-3.5" />
                            <span>Disable</span>
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onChangeActiveMods([...activeMods, mod.id])}
                          className="h-8 px-3 rounded-md border bg-amber-400/15 hover:bg-amber-400 hover:text-slate-950 border-amber-400/45 text-amber-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>Import to Game</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
