import { GameMode, PerformancePreset, PlatformTarget } from '../data/versions';
import { ShaderPackId } from './shaderPacks';

const DB_NAME = 'voxelforge_worlds_db';
const DB_VERSION = 1;
const STORE_NAME = 'worlds';
const PREFS_KEY = 'voxelforge_launcher_prefs_v1';
const FALLBACK_PREFIX = 'voxelforge_world_';

export interface SavedPlayerState {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  flying: boolean;
}

export interface SavedWorldState {
  key: string;
  versionId: string;
  seed: string;
  updatedAt: number;
  worldTime?: number;
  player: SavedPlayerState;
  hotbar: number[];
  activeSlot: number;
  blockEdits: Record<string, number>;
}

export interface LauncherPreferences {
  versionId: string;
  platform: PlatformTarget;
  performance: PerformancePreset;
  gameMode: GameMode;
  seed: string;
  muted: boolean;
  shaderPack?: ShaderPackId;
  dayCycleSpeed?: number;
}

export function normalizeSeed(seed: string): string {
  return (seed || 'voxelforge').trim() || 'voxelforge';
}

export function makeWorldKey(versionId: string, seed: string): string {
  return `${versionId}::${normalizeSeed(seed)}`;
}

export function saveLauncherPrefs(prefs: LauncherPreferences): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadLauncherPrefs(): Partial<LauncherPreferences> | null {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<LauncherPreferences>;
  } catch {
    return null;
  }
}

function openWorldDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
  });
}

export async function saveWorldState(state: SavedWorldState): Promise<void> {
  try {
    const db = await openWorldDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(state);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Graceful LocalStorage fallback
    try {
      localStorage.setItem(`${FALLBACK_PREFIX}${state.key}`, JSON.stringify(state));
    } catch {
      // Ignore quota exceeded
    }
  }
}

export async function loadWorldState(
  versionId: string,
  seed: string,
): Promise<SavedWorldState | null> {
  const key = makeWorldKey(versionId, seed);
  try {
    const db = await openWorldDb();
    const res = await new Promise<SavedWorldState | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve((req.result as SavedWorldState | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (res) return res;
  } catch {
    // Fall through to LocalStorage fallback
  }

  try {
    const raw = localStorage.getItem(`${FALLBACK_PREFIX}${key}`);
    if (!raw) return null;
    return JSON.parse(raw) as SavedWorldState;
  } catch {
    return null;
  }
}

export async function deleteWorldState(versionId: string, seed: string): Promise<void> {
  const key = makeWorldKey(versionId, seed);
  try {
    const db = await openWorldDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Ignore IDB error
  }
  try {
    localStorage.removeItem(`${FALLBACK_PREFIX}${key}`);
  } catch {
    // Ignore storage error
  }
}
