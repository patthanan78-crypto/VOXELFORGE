import React, { useEffect, useState } from 'react';
import { BlockId } from '../engine/blocks';
import { ModCodeLanguage } from '../data/forgeMods';
import {
  formatMtrAnnouncementText,
  getMtrTrainSpec,
  MTR_ANNOUNCEMENT_PRESETS,
  MTR_TRAIN_MODELS,
  MtrAnnouncementMode,
  MtrDepotConfig,
  MtrDirectionMode,
  MtrStationAnnouncement,
  MtrTrackBuilderOptions,
  MtrTrackSummary,
  MtrTrainModelId,
  MtrTrainScheduleData,
  MtrTrainTelemetry,
  MtrTurnCurveSpan,
} from '../data/mtrTransit';
import {
  ArrowLeftRight,
  Check,
  Clock,
  CornerUpLeft,
  CornerUpRight,
  MapPin,
  Mic,
  MoveUp,
  Play,
  Plus,
  RefreshCw,
  Route,
  SlidersHorizontal,
  Square,
  TrainFront,
  Trash2,
  Volume2,
  VolumeX,
  Wrench,
  X,
} from 'lucide-react';

type RailwayTab = 'depots' | 'schedule' | 'announcements' | 'track_builder';

interface RailwayDashboardModalProps {
  modCodeLang: ModCodeLanguage;
  trackWalkMode: boolean;
  trackCurveStyle: 'smooth' | 'straight';
  trackAnchor: {
    startPos: [number, number, number];
    endPos: [number, number, number];
    lengthBlocks: number;
    railName: string;
    isCurve: boolean;
  } | null;
  onClose: () => void;
  onScanTracks: () => MtrTrackSummary;
  onGetDepots: () => MtrDepotConfig[];
  onGetTelemetry: () => MtrTrainTelemetry[];
  onGetSchedule: () => MtrTrainScheduleData;
  onUpsertDepot: (depot: MtrDepotConfig) => void;
  onDeleteDepot: (depotId: string) => void;
  onReverseTrain: (depotId: string) => void;
  onBuildStarterLine: () => { depotPos: [number, number, number]; stationPos: [number, number, number] };
  onPlaceTrackSegment: (
    opts: MtrTrackBuilderOptions,
  ) => { placedCount: number; endPos: [number, number, number]; stationPlaced: boolean };
  onBuildCurvedLoop: (
    straightLen: number,
    turnSpan: MtrTurnCurveSpan,
  ) => { depotPos: [number, number, number]; stationPos: [number, number, number]; trackCount: number };
  onToggleRideTrain: (depotId: string) => boolean;
  onToggleDoors: (depotId: string) => boolean;
  onWarpToPoint: (x: number, y: number, z: number) => void;
  onSetTrackWalkMode: (enabled: boolean) => void;
  onSetTrackCurveStyle: (style: 'smooth' | 'straight') => void;
  onConfirmTrackAnchor: () => { placedCount: number; endPos: [number, number, number] } | null;
  onCancelTrackAnchor: () => void;
  onEquipBlock: (blockId: BlockId) => void;
  onSetAnnouncement: (ann: MtrStationAnnouncement) => void;
  onDeleteAnnouncement: (stationId: string) => void;
  onTestAnnouncement: (stationId: string) => void;
}

const DIRECTION_OPTIONS: { id: MtrDirectionMode; label: string; short: string; hint: string }[] = [
  {
    id: 'one_way_cw',
    label: 'One-Way Clockwise',
    short: '1-Way CW',
    hint: 'Follows closed loops clockwise (standard one-way rail).',
  },
  {
    id: 'one_way_ccw',
    label: 'One-Way Counter-CW',
    short: '1-Way CCW',
    hint: 'Follows closed loops counter-clockwise (reverse one-way).',
  },
  {
    id: 'two_way',
    label: 'Two-Way Shuttle',
    short: '2-Way',
    hint: 'Runs back and forth and reverses automatically at dead ends.',
  },
];

const CURVE_SPANS: { id: MtrTurnCurveSpan; label: string; radius: number }[] = [
  { id: 'tight', label: 'Tight', radius: 7 },
  { id: 'gentle', label: 'Gentle', radius: 14 },
  { id: 'long', label: 'Long Turn', radius: 24 },
  { id: 'giant', label: 'Giant Curve', radius: 38 },
];

export const RailwayDashboardModal: React.FC<RailwayDashboardModalProps> = ({
  modCodeLang,
  trackWalkMode,
  trackCurveStyle,
  trackAnchor,
  onClose,
  onScanTracks,
  onGetDepots,
  onGetTelemetry,
  onGetSchedule,
  onUpsertDepot,
  onDeleteDepot,
  onReverseTrain,
  onBuildStarterLine,
  onPlaceTrackSegment,
  onBuildCurvedLoop,
  onToggleRideTrain,
  onToggleDoors,
  onWarpToPoint,
  onEquipBlock,
  onSetTrackWalkMode,
  onSetTrackCurveStyle,
  onConfirmTrackAnchor,
  onCancelTrackAnchor,
  onSetAnnouncement,
  onDeleteAnnouncement,
  onTestAnnouncement,
}) => {
  const [activeTab, setActiveTab] = useState<RailwayTab>('depots');
  const [tracks, setTracks] = useState<MtrTrackSummary>(() => onScanTracks());
  const [depots, setDepots] = useState<MtrDepotConfig[]>(() => onGetDepots());
  const [telemetry, setTelemetry] = useState<MtrTrainTelemetry[]>(() => onGetTelemetry());
  const [schedule, setSchedule] = useState<MtrTrainScheduleData>(() => onGetSchedule());

  // Depot form state
  const [depotName, setDepotName] = useState('Bangkok MRT Blue Depot');
  const [selectedModel, setSelectedModel] = useState<MtrTrainModelId>('bangkok_mrt_blue');
  const [carCount, setCarCount] = useState(3);
  const [cruiseSpeed, setCruiseSpeed] = useState(10);
  const [dwellSeconds, setDwellSeconds] = useState(3);
  const [directionMode, setDirectionMode] = useState<MtrDirectionMode>('one_way_cw');
  const [depotCoord, setDepotCoord] = useState<[number, number, number]>(() => {
    const initial = onScanTracks();
    return initial.depotPositions[0] ?? [16, 5, 8];
  });

  // Track Length & Long Turn builder state (simpler Create-style track placer)
  const [railType, setRailType] = useState<'normal' | 'station' | 'depot'>('normal');
  const [trackLength, setTrackLength] = useState<number>(28);
  const [turnDirection, setTurnDirection] = useState<'straight' | 'left' | 'right'>('right');
  const [turnCurveSpan, setTurnCurveSpan] = useState<MtrTurnCurveSpan>('long');
  const [includePlatform, setIncludePlatform] = useState<boolean>(true);

  // Voice Announcements studio state
  const [selectedAnnStationId, setSelectedAnnStationId] = useState<string>(
    () => onGetSchedule().stations[0]?.stationId ?? '',
  );
  const [annStationName, setAnnStationName] = useState('Platform 1');
  const [annMode, setAnnMode] = useState<MtrAnnouncementMode>('preset');
  const [annPresetId, setAnnPresetId] = useState(MTR_ANNOUNCEMENT_PRESETS[0].id);
  const [annCustomPhrase, setAnnCustomPhrase] = useState('');
  const [annRecordedDataUrl, setAnnRecordedDataUrl] = useState<string | undefined>(undefined);
  const [annRecordedDurationSec, setAnnRecordedDurationSec] = useState<number | undefined>(undefined);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingElapsedSec, setRecordingElapsedSec] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);

  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const mediaStreamRef = React.useRef<MediaStream | null>(null);
  const recChunksRef = React.useRef<Blob[]>([]);
  const recTimerRef = React.useRef<number | null>(null);
  const previewAudioRef = React.useRef<HTMLAudioElement | null>(null);

  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const refreshData = () => {
    const t = onScanTracks();
    const nextSchedule = onGetSchedule();
    setTracks(t);
    setDepots(onGetDepots());
    setTelemetry(onGetTelemetry());
    setSchedule(nextSchedule);
    if (t.depotPositions.length > 0) {
      const exists = t.depotPositions.some(
        (p) => p[0] === depotCoord[0] && p[1] === depotCoord[1] && p[2] === depotCoord[2],
      );
      if (!exists) {
        setDepotCoord(t.depotPositions[0]);
      }
    }
    if (nextSchedule.stations.length > 0) {
      const stillExists = nextSchedule.stations.some((s) => s.stationId === selectedAnnStationId);
      if (!stillExists) {
        setSelectedAnnStationId(nextSchedule.stations[0].stationId);
      }
    }
  };

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTelemetry(onGetTelemetry());
      setSchedule(onGetSchedule());
    }, 350);
    return () => window.clearInterval(timer);
  }, [onGetTelemetry, onGetSchedule]);

  const cleanupRecorder = React.useCallback(() => {
    if (recTimerRef.current !== null) {
      window.clearInterval(recTimerRef.current);
      recTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore stop error
      }
    }
    mediaRecorderRef.current = null;
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    setIsRecording(false);
  }, []);

  useEffect(() => {
    return () => {
      cleanupRecorder();
    };
  }, [cleanupRecorder]);

  // Sync announcement form whenever selected station changes
  useEffect(() => {
    const matched = schedule.stations.find((s) => s.stationId === selectedAnnStationId);
    if (!matched) {
      if (schedule.stations.length > 0 && !selectedAnnStationId) {
        setSelectedAnnStationId(schedule.stations[0].stationId);
      }
      return;
    }
    const existing = matched.announcement;
    setAnnStationName(existing?.stationName ?? matched.platformLabel);
    setAnnMode(existing?.mode ?? 'preset');
    setAnnPresetId(existing?.presetId ?? MTR_ANNOUNCEMENT_PRESETS[0].id);
    setAnnCustomPhrase(existing?.customPhrase ?? '');
    setAnnRecordedDataUrl(existing?.recordedAudioDataUrl);
    setAnnRecordedDurationSec(existing?.recordedDurationSec);
    setMicError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAnnStationId]);

  const handleModelChange = (modelId: MtrTrainModelId) => {
    setSelectedModel(modelId);
    const spec = getMtrTrainSpec(modelId);
    setCruiseSpeed(Math.round(spec.topSpeed));
    if (modelId === 'bangkok_mrt_blue') setDepotName('Hua Lamphong Depot (Bangkok MRT)');
    else if (modelId.startsWith('hk_mtr')) setDepotName('Kowloon Bay Depot (HK MTR)');
    else setDepotName('Coney Island Yard (NYC Subway)');
  };

  const handleBuildDemoLine = () => {
    const res = onBuildStarterLine();
    setDepotCoord(res.depotPos);
    refreshData();
    setStatusMessage(
      `Built rapid transit loop: Yellow Depot [${res.depotPos.join(', ')}] · Red Station [${res.stationPos.join(', ')}] · Silver Normal Rails.`,
    );
  };

  const handleCreateOrUpdateDepot = (e: React.FormEvent) => {
    e.preventDefault();
    const id = `depot-${Date.now().toString(36)}`;
    onUpsertDepot({
      id,
      name: depotName.trim() || 'MTR Depot',
      depotPos: [...depotCoord] as [number, number, number],
      trainModelId: selectedModel,
      carCount,
      cruiseSpeed,
      stationDwellSeconds: dwellSeconds,
      dispatched: true,
      directionMode,
    });
    refreshData();
    setStatusMessage(
      `Created & dispatched ${getMtrTrainSpec(selectedModel).name} (${DIRECTION_OPTIONS.find((d) => d.id === directionMode)?.short}) from [${depotCoord.join(', ')}].`,
    );
  };

  const toggleDispatch = (depot: MtrDepotConfig) => {
    onUpsertDepot({
      ...depot,
      dispatched: !depot.dispatched,
    });
    refreshData();
  };

  const handleChangeDepotDirection = (depot: MtrDepotConfig, nextDir: MtrDirectionMode) => {
    onUpsertDepot({
      ...depot,
      directionMode: nextDir,
    });
    refreshData();
    setStatusMessage(
      `${depot.name} routing set to ${DIRECTION_OPTIONS.find((o) => o.id === nextDir)?.label}.`,
    );
  };

  const handlePlaceSegment = () => {
    const res = onPlaceTrackSegment({
      railType,
      length: trackLength,
      turnDirection,
      turnCurveSpan,
      includePlatform: railType === 'station' && includePlatform,
    });
    refreshData();
    setStatusMessage(
      `Placed ${res.placedCount} ${railType === 'station' ? 'Red Station' : railType === 'depot' ? 'Yellow Depot' : 'Silver Normal'} rail blocks ending at [${res.endPos.join(', ')}].`,
    );
  };

  const handleBuildLongCurvedLoop = () => {
    const res = onBuildCurvedLoop(trackLength, turnCurveSpan);
    setDepotCoord(res.depotPos);
    refreshData();
    setStatusMessage(
      `Built ${res.trackCount}-block long curved metro loop (${turnCurveSpan} turns) · Yellow Depot [${res.depotPos.join(', ')}] · Station [${res.stationPos.join(', ')}].`,
    );
  };

  const buildCurrentAnnouncement = (
    overrides?: Partial<MtrStationAnnouncement>,
  ): MtrStationAnnouncement => ({
    stationId: selectedAnnStationId,
    stationName: annStationName.trim() || 'Station Platform',
    mode: annMode,
    presetId: annPresetId,
    customPhrase: annCustomPhrase.trim() || undefined,
    recordedAudioDataUrl: annRecordedDataUrl,
    recordedDurationSec: annRecordedDurationSec,
    ...overrides,
  });

  const handleSaveAnnouncement = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedAnnStationId) return;
    const payload = buildCurrentAnnouncement();
    onSetAnnouncement(payload);
    refreshData();
    setStatusMessage(
      `Saved ${payload.mode === 'recorded' ? 'recorded mic audio' : payload.mode === 'mute' ? 'muted setting' : 'automated voice preset'} for ${payload.stationName}.`,
    );
  };

  const handleStartRecording = async () => {
    if (!selectedAnnStationId) return;
    setMicError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined') {
      setMicError('Microphone recording is not supported in this browser context. Use Preset TTS instead.');
      return;
    }

    try {
      cleanupRecorder();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      recChunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      const startTime = performance.now();

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          recChunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = () => {
        if (recTimerRef.current !== null) {
          window.clearInterval(recTimerRef.current);
          recTimerRef.current = null;
        }
        stream.getTracks().forEach((t) => t.stop());
        if (mediaStreamRef.current === stream) {
          mediaStreamRef.current = null;
        }
        setIsRecording(false);

        const blob = new Blob(recChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size === 0) {
          setMicError('No audio captured. Please try speaking closer to the microphone.');
          return;
        }
        const duration = Math.max(0.5, Number(((performance.now() - startTime) / 1000).toFixed(1)));
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = typeof reader.result === 'string' ? reader.result : undefined;
          if (!dataUrl) return;
          setAnnRecordedDataUrl(dataUrl);
          setAnnRecordedDurationSec(duration);
          setAnnMode('recorded');
          const next = buildCurrentAnnouncement({
            mode: 'recorded',
            recordedAudioDataUrl: dataUrl,
            recordedDurationSec: duration,
          });
          onSetAnnouncement(next);
          refreshData();
          setStatusMessage(`Recorded ${duration}s station announcement for ${next.stationName}.`);
        };
        reader.readAsDataURL(blob);
      };

      recorder.start();
      setIsRecording(true);
      setRecordingElapsedSec(0);
      recTimerRef.current = window.setInterval(() => {
        const elapsed = Number(((performance.now() - startTime) / 1000).toFixed(1));
        setRecordingElapsedSec(elapsed);
        if (elapsed >= 12 && recorder.state === 'recording') {
          recorder.stop();
        }
      }, 200);
    } catch {
      setMicError('Microphone access was denied or unavailable. Check browser permissions or use Preset TTS.');
      cleanupRecorder();
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const handlePlayRecordedPreview = () => {
    if (!annRecordedDataUrl) return;
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }
    const audio = new Audio(annRecordedDataUrl);
    previewAudioRef.current = audio;
    audio.play().catch(() => {
      setMicError('Unable to play recorded audio clip.');
    });
  };

  const handleDeleteStationVoice = (stationId: string) => {
    onDeleteAnnouncement(stationId);
    const matched = schedule.stations.find((s) => s.stationId === stationId);
    setAnnStationName(matched?.platformLabel ?? 'Platform');
    setAnnMode('preset');
    setAnnPresetId(MTR_ANNOUNCEMENT_PRESETS[0].id);
    setAnnCustomPhrase('');
    setAnnRecordedDataUrl(undefined);
    setAnnRecordedDurationSec(undefined);
    refreshData();
    setStatusMessage('Reset station announcement to default.');
  };

  const activeSpanInfo = CURVE_SPANS.find((c) => c.id === turnCurveSpan) ?? CURVE_SPANS[2];

  return (
    <div className="fixed inset-0 z-40 bg-[#090d12]/86 flex items-center justify-center p-3 sm:p-5 pointer-events-auto overflow-y-auto launcher-scroll">
      <div className="w-full max-w-4xl bg-[#10161e] border border-white/15 rounded-xl p-4 sm:p-6 space-y-4 my-auto shadow-2xl">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-white/10">
          <div>
            <div className="text-[11px] font-mono-tabular text-amber-300 flex flex-wrap items-center gap-1.5">
              <TrainFront className="w-3.5 h-3.5" />
              <span>
                Minecraft Transit Railway (MTR) ·{' '}
                {modCodeLang === 'java' ? 'Java @Mod("mtr")' : 'Rust JNI Module'}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-amber-400/20 border border-amber-400/45 text-amber-200 font-bold text-[10px]">
                REMAKE v2 · RUST ENGINE
              </span>
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-extrabold text-white mt-0.5">
              MTR Railway, Schedule &amp; Track Builder
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleBuildDemoLine}
              className="h-9 px-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Build Sample Line + Depot</span>
            </button>
            <button
              type="button"
              onClick={refreshData}
              aria-label="Scan Tracks"
              className="h-9 w-9 rounded-lg bg-[#17202b] hover:bg-[#223040] border border-white/15 text-slate-200 flex items-center justify-center cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Railway Dashboard"
              className="h-9 w-9 rounded-lg bg-[#17202b] hover:bg-[#223040] border border-white/15 text-slate-200 flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Always-Visible Create-Mod Style Track Length & Walk-to-Extend Banner */}
        <div className="p-3 rounded-xl bg-[#0b1016] border border-emerald-400/35 flex flex-wrap items-center justify-between gap-2.5">
          <div className="space-y-0.5 min-w-0">
            <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
              <Route className="w-3.5 h-3.5" />
              <span>Create-Style Track Length (Walk-to-Extend)</span>
            </div>
            <div className="text-[11px] text-slate-300">
              {trackAnchor
                ? `Active Anchor [${trackAnchor.startPos.join(', ')}] → Currently ${trackAnchor.lengthBlocks} blocks (${trackAnchor.isCurve ? 'Smooth Long Turn' : 'Straight'}).`
                : 'Hold any Rail block → Place 1st rail → Walk the length you need → Place 2nd rail to auto-connect!'}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => onSetTrackWalkMode(!trackWalkMode)}
              className={`h-8 px-2.5 rounded-lg border text-xs font-bold cursor-pointer ${
                trackWalkMode
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                  : 'bg-[#17202b] text-slate-300 border-white/15'
              }`}
            >
              Walk-Extend: {trackWalkMode ? 'ON' : 'OFF'}
            </button>

            <button
              type="button"
              onClick={() =>
                onSetTrackCurveStyle(trackCurveStyle === 'smooth' ? 'straight' : 'smooth')
              }
              className="h-8 px-2.5 rounded-lg bg-[#17202b] hover:bg-[#223040] border border-amber-400/40 text-xs font-semibold text-amber-200 cursor-pointer"
            >
              {trackCurveStyle === 'smooth' ? 'Smooth Long Turn' : 'Straight L-Bend'}
            </button>

            {trackAnchor ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const res = onConfirmTrackAnchor();
                    refreshData();
                    if (res) {
                      setStatusMessage(`Connected ${res.placedCount}-block track ending at [${res.endPos.join(', ')}].`);
                    }
                  }}
                  className="h-8 px-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold cursor-pointer"
                >
                  Place {trackAnchor.lengthBlocks}m Track
                </button>
                <button
                  type="button"
                  onClick={() => onCancelTrackAnchor()}
                  className="h-8 px-2.5 rounded-lg bg-[#17202b] hover:bg-rose-500/25 border border-white/15 text-xs text-rose-200 cursor-pointer"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onEquipBlock(BlockId.RailNormal);
                  onSetTrackWalkMode(true);
                  onClose();
                }}
                className="h-8 px-3 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold cursor-pointer"
              >
                Equip Rail &amp; Walk Track
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#0b1016] p-1 rounded-lg border border-white/10">
          <button
            type="button"
            onClick={() => setActiveTab('depots')}
            className={`h-9 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'depots'
                ? 'bg-emerald-500 text-slate-950'
                : 'text-slate-300 hover:text-white hover:bg-[#17202b]'
            }`}
          >
            <TrainFront className="w-3.5 h-3.5" />
            <span>Depots ({depots.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('schedule')}
            className={`h-9 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'schedule'
                ? 'bg-rose-500 text-white'
                : 'text-slate-300 hover:text-white hover:bg-[#17202b]'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Train Schedule ({schedule.stations.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('announcements')}
            className={`h-9 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'announcements'
                ? 'bg-sky-400 text-slate-950'
                : 'text-slate-300 hover:text-white hover:bg-[#17202b]'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Voice Announcements</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('track_builder')}
            className={`h-9 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'track_builder'
                ? 'bg-amber-400 text-slate-950'
                : 'text-slate-300 hover:text-white hover:bg-[#17202b]'
            }`}
          >
            <Route className="w-3.5 h-3.5" />
            <span>Track &amp; Turns</span>
          </button>
        </div>

        {/* Rail Legend + Quick Hotbar Equip + Start Walk-Extend */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => {
              onEquipBlock(BlockId.RailNormal);
              onSetTrackWalkMode(true);
              setStatusMessage(
                'Equipped Silver Normal Rail + Walk-Extend ON. Close menu, place 1st rail, walk length, place 2nd rail!',
              );
            }}
            className="p-2.5 rounded-lg bg-[#0b1016] hover:bg-[#17202b] border border-slate-400/35 text-left cursor-pointer"
          >
            <div className="flex items-center justify-between text-xs font-bold text-slate-200">
              <span>Normal Rail</span>
              <span className="w-3 h-3 bg-slate-300 border border-white/40 inline-block" />
            </div>
            <div className="text-[11px] font-mono-tabular text-slate-400 mt-0.5">
              Equip &amp; Walk · {tracks.normalCount} placed
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              onEquipBlock(BlockId.RailStation);
              onSetTrackWalkMode(true);
              setStatusMessage(
                'Equipped Red Station Rail + Walk-Extend ON. Place 1st rail, walk station length, place 2nd rail!',
              );
            }}
            className="p-2.5 rounded-lg bg-[#0b1016] hover:bg-[#17202b] border border-rose-500/40 text-left cursor-pointer"
          >
            <div className="flex items-center justify-between text-xs font-bold text-rose-300">
              <span>Station Rail</span>
              <span className="w-3 h-3 bg-rose-500 border border-rose-200/50 inline-block" />
            </div>
            <div className="text-[11px] font-mono-tabular text-slate-400 mt-0.5">
              Equip &amp; Walk · {tracks.stationCount} placed
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              onEquipBlock(BlockId.RailDepot);
              onSetTrackWalkMode(true);
              setStatusMessage(
                'Equipped Yellow Depot Track + Walk-Extend ON. Place 1st rail, walk depot length, place 2nd rail!',
              );
            }}
            className="p-2.5 rounded-lg bg-[#0b1016] hover:bg-[#17202b] border border-amber-400/45 text-left cursor-pointer"
          >
            <div className="flex items-center justify-between text-xs font-bold text-amber-300">
              <span>Depot Track</span>
              <span className="w-3 h-3 bg-amber-400 border border-amber-100/50 inline-block" />
            </div>
            <div className="text-[11px] font-mono-tabular text-slate-400 mt-0.5">
              Equip &amp; Walk · {tracks.depotCount} placed
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              onEquipBlock(BlockId.PlatformEdge);
              setStatusMessage('Equipped Station Platform Slab to active hotbar slot.');
            }}
            className="p-2.5 rounded-lg bg-[#0b1016] hover:bg-[#17202b] border border-white/15 text-left cursor-pointer"
          >
            <div className="flex items-center justify-between text-xs font-bold text-sky-200">
              <span>Platform Slab</span>
              <span className="w-3.5 h-1.5 bg-slate-400 border-t-2 border-amber-400 inline-block" />
            </div>
            <div className="text-[11px] font-mono-tabular text-slate-400 mt-0.5">
              Half-Slab · Equip to Hotbar
            </div>
          </button>
        </div>

        {statusMessage && (
          <div className="px-3 py-2 rounded-lg bg-emerald-500/15 border border-emerald-400/35 text-xs text-emerald-200 flex items-center justify-between gap-2">
            <span>{statusMessage}</span>
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1 rounded bg-emerald-500 text-slate-950 font-bold text-[11px] shrink-0 cursor-pointer"
            >
              Back to World
            </button>
          </div>
        )}

        {/* TAB 1: DEPOTS & ONE-WAY / TWO-WAY DIRECTION */}
        {activeTab === 'depots' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left: Depot Setup & Real-Life Train Selector */}
            <form
              onSubmit={handleCreateOrUpdateDepot}
              className="lg:col-span-6 p-3.5 rounded-xl bg-[#0b1016] border border-white/10 space-y-3"
            >
              <div className="text-xs font-bold text-white">
                Set Up Depot &amp; Select Real-Life Rolling Stock
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Depot / Line Name</label>
                  <input
                    type="text"
                    value={depotName}
                    onChange={(e) => setDepotName(e.target.value)}
                    className="w-full h-8 px-2.5 rounded-lg bg-[#141c26] border border-white/15 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Yellow Depot Track Coordinate
                  </label>
                  {tracks.depotPositions.length > 0 ? (
                    <select
                      value={depotCoord.join(',')}
                      onChange={(e) => {
                        const parts = e.target.value.split(',').map(Number);
                        if (parts.length === 3) {
                          setDepotCoord([parts[0], parts[1], parts[2]]);
                        }
                      }}
                      className="w-full h-8 px-2 rounded-lg bg-[#141c26] border border-amber-400/40 text-xs font-mono-tabular text-amber-200 cursor-pointer"
                    >
                      {tracks.depotPositions.map((pos, idx) => (
                        <option key={idx} value={pos.join(',')}>
                          Depot [{pos[0]}, {pos[1]}, {pos[2]}]
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="h-8 px-2.5 rounded-lg bg-[#141c26] border border-rose-400/35 text-[11px] text-rose-200 flex items-center">
                      No yellow depot tracks yet (place or Build Sample)
                    </div>
                  )}
                </div>
              </div>

              {/* Rail Direction Mode (One-Way CW, One-Way CCW, Two-Way Shuttle) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Rail Routing Direction</span>
                  <span className="text-sky-300 font-semibold">
                    {DIRECTION_OPTIONS.find((o) => o.id === directionMode)?.short}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {DIRECTION_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setDirectionMode(opt.id)}
                      className={`h-8 px-2 rounded-lg border text-[11px] font-bold cursor-pointer transition-colors ${
                        directionMode === opt.id
                          ? 'bg-sky-500/25 border-sky-400 text-sky-200'
                          : 'bg-[#121922] border-white/10 text-slate-300 hover:bg-[#19222e]'
                      }`}
                    >
                      {opt.short}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400">
                  {DIRECTION_OPTIONS.find((o) => o.id === directionMode)?.hint}
                </p>
              </div>

              {/* Real-Life Train Selector */}
              <div className="space-y-1.5">
                <label className="block text-[11px] text-slate-400">
                  Real-World Train Fleet (Bangkok MRT · Hong Kong MTR · NYC Subway)
                </label>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 launcher-scroll">
                  {MTR_TRAIN_MODELS.map((spec) => {
                    const active = selectedModel === spec.id;
                    return (
                      <button
                        key={spec.id}
                        type="button"
                        onClick={() => handleModelChange(spec.id)}
                        className={`w-full text-left p-2 rounded-lg border transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                          active
                            ? 'bg-[#182330] border-emerald-400 text-white'
                            : 'bg-[#121922] border-white/10 text-slate-300 hover:bg-[#19222e]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-5 rounded-sm border border-white/25 overflow-hidden shrink-0 flex flex-col">
                            <div className="flex-1" style={{ backgroundColor: spec.bodyHex }} />
                            <div className="h-1.5" style={{ backgroundColor: spec.stripeHex }} />
                            <div className="h-0.5" style={{ backgroundColor: spec.accentHex }} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold truncate">{spec.name}</div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {spec.city} · {spec.lineLabel}
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono-tabular text-emerald-300 shrink-0">
                          {spec.topSpeed} b/s
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Train Parameters */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Cars ({carCount})</label>
                  <input
                    type="range"
                    min={1}
                    max={4}
                    value={carCount}
                    onChange={(e) => setCarCount(Number(e.target.value))}
                    className="w-full accent-emerald-400 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Speed ({cruiseSpeed} b/s)</label>
                  <input
                    type="range"
                    min={4}
                    max={16}
                    value={cruiseSpeed}
                    onChange={(e) => setCruiseSpeed(Number(e.target.value))}
                    className="w-full accent-emerald-400 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Station Stop ({dwellSeconds}s)</label>
                  <input
                    type="range"
                    min={1}
                    max={6}
                    value={dwellSeconds}
                    onChange={(e) => setDwellSeconds(Number(e.target.value))}
                    className="w-full accent-rose-400 cursor-pointer"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full h-10 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Assign Train to Yellow Depot &amp; Dispatch</span>
              </button>
            </form>

            {/* Right: Live Depots & Active Train Consists */}
            <div className="lg:col-span-6 p-3.5 rounded-xl bg-[#0b1016] border border-white/10 flex flex-col justify-between gap-3">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">
                    Active Depots &amp; Live Trains ({depots.length})
                  </span>
                  <span className="text-[11px] font-mono-tabular text-slate-400">
                    Red Stations: {schedule.stations.length}
                  </span>
                </div>

                {depots.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400 space-y-2">
                    <p>No MTR depots configured yet.</p>
                    <p>
                      Click <strong>Build Sample Line + Depot</strong> above or place Yellow Depot Track
                      blocks and create a depot on the left.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1 launcher-scroll">
                    {depots.map((d) => {
                      const live = telemetry.find((t) => t.depotId === d.id);
                      const spec = getMtrTrainSpec(d.trainModelId);
                      const currentDir = live?.directionMode ?? d.directionMode ?? 'one_way_cw';
                      return (
                        <div
                          key={d.id}
                          className="p-2.5 rounded-lg bg-[#121922] border border-white/10 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-white truncate">{d.name}</div>
                              <div className="text-[11px] text-slate-300 truncate">
                                {spec.name} · {d.carCount} cars
                              </div>
                            </div>
                            <span
                              className={`text-[11px] font-mono-tabular font-bold shrink-0 ${
                                live?.status === 'Running'
                                  ? 'text-emerald-300'
                                  : live?.status === 'At Station'
                                    ? 'text-rose-300'
                                    : live?.status === 'In Depot'
                                      ? 'text-amber-300'
                                      : 'text-slate-400'
                              }`}
                            >
                              {live?.status ?? (d.dispatched ? 'Running' : 'In Depot')}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono-tabular text-slate-400">
                            <span>
                              Pos [{live?.x ?? d.depotPos[0]}, {live?.y ?? d.depotPos[1]},{' '}
                              {live?.z ?? d.depotPos[2]}] · {live?.speedBlocksPerSec ?? 0} b/s
                            </span>
                            <div className="flex items-center gap-2">
                              <span className={live?.doorOpen ? 'text-emerald-300' : 'text-slate-400'}>
                                {live?.doorOpen ? 'Doors Open' : 'Doors Closed'}
                              </span>
                              <span className="text-amber-300">
                                NPCs: {live?.onboardNpcCount ?? 0}
                              </span>
                              <span className="text-sky-300">
                                {DIRECTION_OPTIONS.find((o) => o.id === currentDir)?.short}
                              </span>
                            </div>
                          </div>

                          {/* Quick Direction Switcher per train */}
                          <div className="flex items-center gap-1">
                            {DIRECTION_OPTIONS.map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => handleChangeDepotDirection(d, opt.id)}
                                className={`flex-1 h-6 rounded text-[10px] font-bold border cursor-pointer ${
                                  currentDir === opt.id
                                    ? 'bg-sky-500/25 border-sky-400 text-sky-200'
                                    : 'bg-[#0f151d] border-white/10 text-slate-400 hover:text-white'
                                }`}
                              >
                                {opt.short}
                              </button>
                            ))}
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => toggleDispatch(d)}
                              className={`h-7 px-2.5 rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                                d.dispatched
                                  ? 'bg-amber-400/20 border border-amber-400/40 text-amber-200'
                                  : 'bg-emerald-500 text-slate-950'
                              }`}
                            >
                              {d.dispatched ? (
                                <>
                                  <Square className="w-3 h-3" />
                                  <span>Recall</span>
                                </>
                              ) : (
                                <>
                                  <Play className="w-3 h-3" />
                                  <span>Dispatch</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                onReverseTrain(d.id);
                                refreshData();
                                setStatusMessage(`Reversed direction for ${d.name}.`);
                              }}
                              className="h-7 px-2.5 rounded bg-[#1a2533] hover:bg-[#233245] border border-amber-400/35 text-[11px] font-semibold text-amber-200 flex items-center gap-1 cursor-pointer"
                            >
                              <ArrowLeftRight className="w-3 h-3" />
                              <span>Flip</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                const open = onToggleDoors(d.id);
                                refreshData();
                                setStatusMessage(
                                  open
                                    ? `Opened sliding doors on ${spec.name}.`
                                    : `Closed sliding doors on ${spec.name}.`,
                                );
                              }}
                              className={`h-7 px-2.5 rounded border text-[11px] font-semibold cursor-pointer ${
                                live?.doorOpen
                                  ? 'bg-emerald-500/20 border-emerald-400/45 text-emerald-200'
                                  : 'bg-[#1a2533] hover:bg-[#233245] border-white/15 text-slate-200'
                              }`}
                            >
                              {live?.doorOpen ? 'Close Doors' : 'Open Doors'}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                const riding = onToggleRideTrain(d.id);
                                setStatusMessage(
                                  riding
                                    ? `Boarded ${spec.name} interior — walk cars, press [R] to sit, [G] for doors, [F] to exit.`
                                    : `Exited ${spec.name}.`,
                                );
                              }}
                              className="h-7 px-2.5 rounded bg-[#1a2533] hover:bg-[#233245] border border-sky-400/35 text-[11px] font-semibold text-sky-200 cursor-pointer"
                            >
                              Board Train
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                onWarpToPoint(d.depotPos[0], d.depotPos[1], d.depotPos[2]);
                                onClose();
                              }}
                              className="h-7 px-2.5 rounded bg-[#1a2533] hover:bg-[#233245] border border-white/12 text-[11px] font-semibold text-slate-200 flex items-center gap-1 cursor-pointer"
                            >
                              <MapPin className="w-3 h-3" />
                              <span>Warp</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                onDeleteDepot(d.id);
                                refreshData();
                              }}
                              aria-label="Delete Depot"
                              className="h-7 px-2 rounded bg-[#1a2533] hover:bg-rose-500/25 border border-white/10 text-rose-300 ml-auto cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {tracks.stationPositions.length > 0 && (
                <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <span className="text-slate-400">
                    Red Station Rail detected at [{tracks.stationPositions[0].join(', ')}]
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const st = tracks.stationPositions[0];
                      onWarpToPoint(st[0], st[1], st[2] + 1);
                      onClose();
                    }}
                    className="text-rose-300 hover:text-rose-200 font-semibold cursor-pointer"
                  >
                    Warp to Station Platform
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: TRAIN SCHEDULE DASHBOARD */}
        {activeTab === 'schedule' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-[#0b1016] border border-white/10">
              <div>
                <div className="text-xs font-bold text-white">
                  Live Station Departure Board &amp; Platform Status
                </div>
                <div className="text-[11px] text-slate-400">
                  Tracks all connected Red Station Rail platforms · {schedule.totalDispatchedTrains}{' '}
                  active trains running
                </div>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-mono-tabular">
                <span className="px-2 py-1 rounded bg-rose-500/20 border border-rose-400/35 text-rose-200">
                  Platforms: {schedule.stations.length}
                </span>
              </div>
            </div>

            {schedule.stations.length === 0 ? (
              <div className="p-8 rounded-xl bg-[#0b1016] border border-white/10 text-center space-y-3">
                <div className="text-sm font-bold text-white">
                  No Red Station Rails Configured Yet
                </div>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Place Red Station Rail blocks on any rail line or use Build Sample Line / Track
                  Builder to register a station platform on the Train Schedule board.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={handleBuildDemoLine}
                    className="h-9 px-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs cursor-pointer"
                  >
                    Build Sample Line + Stations
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('track_builder')}
                    className="h-9 px-3 rounded-lg bg-[#17202b] hover:bg-[#223040] border border-white/15 text-slate-200 font-semibold text-xs cursor-pointer"
                  >
                    Open Track Builder
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1 launcher-scroll">
                {schedule.stations.map((station) => {
                  const statusTone =
                    station.platformStatus === 'Boarding'
                      ? 'bg-emerald-500/20 border-emerald-400/45 text-emerald-200'
                      : station.platformStatus === 'Approaching'
                        ? 'bg-amber-400/20 border-amber-400/45 text-amber-200'
                        : 'bg-slate-700/35 border-white/15 text-slate-300';

                  return (
                    <div
                      key={station.stationId}
                      className="p-3.5 rounded-xl bg-[#0b1016] border border-white/12 space-y-3"
                    >
                      {/* Platform Header */}
                      <div className="flex items-start justify-between gap-2 pb-2 border-b border-white/10">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-display font-extrabold text-white">
                              {station.platformLabel}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded border text-[10px] font-mono-tabular font-bold ${statusTone}`}
                            >
                              {station.platformStatus === 'Boarding'
                                ? `Boarding · ${station.dwellRemainingSeconds}s`
                                : station.platformStatus}
                            </span>
                          </div>
                          <div className="text-[11px] font-mono-tabular text-slate-400 mt-0.5">
                            Red Station [{station.centerPos.join(', ')}] · {station.railCount} rail
                            blocks
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedAnnStationId(station.stationId);
                              setActiveTab('announcements');
                            }}
                            className="h-7 px-2.5 rounded bg-sky-500/20 hover:bg-sky-500 hover:text-slate-950 border border-sky-400/40 text-[11px] font-semibold text-sky-200 flex items-center gap-1 cursor-pointer"
                          >
                            <Volume2 className="w-3 h-3" />
                            <span>
                              {station.announcement?.mode === 'recorded'
                                ? 'Mic'
                                : station.announcement?.mode === 'mute'
                                  ? 'Muted'
                                  : 'Voice'}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onWarpToPoint(
                                station.centerPos[0],
                                station.centerPos[1],
                                station.centerPos[2] + 1,
                              );
                              onClose();
                            }}
                            className="h-7 px-2.5 rounded bg-[#17202b] hover:bg-[#223040] border border-white/15 text-[11px] font-semibold text-slate-200 flex items-center gap-1 cursor-pointer"
                          >
                            <MapPin className="w-3 h-3 text-rose-400" />
                            <span>Warp</span>
                          </button>
                        </div>
                      </div>

                      {/* Upcoming Departures List */}
                      {station.upcomingDepartures.length === 0 ? (
                        <div className="py-4 text-center text-xs text-slate-400">
                          No trains assigned to any depot yet. Assign a train in Depots &amp;
                          Direction.
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="text-[10px] font-mono-tabular uppercase tracking-wider text-slate-400 flex items-center justify-between">
                            <span>Upcoming Departures</span>
                            <span>ETA</span>
                          </div>
                          {station.upcomingDepartures.map((dep) => (
                            <div
                              key={`${station.stationId}-${dep.depotId}`}
                              className="p-2 rounded-lg bg-[#121922] border border-white/10 flex items-center justify-between gap-2"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className="w-1.5 h-8 rounded-xs shrink-0"
                                  style={{ backgroundColor: dep.stripeHex }}
                                />
                                <div className="min-w-0">
                                  <div className="text-xs font-bold text-white truncate">
                                    {dep.trainName}
                                  </div>
                                  <div className="text-[10px] text-slate-400 truncate">
                                    {dep.carCount} cars · {dep.directionLabel} · {dep.depotName}
                                  </div>
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <div
                                  className={`text-xs font-mono-tabular font-extrabold ${
                                    dep.status === 'Boarding'
                                      ? 'text-emerald-300'
                                      : dep.status === 'Approaching'
                                        ? 'text-amber-300'
                                        : dep.status === 'In Depot'
                                          ? 'text-slate-400'
                                          : 'text-sky-300'
                                  }`}
                                >
                                  {dep.status === 'Boarding'
                                    ? 'NOW'
                                    : dep.status === 'In Depot'
                                      ? 'DEPOT'
                                      : `${dep.etaSeconds}s`}
                                </div>
                                <div className="text-[10px] text-slate-400">{dep.status}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: STATION AUTOMATED VOICE ANNOUNCEMENTS */}
        {activeTab === 'announcements' && (
          <div className="space-y-3">
            {schedule.stations.length === 0 ? (
              <div className="p-8 rounded-xl bg-[#0b1016] border border-white/10 text-center space-y-3">
                <div className="text-sm font-bold text-white">
                  No Red Station Platforms Found
                </div>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Place Red Station Rail blocks or build the Sample Line first, then configure
                  automated arrival chimes, spoken presets, or custom mic recordings per station.
                </p>
                <button
                  type="button"
                  onClick={handleBuildDemoLine}
                  className="h-9 px-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs cursor-pointer"
                >
                  Build Sample Line + Stations
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Left: Station Selector List */}
                <div className="lg:col-span-4 p-3 rounded-xl bg-[#0b1016] border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">
                      Station Platforms ({schedule.stations.length})
                    </span>
                    <span className="text-[10px] font-mono-tabular text-sky-300">
                      Auto-Triggers on Arrival
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1 launcher-scroll">
                    {schedule.stations.map((st) => {
                      const active = st.stationId === selectedAnnStationId;
                      const modeLabel =
                        st.announcement?.mode === 'recorded'
                          ? `Mic (${st.announcement.recordedDurationSec ?? 1}s)`
                          : st.announcement?.mode === 'mute'
                            ? 'Muted'
                            : 'Preset TTS';
                      return (
                        <button
                          key={st.stationId}
                          type="button"
                          onClick={() => setSelectedAnnStationId(st.stationId)}
                          className={`w-full text-left p-2.5 rounded-lg border transition-colors cursor-pointer space-y-1 ${
                            active
                              ? 'bg-[#172332] border-sky-400 text-white'
                              : 'bg-[#121922] border-white/10 text-slate-300 hover:bg-[#18212d]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold truncate">{st.platformLabel}</span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono-tabular font-bold border ${
                                st.announcement?.mode === 'recorded'
                                  ? 'bg-rose-500/20 border-rose-400/45 text-rose-200'
                                  : st.announcement?.mode === 'mute'
                                    ? 'bg-slate-700/40 border-white/15 text-slate-400'
                                    : 'bg-sky-500/20 border-sky-400/40 text-sky-200'
                              }`}
                            >
                              {modeLabel}
                            </span>
                          </div>
                          <div className="text-[10px] font-mono-tabular text-slate-400">
                            Pos [{st.centerPos.join(', ')}] · {st.railCount} station rails
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Right: Voice / Mic Recorder Configurator */}
                <form
                  onSubmit={handleSaveAnnouncement}
                  className="lg:col-span-8 p-4 rounded-xl bg-[#0b1016] border border-white/10 space-y-3.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/10">
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Volume2 className="w-4 h-4 text-sky-300" />
                        <span>Automated Station Arrival Announcement</span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Plays arrival chime + spoken preset or recorded mic voice when a train stops
                        at this platform.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => selectedAnnStationId && onTestAnnouncement(selectedAnnStationId)}
                      className="h-8 px-3 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Test Arrival Voice</span>
                    </button>
                  </div>

                  {/* Station Display Name & Mode */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Station Name (replaces {'{station}'})
                      </label>
                      <input
                        type="text"
                        value={annStationName}
                        onChange={(e) => setAnnStationName(e.target.value)}
                        placeholder="e.g. Hua Lamphong / Central"
                        className="w-full h-9 px-2.5 rounded-lg bg-[#141c26] border border-white/15 text-xs text-white focus:outline-none focus:border-sky-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Announcement Playback Mode
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { id: 'preset' as const, label: 'Preset TTS', icon: Volume2 },
                          { id: 'recorded' as const, label: 'Mic Clip', icon: Mic },
                          { id: 'mute' as const, label: 'Muted', icon: VolumeX },
                        ].map((opt) => {
                          const Icon = opt.icon;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setAnnMode(opt.id)}
                              className={`h-9 px-2 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer ${
                                annMode === opt.id
                                  ? 'bg-sky-500/25 border-sky-400 text-sky-200'
                                  : 'bg-[#121922] border-white/10 text-slate-300 hover:bg-[#19222e]'
                              }`}
                            >
                              <Icon className="w-3.5 h-3.5" />
                              <span>{opt.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Automated Preset Phrase Selector */}
                  <div className="space-y-2">
                    <label className="block text-[11px] text-slate-400">
                      Transit Agency Preset Phrase (SpeechSynthesis)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {MTR_ANNOUNCEMENT_PRESETS.map((preset) => {
                        const selected = annPresetId === preset.id && !annCustomPhrase.trim();
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => {
                              setAnnPresetId(preset.id);
                              setAnnCustomPhrase('');
                              if (annMode === 'mute') setAnnMode('preset');
                            }}
                            className={`p-2 rounded-lg border text-left cursor-pointer transition-colors ${
                              selected
                                ? 'bg-[#172332] border-sky-400 text-white'
                                : 'bg-[#121922] border-white/10 text-slate-300 hover:bg-[#19222e]'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[11px] font-bold">
                              <span>{preset.label}</span>
                              <span className="text-[10px] text-sky-300">{preset.agency}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 truncate mt-0.5">
                              {preset.template}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Custom Phrase Override (optional · supports {'{station}'})
                      </label>
                      <input
                        type="text"
                        value={annCustomPhrase}
                        onChange={(e) => setAnnCustomPhrase(e.target.value)}
                        placeholder={formatMtrAnnouncementText({
                          stationId: selectedAnnStationId,
                          stationName: annStationName,
                          mode: annMode,
                          presetId: annPresetId,
                        })}
                        className="w-full h-9 px-2.5 rounded-lg bg-[#141c26] border border-white/15 text-xs text-white focus:outline-none focus:border-sky-400"
                      />
                    </div>
                  </div>

                  {/* Custom Microphone Recorder */}
                  <div className="p-3 rounded-lg bg-[#121922] border border-white/10 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <Mic className="w-3.5 h-3.5 text-rose-400" />
                          <span>Custom Microphone Recording</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Record up to 12 seconds directly for this station platform (stored with world).
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {!isRecording ? (
                          <button
                            type="button"
                            onClick={() => void handleStartRecording()}
                            className="h-8 px-3 rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                          >
                            <Mic className="w-3.5 h-3.5" />
                            <span>{annRecordedDataUrl ? 'Re-Record Voice' : 'Record Voice'}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handleStopRecording}
                            className="h-8 px-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                          >
                            <Square className="w-3.5 h-3.5" />
                            <span>Stop ({recordingElapsedSec.toFixed(1)}s / 12s)</span>
                          </button>
                        )}

                        {annRecordedDataUrl && !isRecording && (
                          <>
                            <button
                              type="button"
                              onClick={handlePlayRecordedPreview}
                              className="h-8 px-2.5 rounded-lg bg-[#1a2533] hover:bg-[#243447] border border-emerald-400/40 text-emerald-200 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <Play className="w-3 h-3" />
                              <span>Play Clip ({annRecordedDurationSec ?? 1}s)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setAnnRecordedDataUrl(undefined);
                                setAnnRecordedDurationSec(undefined);
                                if (annMode === 'recorded') setAnnMode('preset');
                              }}
                              aria-label="Clear Recording"
                              className="h-8 px-2 rounded-lg bg-[#1a2533] hover:bg-rose-500/25 border border-white/10 text-rose-300 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {micError && (
                      <div className="px-2.5 py-1.5 rounded bg-rose-500/15 border border-rose-400/40 text-[11px] text-rose-200">
                        {micError}
                      </div>
                    )}
                  </div>

                  {/* Save / Reset Controls */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => selectedAnnStationId && handleDeleteStationVoice(selectedAnnStationId)}
                      className="h-9 px-3 rounded-lg bg-[#17202b] hover:bg-rose-500/20 border border-white/15 text-xs font-semibold text-slate-300 cursor-pointer"
                    >
                      Reset to Default
                    </button>

                    <button
                      type="submit"
                      className="h-9 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>Save Station Announcement</span>
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: SIMPLE TRACK LENGTH & LONG TURN SETTINGS */}
        {activeTab === 'track_builder' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left: Simple Create-style Length & Long Turn Controls */}
            <div className="lg:col-span-7 p-4 rounded-xl bg-[#0b1016] border border-white/10 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-amber-300" />
                    <span>Simple Track Length &amp; Long Turn Builder</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Easier Create-style track placement: pick rail color, track length, and wide
                    sweeping curve size, then place directly ahead of you.
                  </p>
                </div>
              </div>

              {/* Rail Type */}
              <div className="space-y-1.5">
                <label className="block text-[11px] text-slate-400">1. Rail Block Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'normal' as const, label: 'Normal (Silver)', accent: 'border-slate-300/60 text-slate-100' },
                    { id: 'station' as const, label: 'Station (Red)', accent: 'border-rose-400 text-rose-200' },
                    { id: 'depot' as const, label: 'Depot (Yellow)', accent: 'border-amber-400 text-amber-200' },
                  ].map((rt) => (
                    <button
                      key={rt.id}
                      type="button"
                      onClick={() => setRailType(rt.id)}
                      className={`h-9 px-2 rounded-lg border text-xs font-bold cursor-pointer transition-colors ${
                        railType === rt.id
                          ? `bg-[#182330] ${rt.accent}`
                          : 'bg-[#121922] border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      {rt.label}
                    </button>
                  ))}
                </div>
                {railType === 'station' && (
                  <label className="flex items-center gap-2 pt-1 text-xs text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includePlatform}
                      onChange={(e) => setIncludePlatform(e.target.checked)}
                      className="accent-rose-400 cursor-pointer"
                    />
                    <span>Auto-place Concrete Station Platform alongside Red Station Rails</span>
                  </label>
                )}
              </div>

              {/* Track Length Slider + Presets */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-semibold">2. Track Length</span>
                  <span className="font-mono-tabular font-bold text-emerald-300">
                    {trackLength} blocks
                  </span>
                </div>
                <input
                  type="range"
                  min={4}
                  max={64}
                  value={trackLength}
                  onChange={(e) => setTrackLength(Number(e.target.value))}
                  className="w-full accent-emerald-400 cursor-pointer"
                />
                <div className="flex flex-wrap gap-1.5">
                  {[8, 16, 32, 48, 64].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setTrackLength(preset)}
                      className={`px-2.5 py-1 rounded border text-[11px] font-mono-tabular font-bold cursor-pointer ${
                        trackLength === preset
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                          : 'bg-[#121922] text-slate-300 border-white/10 hover:bg-[#19222e]'
                      }`}
                    >
                      {preset}m
                    </button>
                  ))}
                </div>
              </div>

              {/* Turn Direction */}
              <div className="space-y-1.5">
                <label className="block text-[11px] text-slate-400">3. Track Turn Direction</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTurnDirection('left')}
                    className={`h-9 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                      turnDirection === 'left'
                        ? 'bg-amber-400/20 border-amber-400 text-amber-200'
                        : 'bg-[#121922] border-white/10 text-slate-300 hover:bg-[#19222e]'
                    }`}
                  >
                    <CornerUpLeft className="w-3.5 h-3.5" />
                    <span>Turn Left</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTurnDirection('straight')}
                    className={`h-9 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                      turnDirection === 'straight'
                        ? 'bg-amber-400/20 border-amber-400 text-amber-200'
                        : 'bg-[#121922] border-white/10 text-slate-300 hover:bg-[#19222e]'
                    }`}
                  >
                    <MoveUp className="w-3.5 h-3.5" />
                    <span>Straight</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTurnDirection('right')}
                    className={`h-9 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                      turnDirection === 'right'
                        ? 'bg-amber-400/20 border-amber-400 text-amber-200'
                        : 'bg-[#121922] border-white/10 text-slate-300 hover:bg-[#19222e]'
                    }`}
                  >
                    <CornerUpRight className="w-3.5 h-3.5" />
                    <span>Turn Right</span>
                  </button>
                </div>
              </div>

              {/* Long Turn Curve Radius */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">4. Long Turn Curve Size</span>
                  <span className="font-mono-tabular text-amber-300">
                    Radius {activeSpanInfo.radius} blocks ({activeSpanInfo.label})
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {CURVE_SPANS.map((span) => (
                    <button
                      key={span.id}
                      type="button"
                      onClick={() => setTurnCurveSpan(span.id)}
                      className={`h-9 rounded-lg border text-[11px] font-bold flex flex-col items-center justify-center cursor-pointer ${
                        turnCurveSpan === span.id
                          ? 'bg-amber-400 text-slate-950 border-amber-300'
                          : 'bg-[#121922] border-white/10 text-slate-300 hover:bg-[#19222e]'
                      }`}
                    >
                      <span>{span.label}</span>
                      <span className="text-[9px] font-mono-tabular opacity-80">R{span.radius}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Live Curve Preview + 1-Click Actions */}
            <div className="lg:col-span-5 p-4 rounded-xl bg-[#0b1016] border border-white/10 flex flex-col justify-between gap-4">
              <div className="space-y-3">
                <div className="text-xs font-bold text-white">Curve &amp; Segment Preview</div>
                <div className="h-44 rounded-lg bg-[#121922] border border-white/10 flex flex-col items-center justify-center p-3">
                  <svg viewBox="0 0 180 120" className="w-full h-28" aria-hidden="true">
                    {/* Grid reference lines */}
                    <line x1="20" y1="100" x2="160" y2="100" stroke="#1e293b" strokeWidth="1" />
                    <line x1="90" y1="15" x2="90" y2="105" stroke="#1e293b" strokeWidth="1" />
                    {turnDirection === 'straight' ? (
                      <line
                        x1="90"
                        y1="102"
                        x2="90"
                        y2={Math.max(16, 102 - trackLength * 1.25)}
                        stroke={
                          railType === 'station'
                            ? '#fb7185'
                            : railType === 'depot'
                              ? '#facc15'
                              : '#cbd5e1'
                        }
                        strokeWidth="5"
                        strokeLinecap="square"
                      />
                    ) : (
                      <path
                        d={
                          turnDirection === 'right'
                            ? `M 65 102 L 65 76 Q 65 ${Math.max(18, 74 - activeSpanInfo.radius * 1.3)} ${Math.min(165, 85 + activeSpanInfo.radius * 1.9)} ${Math.max(18, 74 - activeSpanInfo.radius * 1.3)}`
                            : `M 115 102 L 115 76 Q 115 ${Math.max(18, 74 - activeSpanInfo.radius * 1.3)} ${Math.max(15, 95 - activeSpanInfo.radius * 1.9)} ${Math.max(18, 74 - activeSpanInfo.radius * 1.3)}`
                        }
                        fill="none"
                        stroke={
                          railType === 'station'
                            ? '#fb7185'
                            : railType === 'depot'
                              ? '#facc15'
                              : '#cbd5e1'
                        }
                        strokeWidth="5"
                        strokeLinecap="round"
                      />
                    )}
                  </svg>
                  <div className="text-[11px] font-mono-tabular text-slate-300 text-center">
                    {trackLength} blocks ·{' '}
                    {turnDirection === 'straight'
                      ? 'Straight Line'
                      : `${turnDirection === 'left' ? 'Left' : 'Right'} ${activeSpanInfo.label} (R${activeSpanInfo.radius})`}
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Automatically connects to nearby rails within 2 blocks of your feet, builds stone
                  trackbed underneath, and clears 3 blocks of headroom for trains.
                </p>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handlePlaceSegment}
                  className="w-full h-10 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Route className="w-4 h-4" />
                  <span>Place Track Segment Ahead</span>
                </button>

                <button
                  type="button"
                  onClick={handleBuildLongCurvedLoop}
                  className="w-full h-10 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Wrench className="w-4 h-4" />
                  <span>Build Long Curved Metro Loop ({activeSpanInfo.label})</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
