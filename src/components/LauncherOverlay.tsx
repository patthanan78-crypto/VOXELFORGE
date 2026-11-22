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
import { ForgeModId, ModCodeLanguage } from '../data/forgeMods';
import { SHADER_PACKS, ShaderPackId } from '../engine/shaderPacks';
import { SavedWorldState, WorldType } from '../engine/worldStorage';
import {
  computeJavaOfflineUuid,
  JavaAccountState,
  sanitizeJavaUsername,
} from '../engine/javaAccount';
import {
  buildJavaLaunchScript,
  fetchJavaVersionDetails,
  fetchMojangJavaManifest,
  formatBytesMb,
  JavaVersionDetails,
  mojangEntryToMinecraftVersion,
} from '../engine/javaManifest';
import {
  JavaRuntimeAndroidPanel,
  RealServerPanel,
} from './ServerAndRuntimePanels';
import { RustCrateModal } from './RustCrateModal';
import { ModsForgePanel } from './ModsForgePanel';
import { PWAInstallButton } from './PWAInstallButton';
import {
  Monitor,
  Smartphone,
  Play,
  Search,
  Volume2,
  VolumeX,
  FileCode2,
  HardDrive,
  RotateCcw,
  RefreshCw,
  Download,
  UserCheck,
  User,
  ExternalLink,
  Layers,
  Package,
  Server,
  Terminal,
} from 'lucide-react';

type LauncherTab = 'versions' | 'mods' | 'server' | 'runtime';

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
  worldType: WorldType;
  onSelectWorldType: (wt: WorldType) => void;
  seed: string;
  onChangeSeed: (seed: string) => void;
  account: JavaAccountState;
  onChangeAccount: (next: JavaAccountState) => void;
  muted: boolean;
  onToggleMute: () => void;
  savedWorld: SavedWorldState | null;
  onDeleteSave: () => void;
  activeMods: ForgeModId[];
  onChangeActiveMods: (next: ForgeModId[]) => void;
  modCodeLang: ModCodeLanguage;
  onChangeModCodeLang: (lang: ModCodeLanguage) => void;
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
  worldType,
  onSelectWorldType,
  seed,
  onChangeSeed,
  account,
  onChangeAccount,
  muted,
  onToggleMute,
  savedWorld,
  onDeleteSave,
  activeMods,
  onChangeActiveMods,
  modCodeLang,
  onChangeModCodeLang,
  onLaunch,
}) => {
  const [activeTab, setActiveTab] = useState<LauncherTab>('versions');
  const [eraFilter, setEraFilter] = useState<'all' | 'java_official' | VersionEraId>('java_official');
  const [query, setQuery] = useState('');
  const [includeSnapshots, setIncludeSnapshots] = useState(false);
  const [versionsCatalog, setVersionsCatalog] = useState<MinecraftVersion[]>(MINECRAFT_VERSIONS);
  const [mojangSyncState, setMojangSyncState] = useState<'idle' | 'syncing' | 'synced' | 'offline'>('idle');
  const [versionDetails, setVersionDetails] = useState<JavaVersionDetails | null>(null);
  const [crateModalOpen, setCrateModalOpen] = useState(false);
  const [confirmDeleteSave, setConfirmDeleteSave] = useState(false);

  useEffect(() => {
    setConfirmDeleteSave(false);
  }, [selectedVersion.id, seed, worldType]);

  // Sync live Mojang Piston Meta Java manifest on mount
  const syncMojangCatalog = async (withSnapshots = includeSnapshots) => {
    setMojangSyncState('syncing');
    try {
      const manifest = await fetchMojangJavaManifest();
      const baseMap = new Map(MINECRAFT_VERSIONS.map((v) => [v.id, v]));
      const officialList: MinecraftVersion[] = [];
      const seen = new Set<string>();

      for (const entry of manifest.versions) {
        if (entry.type !== 'release' && (!withSnapshots || entry.type !== 'snapshot')) {
          continue;
        }
        const merged = mojangEntryToMinecraftVersion(entry, baseMap.get(entry.id));
        officialList.push(merged);
        seen.add(entry.id);
      }

      for (const localVer of MINECRAFT_VERSIONS) {
        if (!seen.has(localVer.id)) {
          officialList.push(localVer);
        }
      }

      setVersionsCatalog(officialList);
      const updatedSelected = officialList.find((v) => v.id === selectedVersion.id);
      if (updatedSelected && updatedSelected.manifestUrl !== selectedVersion.manifestUrl) {
        onSelectVersion(updatedSelected);
      }
      setMojangSyncState('synced');
    } catch {
      setMojangSyncState('offline');
    }
  };

  useEffect(() => {
    void syncMojangCatalog(includeSnapshots);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeSnapshots]);

  // Fetch real Mojang client.jar, server.jar & Java version details for selected version
  useEffect(() => {
    if (!selectedVersion.manifestUrl) {
      setVersionDetails(null);
      return;
    }
    let cancelled = false;
    void fetchJavaVersionDetails(selectedVersion.manifestUrl)
      .then((details) => {
        if (!cancelled) setVersionDetails(details);
      })
      .catch(() => {
        if (!cancelled) setVersionDetails(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedVersion.manifestUrl]);

  const filteredVersions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return versionsCatalog.filter((v) => {
      if (eraFilter === 'java_official') {
        if (!v.isOfficialJava) return false;
      } else if (eraFilter !== 'all' && v.era !== eraFilter) {
        return false;
      }
      if (q && !v.id.toLowerCase().includes(q) && !v.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [versionsCatalog, eraFilter, query]);

  const rustRuntime = useMemo(
    () => getRustRuntimeSummary(selectedVersion, platform, performance),
    [selectedVersion, platform, performance],
  );

  const effectiveJavaMajor = versionDetails?.javaMajor ?? rustRuntime.javaVersion;
  const normalizedOfflineName = sanitizeJavaUsername(account.offlineUsername);
  const offlineUuid = useMemo(
    () => computeJavaOfflineUuid(normalizedOfflineName),
    [normalizedOfflineName],
  );

  const handleDownloadLaunchScript = () => {
    const script = buildJavaLaunchScript(selectedVersion, platform, account, versionDetails);
    const blob = new Blob([script.content], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = script.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  return (
    <>
      <div className="fixed inset-0 z-20 flex flex-col justify-between p-4 sm:p-6 md:p-7 bg-[#090d12]/88 overflow-y-auto launcher-scroll">
        {/* Top Bar: Brand + Workspace Navigation + Actions */}
        <header className="w-full max-w-[1200px] mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-3 shrink-0 pb-3 border-b border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            <svg
              width="34"
              height="34"
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
              <h1 className="font-display text-lg sm:text-2xl font-extrabold tracking-tight text-white leading-none truncate">
                VoxelForge Mojang Hub
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-1 truncate">
                Official Mojang client.jar · server.jar · Java Runtime · Live Server Monitor
              </p>
            </div>
          </div>

          {/* Primary Zalith/Pojav Style Navigation Tabs */}
          <nav
            aria-label="Launcher Sections"
            className="flex items-center gap-1 p-1 rounded-xl bg-[#10161e] border border-white/12 overflow-x-auto launcher-scroll shrink-0"
          >
            <button
              type="button"
              onClick={() => setActiveTab('versions')}
              className={`h-9 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                activeTab === 'versions'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-300 hover:text-white hover:bg-[#192330]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Versions &amp; client.jar</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('mods')}
              className={`h-9 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                activeTab === 'mods'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-300 hover:text-white hover:bg-[#192330]'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Mods &amp; Forge ({activeMods.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('server')}
              className={`h-9 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                activeTab === 'server'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-300 hover:text-white hover:bg-[#192330]'
              }`}
            >
              <Server className="w-3.5 h-3.5" />
              <span>Server &amp; Live Ping</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('runtime')}
              className={`h-9 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                activeTab === 'runtime'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-300 hover:text-white hover:bg-[#192330]'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Java Runtime &amp; Android</span>
            </button>
          </nav>

          {/* Right Tools */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <PWAInstallButton />
            <button
              type="button"
              onClick={() => setCrateModalOpen(true)}
              className="h-9 px-3 rounded-lg bg-[#141b24] border border-amber-400/35 text-amber-300 hover:bg-[#1e2835] transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
            >
              <FileCode2 className="w-3.5 h-3.5 shrink-0" />
              <span>Rust &amp; APK Source</span>
            </button>
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              className="h-9 w-9 rounded-lg bg-[#141b24] border border-white/15 text-slate-200 hover:bg-[#1e2835] flex items-center justify-center shrink-0 cursor-pointer"
            >
              {muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            </button>
          </div>
        </header>

        {/* Active Tab Workspace */}
        {activeTab === 'versions' && (
          <div className="w-full max-w-[1200px] mx-auto my-auto py-3 grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* Left Column: Official Mojang Version Manifest Browser */}
            <section
              aria-label="Official Mojang Java Version Catalog"
              className="lg:col-span-7 bg-[#10161e]/94 border border-white/12 rounded-xl p-4 sm:p-5 flex flex-col max-h-[58vh] lg:max-h-[68vh]"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="font-display text-lg font-bold text-white">Mojang Java Versions</h2>
                    <span className="text-[11px] font-mono-tabular text-slate-400">
                      {mojangSyncState === 'syncing'
                        ? 'Fetching piston-meta.mojang.com...'
                        : mojangSyncState === 'synced'
                          ? `${versionsCatalog.length} Mojang versions`
                          : 'Offline catalog'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Select any official Mojang release or snapshot for client.jar, server.jar &amp; Java runtime info
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="relative w-full sm:w-44">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="26.3, 1.21.4, 1.8.9..."
                      className="w-full h-9 pl-9 pr-3 rounded-lg bg-[#0b1016] border border-white/15 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => void syncMojangCatalog(includeSnapshots)}
                    title="Refresh Mojang Version Manifest"
                    aria-label="Refresh Mojang Version Manifest"
                    className="h-9 w-9 rounded-lg bg-[#17202b] hover:bg-[#223040] border border-white/12 text-slate-200 flex items-center justify-center shrink-0 cursor-pointer"
                  >
                    <RefreshCw className={`w-4 h-4 ${mojangSyncState === 'syncing' ? 'animate-spin text-emerald-400' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Era Filter Tabs + Snapshots */}
              <div className="flex items-center justify-between gap-2 py-3 shrink-0">
                <div className="flex items-center gap-1.5 overflow-x-auto launcher-scroll">
                  <button
                    type="button"
                    onClick={() => setEraFilter('java_official')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                      eraFilter === 'java_official'
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-[#17202b] text-amber-200 hover:bg-[#202c3b]'
                    }`}
                  >
                    Mojang Official
                  </button>
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

                <button
                  type="button"
                  onClick={() => setIncludeSnapshots((s) => !s)}
                  className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                    includeSnapshots
                      ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                      : 'bg-[#17202b] border-white/10 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {includeSnapshots ? 'Snapshots: On' : 'Snapshots: Off'}
                </button>
              </div>

              {/* Scrollable Version List */}
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 launcher-scroll min-h-[180px]">
                {filteredVersions.length === 0 ? (
                  <div className="py-10 text-center text-sm text-slate-400">
                    No versions match "{query}".
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
                            <span className="text-sm font-semibold truncate">
                              {ver.name.replace(`${ver.id} — `, '')}
                            </span>
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

            {/* Right Column: Official Mojang Downloads, Account & Honest Browser Preview */}
            <section
              aria-label="Official Downloads and Account Profile"
              className="lg:col-span-5 bg-[#10161e]/94 border border-white/12 rounded-xl p-4 sm:p-5 flex flex-col justify-between gap-3.5"
            >
              <div className="space-y-3.5">
                <div className="pb-2.5 border-b border-white/10">
                  <div className="text-xs text-slate-400 font-mono-tabular">
                    {versionDetails?.javaComponent || `Java ${effectiveJavaMajor}`} · {selectedVersion.year} ·{' '}
                    {versionDetails ? `${versionDetails.libraryCount} libraries` : rustRuntime.targetTriple}
                  </div>
                  <h2 className="font-display text-xl font-bold text-white mt-0.5 truncate">
                    Mojang {selectedVersion.id}
                  </h2>
                </div>

                {/* Official client.jar & server.jar Direct Download Actions */}
                <div className="p-3 rounded-lg bg-[#0b1016] border border-white/10 space-y-2">
                  <div className="text-xs font-semibold text-amber-300">
                    Official Mojang Binaries (piston-data.mojang.com)
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {versionDetails?.clientJarUrl ? (
                      <a
                        href={versionDetails.clientJarUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-10 px-2.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 whitespace-nowrap"
                      >
                        <Download className="w-3.5 h-3.5 shrink-0" />
                        <span>client.jar ({formatBytesMb(versionDetails.clientJarSizeBytes)})</span>
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void syncMojangCatalog(includeSnapshots)}
                        className="h-10 px-2.5 rounded-lg bg-[#17202b] border border-white/12 text-amber-200 text-xs font-semibold cursor-pointer"
                      >
                        Sync client.jar
                      </button>
                    )}

                    {versionDetails?.serverJarUrl ? (
                      <a
                        href={versionDetails.serverJarUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-10 px-2.5 rounded-lg bg-[#17202b] hover:bg-[#223040] border border-white/15 text-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5 whitespace-nowrap"
                      >
                        <Download className="w-3.5 h-3.5 shrink-0" />
                        <span>server.jar ({formatBytesMb(versionDetails.serverJarSizeBytes)})</span>
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveTab('server')}
                        className="h-10 px-2.5 rounded-lg bg-[#17202b] border border-white/12 text-slate-300 text-xs font-semibold cursor-pointer"
                      >
                        Server Setup
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-0.5 text-[11px] font-mono-tabular text-slate-400">
                    <span className="truncate">
                      Requires Java {effectiveJavaMajor} · Asset Index {versionDetails?.assetIndexId || selectedVersion.id}
                    </span>
                    <button
                      type="button"
                      onClick={handleDownloadLaunchScript}
                      className="text-emerald-300 hover:text-emerald-200 font-sans font-semibold flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      <span>{platform === 'windows' ? '.bat' : '.sh'}</span>
                    </button>
                  </div>
                </div>

                {/* Account Mode (Offline Free vs Microsoft Online) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300">JVM Launch Account</label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onSelectPlatform('windows')}
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                          platform === 'windows' ? 'bg-slate-700 text-white' : 'text-slate-400'
                        }`}
                      >
                        <Monitor className="w-3 h-3 inline mr-1" />PC
                      </button>
                      <button
                        type="button"
                        onClick={() => onSelectPlatform('android')}
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                          platform === 'android' ? 'bg-slate-700 text-white' : 'text-slate-400'
                        }`}
                      >
                        <Smartphone className="w-3 h-3 inline mr-1" />Android
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#0b1016] rounded-lg border border-white/10">
                    <button
                      type="button"
                      onClick={() => onChangeAccount({ ...account, mode: 'offline' })}
                      className={`h-8 px-2 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                        account.mode === 'offline' ? 'bg-emerald-500 text-slate-950' : 'text-slate-300'
                      }`}
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>Offline (Free)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeAccount({ ...account, mode: 'microsoft' })}
                      className={`h-8 px-2 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                        account.mode === 'microsoft' ? 'bg-sky-400 text-slate-950' : 'text-slate-300'
                      }`}
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Microsoft Account</span>
                    </button>
                  </div>

                  {account.mode === 'offline' ? (
                    <div className="p-2.5 rounded-lg bg-[#0b1016] border border-white/10 space-y-1">
                      <input
                        type="text"
                        maxLength={16}
                        value={account.offlineUsername}
                        onChange={(e) => onChangeAccount({ ...account, offlineUsername: e.target.value })}
                        placeholder="Offline username (Player)"
                        aria-label="Offline Player Name"
                        className="w-full h-8 px-2.5 rounded bg-[#141c26] border border-white/15 text-xs font-mono-tabular text-white focus:outline-none focus:border-emerald-400"
                      />
                      <div className="text-[11px] font-mono-tabular text-slate-400 truncate">
                        Offline UUID v3: {offlineUuid}
                      </div>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-lg bg-[#0b1016] border border-sky-400/25 space-y-1.5">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={account.msaGamertag}
                          onChange={(e) => onChangeAccount({ ...account, msaGamertag: e.target.value })}
                          placeholder="Java Gamertag"
                          className="h-8 px-2.5 rounded bg-[#141c26] border border-white/15 text-xs font-mono-tabular text-white"
                        />
                        <input
                          type="text"
                          value={account.azureClientId}
                          onChange={(e) => onChangeAccount({ ...account, azureClientId: e.target.value })}
                          placeholder="Azure Client ID"
                          className="h-8 px-2.5 rounded bg-[#141c26] border border-white/15 text-xs font-mono-tabular text-white"
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-300">
                        <span>Uses Microsoft Device Code in Zalith / Rust</span>
                        <a
                          href="https://www.minecraft.net/en-us/login"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sky-300 hover:text-sky-200 font-semibold flex items-center gap-1"
                        >
                          <span>MS Login</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                {/* Android Native Launcher + Mods Quick Links */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('mods')}
                    className="w-full px-3 py-2 rounded-lg bg-[#17202b] hover:bg-[#1f2b3a] border border-amber-400/25 text-left flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-amber-300 truncate">
                        Drin Anchors &amp; Forge Mods
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {activeMods.length} active · {modCodeLang === 'java' ? 'Java Code (Default)' : 'Rust Mod Code'}
                      </div>
                    </div>
                    <Package className="w-4 h-4 text-amber-300 shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('runtime')}
                    className="w-full px-3 py-2 rounded-lg bg-[#17202b] hover:bg-[#1f2b3a] border border-white/12 text-left flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">
                        Android JVM &amp; Runtime
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        Zalith / Pojav APK + Java {effectiveJavaMajor}
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-emerald-400 shrink-0" />
                  </button>
                </div>
              </div>

              {/* Custom WebGL Sandbox Preview (Clearly labeled, non-deceptive) */}
              <div className="space-y-2 pt-2 border-t border-white/10">
                <div className="grid grid-cols-2 gap-2">
                  <select
                    aria-label="Preview Shader Pack"
                    value={shaderPack}
                    onChange={(e) => onSelectShaderPack(e.target.value as ShaderPackId)}
                    className="h-8 px-2 rounded-lg bg-[#0b1016] border border-white/15 text-[11px] font-semibold text-slate-200 cursor-pointer"
                  >
                    {SHADER_PACKS.map((pack) => (
                      <option key={pack.id} value={pack.id}>
                        Shader: {pack.name}
                      </option>
                    ))}
                  </select>
                  <div className="grid grid-cols-3 gap-1">
                    {(['ultra_fps', 'balanced', 'vibrant'] as PerformancePreset[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => onSelectPerformance(p)}
                        className={`h-8 rounded-lg border text-[10px] font-semibold cursor-pointer ${
                          performance === p
                            ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                            : 'bg-[#0b1016] border-white/10 text-slate-400'
                        }`}
                      >
                        {p === 'ultra_fps' ? 'Fast' : p === 'balanced' ? 'Bal' : 'High'}
                      </button>
                    ))}
                  </div>
                </div>

                {savedWorld && (
                  <div className="px-2.5 py-1.5 rounded-lg bg-[#0b1016] border border-emerald-400/20 flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-emerald-300 font-mono-tabular truncate">
                      <HardDrive className="w-3.5 h-3.5 inline mr-1.5" />
                      Sandbox save: {Object.keys(savedWorld.blockEdits).length} blocks edited
                    </span>
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
                      className="text-rose-300 hover:text-rose-200 font-semibold cursor-pointer shrink-0"
                    >
                      <RotateCcw className="w-3 h-3 inline mr-1" />
                      {confirmDeleteSave ? 'Confirm?' : 'Reset'}
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectWorldType(worldType === 'superflat' ? 'normal' : 'superflat')}
                    className="h-10 px-2 rounded-xl bg-[#17202b] hover:bg-[#202d3c] border border-white/12 text-[11px] font-semibold text-emerald-300 cursor-pointer truncate"
                  >
                    {worldType === 'superflat' ? 'Superflat + Village' : 'Normal Hills'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectGameMode(gameMode === 'creative' ? 'survival' : 'creative')}
                    className="h-10 px-2 rounded-xl bg-[#17202b] hover:bg-[#202d3c] border border-white/12 text-[11px] font-semibold text-slate-200 cursor-pointer truncate"
                  >
                    Mode: {gameMode === 'creative' ? 'Creative' : 'Survival'}
                  </button>
                  <input
                    type="text"
                    value={seed}
                    onChange={(e) => onChangeSeed(e.target.value)}
                    placeholder="Seed"
                    aria-label="WebGL Sandbox Seed"
                    className="h-10 px-2.5 rounded-xl bg-[#0b1016] border border-white/15 text-xs font-mono-tabular text-white"
                  />
                </div>

                <button
                  type="button"
                  onClick={onLaunch}
                  className="w-full h-11 rounded-xl bg-[#182430] hover:bg-[#223344] border border-emerald-400/40 text-white font-display font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Play className="w-4 h-4 text-emerald-400 fill-emerald-400" />
                  <span>Open Browser WebGL Sandbox (Custom Demo)</span>
                </button>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'mods' && (
          <ModsForgePanel
            selectedVersion={selectedVersion}
            activeMods={activeMods}
            onChangeActiveMods={onChangeActiveMods}
            modCodeLang={modCodeLang}
            onChangeModCodeLang={onChangeModCodeLang}
            onEnterGame={onLaunch}
          />
        )}

        {activeTab === 'server' && (
          <RealServerPanel
            selectedVersion={selectedVersion}
            versionDetails={versionDetails}
            account={account}
            onChangeAccount={onChangeAccount}
            effectiveJavaMajor={effectiveJavaMajor}
          />
        )}

        {activeTab === 'runtime' && (
          <JavaRuntimeAndroidPanel
            selectedVersion={selectedVersion}
            versionDetails={versionDetails}
            effectiveJavaMajor={effectiveJavaMajor}
          />
        )}

        {/* Quiet Footer */}
        <footer className="w-full max-w-[1200px] mx-auto text-center text-[11px] text-slate-400 shrink-0 pt-2">
          Mojang Piston Meta &amp; Java Runtime APIs · Live Server Status via mcstatus.io · Browser WebGL Sandbox is a custom 3D preview (use Zalith / PojavLauncher or desktop Java to run official .jar binaries)
        </footer>
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
