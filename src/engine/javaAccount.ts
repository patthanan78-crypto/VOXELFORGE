// Real Minecraft Java Edition Account Manager (Offline Free UUID v3 + Microsoft Online Profile Config)

export type JavaAccountMode = 'offline' | 'microsoft';

export interface JavaServerEntry {
  id: string;
  name: string;
  address: string;
}

export interface JavaAccountState {
  mode: JavaAccountMode;
  offlineUsername: string;
  msaGamertag: string;
  azureClientId: string;
  servers: JavaServerEntry[];
}

const ACCOUNT_STORAGE_KEY = 'voxelforge_java_account_v1';

const DEFAULT_SERVERS: JavaServerEntry[] = [
  { id: 'hypixel', name: 'Hypixel Network', address: 'mc.hypixel.net' },
  { id: 'cubecraft', name: 'CubeCraft Games', address: 'play.cubecraft.net' },
  { id: 'donutsmp', name: 'DonutSMP', address: 'donutsmp.net' },
];

export function sanitizeJavaUsername(raw: string): string {
  const cleaned = raw.replace(/[^A-Za-z0-9_]/g, '').slice(0, 16);
  if (cleaned.length >= 3) return cleaned;
  return cleaned.length > 0 ? cleaned.padEnd(3, '_') : 'Player';
}

// Pure-TypeScript RFC 1321 MD5 for exact Mojang Java Edition `OfflinePlayer:<username>` UUID v3
function md5Bytes(inputBytes: Uint8Array): Uint8Array {
  const s = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];
  const K = new Uint32Array(64);
  for (let i = 0; i < 64; i++) {
    K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) >>> 0;
  }

  const origLen = inputBytes.length;
  const paddedLen = (((origLen + 8) >>> 6) + 1) * 64;
  const msg = new Uint8Array(paddedLen);
  msg.set(inputBytes);
  msg[origLen] = 0x80;

  const bitLen = origLen * 8;
  const dv = new DataView(msg.buffer);
  dv.setUint32(paddedLen - 8, bitLen >>> 0, true);
  dv.setUint32(paddedLen - 4, Math.floor(bitLen / 0x100000000) >>> 0, true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  const M = new Uint32Array(16);
  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let j = 0; j < 16; j++) {
      M[j] = dv.getUint32(offset + j * 4, true);
    }
    let A = a0;
    let B = b0;
    let C = c0;
    let D = d0;

    for (let i = 0; i < 64; i++) {
      let F = 0;
      let g = 0;
      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }
      const sum = (A + F + K[i] + M[g]) >>> 0;
      A = D;
      D = C;
      C = B;
      const rot = ((sum << s[i]) | (sum >>> (32 - s[i]))) >>> 0;
      B = (B + rot) >>> 0;
    }

    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }

  const out = new Uint8Array(16);
  const ov = new DataView(out.buffer);
  ov.setUint32(0, a0, true);
  ov.setUint32(4, b0, true);
  ov.setUint32(8, c0, true);
  ov.setUint32(12, d0, true);
  return out;
}

/**
 * Computes exact Java Edition Offline UUID v3:
 * UUID.nameUUIDFromBytes(("OfflinePlayer:" + username).getBytes(StandardCharsets.UTF_8))
 */
export function computeJavaOfflineUuid(username: string): string {
  const normalized = sanitizeJavaUsername(username);
  const bytes = new TextEncoder().encode(`OfflinePlayer:${normalized}`);
  const hash = md5Bytes(bytes);

  // Set UUID version 3 and RFC 4122 variant bits
  hash[6] = (hash[6] & 0x0f) | 0x30;
  hash[8] = (hash[8] & 0x3f) | 0x80;

  const hex = Array.from(hash, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function loadJavaAccountState(): JavaAccountState {
  try {
    const raw = localStorage.getItem(ACCOUNT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<JavaAccountState>;
      return {
        mode: parsed.mode === 'microsoft' ? 'microsoft' : 'offline',
        offlineUsername:
          typeof parsed.offlineUsername === 'string' && parsed.offlineUsername.trim().length > 0
            ? parsed.offlineUsername.slice(0, 16)
            : 'Player',
        msaGamertag: typeof parsed.msaGamertag === 'string' ? parsed.msaGamertag.slice(0, 24) : '',
        azureClientId: typeof parsed.azureClientId === 'string' ? parsed.azureClientId.trim() : '',
        servers:
          Array.isArray(parsed.servers) && parsed.servers.length > 0
            ? parsed.servers.filter(
                (s): s is JavaServerEntry =>
                  Boolean(s && typeof s.id === 'string' && typeof s.name === 'string' && typeof s.address === 'string'),
              )
            : DEFAULT_SERVERS,
      };
    }
  } catch {
    // Ignore storage read errors
  }
  return {
    mode: 'offline',
    offlineUsername: 'Player',
    msaGamertag: '',
    azureClientId: '',
    servers: DEFAULT_SERVERS,
  };
}

export function saveJavaAccountState(state: JavaAccountState): void {
  try {
    localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}
