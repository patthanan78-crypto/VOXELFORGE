import { useCallback, useEffect, useRef, useState } from 'react';
import {
  detectDefaultPlatform,
  GameMode,
  MINECRAFT_VERSIONS,
  MinecraftVersion,
  PerformancePreset,
  PlatformTarget,
} from './data/versions';
import {
  FORGE_MODS_CATALOG,
  ForgeModId,
  ModCodeLanguage,
} from './data/forgeMods';
import { BlockId, HOTBAR_BLOCKS } from './engine/blocks';
import { EngineStats, VoxelWorldEngine } from './engine/voxelWorld';
import { voxelAudio } from './engine/audio';
import { SHADER_PACKS, ShaderPackId } from './engine/shaderPacks';
import {
  deleteWorldState,
  loadLauncherPrefs,
  loadWorldState,
  saveLauncherPrefs,
  SavedWorldState,
  saveWorldState,
  WorldType,
} from './engine/worldStorage';
import {
  JavaAccountState,
  loadJavaAccountState,
  saveJavaAccountState,
} from './engine/javaAccount';
import { LauncherOverlay } from './components/LauncherOverlay';
import { GameMainMenu } from './components/GameMainMenu';
import { GameHUD } from './components/GameHUD';

function getInitialPrefs() {
  const prefs = loadLauncherPrefs();
  const matchedVersion =
    (prefs?.versionId && MINECRAFT_VERSIONS.find((v) => v.id === prefs.versionId)) ||
    MINECRAFT_VERSIONS[0];
  const platform: PlatformTarget =
    prefs?.platform === 'windows' || prefs?.platform === 'android'
      ? prefs.platform
      : detectDefaultPlatform();
  const performance: PerformancePreset =
    prefs?.performance === 'ultra_fps' ||
    prefs?.performance === 'balanced' ||
    prefs?.performance === 'vibrant'
      ? prefs.performance
      : 'balanced';
  const gameMode: GameMode =
    prefs?.gameMode === 'creative' || prefs?.gameMode === 'survival'
      ? prefs.gameMode
      : 'creative';
  const worldType: WorldType =
    prefs?.worldType === 'normal' || prefs?.worldType === 'superflat'
      ? prefs.worldType
      : 'superflat';
  const seed =
    typeof prefs?.seed === 'string' && prefs.seed.trim().length > 0
      ? prefs.seed
      : 'voxelforge';
  const muted = Boolean(prefs?.muted);
  const shaderPack: ShaderPackId =
    prefs?.shaderPack && SHADER_PACKS.some((p) => p.id === prefs.shaderPack)
      ? prefs.shaderPack
      : 'complementary';
  const dayCycleSpeed =
    typeof prefs?.dayCycleSpeed === 'number' &&
    Number.isFinite(prefs.dayCycleSpeed) &&
    prefs.dayCycleSpeed >= 0
      ? prefs.dayCycleSpeed
      : 1;
  const validModIds = new Set<ForgeModId>(FORGE_MODS_CATALOG.map((m) => m.id));
  const activeMods: ForgeModId[] = Array.isArray(prefs?.activeMods)
    ? prefs.activeMods.filter((id): id is ForgeModId => validModIds.has(id))
    : ['drin_anchors', 'minecraft_transit_railway', 'effortless_building'];
  // Java Code Pane stays ON by default; Rust Mod Code is selected only by explicit manual click
  const modCodeLang: ModCodeLanguage = prefs?.modCodeLang === 'rust' ? 'rust' : 'java';

  return {
    version: matchedVersion,
    platform,
    performance,
    gameMode,
    worldType,
    seed,
    muted,
    shaderPack,
    dayCycleSpeed,
    activeMods,
    modCodeLang,
  };
}

type ShellState = 'title' | 'game_menu' | 'playing' | 'paused';

export default function App() {
  const [initialPrefs] = useState(getInitialPrefs);

  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<VoxelWorldEngine | null>(null);

  const [shellState, setShellState] = useState<ShellState>('title');
  const shellStateRef = useRef<ShellState>('title');
  const [selectedVersion, setSelectedVersion] = useState<MinecraftVersion>(initialPrefs.version);
  const [platform, setPlatform] = useState<PlatformTarget>(initialPrefs.platform);
  const [performance, setPerformance] = useState<PerformancePreset>(initialPrefs.performance);
  const [gameMode, setGameMode] = useState<GameMode>(initialPrefs.gameMode);
  const [worldType, setWorldType] = useState<WorldType>(initialPrefs.worldType);
  const [seed, setSeed] = useState<string>(initialPrefs.seed);
  const [shaderPack, setShaderPack] = useState<ShaderPackId>(initialPrefs.shaderPack);
  const [dayCycleSpeed, setDayCycleSpeed] = useState<number>(initialPrefs.dayCycleSpeed);
  const [activeMods, setActiveMods] = useState<ForgeModId[]>(initialPrefs.activeMods);
  const [modCodeLang, setModCodeLang] = useState<ModCodeLanguage>(initialPrefs.modCodeLang);
  const [javaAccount, setJavaAccount] = useState<JavaAccountState>(() => loadJavaAccountState());

  const [hotbar, setHotbar] = useState<BlockId[]>(() => [...HOTBAR_BLOCKS]);
  const [activeSlot, setActiveSlot] = useState<number>(1);
  const activeSlotRef = useRef<number>(1);
  const hotbarRef = useRef<BlockId[]>(hotbar);

  const [tileIcons, setTileIcons] = useState<Record<number, string>>({});
  const [muted, setMuted] = useState<boolean>(initialPrefs.muted);
  const [contextLost, setContextLost] = useState<boolean>(false);

  const [savedWorld, setSavedWorld] = useState<SavedWorldState | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const saveDebounceRef = useRef<number | null>(null);
  const saveStatusTimerRef = useRef<number | null>(null);
  const worldLoadSeqRef = useRef<number>(0);

  const [stats, setStats] = useState<EngineStats>({
    fps: 60,
    x: 8,
    y: 26,
    z: 8,
    flying: false,
    pointerLocked: false,
    targetBlockName: null,
    chunksLoaded: 0,
    worldTime: 0.16,
    timeText: '09:50',
    timePhase: 'Day',
    trackWalkMode: true,
    trackCurveStyle: 'smooth',
    trackAnchor: null,
    trainInteraction: {
      riding: false,
      seated: false,
      depotId: null,
      trainName: null,
      carIndex: 0,
      carCount: 0,
      doorOpen: false,
      doorProgress: 0,
      trainStatus: null,
      nearbyTrain: null,
      onboardNpcCount: 0,
    },
    effortless: {
      enabled: initialPrefs.activeMods.includes('effortless_building'),
      mode: 'normal',
      mirrorX: false,
      mirrorZ: false,
      radial: false,
      hollow: false,
      mirrorCenter: [8, 5, 8],
      hasAnchor: false,
      anchorPos: null,
      previewCount: 0,
      undoCount: 0,
    },
  });

  // Sync refs and audio mute state
  useEffect(() => {
    shellStateRef.current = shellState;
  }, [shellState]);

  useEffect(() => {
    activeSlotRef.current = activeSlot;
  }, [activeSlot]);

  useEffect(() => {
    hotbarRef.current = hotbar;
  }, [hotbar]);

  useEffect(() => {
    voxelAudio.muted = muted;
  }, [muted]);

  // Persist launcher preferences cleanly
  useEffect(() => {
    saveLauncherPrefs({
      versionId: selectedVersion.id,
      platform,
      performance,
      gameMode,
      worldType,
      seed,
      muted,
      shaderPack,
      dayCycleSpeed,
      activeMods,
      modCodeLang,
    });
  }, [
    selectedVersion.id,
    platform,
    performance,
    gameMode,
    worldType,
    seed,
    muted,
    shaderPack,
    dayCycleSpeed,
    activeMods,
    modCodeLang,
  ]);

  useEffect(() => {
    saveJavaAccountState(javaAccount);
  }, [javaAccount]);

  const persistCurrentWorld = useCallback(async (showFeedback = false) => {
    const engine = engineRef.current;
    if (!engine) return;

    if (saveDebounceRef.current !== null) {
      window.clearTimeout(saveDebounceRef.current);
      saveDebounceRef.current = null;
    }

    if (showFeedback) {
      setSaveStatus('saving');
    }

    const snapshot = engine.exportWorldState(hotbarRef.current, activeSlotRef.current);
    await saveWorldState(snapshot);
    setSavedWorld(snapshot);

    if (showFeedback) {
      setSaveStatus('saved');
      if (saveStatusTimerRef.current !== null) {
        window.clearTimeout(saveStatusTimerRef.current);
      }
      saveStatusTimerRef.current = window.setTimeout(() => {
        setSaveStatus('idle');
      }, 2200);
    }
  }, []);

  const scheduleAutoSave = useCallback(() => {
    if (saveDebounceRef.current !== null) {
      window.clearTimeout(saveDebounceRef.current);
    }
    saveDebounceRef.current = window.setTimeout(() => {
      saveDebounceRef.current = null;
      void persistCurrentWorld(false);
    }, 1200);
  }, [persistCurrentWorld]);

  const handleHotbarSlotCallback = useCallback(
    (slotOrDelta: number) => {
      let nextIdx = activeSlotRef.current;
      if (slotOrDelta === -1) {
        nextIdx = (nextIdx + 1) % 9;
      } else if (slotOrDelta === -2) {
        nextIdx = (nextIdx + 8) % 9;
      } else {
        nextIdx = Math.max(0, Math.min(8, slotOrDelta));
      }
      activeSlotRef.current = nextIdx;
      setActiveSlot(nextIdx);
      const blk = hotbarRef.current[nextIdx];
      if (blk !== undefined) {
        engineRef.current?.setSelectedBlock(blk);
      }
      if (shellStateRef.current === 'playing' || shellStateRef.current === 'paused') {
        scheduleAutoSave();
      }
    },
    [scheduleAutoSave],
  );

  // Initialize isolated Three.js Voxel Engine once
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const engine = new VoxelWorldEngine(
      mount,
      {
        version: selectedVersion,
        platform,
        performance,
        gameMode,
        worldType,
        seed,
        shaderPack,
        dayCycleSpeed,
        activeMods,
      },
      {
        onStats: (nextStats) => setStats(nextStats),
        onIconsReady: (icons) => setTileIcons(icons),
        onRequestPause: () => {
          setShellState('paused');
          engineRef.current?.setMode('paused');
          void persistCurrentWorld(false);
        },
        onHotbarSlot: handleHotbarSlotCallback,
        onWorldDirty: scheduleAutoSave,
      },
    );

    engineRef.current = engine;
    engine.setSelectedBlock(hotbarRef.current[activeSlotRef.current] ?? BlockId.OakPlanks);

    const canvas = mount.querySelector('canvas');
    const onLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const onRestored = () => {
      setContextLost(false);
    };
    canvas?.addEventListener('webglcontextlost', onLost);
    canvas?.addEventListener('webglcontextrestored', onRestored);

    return () => {
      if (saveDebounceRef.current !== null) {
        window.clearTimeout(saveDebounceRef.current);
      }
      if (saveStatusTimerRef.current !== null) {
        window.clearTimeout(saveStatusTimerRef.current);
      }
      canvas?.removeEventListener('webglcontextlost', onLost);
      canvas?.removeEventListener('webglcontextrestored', onRestored);
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply core version/world/platform/performance updates cleanly
  useEffect(() => {
    engineRef.current?.applyVersionAndPerformance({
      version: selectedVersion,
      platform,
      performance,
      gameMode,
      worldType,
      seed,
      shaderPack,
      dayCycleSpeed,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVersion, platform, performance, gameMode, worldType, seed]);

  // Fast live shader pack & day/night speed updates (zero chunk rebuild)
  useEffect(() => {
    engineRef.current?.setShaderPack(shaderPack);
  }, [shaderPack]);

  useEffect(() => {
    engineRef.current?.setDayCycleSpeed(dayCycleSpeed);
  }, [dayCycleSpeed]);

  useEffect(() => {
    engineRef.current?.setActiveMods(activeMods);
  }, [activeMods]);

  // Load saved world state for active (version, seed, worldType) whenever initialized or changed
  useEffect(() => {
    const seq = ++worldLoadSeqRef.current;
    setSaveStatus('idle');

    void (async () => {
      const saved = await loadWorldState(selectedVersion.id, seed, worldType);
      if (seq !== worldLoadSeqRef.current) return;

      setSavedWorld(saved);
      if (saved) {
        if (Array.isArray(saved.hotbar) && saved.hotbar.length === 9) {
          const restoredHotbar = saved.hotbar as BlockId[];
          const restoredSlot =
            typeof saved.activeSlot === 'number' && saved.activeSlot >= 0 && saved.activeSlot < 9
              ? saved.activeSlot
              : 1;
          hotbarRef.current = restoredHotbar;
          activeSlotRef.current = restoredSlot;
          setHotbar(restoredHotbar);
          setActiveSlot(restoredSlot);
          engineRef.current?.setSelectedBlock(restoredHotbar[restoredSlot] ?? BlockId.OakPlanks);
        }
        engineRef.current?.importWorldState(saved);
      } else {
        const defaultHotbar = [...HOTBAR_BLOCKS];
        hotbarRef.current = defaultHotbar;
        activeSlotRef.current = 1;
        setHotbar(defaultHotbar);
        setActiveSlot(1);
        engineRef.current?.setSelectedBlock(defaultHotbar[1]);
      }
    })();
  }, [selectedVersion.id, seed, worldType]);

  // Periodic position/progress auto-save while playing + pagehide/visibilitychange safety save
  useEffect(() => {
    if (shellState !== 'playing') return;
    const interval = window.setInterval(() => {
      void persistCurrentWorld(false);
    }, 10000);
    return () => window.clearInterval(interval);
  }, [shellState, persistCurrentWorld]);

  useEffect(() => {
    const flushSave = () => {
      if (shellStateRef.current === 'playing' || shellStateRef.current === 'paused') {
        void persistCurrentWorld(false);
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushSave();
      }
    };
    window.addEventListener('pagehide', flushSave);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', flushSave);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [persistCurrentWorld]);

  // Launcher Play -> Opens that Minecraft version's Main Menu
  const handleLaunchToMenu = useCallback(() => {
    voxelAudio.playLaunchChime();
    setShellState('game_menu');
    engineRef.current?.setMode('title');
  }, []);

  // Main Menu Singleplayer -> Enters active first-person gameplay
  const handleEnterWorld = useCallback(() => {
    voxelAudio.playLaunchChime();
    setSaveStatus('idle');
    setShellState('playing');
    engineRef.current?.setMode('playing');
  }, []);

  const handleResume = useCallback(() => {
    setSaveStatus('idle');
    setShellState('playing');
    engineRef.current?.setMode('playing');
  }, []);

  const handlePause = useCallback(() => {
    setShellState('paused');
    engineRef.current?.setMode('paused');
    void persistCurrentWorld(false);
  }, [persistCurrentWorld]);

  const handleReturnToMainMenu = useCallback(() => {
    if (shellStateRef.current === 'playing' || shellStateRef.current === 'paused') {
      void persistCurrentWorld(false);
    }
    setShellState('game_menu');
    engineRef.current?.setMode('title');
  }, [persistCurrentWorld]);

  const handleReturnToLauncher = useCallback(() => {
    if (shellStateRef.current === 'playing' || shellStateRef.current === 'paused') {
      void persistCurrentWorld(false);
    }
    setShellState('title');
    engineRef.current?.setMode('title');
  }, [persistCurrentWorld]);

  const handleSaveWorld = useCallback(() => {
    void persistCurrentWorld(true);
  }, [persistCurrentWorld]);

  const handleResetWorld = useCallback(() => {
    if (saveDebounceRef.current !== null) {
      window.clearTimeout(saveDebounceRef.current);
      saveDebounceRef.current = null;
    }
    void deleteWorldState(selectedVersion.id, seed, worldType);
    const defaultHotbar = [...HOTBAR_BLOCKS];
    hotbarRef.current = defaultHotbar;
    activeSlotRef.current = 1;
    setHotbar(defaultHotbar);
    setActiveSlot(1);
    engineRef.current?.setSelectedBlock(defaultHotbar[1]);
    engineRef.current?.resetWorld();
    setSavedWorld(null);
    setSaveStatus('idle');
  }, [selectedVersion.id, seed, worldType]);

  const handleSetWorldTime = useCallback(
    (t: number) => {
      engineRef.current?.setWorldTime(t);
      if (shellStateRef.current === 'playing' || shellStateRef.current === 'paused') {
        scheduleAutoSave();
      }
    },
    [scheduleAutoSave],
  );

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      voxelAudio.muted = next;
      return next;
    });
  }, []);

  const handleReplaceActiveBlock = useCallback(
    (blockId: BlockId) => {
      setHotbar((prev) => {
        const next = [...prev];
        next[activeSlot] = blockId;
        hotbarRef.current = next;
        return next;
      });
      engineRef.current?.setSelectedBlock(blockId);
      if (shellStateRef.current === 'playing' || shellStateRef.current === 'paused') {
        scheduleAutoSave();
      }
    },
    [activeSlot, scheduleAutoSave],
  );

  const handleExecuteCommand = useCallback(
    (cmd: string): string => {
      const engine = engineRef.current;
      if (!engine) return '';
      const res = engine.executeCommand(cmd);
      if (res.gameModeChanged) {
        setGameMode(res.gameModeChanged);
      }
      scheduleAutoSave();
      return res.reply;
    },
    [scheduleAutoSave],
  );

  // Enter shortcut from Title Launcher -> opens Main Menu; Enter from Main Menu -> enters world
  useEffect(() => {
    if (shellState !== 'title' && shellState !== 'game_menu') return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.code === 'Enter') {
        e.preventDefault();
        if (shellState === 'title') handleLaunchToMenu();
        else handleEnterWorld();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shellState, handleLaunchToMenu, handleEnterWorld]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0d1117]">
      {/* Isolated WebGL Mount Container */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full" />

      {/* Graceful WebGL Context Loss Fallback */}
      {contextLost && (
        <div className="fixed inset-0 z-50 bg-[#0d1117] flex items-center justify-center p-6 text-center">
          <div className="max-w-sm space-y-2">
            <h2 className="font-display text-xl font-bold text-white">Graphics Context Paused</h2>
            <p className="text-sm text-slate-400">
              Restoring WebGL voxel renderer automatically.
            </p>
          </div>
        </div>
      )}

      {/* Version Launcher Screen */}
      {shellState === 'title' && (
        <LauncherOverlay
          selectedVersion={selectedVersion}
          onSelectVersion={setSelectedVersion}
          platform={platform}
          onSelectPlatform={setPlatform}
          performance={performance}
          onSelectPerformance={setPerformance}
          shaderPack={shaderPack}
          onSelectShaderPack={setShaderPack}
          gameMode={gameMode}
          onSelectGameMode={setGameMode}
          worldType={worldType}
          onSelectWorldType={setWorldType}
          seed={seed}
          onChangeSeed={setSeed}
          account={javaAccount}
          onChangeAccount={setJavaAccount}
          muted={muted}
          onToggleMute={handleToggleMute}
          savedWorld={savedWorld}
          onDeleteSave={handleResetWorld}
          activeMods={activeMods}
          onChangeActiveMods={setActiveMods}
          modCodeLang={modCodeLang}
          onChangeModCodeLang={setModCodeLang}
          onLaunch={handleLaunchToMenu}
        />
      )}

      {/* In-Game Version Main Menu (after clicking Play in Launcher) */}
      {shellState === 'game_menu' && (
        <GameMainMenu
          version={selectedVersion}
          seed={seed}
          gameMode={gameMode}
          worldType={worldType}
          platform={platform}
          performance={performance}
          shaderPack={shaderPack}
          dayCycleSpeed={dayCycleSpeed}
          timeText={stats.timeText}
          timePhase={stats.timePhase}
          muted={muted}
          savedWorld={savedWorld}
          account={javaAccount}
          onChangeAccount={setJavaAccount}
          onEnterWorld={handleEnterWorld}
          onBackToLauncher={handleReturnToLauncher}
          onChangeGameMode={setGameMode}
          onChangeWorldType={setWorldType}
          onChangePlatform={setPlatform}
          onChangePerformance={setPerformance}
          onChangeShaderPack={setShaderPack}
          onSetWorldTime={handleSetWorldTime}
          onChangeDayCycleSpeed={setDayCycleSpeed}
          onToggleMute={handleToggleMute}
          onResetWorld={handleResetWorld}
        />
      )}

      {/* Active Gameplay HUD & Pause Modal */}
      {(shellState === 'playing' || shellState === 'paused') && (
        <GameHUD
          version={selectedVersion}
          platform={platform}
          performance={performance}
          gameMode={gameMode}
          worldType={worldType}
          shaderPack={shaderPack}
          dayCycleSpeed={dayCycleSpeed}
          stats={stats}
          hotbar={hotbar}
          activeSlot={activeSlot}
          tileIcons={tileIcons}
          muted={muted}
          paused={shellState === 'paused'}
          saveStatus={saveStatus}
          activeMods={activeMods}
          onChangeActiveMods={setActiveMods}
          modCodeLang={modCodeLang}
          onSelectSlot={(idx) => handleHotbarSlotCallback(idx)}
          onReplaceActiveBlock={handleReplaceActiveBlock}
          onToggleMute={handleToggleMute}
          onPause={handlePause}
          onResume={handleResume}
          onReturnToMainMenu={handleReturnToMainMenu}
          onReturnToLauncher={handleReturnToLauncher}
          onSaveWorld={handleSaveWorld}
          onResetWorld={handleResetWorld}
          onChangePlatform={setPlatform}
          onChangePerformance={setPerformance}
          onChangeWorldType={setWorldType}
          onChangeShaderPack={setShaderPack}
          onSetWorldTime={handleSetWorldTime}
          onChangeDayCycleSpeed={setDayCycleSpeed}
          onTouchJoystick={(x, y) => engineRef.current?.setTouchJoystick(x, y)}
          onTouchLookDelta={(dx, dy) => engineRef.current?.addTouchLookDelta(dx, dy)}
          onTouchJump={() => engineRef.current?.triggerJump()}
          onTouchDescend={(active) => engineRef.current?.setTouchDescend(active)}
          onTouchSprint={(active) => engineRef.current?.setTouchSprint(active)}
          onTouchFly={() => engineRef.current?.toggleFly()}
          onTouchBreak={() => engineRef.current?.triggerBreakBlock()}
          onTouchPlace={() => engineRef.current?.triggerPlaceBlock()}
          onExecuteCommand={handleExecuteCommand}
          onRequestPointerLock={() => engineRef.current?.requestPointerLock()}
          onScanMtrTracks={() =>
            engineRef.current?.scanMtrTracks() ?? {
              normalCount: 0,
              stationCount: 0,
              depotCount: 0,
              stationPositions: [],
              depotPositions: [],
            }
          }
          onGetMtrDepots={() => engineRef.current?.getMtrDepots() ?? []}
          onGetMtrTelemetry={() => engineRef.current?.getMtrTrainTelemetry() ?? []}
          onGetMtrSchedule={() =>
            engineRef.current?.getMtrTrainSchedule() ?? {
              stations: [],
              totalDispatchedTrains: 0,
              generatedAt: Date.now(),
            }
          }
          onUpsertMtrDepot={(depot) => {
            engineRef.current?.upsertMtrDepot(depot);
            scheduleAutoSave();
          }}
          onDeleteMtrDepot={(depotId) => {
            engineRef.current?.deleteMtrDepot(depotId);
            scheduleAutoSave();
          }}
          onReverseMtrTrain={(depotId) => {
            engineRef.current?.reverseTrainDirection(depotId);
            scheduleAutoSave();
          }}
          onBuildStarterMtrLine={() => {
            const built = engineRef.current?.buildStarterMtrLine() ?? {
              depotPos: [16, 5, 8],
              stationPos: [28, 5, 8],
            };
            scheduleAutoSave();
            return built;
          }}
          onPlaceMtrTrackSegment={(opts) => {
            const placed = engineRef.current?.placeMtrTrackSegment(opts) ?? {
              placedCount: 0,
              endPos: [8, 5, 8],
              stationPlaced: false,
            };
            scheduleAutoSave();
            return placed;
          }}
          onBuildCurvedMtrLoop={(straightLen, turnSpan) => {
            const built = engineRef.current?.buildCurvedLoopMtrLine(straightLen, turnSpan) ?? {
              depotPos: [18, 5, 19],
              stationPos: [28, 5, 18],
              trackCount: 0,
            };
            scheduleAutoSave();
            return built;
          }}
          onToggleRideTrain={(depotId) => engineRef.current?.toggleRideTrain(depotId) ?? false}
          onBoardOrExitTrain={() => engineRef.current?.boardOrExitNearestTrain() ?? false}
          onToggleSitInTrain={() => engineRef.current?.toggleSitInTrain() ?? false}
          onToggleTrainDoors={(depotId) => engineRef.current?.toggleTrainDoors(depotId) ?? false}
          onSwitchTrainCar={(delta) => engineRef.current?.switchTrainCar(delta)}
          onWarpToPoint={(x, y, z) => engineRef.current?.warpToPoint(x, y, z)}
          onSetTrackWalkMode={(enabled) => engineRef.current?.setTrackWalkMode(enabled)}
          onSetTrackCurveStyle={(style) => engineRef.current?.setTrackCurveStyle(style)}
          onConfirmTrackAnchor={() => {
            const res = engineRef.current?.confirmTrackAnchorPlacement() ?? null;
            if (res) scheduleAutoSave();
            return res;
          }}
          onCancelTrackAnchor={() => engineRef.current?.cancelTrackAnchor()}
          onSetMtrAnnouncement={(ann) => {
            engineRef.current?.setMtrAnnouncement(ann);
            scheduleAutoSave();
          }}
          onDeleteMtrAnnouncement={(stationId) => {
            engineRef.current?.deleteMtrAnnouncement(stationId);
            scheduleAutoSave();
          }}
          onTestMtrAnnouncement={(stationId) => engineRef.current?.testStationAnnouncement(stationId)}
          onSetEffortlessMode={(mode) => engineRef.current?.setEffortlessMode(mode)}
          onSetEffortlessOption={(opt, value) => engineRef.current?.setEffortlessOption(opt, value)}
          onSetEffortlessMirrorCenterHere={() => engineRef.current?.setEffortlessMirrorCenterHere()}
          onCancelEffortlessAnchor={() => engineRef.current?.cancelEffortlessAnchor()}
          onUndoEffortless={() => engineRef.current?.undoEffortlessBuild()}
        />
      )}
    </div>
  );
}
