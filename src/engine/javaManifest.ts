// Real Official Mojang Piston Meta, Java Runtime Manifest, Server.jar & Live Server Status Pinger

import { MinecraftVersion, PlatformTarget, VersionEraId } from '../data/versions';
import { computeJavaOfflineUuid, JavaAccountState, sanitizeJavaUsername } from './javaAccount';
import { ZipEntryInput } from '../utils/zipBuilder';

export const MOJANG_VERSION_MANIFEST_URL =
  'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';

export const MOJANG_JAVA_RUNTIME_URL =
  'https://launchermeta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json';

export interface MojangManifestVersion {
  id: string;
  type: 'release' | 'snapshot' | 'old_beta' | 'old_alpha';
  url: string;
  time: string;
  releaseTime: string;
  sha1: string;
}

export interface MojangManifestResponse {
  latest: {
    release: string;
    snapshot: string;
  };
  versions: MojangManifestVersion[];
}

export interface JavaVersionDetails {
  id: string;
  type: string;
  mainClass: string;
  javaMajor: number;
  javaComponent: string;
  assetIndexId: string;
  assetIndexUrl: string;
  clientJarUrl: string;
  clientJarSizeBytes: number;
  clientJarSha1: string;
  serverJarUrl: string;
  serverJarSizeBytes: number;
  serverJarSha1: string;
  libraryCount: number;
}

export interface MojangRuntimeEntry {
  component: string;
  versionName: string;
  released: string;
  manifestUrl: string;
  manifestSha1: string;
}

export type MojangRuntimeCatalog = Record<string, MojangRuntimeEntry[]>;

export interface LiveJavaServerStatus {
  address: string;
  online: boolean;
  host: string;
  port: number;
  versionName: string;
  protocolVersion: number | null;
  playersOnline: number;
  playersMax: number;
  motd: string;
  icon: string | null;
  checkedAt: number;
  error?: string;
}

export interface ServerConfigOptions {
  motd: string;
  port: number;
  maxPlayers: number;
  gamemode: 'survival' | 'creative' | 'adventure' | 'spectator';
  difficulty: 'peaceful' | 'easy' | 'normal' | 'hard';
  onlineMode: boolean;
  pvp: boolean;
  allowFlight: boolean;
  viewDistance: number;
  seed: string;
  acceptEula: boolean;
  heapMb: number;
}

const ERA_PRESETS: Record<
  VersionEraId,
  Pick<
    MinecraftVersion,
    | 'era'
    | 'eraLabel'
    | 'skyColor'
    | 'fogColor'
    | 'grassTint'
    | 'waterColor'
    | 'waterOpacity'
    | 'terrainAmplitude'
    | 'baseHeight'
    | 'hasCherryTrees'
    | 'hasDeepslate'
    | 'hasCopper'
    | 'classicAlphaShade'
  >
> = {
  nextgen: {
    era: 'nextgen',
    eraLabel: 'Java Next-Gen',
    skyColor: '#6bb8ff',
    fogColor: '#98ceff',
    grassTint: '#6fc24e',
    waterColor: '#2589d8',
    waterOpacity: 0.72,
    terrainAmplitude: 18,
    baseHeight: 22,
    hasCherryTrees: true,
    hasDeepslate: true,
    hasCopper: true,
    classicAlphaShade: false,
  },
  caves_trials: {
    era: 'caves_trials',
    eraLabel: 'Java Caves & Trials',
    skyColor: '#78bfff',
    fogColor: '#a6d5ff',
    grassTint: '#66b649',
    waterColor: '#2b8cd6',
    waterOpacity: 0.75,
    terrainAmplitude: 19,
    baseHeight: 22,
    hasCherryTrees: true,
    hasDeepslate: true,
    hasCopper: true,
    classicAlphaShade: false,
  },
  aquatic_nether: {
    era: 'aquatic_nether',
    eraLabel: 'Java Aquatic & Nether',
    skyColor: '#7bc3ff',
    fogColor: '#aedbff',
    grassTint: '#68b74a',
    waterColor: '#2696e3',
    waterOpacity: 0.68,
    terrainAmplitude: 14,
    baseHeight: 20,
    hasCherryTrees: false,
    hasDeepslate: false,
    hasCopper: false,
    classicAlphaShade: false,
  },
  modern_classic: {
    era: 'modern_classic',
    eraLabel: 'Java Modern Classic',
    skyColor: '#83c8ff',
    fogColor: '#b7deff',
    grassTint: '#6bbb4b',
    waterColor: '#2e6cdb',
    waterOpacity: 0.79,
    terrainAmplitude: 13,
    baseHeight: 20,
    hasCherryTrees: false,
    hasDeepslate: false,
    hasCopper: false,
    classicAlphaShade: false,
  },
  golden_alpha: {
    era: 'golden_alpha',
    eraLabel: 'Java Classic Era',
    skyColor: '#91d5ff',
    fogColor: '#c8eaff',
    grassTint: '#7fd64d',
    waterColor: '#2258cc',
    waterOpacity: 0.84,
    terrainAmplitude: 11,
    baseHeight: 19,
    hasCherryTrees: false,
    hasDeepslate: false,
    hasCopper: false,
    classicAlphaShade: true,
  },
};

function inferEraFromMojangEntry(id: string, year: number): VersionEraId {
  if (year >= 2024 || id.startsWith('26.') || id.startsWith('25.')) return 'nextgen';
  if (year >= 2021) return 'caves_trials';
  if (year >= 2018) return 'aquatic_nether';
  if (year >= 2015) return 'modern_classic';
  return 'golden_alpha';
}

export function mojangEntryToMinecraftVersion(
  entry: MojangManifestVersion,
  existing?: MinecraftVersion,
): MinecraftVersion {
  const year = Number(entry.releaseTime.slice(0, 4)) || 2026;
  const era = existing?.era ?? inferEraFromMojangEntry(entry.id, year);
  const preset = ERA_PRESETS[era];
  const typeTag = entry.type === 'snapshot' ? 'Java Snapshot' : 'Official Java';

  if (existing) {
    return {
      ...existing,
      manifestUrl: entry.url,
      releaseType: entry.type,
      isOfficialJava: true,
    };
  }

  return {
    id: entry.id,
    name: `${entry.id} — ${typeTag}`,
    year,
    summary: `Official Mojang Java Edition ${entry.type} (${entry.releaseTime.slice(0, 10)}) via Piston Meta.`,
    ...preset,
    manifestUrl: entry.url,
    releaseType: entry.type,
    isOfficialJava: true,
  };
}

let cachedManifest: MojangManifestResponse | null = null;
const detailsCache = new Map<string, JavaVersionDetails>();
let cachedRuntimes: MojangRuntimeCatalog | null = null;

export async function fetchMojangJavaManifest(): Promise<MojangManifestResponse> {
  if (cachedManifest) return cachedManifest;
  const res = await fetch(MOJANG_VERSION_MANIFEST_URL);
  if (!res.ok) {
    throw new Error(`Mojang manifest returned HTTP ${res.status}`);
  }
  const data = (await res.json()) as MojangManifestResponse;
  cachedManifest = data;
  return data;
}

export async function fetchJavaVersionDetails(
  manifestUrl: string,
): Promise<JavaVersionDetails> {
  const cached = detailsCache.get(manifestUrl);
  if (cached) return cached;

  const res = await fetch(manifestUrl);
  if (!res.ok) {
    throw new Error(`Version metadata returned HTTP ${res.status}`);
  }
  const raw = (await res.json()) as {
    id: string;
    type: string;
    mainClass?: string;
    javaVersion?: { component?: string; majorVersion?: number };
    assetIndex?: { id?: string; url?: string };
    downloads?: {
      client?: { url?: string; size?: number; sha1?: string };
      server?: { url?: string; size?: number; sha1?: string };
    };
    libraries?: unknown[];
  };

  const details: JavaVersionDetails = {
    id: raw.id,
    type: raw.type,
    mainClass: raw.mainClass || 'net.minecraft.client.main.Main',
    javaMajor: raw.javaVersion?.majorVersion || 21,
    javaComponent: raw.javaVersion?.component || 'java-runtime-delta',
    assetIndexId: raw.assetIndex?.id || raw.id,
    assetIndexUrl: raw.assetIndex?.url || '',
    clientJarUrl: raw.downloads?.client?.url || '',
    clientJarSizeBytes: raw.downloads?.client?.size || 0,
    clientJarSha1: raw.downloads?.client?.sha1 || '',
    serverJarUrl: raw.downloads?.server?.url || '',
    serverJarSizeBytes: raw.downloads?.server?.size || 0,
    serverJarSha1: raw.downloads?.server?.sha1 || '',
    libraryCount: Array.isArray(raw.libraries) ? raw.libraries.length : 0,
  };

  detailsCache.set(manifestUrl, details);
  return details;
}

export async function fetchMojangJavaRuntimes(): Promise<MojangRuntimeCatalog> {
  if (cachedRuntimes) return cachedRuntimes;
  const res = await fetch(MOJANG_JAVA_RUNTIME_URL);
  if (!res.ok) {
    throw new Error(`Mojang runtime manifest returned HTTP ${res.status}`);
  }
  const raw = (await res.json()) as Record<
    string,
    Record<
      string,
      Array<{
        manifest?: { sha1?: string; url?: string };
        version?: { name?: string; released?: string };
      }>
    >
  >;

  const catalog: MojangRuntimeCatalog = {};
  for (const [platformKey, components] of Object.entries(raw)) {
    const entries: MojangRuntimeEntry[] = [];
    for (const [component, list] of Object.entries(components)) {
      const first = list?.[0];
      if (!first?.manifest?.url || !first?.version?.name) continue;
      entries.push({
        component,
        versionName: first.version.name,
        released: first.version.released || '',
        manifestUrl: first.manifest.url,
        manifestSha1: first.manifest.sha1 || '',
      });
    }
    if (entries.length > 0) {
      catalog[platformKey] = entries;
    }
  }

  cachedRuntimes = catalog;
  return catalog;
}

export async function pingJavaServer(address: string): Promise<LiveJavaServerStatus> {
  const cleanAddr = address.trim();
  if (!cleanAddr) {
    throw new Error('Enter a Minecraft Java server address (e.g. mc.hypixel.net)');
  }

  const res = await fetch(`https://api.mcstatus.io/v2/status/java/${encodeURIComponent(cleanAddr)}`);
  if (!res.ok) {
    throw new Error(`Server ping HTTP ${res.status}`);
  }
  const raw = (await res.json()) as {
    online?: boolean;
    host?: string;
    port?: number;
    version?: { name_clean?: string; name_raw?: string; protocol?: number };
    players?: { online?: number; max?: number };
    motd?: { clean?: string; raw?: string };
    icon?: string | null;
  };

  return {
    address: cleanAddr,
    online: Boolean(raw.online),
    host: raw.host || cleanAddr.split(':')[0] || cleanAddr,
    port: typeof raw.port === 'number' ? raw.port : 25565,
    versionName: raw.version?.name_clean || raw.version?.name_raw || 'Unknown',
    protocolVersion: typeof raw.version?.protocol === 'number' ? raw.version.protocol : null,
    playersOnline: raw.players?.online ?? 0,
    playersMax: raw.players?.max ?? 0,
    motd: (raw.motd?.clean || '').trim() || (raw.online ? 'Minecraft Server' : 'Offline / Unreachable'),
    icon: raw.icon || null,
    checkedAt: Date.now(),
  };
}

export function formatBytesMb(bytes: number): string {
  if (!bytes || bytes <= 0) return 'N/A';
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function buildJavaCliArgs(
  versionId: string,
  account: JavaAccountState,
  serverAddress?: string,
): string {
  const player =
    account.mode === 'offline'
      ? sanitizeJavaUsername(account.offlineUsername)
      : account.msaGamertag.trim() || 'MicrosoftPlayer';
  const uuid =
    account.mode === 'offline'
      ? computeJavaOfflineUuid(player)
      : '<MSA_PROFILE_UUID>';
  const token = account.mode === 'offline' ? '0' : '<MSA_MINECRAFT_TOKEN>';
  const userType = account.mode === 'offline' ? 'legacy' : 'msa';

  let serverFlags = '';
  if (serverAddress && serverAddress.trim()) {
    const [host, port] = serverAddress.trim().split(':');
    if (host) {
      serverFlags = ` --server ${host}${port ? ` --port ${port}` : ''}`;
    }
  }

  return `--username ${player} --version ${versionId} --uuid ${uuid} --accessToken ${token} --userType ${userType}${serverFlags}`;
}

export function buildJavaLaunchScript(
  version: MinecraftVersion,
  platform: PlatformTarget,
  account: JavaAccountState,
  details: JavaVersionDetails | null,
  serverAddress?: string,
): { filename: string; content: string } {
  const mainClass = details?.mainClass || 'net.minecraft.client.main.Main';
  const assetIndex = details?.assetIndexId || version.id;
  const args = buildJavaCliArgs(version.id, account, serverAddress);
  const clientUrl = details?.clientJarUrl || MOJANG_VERSION_MANIFEST_URL;

  if (platform === 'windows') {
    return {
      filename: `launch-mc-java-${version.id}.bat`,
      content: `@echo off
REM Minecraft Java Edition ${version.id} (${account.mode === 'offline' ? 'Offline Free' : 'Microsoft Online'})
REM Official Mojang client.jar: ${clientUrl}
set MC_DIR=%APPDATA%\\.minecraft
java -Xms2048M -Xmx4096M -XX:+UseG1GC -cp "%MC_DIR%\\versions\\${version.id}\\${version.id}.jar;%MC_DIR%\\libraries\\*" ${mainClass} --gameDir "%MC_DIR%" --assetsDir "%MC_DIR%\\assets" --assetIndex ${assetIndex} ${args}
pause
`,
    };
  }

  return {
    filename: `launch-mc-java-${version.id}-android.sh`,
    content: `#!/usr/bin/env bash
# Minecraft Java Edition ${version.id} for Android Termux/JVM (${account.mode === 'offline' ? 'Offline Free' : 'Microsoft Online'})
# Official Mojang client.jar: ${clientUrl}
MC_DIR="$HOME/.minecraft"
java -Xms1024M -Xmx2560M -XX:+UseG1GC -cp "$MC_DIR/versions/${version.id}/${version.id}.jar:$MC_DIR/libraries/*" ${mainClass} --gameDir "$MC_DIR" --assetsDir "$MC_DIR/assets" --assetIndex ${assetIndex} ${args}
`,
  };
}

export function buildServerBundleEntries(
  versionId: string,
  details: JavaVersionDetails | null,
  cfg: ServerConfigOptions,
): ZipEntryInput[] {
  const serverJarUrl = details?.serverJarUrl || MOJANG_VERSION_MANIFEST_URL;
  const javaMajor = details?.javaMajor || 21;

  const properties = `# Minecraft Java Edition Server Properties (${versionId})
motd=${cfg.motd}
server-port=${cfg.port}
max-players=${cfg.maxPlayers}
gamemode=${cfg.gamemode}
difficulty=${cfg.difficulty}
online-mode=${cfg.onlineMode}
pvp=${cfg.pvp}
allow-flight=${cfg.allowFlight}
view-distance=${cfg.viewDistance}
level-seed=${cfg.seed}
enable-command-block=true
white-list=false
`;

  const eula = `# Mojang Minecraft EULA (https://aka.ms/MinecraftEULA)
eula=${cfg.acceptEula ? 'true' : 'false'}
`;

  const startBat = `@echo off
REM Requires Java ${javaMajor}+ and official Mojang server.jar for ${versionId}
REM Download server.jar: ${serverJarUrl}
java -Xms${Math.max(512, Math.floor(cfg.heapMb / 2))}M -Xmx${cfg.heapMb}M -XX:+UseG1GC -jar server.jar nogui
pause
`;

  const startSh = `#!/usr/bin/env bash
# Requires Java ${javaMajor}+ (Termux / Linux / macOS) and official server.jar for ${versionId}
if [ ! -f server.jar ]; then
  echo "Downloading official Mojang server.jar for ${versionId}..."
  curl -L -o server.jar "${serverJarUrl}"
fi
java -Xms${Math.max(512, Math.floor(cfg.heapMb / 2))}M -Xmx${cfg.heapMb}M -XX:+UseG1GC -jar server.jar nogui
`;

  return [
    { path: 'server.properties', content: properties },
    { path: 'eula.txt', content: eula },
    { path: 'start-server.bat', content: startBat },
    { path: 'start-server.sh', content: startSh },
  ];
}
