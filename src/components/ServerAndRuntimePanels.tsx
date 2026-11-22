import React, { useEffect, useState } from 'react';
import { MinecraftVersion } from '../data/versions';
import { JavaAccountState } from '../engine/javaAccount';
import {
  buildJavaCliArgs,
  buildServerBundleEntries,
  fetchMojangJavaRuntimes,
  formatBytesMb,
  JavaVersionDetails,
  LiveJavaServerStatus,
  MOJANG_VERSION_MANIFEST_URL,
  MojangRuntimeCatalog,
  pingJavaServer,
  ServerConfigOptions,
} from '../engine/javaManifest';
import { buildZipBlob } from '../utils/zipBuilder';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  FileArchive,
  Globe,
  Plus,
  RefreshCw,
  Server,
  Smartphone,
  Terminal,
  Trash2,
} from 'lucide-react';

interface RealServerPanelProps {
  selectedVersion: MinecraftVersion;
  versionDetails: JavaVersionDetails | null;
  account: JavaAccountState;
  onChangeAccount: (next: JavaAccountState) => void;
  effectiveJavaMajor: number;
}

export const RealServerPanel: React.FC<RealServerPanelProps> = ({
  selectedVersion,
  versionDetails,
  account,
  onChangeAccount,
  effectiveJavaMajor,
}) => {
  const [statuses, setStatuses] = useState<Record<string, LiveJavaServerStatus>>({});
  const [pinging, setPinging] = useState<Record<string, boolean>>({});
  const [newName, setNewName] = useState('');
  const [newAddr, setNewAddr] = useState('');
  const [copiedAddr, setCopiedAddr] = useState<string | null>(null);

  const [serverCfg, setServerCfg] = useState<ServerConfigOptions>({
    motd: `Minecraft ${selectedVersion.id} Server`,
    port: 25565,
    maxPlayers: 20,
    gamemode: 'survival',
    difficulty: 'normal',
    onlineMode: account.mode === 'microsoft',
    pvp: true,
    allowFlight: false,
    viewDistance: 10,
    seed: '',
    acceptEula: true,
    heapMb: 2048,
  });

  useEffect(() => {
    setServerCfg((prev) => ({
      ...prev,
      motd: `Minecraft ${selectedVersion.id} Server`,
    }));
  }, [selectedVersion.id]);

  const pingOne = async (address: string) => {
    setPinging((prev) => ({ ...prev, [address]: true }));
    try {
      const result = await pingJavaServer(address);
      setStatuses((prev) => ({ ...prev, [address]: result }));
    } catch (err) {
      setStatuses((prev) => ({
        ...prev,
        [address]: {
          address,
          online: false,
          host: address,
          port: 25565,
          versionName: 'Unknown',
          protocolVersion: null,
          playersOnline: 0,
          playersMax: 0,
          motd: err instanceof Error ? err.message : 'Unable to reach server',
          icon: null,
          checkedAt: Date.now(),
        },
      }));
    } finally {
      setPinging((prev) => ({ ...prev, [address]: false }));
    }
  };

  const pingAll = () => {
    for (const srv of account.servers) {
      void pingOne(srv.address);
    }
  };

  useEffect(() => {
    pingAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddServer = (e: React.FormEvent) => {
    e.preventDefault();
    const addr = newAddr.trim();
    if (!addr) return;
    const name = newName.trim() || addr;
    const entry = {
      id: `srv-${Date.now()}`,
      name,
      address: addr,
    };
    onChangeAccount({
      ...account,
      servers: [entry, ...account.servers],
    });
    setNewName('');
    setNewAddr('');
    void pingOne(addr);
  };

  const handleRemoveServer = (id: string) => {
    onChangeAccount({
      ...account,
      servers: account.servers.filter((s) => s.id !== id),
    });
  };

  const handleCopyArgs = async (address: string) => {
    const args = buildJavaCliArgs(selectedVersion.id, account, address);
    try {
      await navigator.clipboard.writeText(args);
      setCopiedAddr(address);
      window.setTimeout(() => setCopiedAddr(null), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleDownloadServerBundle = () => {
    const entries = buildServerBundleEntries(selectedVersion.id, versionDetails, serverCfg);
    const zipBlob = buildZipBlob(entries);
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mc-java-server-${selectedVersion.id}-config.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  return (
    <div className="w-full max-w-[1200px] mx-auto my-auto py-3 grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
      {/* Left: Live Minecraft Java Server Status Pinger */}
      <section
        aria-label="Live Minecraft Java Server Status"
        className="lg:col-span-7 bg-[#10161e]/94 border border-white/12 rounded-xl p-4 sm:p-5 flex flex-col max-h-[66vh]"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div>
            <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-400" />
              <span>Real Java Server Monitor</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Live status, MOTD, version, and player counts via mcstatus.io
            </p>
          </div>
          <button
            type="button"
            onClick={pingAll}
            className="h-9 px-3 rounded-lg bg-[#17202b] hover:bg-[#223040] border border-white/12 text-xs font-semibold text-slate-200 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
            <span>Ping All</span>
          </button>
        </div>

        {/* Add Custom Server Form */}
        <form onSubmit={handleAddServer} className="grid grid-cols-1 sm:grid-cols-12 gap-2 py-3 border-b border-white/10">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Server label (optional)"
            className="sm:col-span-4 h-9 px-3 rounded-lg bg-[#0b1016] border border-white/15 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400"
          />
          <input
            type="text"
            value={newAddr}
            onChange={(e) => setNewAddr(e.target.value)}
            placeholder="play.example.net or ip:25565"
            className="sm:col-span-5 h-9 px-3 rounded-lg bg-[#0b1016] border border-white/15 text-xs font-mono-tabular text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400"
          />
          <button
            type="submit"
            className="sm:col-span-3 h-9 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add &amp; Ping</span>
          </button>
        </form>

        {/* Server Rows */}
        <div className="flex-1 overflow-y-auto space-y-2 pt-3 pr-1 launcher-scroll min-h-[200px]">
          {account.servers.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">
              No servers listed. Add any Java Edition server address above to check live status.
            </div>
          ) : (
            account.servers.map((srv) => {
              const st = statuses[srv.address];
              const isLoading = Boolean(pinging[srv.address]);

              return (
                <div
                  key={srv.id}
                  className="p-3 rounded-lg bg-[#151d27]/85 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    {st?.icon ? (
                      <img
                        src={st.icon}
                        alt={srv.name}
                        referrerPolicy="no-referrer"
                        className="w-11 h-11 rounded-md border border-white/10 shrink-0 bg-[#0b1016]"
                        style={{ imageRendering: 'pixelated' }}
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-md border border-white/10 bg-[#0b1016] flex items-center justify-center shrink-0">
                        <Server className="w-5 h-5 text-slate-500" />
                      </div>
                    )}

                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="text-sm font-bold text-white truncate">{srv.name}</span>
                        <span className="text-xs font-mono-tabular text-slate-400">{srv.address}</span>
                        {isLoading ? (
                          <span className="text-[11px] font-mono-tabular text-amber-300">Pinging...</span>
                        ) : st ? (
                          <span
                            className={`text-[11px] font-mono-tabular font-semibold ${
                              st.online ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {st.online
                              ? `Online · ${st.playersOnline.toLocaleString()}/${st.playersMax.toLocaleString()} · ${st.versionName}`
                              : 'Offline'}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-slate-300 line-clamp-2 break-words">
                        {st ? st.motd : 'Click refresh to inspect server status'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => void pingOne(srv.address)}
                      aria-label={`Refresh ${srv.name}`}
                      className="h-8 w-8 rounded-md bg-[#1c2735] hover:bg-[#253345] border border-white/10 text-slate-200 flex items-center justify-center cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCopyArgs(srv.address)}
                      className="h-8 px-2.5 rounded-md bg-[#1c2735] hover:bg-[#253345] border border-white/10 text-xs font-semibold text-slate-200 flex items-center gap-1 cursor-pointer whitespace-nowrap"
                    >
                      {copiedAddr === srv.address ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedAddr === srv.address ? 'Copied' : 'Args'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveServer(srv.id)}
                      aria-label={`Delete ${srv.name}`}
                      className="h-8 w-8 rounded-md bg-[#1c2735] hover:bg-rose-500/25 border border-white/10 text-slate-400 hover:text-rose-300 flex items-center justify-center cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Right: Official Mojang server.jar + server.properties Bundle */}
      <section
        aria-label="Official Mojang Server Setup"
        className="lg:col-span-5 bg-[#10161e]/94 border border-white/12 rounded-xl p-4 sm:p-5 flex flex-col justify-between gap-3.5"
      >
        <div className="space-y-3">
          <div className="pb-2.5 border-b border-white/10">
            <div className="text-xs font-mono-tabular text-amber-300">
              Official Mojang Dedicated Server · Java {effectiveJavaMajor}+
            </div>
            <h2 className="font-display text-lg font-bold text-white mt-0.5">
              server.jar ({selectedVersion.id})
            </h2>
          </div>

          <div className="p-3 rounded-lg bg-[#0b1016] border border-white/10 space-y-1.5 text-xs font-mono-tabular">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400">Binary Size</span>
              <span className="text-white">
                {versionDetails ? formatBytesMb(versionDetails.serverJarSizeBytes) : 'Select synced version'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400">SHA-1</span>
              <span className="text-slate-300 truncate max-w-[200px]">
                {versionDetails?.serverJarSha1 || 'Sync Mojang manifest'}
              </span>
            </div>
            {versionDetails?.serverJarUrl ? (
              <a
                href={versionDetails.serverJarUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 w-full h-9 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-sans font-bold text-xs flex items-center justify-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                <span>Download Official server.jar ({selectedVersion.id})</span>
              </a>
            ) : (
              <a
                href={MOJANG_VERSION_MANIFEST_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 w-full h-9 rounded-lg bg-[#17202b] hover:bg-[#202d3c] border border-white/12 text-amber-300 font-sans font-semibold text-xs flex items-center justify-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open Mojang Piston Meta JSON</span>
              </a>
            )}
          </div>

          {/* server.properties Editor */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="col-span-2">
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">Server MOTD</label>
              <input
                type="text"
                value={serverCfg.motd}
                onChange={(e) => setServerCfg((c) => ({ ...c, motd: e.target.value }))}
                className="w-full h-8 px-2.5 rounded-lg bg-[#0b1016] border border-white/15 text-xs text-white focus:outline-none focus:border-emerald-400"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">Port</label>
              <input
                type="number"
                value={serverCfg.port}
                onChange={(e) => setServerCfg((c) => ({ ...c, port: Number(e.target.value) || 25565 }))}
                className="w-full h-8 px-2.5 rounded-lg bg-[#0b1016] border border-white/15 text-xs font-mono-tabular text-white focus:outline-none focus:border-emerald-400"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">Max Players</label>
              <input
                type="number"
                value={serverCfg.maxPlayers}
                onChange={(e) => setServerCfg((c) => ({ ...c, maxPlayers: Number(e.target.value) || 20 }))}
                className="w-full h-8 px-2.5 rounded-lg bg-[#0b1016] border border-white/15 text-xs font-mono-tabular text-white focus:outline-none focus:border-emerald-400"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">Game Mode</label>
              <select
                value={serverCfg.gamemode}
                onChange={(e) =>
                  setServerCfg((c) => ({
                    ...c,
                    gamemode: e.target.value as ServerConfigOptions['gamemode'],
                  }))
                }
                className="w-full h-8 px-2 rounded-lg bg-[#0b1016] border border-white/15 text-xs text-white"
              >
                <option value="survival">Survival</option>
                <option value="creative">Creative</option>
                <option value="adventure">Adventure</option>
                <option value="spectator">Spectator</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">Auth Mode (online-mode)</label>
              <button
                type="button"
                onClick={() => setServerCfg((c) => ({ ...c, onlineMode: !c.onlineMode }))}
                className={`w-full h-8 px-2 rounded-lg border text-xs font-semibold cursor-pointer ${
                  serverCfg.onlineMode
                    ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                    : 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                }`}
              >
                {serverCfg.onlineMode ? 'Microsoft Only (true)' : 'Offline Allowed (false)'}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={handleDownloadServerBundle}
            className="w-full h-11 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <FileArchive className="w-4 h-4" />
            <span>Download server.properties + start scripts (.zip)</span>
          </button>
          <p className="text-[11px] text-slate-400 text-center">
            Run on Windows/Linux/Termux with Java {effectiveJavaMajor}+ or upload to Aternos/VPS
          </p>
        </div>
      </section>
    </div>
  );
};

interface JavaRuntimeAndroidPanelProps {
  selectedVersion: MinecraftVersion;
  versionDetails: JavaVersionDetails | null;
  effectiveJavaMajor: number;
}

export const JavaRuntimeAndroidPanel: React.FC<JavaRuntimeAndroidPanelProps> = ({
  selectedVersion,
  versionDetails,
  effectiveJavaMajor,
}) => {
  const [runtimes, setRuntimes] = useState<MojangRuntimeCatalog | null>(null);
  const [runtimePlatform, setRuntimePlatform] = useState<'windows-x64' | 'windows-arm64' | 'linux' | 'mac-os-arm64'>('windows-x64');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    void fetchMojangJavaRuntimes()
      .then((catalog) => setRuntimes(catalog))
      .catch(() => setRuntimes(null))
      .finally(() => setLoading(false));
  }, []);

  const entries = runtimes?.[runtimePlatform] ?? [];
  const recommendedComponent = versionDetails?.javaComponent;

  return (
    <div className="w-full max-w-[1200px] mx-auto my-auto py-3 grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
      {/* Left: Mojang Official Java Runtime Manifest */}
      <section
        aria-label="Official Mojang Java Runtimes"
        className="lg:col-span-7 bg-[#10161e]/94 border border-white/12 rounded-xl p-4 sm:p-5 flex flex-col max-h-[66vh]"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
          <div>
            <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-amber-300" />
              <span>Official Mojang Java Runtimes</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              MC {selectedVersion.id} requires Java {effectiveJavaMajor} ({recommendedComponent || 'JRE'})
            </p>
          </div>
          <div className="flex items-center gap-1">
            {(['windows-x64', 'windows-arm64', 'linux', 'mac-os-arm64'] as const).map((plat) => (
              <button
                key={plat}
                type="button"
                onClick={() => setRuntimePlatform(plat)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono-tabular font-semibold cursor-pointer whitespace-nowrap ${
                  runtimePlatform === plat
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-[#17202b] text-slate-300 hover:text-white'
                }`}
              >
                {plat}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pt-3 pr-1 launcher-scroll min-h-[200px]">
          {loading ? (
            <div className="py-10 text-center text-sm text-slate-400">
              Loading official Mojang java-runtime manifest...
            </div>
          ) : entries.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">
              Unable to reach launchermeta.mojang.com while offline.
            </div>
          ) : (
            entries.map((rt) => {
              const isMatch = rt.component === recommendedComponent;
              return (
                <div
                  key={rt.component}
                  className={`p-3 rounded-lg border flex items-center justify-between gap-3 ${
                    isMatch
                      ? 'bg-emerald-500/12 border-emerald-400/60 text-white'
                      : 'bg-[#151d27]/85 border-white/10 text-slate-200'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono-tabular font-bold text-amber-300">
                        {rt.component}
                      </span>
                      {isMatch && (
                        <span className="text-[11px] font-semibold text-emerald-300">
                          Recommended for {selectedVersion.id}
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-mono-tabular text-slate-400 mt-0.5">
                      OpenJDK {rt.versionName} · Released {rt.released.slice(0, 10)}
                    </div>
                  </div>
                  <a
                    href={rt.manifestUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-8 px-3 rounded-md bg-[#1c2735] hover:bg-[#253345] border border-white/12 text-xs font-semibold text-sky-300 flex items-center gap-1.5 shrink-0 whitespace-nowrap"
                  >
                    <span>Manifest</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              );
            })
          )}
        </div>

        <div className="pt-3 mt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-slate-400">Installable Temurin JRE installers:</span>
          <div className="flex items-center gap-3">
            <a
              href={`https://adoptium.net/temurin/releases/?version=${effectiveJavaMajor}&os=windows&arch=x64&package=jre`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-300 hover:text-emerald-200 font-semibold flex items-center gap-1"
            >
              <span>Windows x64 JRE {effectiveJavaMajor}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href={`https://adoptium.net/temurin/releases/?version=${effectiveJavaMajor}&os=linux&arch=aarch64&package=jre`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-300 hover:text-sky-200 font-semibold flex items-center gap-1"
            >
              <span>ARM64 Linux JRE {effectiveJavaMajor}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </section>

      {/* Right: Zalith Launcher & PojavLauncher Android APK Guide */}
      <section
        aria-label="Zalith and PojavLauncher for Android"
        className="lg:col-span-5 bg-[#10161e]/94 border border-white/12 rounded-xl p-4 sm:p-5 flex flex-col justify-between gap-4"
      >
        <div className="space-y-3">
          <div className="pb-2.5 border-b border-white/10">
            <div className="text-xs font-mono-tabular text-emerald-400">
              Native Android JVM + LWJGL + GL4ES/Vulkan
            </div>
            <h2 className="font-display text-lg font-bold text-white mt-0.5 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-emerald-400" />
              <span>Run Real client.jar on Android</span>
            </h2>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Chrome and web apps cannot execute compiled desktop Java <code className="text-amber-300">.jar</code> files or LWJGL OpenGL libraries inside a browser tab. To boot Mojang&apos;s real <code className="text-amber-300">client.jar</code> on your phone without a PC, install a native Android JVM launcher that bundles OpenJDK ARM64:
          </p>

          <div className="space-y-2.5">
            <a
              href="https://github.com/ZalithLauncher/ZalithLauncher/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="block p-3.5 rounded-xl bg-[#17202b] hover:bg-[#1f2b3a] border border-emerald-400/35 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-display text-sm font-bold text-white">Zalith Launcher (Android APK)</span>
                <ExternalLink className="w-4 h-4 text-emerald-400 shrink-0" />
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Modern Pojav-based Android launcher with bundled Java 8/17/21, modpacks, Offline Local accounts &amp; Microsoft Online login.
              </p>
            </a>

            <a
              href="https://github.com/PojavLauncherTeam/PojavLauncher/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="block p-3.5 rounded-xl bg-[#17202b] hover:bg-[#1f2b3a] border border-white/15 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-display text-sm font-bold text-white">PojavLauncher (Android APK)</span>
                <ExternalLink className="w-4 h-4 text-sky-300 shrink-0" />
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Original open-source Minecraft: Java Edition launcher for Android &amp; iOS supporting official 1.0 through latest releases.
              </p>
            </a>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-[#0b1016] border border-white/10 text-[11px] text-slate-300 space-y-1">
          <div className="font-semibold text-white">How to use Offline vs Microsoft inside Zalith / Pojav:</div>
          <div>1. Tap <strong className="text-emerald-300">Offline / Local Account</strong> in Zalith to play Singleplayer or <code className="text-amber-300">online-mode=false</code> servers free.</div>
          <div>2. Or sign in with your <strong className="text-sky-300">Microsoft Account</strong> (that owns Java Edition) to join official servers like Hypixel.</div>
        </div>
      </section>
    </div>
  );
};
