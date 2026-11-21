import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import {
  MinecraftVersion,
  PerformancePreset,
  PlatformTarget,
  GameMode,
} from '../data/versions';
import {
  ATLAS_GRID,
  BLOCK_META,
  BlockId,
  createProceduralAtlas,
} from './blocks';
import { hashSeed, SeededNoise } from './noise';
import {
  createVoxelExplorerMob,
  createVoxelPigMob,
  PooledParticleSystem,
  VoxelMob,
} from './mobs';
import { voxelAudio } from './audio';
import {
  makeWorldKey,
  normalizeSeed,
  SavedWorldState,
} from './worldStorage';
import {
  AtmosphereGradeShader,
  attachTerrainShader,
  attachWaterShader,
  createDynamicSkyMaterial,
  createSharedShaderUniforms,
  getShaderPack,
  ShaderPackDefinition,
  ShaderPackId,
  SharedShaderUniforms,
} from './shaderPacks';

export const CHUNK_W = 16;
export const CHUNK_H = 64;
export const CHUNK_D = 16;
export const SEA_LEVEL = 18;

export type TimePhase = 'Dawn' | 'Day' | 'Dusk' | 'Night';

export interface EngineStats {
  fps: number;
  x: number;
  y: number;
  z: number;
  flying: boolean;
  pointerLocked: boolean;
  targetBlockName: string | null;
  chunksLoaded: number;
  worldTime: number;
  timeText: string;
  timePhase: TimePhase;
}

export interface EngineConfig {
  version: MinecraftVersion;
  platform: PlatformTarget;
  performance: PerformancePreset;
  gameMode: GameMode;
  seed: string;
  shaderPack: ShaderPackId;
  dayCycleSpeed: number;
}

interface ChunkData {
  cx: number;
  cz: number;
  blocks: Uint8Array;
  opaqueMesh: THREE.Mesh | null;
  waterMesh: THREE.Mesh | null;
  dirty: boolean;
}

// Reusable math & color objects (zero GC in render loop)
const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _sunDir = new THREE.Vector3();
const _moonDir = new THREE.Vector3();

const _dayZenith = new THREE.Color('#6bb8ff');
const _dayHorizon = new THREE.Color('#98ceff');
const _dawnZenith = new THREE.Color('#304372');
const _dawnHorizon = new THREE.Color('#f49567');
const _duskZenith = new THREE.Color('#2f2f64');
const _duskHorizon = new THREE.Color('#ea6e4b');
const _nightZenith = new THREE.Color('#050916');
const _nightHorizon = new THREE.Color('#101c36');
const _curZenith = new THREE.Color();
const _curHorizon = new THREE.Color();
const _curFog = new THREE.Color();

const _sunNoonCol = new THREE.Color('#fff6e3');
const _sunWarmCol = new THREE.Color('#ff9a5a');
const _moonKeyCol = new THREE.Color('#7ca3f2');
const _curSunCol = new THREE.Color();

const _hemiDaySky = new THREE.Color('#d8eeff');
const _hemiDawnSky = new THREE.Color('#f6b48e');
const _hemiNightSky = new THREE.Color('#2a3f6f');
const _hemiDayGround = new THREE.Color('#5c4a38');
const _hemiNightGround = new THREE.Color('#111827');
const _curHemiSky = new THREE.Color();
const _curHemiGround = new THREE.Color();

const _cloudDayCol = new THREE.Color('#ffffff');
const _cloudWarmCol = new THREE.Color('#f6b092');
const _cloudNightCol = new THREE.Color('#2a3652');
const _curCloudCol = new THREE.Color();

// Face definitions: dir, corners (4x xyz), normal, faceShade
const FACES: {
  dir: [number, number, number];
  corners: [number, number, number][];
  uvs: [number, number][];
  shade: number;
  faceType: 'top' | 'side' | 'bottom';
}[] = [
  // +Y (Top)
  {
    dir: [0, 1, 0],
    corners: [
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
      [0, 1, 0],
    ],
    uvs: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    shade: 1.0,
    faceType: 'top',
  },
  // -Y (Bottom)
  {
    dir: [0, -1, 0],
    corners: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
    uvs: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    shade: 0.58,
    faceType: 'bottom',
  },
  // +X (East)
  {
    dir: [1, 0, 0],
    corners: [
      [1, 0, 1],
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
    ],
    uvs: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    shade: 0.8,
    faceType: 'side',
  },
  // -X (West)
  {
    dir: [-1, 0, 0],
    corners: [
      [0, 0, 0],
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
    ],
    uvs: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    shade: 0.8,
    faceType: 'side',
  },
  // +Z (South)
  {
    dir: [0, 0, 1],
    corners: [
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
    ],
    uvs: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    shade: 0.88,
    faceType: 'side',
  },
  // -Z (North)
  {
    dir: [0, 0, -1],
    corners: [
      [1, 0, 0],
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
    ],
    uvs: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    shade: 0.88,
    faceType: 'side',
  },
];

export class VoxelWorldEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;

  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private skyColor = new THREE.Color('#6bb8ff');
  private fogColor = new THREE.Color('#98ceff');

  private skyDome: THREE.Mesh;
  private skyMaterial: THREE.ShaderMaterial;
  private sunDisc: THREE.Mesh;
  private moonDisc: THREE.Mesh;
  private cloudMat!: THREE.MeshBasicMaterial;

  private sharedUniforms: SharedShaderUniforms;
  private activePack: ShaderPackDefinition;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private gradePass: ShaderPass | null = null;

  private worldTime = 0.16; // 0.0 sunrise, 0.25 noon, 0.5 sunset, 0.75 midnight
  private elapsedTime = 0;

  private atlasTexture!: THREE.CanvasTexture;
  private opaqueMaterial!: THREE.MeshStandardMaterial;
  private waterMaterial!: THREE.MeshStandardMaterial;
  public tileIcons: Record<number, string> = {};

  private chunks = new Map<string, ChunkData>();
  private worldGroup = new THREE.Group();
  private cloudsGroup = new THREE.Group();
  private mobs: VoxelMob[] = [];
  private particles: PooledParticleSystem;
  private highlightBox: THREE.LineSegments;

  private config: EngineConfig;
  private noise: SeededNoise;
  private renderRadius = 4;

  // Game & player state
  private mode: 'title' | 'playing' | 'paused' = 'title';
  private titleAngle = 0;

  private playerPos = new THREE.Vector3(8, 30, 8);
  private playerVel = new THREE.Vector3(0, 0, 0);
  private yaw = 0.6;
  private pitch = -0.15;
  private onGround = false;
  private flying = false;
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private lastSpaceTime = 0;
  private walkBobPhase = 0;
  private stepDistAccum = 0;
  private shakeIntensity = 0;

  private selectedBlock: BlockId = BlockId.Grass;
  private targetedBlock: { x: number; y: number; z: number; nx: number; ny: number; nz: number } | null = null;

  // Inputs
  private keys = new Set<string>();
  private joyX = 0;
  private joyY = 0;
  private pointerLocked = false;

  // Loop & stats
  private frameId = 0;
  private disposed = false;
  private lastTime = performance.now();
  private fpsAccum = 0;
  private fpsFrames = 0;
  private currentFps = 60;
  private statsTimer = 0;

  private onStatsCallback?: (stats: EngineStats) => void;
  private onIconsReadyCallback?: (icons: Record<number, string>) => void;
  private onRequestPauseCallback?: () => void;
  private onHotbarSlotCallback?: (index: number) => void;
  private onWorldDirtyCallback?: () => void;

  // Persistent block delta tracking ("wx,wy,wz" -> BlockId)
  private blockEdits = new Map<string, BlockId>();
  private chunkEdits = new Map<string, Map<string, { lx: number; y: number; lz: number; id: BlockId }>>();

  constructor(
    container: HTMLElement,
    initialConfig: EngineConfig,
    callbacks: {
      onStats?: (stats: EngineStats) => void;
      onIconsReady?: (icons: Record<number, string>) => void;
      onRequestPause?: () => void;
      onHotbarSlot?: (index: number) => void;
      onWorldDirty?: () => void;
    },
  ) {
    this.container = container;
    this.config = initialConfig;
    this.onStatsCallback = callbacks.onStats;
    this.onIconsReadyCallback = callbacks.onIconsReady;
    this.onRequestPauseCallback = callbacks.onRequestPause;
    this.onHotbarSlotCallback = callbacks.onHotbarSlot;
    this.onWorldDirtyCallback = callbacks.onWorldDirty;

    this.noise = new SeededNoise(hashSeed(initialConfig.seed || 'voxelforge'));

    // Software WebGL guard (read from GPU renderer string)
    this.isSoftwareGl = (() => {
      const probe = document.createElement('canvas').getContext('webgl2');
      if (!probe) return true;
      const ext = probe.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
      const gpu = String(probe.getParameter(param));
      probe.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl && initialConfig.performance !== 'ultra_fps',
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl && initialConfig.performance === 'vibrant';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.applyPixelRatio();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.sharedUniforms = createSharedShaderUniforms();
    this.activePack = getShaderPack(initialConfig.shaderPack);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(72, width / height, 0.1, 260);
    this.camera.up.set(0, 1, 0);
    this.camera.rotation.order = 'YXZ';

    // Procedural Sky Dome + Voxel Sun & Moon
    this.skyMaterial = createDynamicSkyMaterial();
    const skyGeo = new THREE.SphereGeometry(195, 24, 16);
    this.skyDome = new THREE.Mesh(skyGeo, this.skyMaterial);
    this.skyDome.frustumCulled = false;
    this.skyDome.renderOrder = -10;
    this.scene.add(this.skyDome);

    const sunGeo = new THREE.PlaneGeometry(14, 14);
    const sunMat = new THREE.MeshBasicMaterial({
      color: 0xffe49e,
      fog: false,
      depthWrite: false,
    });
    this.sunDisc = new THREE.Mesh(sunGeo, sunMat);
    this.sunDisc.renderOrder = -5;
    this.scene.add(this.sunDisc);

    const moonGeo = new THREE.PlaneGeometry(10, 10);
    const moonMat = new THREE.MeshBasicMaterial({
      color: 0xdbeafe,
      fog: false,
      depthWrite: false,
    });
    this.moonDisc = new THREE.Mesh(moonGeo, moonMat);
    this.moonDisc.renderOrder = -5;
    this.scene.add(this.moonDisc);

    // Mandatory Studio Environment Reflection (RoomEnvironment)
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.35;
    pmremGenerator.dispose();

    // Warm/Cool Lighting Rig
    this.hemiLight = new THREE.HemisphereLight(0xd8eeff, 0x5c4a38, 0.78);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff5e0, 1.35);
    this.sunLight.position.set(42, 72, 32);
    this.sunLight.castShadow = !this.isSoftwareGl && initialConfig.performance === 'vibrant';
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.near = 5;
    this.sunLight.shadow.camera.far = 160;
    const d = 40;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.scene.add(this.worldGroup);
    this.scene.add(this.cloudsGroup);

    // Block highlight wireframe
    const boxGeo = new THREE.BoxGeometry(1.006, 1.006, 1.006);
    const edges = new THREE.EdgesGeometry(boxGeo);
    boxGeo.dispose();
    this.highlightBox = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x0f172a, transparent: true, opacity: 0.72 }),
    );
    this.highlightBox.visible = false;
    this.scene.add(this.highlightBox);

    this.particles = new PooledParticleSystem(this.scene, 84);

    // Post-Processing Composer for GPU shader packs (skipped automatically on software WebGL)
    if (!this.isSoftwareGl) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.setSize(width, height);
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
      this.composer.addPass(new RenderPass(this.scene, this.camera));

      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(Math.max(1, Math.floor(width / 2)), Math.max(1, Math.floor(height / 2))),
        this.activePack.bloomStrength,
        this.activePack.bloomRadius,
        this.activePack.bloomThreshold,
      );
      this.composer.addPass(this.bloomPass);

      this.gradePass = new ShaderPass(AtmosphereGradeShader);
      this.gradePass.uniforms.uResolution.value.set(
        width * this.renderer.getPixelRatio(),
        height * this.renderer.getPixelRatio(),
      );
      this.composer.addPass(this.gradePass);

      this.composer.addPass(new OutputPass());
    }

    this.applyVersionAndPerformance(initialConfig, true);
    this.spawnClouds();
    this.spawnMobs();
    this.spawnPlayerSafely();
    this.updateDayNightCycle(0);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.startLoop();
  }

  private applyPixelRatio() {
    if (this.isSoftwareGl) {
      this.renderer.setPixelRatio(1);
      return;
    }
    const maxDpr =
      this.config.performance === 'ultra_fps'
        ? 1.0
        : this.config.platform === 'android'
          ? 1.5
          : 2.0;
    const pr = Math.min(window.devicePixelRatio || 1, maxDpr);
    this.renderer.setPixelRatio(pr);
    this.composer?.setPixelRatio(pr);
  }

  private rebuildAtlasAndMaterials() {
    const v = this.config.version;
    const result = createProceduralAtlas(
      v.grassTint,
      v.waterColor,
      this.renderer.capabilities.getMaxAnisotropy(),
    );

    if (this.atlasTexture) this.atlasTexture.dispose();
    this.atlasTexture = result.texture;
    this.tileIcons = result.tileIcons;
    this.onIconsReadyCallback?.(this.tileIcons);

    if (!this.opaqueMaterial) {
      this.opaqueMaterial = new THREE.MeshStandardMaterial({
        map: this.atlasTexture,
        vertexColors: true,
        roughness: v.classicAlphaShade ? 0.95 : 0.86,
        metalness: 0.02,
        alphaTest: 0.1,
      });
      attachTerrainShader(this.opaqueMaterial, this.sharedUniforms);
    } else {
      this.opaqueMaterial.map = this.atlasTexture;
      this.opaqueMaterial.roughness = v.classicAlphaShade ? 0.95 : 0.86;
      this.opaqueMaterial.needsUpdate = true;
    }

    if (!this.waterMaterial) {
      this.waterMaterial = new THREE.MeshStandardMaterial({
        map: this.atlasTexture,
        vertexColors: true,
        transparent: true,
        opacity: v.waterOpacity,
        roughness: 0.16,
        metalness: 0.14,
        depthWrite: false,
      });
      attachWaterShader(this.waterMaterial, this.sharedUniforms);
    } else {
      this.waterMaterial.map = this.atlasTexture;
      this.waterMaterial.opacity = v.waterOpacity;
      this.waterMaterial.needsUpdate = true;
    }
  }

  private applyShaderPackSettings() {
    const pack = getShaderPack(this.config.shaderPack);
    this.activePack = pack;

    this.sharedUniforms.uWindStrength.value = pack.windStrength;
    this.sharedUniforms.uWaterWaveStrength.value = pack.waterWaveStrength;
    this.sharedUniforms.uWaterFresnelTint.value = pack.waterFresnelTint;
    this.sharedUniforms.uEmissiveBoost.value = pack.emissiveBoost;
    this.sharedUniforms.uSunWarmth.value = pack.sunWarmth;

    this.skyMaterial.uniforms.uAuroraStrength.value = pack.auroraStrength;
    this.renderer.toneMappingExposure = pack.exposure;

    if (this.bloomPass) {
      this.bloomPass.enabled = pack.bloomStrength > 0.01;
      this.bloomPass.strength = pack.bloomStrength;
      this.bloomPass.radius = pack.bloomRadius;
      this.bloomPass.threshold = pack.bloomThreshold;
    }

    if (this.gradePass) {
      this.gradePass.uniforms.uSaturation.value = pack.saturation;
      this.gradePass.uniforms.uContrast.value = pack.contrast;
      this.gradePass.uniforms.uVignette.value = pack.vignette;
      this.gradePass.uniforms.uWarmth.value = pack.sunWarmth;
      this.gradePass.uniforms.uScanlines.value = pack.scanlines;
    }

    const shadowsOn =
      !this.isSoftwareGl &&
      (this.config.performance === 'vibrant' ||
        (this.config.performance === 'balanced' &&
          (pack.id === 'solstice' || pack.id === 'complementary')));
    this.renderer.shadowMap.enabled = shadowsOn;
    this.sunLight.castShadow = shadowsOn;
  }

  public setShaderPack(packId: ShaderPackId) {
    this.config = { ...this.config, shaderPack: packId };
    this.applyShaderPackSettings();
    this.updateDayNightCycle(0);
  }

  public setWorldTime(t: number) {
    const wrapped = ((t % 1) + 1) % 1;
    this.worldTime = wrapped;
    this.updateDayNightCycle(0);
  }

  public setDayCycleSpeed(speed: number) {
    this.config = { ...this.config, dayCycleSpeed: speed };
  }

  public applyVersionAndPerformance(nextConfig: EngineConfig, forceWorldRebuild = false) {
    const versionChanged =
      this.config.version.id !== nextConfig.version.id ||
      this.config.seed !== nextConfig.seed;

    this.config = nextConfig;
    const v = nextConfig.version;

    // Render distance based on performance & platform
    if (nextConfig.performance === 'ultra_fps') {
      this.renderRadius = nextConfig.platform === 'android' ? 2 : 3;
    } else if (nextConfig.performance === 'balanced') {
      this.renderRadius = nextConfig.platform === 'android' ? 3 : 4;
    } else {
      this.renderRadius = nextConfig.platform === 'android' ? 4 : 5;
    }

    this.applyPixelRatio();
    this.applyShaderPackSettings();

    // Base daytime atmosphere & fog (modulated dynamically by day/night timer)
    this.skyColor.set(v.skyColor);
    this.fogColor.set(v.fogColor);
    const fogFar = this.renderRadius * CHUNK_W * 1.15;
    this.scene.fog = new THREE.Fog(this.fogColor, fogFar * 0.42, fogFar);

    this.rebuildAtlasAndMaterials();
    this.updateDayNightCycle(0);

    if (versionChanged || forceWorldRebuild) {
      this.noise = new SeededNoise(hashSeed(nextConfig.seed || 'voxelforge'));
      this.blockEdits.clear();
      this.chunkEdits.clear();
      this.clearAllChunks();
      this.ensureChunksAround(this.playerPos.x, this.playerPos.z);
      this.remeshDirtyChunks();
      this.spawnPlayerSafely();
    } else {
      this.ensureChunksAround(this.playerPos.x, this.playerPos.z);
      this.remeshDirtyChunks();
    }
  }

  private indexBlockEdit(wx: number, wy: number, wz: number, id: BlockId) {
    const key = `${wx},${wy},${wz}`;
    this.blockEdits.set(key, id);
    const cx = Math.floor(wx / CHUNK_W);
    const cz = Math.floor(wz / CHUNK_D);
    const cKey = this.chunkKey(cx, cz);
    let map = this.chunkEdits.get(cKey);
    if (!map) {
      map = new Map();
      this.chunkEdits.set(cKey, map);
    }
    const lx = ((wx % CHUNK_W) + CHUNK_W) % CHUNK_W;
    const lz = ((wz % CHUNK_D) + CHUNK_D) % CHUNK_D;
    map.set(key, { lx, y: wy, lz, id });
  }

  public exportWorldState(hotbar: BlockId[], activeSlot: number): SavedWorldState {
    const edits: Record<string, number> = {};
    this.blockEdits.forEach((val, key) => {
      edits[key] = val;
    });
    return {
      key: makeWorldKey(this.config.version.id, this.config.seed),
      versionId: this.config.version.id,
      seed: normalizeSeed(this.config.seed),
      updatedAt: Date.now(),
      worldTime: this.worldTime,
      player: {
        x: this.playerPos.x,
        y: this.playerPos.y,
        z: this.playerPos.z,
        yaw: this.yaw,
        pitch: this.pitch,
        flying: this.flying,
      },
      hotbar: [...hotbar],
      activeSlot,
      blockEdits: edits,
    };
  }

  public importWorldState(saved: SavedWorldState | null) {
    this.blockEdits.clear();
    this.chunkEdits.clear();

    if (saved) {
      for (const [coordKey, id] of Object.entries(saved.blockEdits || {})) {
        const parts = coordKey.split(',');
        if (parts.length !== 3) continue;
        const wx = Number(parts[0]);
        const wy = Number(parts[1]);
        const wz = Number(parts[2]);
        if (Number.isFinite(wx) && Number.isFinite(wy) && Number.isFinite(wz)) {
          this.indexBlockEdit(wx, wy, wz, id as BlockId);
        }
      }
      if (typeof saved.worldTime === 'number' && Number.isFinite(saved.worldTime)) {
        this.worldTime = ((saved.worldTime % 1) + 1) % 1;
        this.updateDayNightCycle(0);
      }
      this.playerPos.set(saved.player.x, saved.player.y, saved.player.z);
      this.playerVel.set(0, 0, 0);
      this.yaw = saved.player.yaw;
      this.pitch = THREE.MathUtils.clamp(saved.player.pitch, -Math.PI / 2 + 0.04, Math.PI / 2 - 0.04);
      this.flying = Boolean(saved.player.flying);
      this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    } else {
      this.spawnPlayerSafely();
    }

    this.clearAllChunks();
    this.ensureChunksAround(this.playerPos.x, this.playerPos.z);
    this.remeshDirtyChunks();
  }

  public resetWorld() {
    this.blockEdits.clear();
    this.chunkEdits.clear();
    this.worldTime = 0.16;
    this.updateDayNightCycle(0);
    this.spawnPlayerSafely();
    this.yaw = 0.6;
    this.pitch = -0.15;
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    this.clearAllChunks();
    this.ensureChunksAround(this.playerPos.x, this.playerPos.z);
    this.remeshDirtyChunks();
  }

  public setMode(nextMode: 'title' | 'playing' | 'paused') {
    this.mode = nextMode;
    if (nextMode !== 'playing' && document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock();
    }
    if (nextMode === 'playing') {
      this.camera.up.set(0, 1, 0);
      this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
      if (this.config.platform === 'windows') {
        this.requestPointerLock();
      }
    }
  }

  public requestPointerLock() {
    if (this.config.platform === 'windows' && this.mode === 'playing') {
      try {
        this.renderer.domElement.requestPointerLock();
      } catch {
        // Ignore browser pointer lock rejection
      }
    }
  }

  public setSelectedBlock(blockId: BlockId) {
    this.selectedBlock = blockId;
  }

  public setTouchJoystick(x: number, y: number) {
    this.joyX = x;
    this.joyY = y;
  }

  public addTouchLookDelta(dx: number, dy: number) {
    const sensitivity = 0.0042;
    this.yaw -= dx * sensitivity;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * sensitivity, -Math.PI / 2 + 0.04, Math.PI / 2 - 0.04);
  }

  public triggerJump() {
    this.jumpBufferTimer = 0.12;
  }

  public toggleFly() {
    if (this.config.gameMode === 'creative') {
      this.flying = !this.flying;
      this.playerVel.y = 0;
    }
  }

  public triggerBreakBlock() {
    this.performBreakBlock();
  }

  public triggerPlaceBlock() {
    this.performPlaceBlock();
  }

  private spawnPlayerSafely() {
    const sx = 8;
    const sz = 8;
    const h = this.getSurfaceHeightAt(sx, sz);
    this.playerPos.set(sx + 0.5, Math.max(h + 2.2, SEA_LEVEL + 2), sz + 0.5);
    this.playerVel.set(0, 0, 0);
    this.flying = false;
  }

  private spawnClouds() {
    this.cloudMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
    });
    const geo = new THREE.BoxGeometry(1, 1, 1);
    for (let i = 0; i < 18; i++) {
      const cloud = new THREE.Mesh(geo, this.cloudMat);
      const w = 6 + Math.floor(Math.random() * 10);
      const d = 4 + Math.floor(Math.random() * 8);
      cloud.scale.set(w, 1.4, d);
      cloud.position.set((Math.random() - 0.5) * 160, 48 + Math.random() * 8, (Math.random() - 0.5) * 160);
      this.cloudsGroup.add(cloud);
    }
  }

  private spawnMobs() {
    const explorerColors = [0x22c55e, 0x3b82f6, 0xf59e0b];
    for (let i = 0; i < 3; i++) {
      const mob = createVoxelExplorerMob(explorerColors[i % explorerColors.length]);
      const angle = (i / 3) * Math.PI * 2;
      mob.x = 8 + Math.cos(angle) * (10 + i * 3);
      mob.z = 8 + Math.sin(angle) * (10 + i * 3);
      mob.yaw = Math.random() * Math.PI * 2;
      this.scene.add(mob.group);
      this.mobs.push(mob);
    }
    for (let i = 0; i < 3; i++) {
      const pig = createVoxelPigMob();
      const angle = (i / 3) * Math.PI * 2 + 1.0;
      pig.x = 8 + Math.cos(angle) * (7 + i * 4);
      pig.z = 8 + Math.sin(angle) * (7 + i * 4);
      pig.yaw = Math.random() * Math.PI * 2;
      this.scene.add(pig.group);
      this.mobs.push(pig);
    }
  }

  private chunkKey(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

  private getSurfaceHeightAt(wx: number, wz: number): number {
    const v = this.config.version;
    const continent = this.noise.fbm2D(wx * 0.015, wz * 0.015, 3);
    const detail = this.noise.fbm2D(wx * 0.045 + 100, wz * 0.045 + 100, 3);
    const ridge = Math.abs(this.noise.noise2D(wx * 0.028 - 50, wz * 0.028 - 50));
    const h = v.baseHeight + continent * v.terrainAmplitude + detail * 5 + (1 - ridge) * (v.terrainAmplitude * 0.28);
    return Math.max(4, Math.min(CHUNK_H - 12, Math.floor(h)));
  }

  private clearAllChunks() {
    this.chunks.forEach((chunk) => {
      if (chunk.opaqueMesh) {
        this.worldGroup.remove(chunk.opaqueMesh);
        chunk.opaqueMesh.geometry.dispose();
      }
      if (chunk.waterMesh) {
        this.worldGroup.remove(chunk.waterMesh);
        chunk.waterMesh.geometry.dispose();
      }
    });
    this.chunks.clear();
  }

  private generateChunk(cx: number, cz: number): ChunkData {
    const blocks = new Uint8Array(CHUNK_W * CHUNK_H * CHUNK_D);
    const v = this.config.version;

    const setLocal = (lx: number, y: number, lz: number, id: BlockId) => {
      if (lx < 0 || lx >= CHUNK_W || y < 0 || y >= CHUNK_H || lz < 0 || lz >= CHUNK_D) return;
      blocks[(y * CHUNK_D + lz) * CHUNK_W + lx] = id;
    };

    const getLocal = (lx: number, y: number, lz: number): BlockId => {
      if (lx < 0 || lx >= CHUNK_W || y < 0 || y >= CHUNK_H || lz < 0 || lz >= CHUNK_D) return BlockId.Air;
      return blocks[(y * CHUNK_D + lz) * CHUNK_W + lx] as BlockId;
    };

    for (let lx = 0; lx < CHUNK_W; lx++) {
      for (let lz = 0; lz < CHUNK_D; lz++) {
        const wx = cx * CHUNK_W + lx;
        const wz = cz * CHUNK_D + lz;
        const surfY = this.getSurfaceHeightAt(wx, wz);

        for (let y = 0; y < CHUNK_H; y++) {
          if (y === 0) {
            setLocal(lx, y, lz, BlockId.Bedrock);
          } else if (y < surfY - 3) {
            // Subterranean rock & version-specific strata/ores
            const oreHash = this.noise.hash2(wx * 31 + y * 7, wz * 19 + y * 13);
            if (y < 10 && oreHash > 0.985) {
              setLocal(lx, y, lz, BlockId.DiamondOre);
            } else if (y < 16 && oreHash > 0.975) {
              setLocal(lx, y, lz, BlockId.GoldOre);
            } else if (oreHash > 0.96) {
              setLocal(lx, y, lz, v.hasCopper && oreHash > 0.968 ? BlockId.CopperBlock : BlockId.IronOre);
            } else if (oreHash > 0.93) {
              setLocal(lx, y, lz, BlockId.CoalOre);
            } else if (v.hasDeepslate && y < 10) {
              setLocal(lx, y, lz, BlockId.Deepslate);
            } else {
              setLocal(lx, y, lz, BlockId.Stone);
            }
          } else if (y < surfY) {
            setLocal(lx, y, lz, surfY <= SEA_LEVEL + 1 ? BlockId.Sand : BlockId.Dirt);
          } else if (y === surfY) {
            if (surfY <= SEA_LEVEL + 1) {
              setLocal(lx, y, lz, BlockId.Sand);
            } else if (surfY > 34) {
              setLocal(lx, y, lz, BlockId.Snow);
            } else {
              setLocal(lx, y, lz, BlockId.Grass);
            }
          } else if (y <= SEA_LEVEL) {
            setLocal(lx, y, lz, BlockId.Water);
          }
        }
      }
    }

    // Procedural Trees inside chunk safe margin (2..13) so canopy stays clean
    for (let lx = 2; lx < CHUNK_W - 2; lx++) {
      for (let lz = 2; lz < CHUNK_D - 2; lz++) {
        const wx = cx * CHUNK_W + lx;
        const wz = cz * CHUNK_D + lz;
        const surfY = this.getSurfaceHeightAt(wx, wz);
        if (surfY > SEA_LEVEL + 1 && surfY < 33) {
          const treeRoll = this.noise.hash2(wx, wz);
          if (treeRoll > 0.986) {
            const isCherry = v.hasCherryTrees && this.noise.noise2D(wx * 0.03, wz * 0.03) > 0.12;
            const leafBlock = isCherry ? BlockId.CherryLeaves : BlockId.OakLeaves;
            const trunkH = 4 + (Math.floor(treeRoll * 1000) % 2);
            for (let ty = 1; ty <= trunkH; ty++) {
              setLocal(lx, surfY + ty, lz, BlockId.OakLog);
            }
            const topY = surfY + trunkH;
            for (let dy = -1; dy <= 2; dy++) {
              const rad = dy >= 1 ? 1 : 2;
              for (let dx = -rad; dx <= rad; dx++) {
                for (let dz = -rad; dz <= rad; dz++) {
                  if (Math.abs(dx) === rad && Math.abs(dz) === rad && dy !== 0) continue;
                  if (getLocal(lx + dx, topY + dy, lz + dz) === BlockId.Air) {
                    setLocal(lx + dx, topY + dy, lz + dz, leafBlock);
                  }
                }
              }
            }
          }
        }
      }
    }

    // Overlay saved user block edits for this chunk
    const editsForChunk = this.chunkEdits.get(this.chunkKey(cx, cz));
    if (editsForChunk) {
      editsForChunk.forEach((edit) => {
        setLocal(edit.lx, edit.y, edit.lz, edit.id);
      });
    }

    return {
      cx,
      cz,
      blocks,
      opaqueMesh: null,
      waterMesh: null,
      dirty: true,
    };
  }

  public getBlockAt(wx: number, wy: number, wz: number): BlockId {
    if (wy < 0 || wy >= CHUNK_H) return BlockId.Air;
    const cx = Math.floor(wx / CHUNK_W);
    const cz = Math.floor(wz / CHUNK_D);
    const chunk = this.chunks.get(this.chunkKey(cx, cz));
    if (!chunk) return BlockId.Air;
    const lx = ((wx % CHUNK_W) + CHUNK_W) % CHUNK_W;
    const lz = ((wz % CHUNK_D) + CHUNK_D) % CHUNK_D;
    return chunk.blocks[(wy * CHUNK_D + lz) * CHUNK_W + lx] as BlockId;
  }

  public setBlockAt(wx: number, wy: number, wz: number, id: BlockId) {
    if (wy < 1 || wy >= CHUNK_H - 1) return;
    const cx = Math.floor(wx / CHUNK_W);
    const cz = Math.floor(wz / CHUNK_D);
    const chunk = this.chunks.get(this.chunkKey(cx, cz));
    if (!chunk) return;
    const lx = ((wx % CHUNK_W) + CHUNK_W) % CHUNK_W;
    const lz = ((wz % CHUNK_D) + CHUNK_D) % CHUNK_D;
    chunk.blocks[(wy * CHUNK_D + lz) * CHUNK_W + lx] = id;
    chunk.dirty = true;
    this.indexBlockEdit(wx, wy, wz, id);
    this.onWorldDirtyCallback?.();

    // Mark neighbor chunks dirty if on boundary
    if (lx === 0) this.markDirty(cx - 1, cz);
    if (lx === CHUNK_W - 1) this.markDirty(cx + 1, cz);
    if (lz === 0) this.markDirty(cx, cz - 1);
    if (lz === CHUNK_D - 1) this.markDirty(cx, cz + 1);
  }

  private markDirty(cx: number, cz: number) {
    const ch = this.chunks.get(this.chunkKey(cx, cz));
    if (ch) ch.dirty = true;
  }

  private ensureChunksAround(wx: number, wz: number) {
    const pcx = Math.floor(wx / CHUNK_W);
    const pcz = Math.floor(wz / CHUNK_D);
    const r = this.renderRadius;

    // Unload distant chunks to keep memory & draw calls minimal
    for (const [key, ch] of this.chunks.entries()) {
      if (Math.abs(ch.cx - pcx) > r + 1 || Math.abs(ch.cz - pcz) > r + 1) {
        if (ch.opaqueMesh) {
          this.worldGroup.remove(ch.opaqueMesh);
          ch.opaqueMesh.geometry.dispose();
        }
        if (ch.waterMesh) {
          this.worldGroup.remove(ch.waterMesh);
          ch.waterMesh.geometry.dispose();
        }
        this.chunks.delete(key);
      }
    }

    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        const cx = pcx + dx;
        const cz = pcz + dz;
        const key = this.chunkKey(cx, cz);
        if (!this.chunks.has(key)) {
          this.chunks.set(key, this.generateChunk(cx, cz));
        }
      }
    }
  }

  private remeshDirtyChunks(maxPerFrame = 99) {
    let built = 0;
    for (const chunk of this.chunks.values()) {
      if (!chunk.dirty) continue;
      this.buildChunkMesh(chunk);
      chunk.dirty = false;
      built++;
      if (built >= maxPerFrame) break;
    }
  }

  private buildChunkMesh(chunk: ChunkData) {
    const opPos: number[] = [];
    const opNorm: number[] = [];
    const opUv: number[] = [];
    const opCol: number[] = [];
    const opFlags: number[] = [];
    const opIdx: number[] = [];

    const waPos: number[] = [];
    const waNorm: number[] = [];
    const waUv: number[] = [];
    const waCol: number[] = [];
    const waIdx: number[] = [];

    const ox = chunk.cx * CHUNK_W;
    const oz = chunk.cz * CHUNK_D;
    const eps = 0.002;
    const tileStep = 1 / ATLAS_GRID;

    const isSolidForAo = (wx: number, wy: number, wz: number): boolean => {
      const b = this.getBlockAt(wx, wy, wz);
      return BLOCK_META[b]?.opaque ?? false;
    };

    for (let y = 0; y < CHUNK_H; y++) {
      for (let lz = 0; lz < CHUNK_D; lz++) {
        for (let lx = 0; lx < CHUNK_W; lx++) {
          const id = chunk.blocks[(y * CHUNK_D + lz) * CHUNK_W + lx] as BlockId;
          if (id === BlockId.Air) continue;

          const meta = BLOCK_META[id];
          const wx = ox + lx;
          const wz = oz + lz;
          const isWater = id === BlockId.Water;
          const swayFlag = id === BlockId.OakLeaves || id === BlockId.CherryLeaves ? 0.9 : 0.0;
          const emissiveFlag =
            id === BlockId.Glowstone
              ? 1.4
              : id === BlockId.DiamondOre || id === BlockId.GoldOre
                ? 0.25
                : 0.0;

          for (const face of FACES) {
            const nx = wx + face.dir[0];
            const ny = y + face.dir[1];
            const nz = wz + face.dir[2];

            const neighborId = this.getBlockAt(nx, ny, nz);
            const neighborMeta = BLOCK_META[neighborId];

            if (isWater) {
              // Water only renders face against Air (and top face slightly lowered)
              if (neighborId !== BlockId.Air) continue;
            } else if (id === BlockId.Glass) {
              if (neighborId === BlockId.Glass || neighborMeta.opaque) continue;
            } else {
              if (neighborMeta.opaque) continue;
            }

            const tileIdx =
              face.faceType === 'top'
                ? meta.tiles[0]
                : face.faceType === 'side'
                  ? meta.tiles[1]
                  : meta.tiles[2];

            const col = tileIdx % ATLAS_GRID;
            const row = Math.floor(tileIdx / ATLAS_GRID);
            const u0 = col * tileStep + eps;
            const u1 = (col + 1) * tileStep - eps;
            const v1 = 1 - row * tileStep - eps;
            const v0 = 1 - (row + 1) * tileStep + eps;

            const targetPos = isWater ? waPos : opPos;
            const targetNorm = isWater ? waNorm : opNorm;
            const targetUv = isWater ? waUv : opUv;
            const targetCol = isWater ? waCol : opCol;
            const targetIdx = isWater ? waIdx : opIdx;

            const baseVert = targetPos.length / 3;
            const waterTopDrop = isWater && face.faceType === 'top' ? -0.14 : 0;

            for (let i = 0; i < 4; i++) {
              const c = face.corners[i];
              targetPos.push(
                wx + c[0],
                y + c[1] + (c[1] === 1 ? waterTopDrop : 0),
                wz + c[2],
              );
              targetNorm.push(face.dir[0], face.dir[1], face.dir[2]);

              const uv = face.uvs[i];
              targetUv.push(uv[0] === 0 ? u0 : u1, uv[1] === 0 ? v0 : v1);

              if (!isWater) {
                opFlags.push(swayFlag, emissiveFlag);
              }

              // Subtle vertex AO for crisp voxel corners
              let ao = 1.0;
              if (!isWater && face.faceType === 'top' && !this.config.version.classicAlphaShade) {
                const cxOff = c[0] === 0 ? -1 : 1;
                const czOff = c[2] === 0 ? -1 : 1;
                let occ = 0;
                if (isSolidForAo(wx + cxOff, y + 1, wz)) occ++;
                if (isSolidForAo(wx, y + 1, wz + czOff)) occ++;
                if (isSolidForAo(wx + cxOff, y + 1, wz + czOff)) occ++;
                ao = 1.0 - occ * 0.12;
              }
              const shade = face.shade * ao;
              targetCol.push(shade, shade, shade);
            }

            targetIdx.push(baseVert, baseVert + 1, baseVert + 2, baseVert, baseVert + 2, baseVert + 3);
          }
        }
      }
    }

    // Update Opaque Mesh
    if (chunk.opaqueMesh) {
      this.worldGroup.remove(chunk.opaqueMesh);
      chunk.opaqueMesh.geometry.dispose();
      chunk.opaqueMesh = null;
    }
    if (opPos.length > 0) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(opPos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(opNorm, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(opUv, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(opCol, 3));
      geo.setAttribute('aBlockFlags', new THREE.Float32BufferAttribute(opFlags, 2));
      geo.setIndex(opIdx);
      geo.computeBoundingSphere();

      const mesh = new THREE.Mesh(geo, this.opaqueMaterial);
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      this.worldGroup.add(mesh);
      chunk.opaqueMesh = mesh;
    }

    // Update Water Mesh
    if (chunk.waterMesh) {
      this.worldGroup.remove(chunk.waterMesh);
      chunk.waterMesh.geometry.dispose();
      chunk.waterMesh = null;
    }
    if (waPos.length > 0) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(waPos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(waNorm, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(waUv, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(waCol, 3));
      geo.setIndex(waIdx);
      geo.computeBoundingSphere();

      const mesh = new THREE.Mesh(geo, this.waterMaterial);
      mesh.renderOrder = 2;
      this.worldGroup.add(mesh);
      chunk.waterMesh = mesh;
    }
  }

  // Fast 3D Voxel DDA Raycast from camera eye
  private raycastVoxel(maxDist = 6.5) {
    const ox = this.camera.position.x;
    const oy = this.camera.position.y;
    const oz = this.camera.position.z;

    this.camera.getWorldDirection(_vec3A);
    const dx = _vec3A.x;
    const dy = _vec3A.y;
    const dz = _vec3A.z;

    let bx = Math.floor(ox);
    let by = Math.floor(oy);
    let bz = Math.floor(oz);

    const stepX = dx > 0 ? 1 : -1;
    const stepY = dy > 0 ? 1 : -1;
    const stepZ = dz > 0 ? 1 : -1;

    const tDeltaX = dx !== 0 ? Math.abs(1 / dx) : 1e9;
    const tDeltaY = dy !== 0 ? Math.abs(1 / dy) : 1e9;
    const tDeltaZ = dz !== 0 ? Math.abs(1 / dz) : 1e9;

    let tMaxX = dx > 0 ? (bx + 1 - ox) * tDeltaX : (ox - bx) * tDeltaX;
    let tMaxY = dy > 0 ? (by + 1 - oy) * tDeltaY : (oy - by) * tDeltaY;
    let tMaxZ = dz > 0 ? (bz + 1 - oz) * tDeltaZ : (oz - bz) * tDeltaZ;

    let nx = 0;
    let ny = 0;
    let nz = 0;
    let dist = 0;

    while (dist <= maxDist) {
      const b = this.getBlockAt(bx, by, bz);
      if (b !== BlockId.Air && b !== BlockId.Water) {
        return { x: bx, y: by, z: bz, nx, ny, nz, block: b };
      }

      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) {
          dist = tMaxX;
          tMaxX += tDeltaX;
          bx += stepX;
          nx = -stepX;
          ny = 0;
          nz = 0;
        } else {
          dist = tMaxZ;
          tMaxZ += tDeltaZ;
          bz += stepZ;
          nx = 0;
          ny = 0;
          nz = -stepZ;
        }
      } else {
        if (tMaxY < tMaxZ) {
          dist = tMaxY;
          tMaxY += tDeltaY;
          by += stepY;
          nx = 0;
          ny = -stepY;
          nz = 0;
        } else {
          dist = tMaxZ;
          tMaxZ += tDeltaZ;
          bz += stepZ;
          nx = 0;
          ny = 0;
          nz = -stepZ;
        }
      }
    }
    return null;
  }

  private performBreakBlock() {
    if (this.mode !== 'playing') return;
    const hit = this.raycastVoxel(6.5);
    if (!hit) return;
    if (hit.block === BlockId.Bedrock && this.config.gameMode === 'survival') return;

    const meta = BLOCK_META[hit.block];
    this.setBlockAt(hit.x, hit.y, hit.z, BlockId.Air);
    this.remeshDirtyChunks(6);
    this.particles.spawnBurst(hit.x, hit.y, hit.z, meta.breakColor, 14);
    this.shakeIntensity = 0.04;
    voxelAudio.playBlockBreak(meta.soundType);
  }

  private performPlaceBlock() {
    if (this.mode !== 'playing') return;
    const hit = this.raycastVoxel(6.5);
    if (!hit) return;

    const px = hit.x + hit.nx;
    const py = hit.y + hit.ny;
    const pz = hit.z + hit.nz;

    // Prevent placing inside player's own AABB
    const playerMinX = this.playerPos.x - 0.3;
    const playerMaxX = this.playerPos.x + 0.3;
    const playerMinY = this.playerPos.y;
    const playerMaxY = this.playerPos.y + 1.75;
    const playerMinZ = this.playerPos.z - 0.3;
    const playerMaxZ = this.playerPos.z + 0.3;

    const overlapsPlayer =
      px + 1 > playerMinX &&
      px < playerMaxX &&
      py + 1 > playerMinY &&
      py < playerMaxY &&
      pz + 1 > playerMinZ &&
      pz < playerMaxZ;

    if (overlapsPlayer) return;

    this.setBlockAt(px, py, pz, this.selectedBlock);
    this.remeshDirtyChunks(6);
    const meta = BLOCK_META[this.selectedBlock];
    voxelAudio.playBlockPlace(meta.soundType);
  }

  private isSolidBlockAt(wx: number, wy: number, wz: number): boolean {
    const b = this.getBlockAt(Math.floor(wx), Math.floor(wy), Math.floor(wz));
    return BLOCK_META[b]?.solid ?? false;
  }

  private collidesAt(x: number, y: number, z: number): boolean {
    const hw = 0.28;
    const height = 1.72;
    const minX = Math.floor(x - hw);
    const maxX = Math.floor(x + hw);
    const minY = Math.floor(y);
    const maxY = Math.floor(y + height);
    const minZ = Math.floor(z - hw);
    const maxZ = Math.floor(z + hw);

    for (let bx = minX; bx <= maxX; bx++) {
      for (let by = minY; by <= maxY; by++) {
        for (let bz = minZ; bz <= maxZ; bz++) {
          if (this.isSolidBlockAt(bx, by, bz)) return true;
        }
      }
    }
    return false;
  }

  private updatePlayer(dt: number) {
    // Movement direction from WASD + touch joystick
    let forward = 0;
    let strafe = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) forward += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) forward -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) strafe += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) strafe -= 1;

    forward += -this.joyY;
    strafe += this.joyX;

    const mag = Math.hypot(forward, strafe);
    if (mag > 1) {
      forward /= mag;
      strafe /= mag;
    }

    const sprinting = this.keys.has('ShiftLeft') && !this.flying;
    const baseSpeed = this.flying ? 11.5 : sprinting ? 7.4 : 5.2;

    const sinY = Math.sin(this.yaw);
    const cosY = Math.cos(this.yaw);
    // Forward vector = (-sin(yaw), 0, -cos(yaw)), Right = (cos(yaw), 0, -sin(yaw))
    const wishX = -sinY * forward + cosY * strafe;
    const wishZ = -cosY * forward - sinY * strafe;

    this.playerVel.x = THREE.MathUtils.damp(this.playerVel.x, wishX * baseSpeed, 14, dt);
    this.playerVel.z = THREE.MathUtils.damp(this.playerVel.z, wishZ * baseSpeed, 14, dt);

    const inWater =
      this.getBlockAt(
        Math.floor(this.playerPos.x),
        Math.floor(this.playerPos.y + 0.5),
        Math.floor(this.playerPos.z),
      ) === BlockId.Water;

    if (this.flying) {
      let vyTarget = 0;
      if (this.keys.has('Space')) vyTarget += 7.5;
      if (this.keys.has('ShiftLeft') || this.keys.has('KeyC')) vyTarget -= 7.5;
      this.playerVel.y = THREE.MathUtils.damp(this.playerVel.y, vyTarget, 12, dt);
    } else {
      const gravity = inWater ? 8.0 : 24.0;
      this.playerVel.y -= gravity * dt;
      if (inWater && this.keys.has('Space')) {
        this.playerVel.y = 4.5;
      }

      if (this.onGround) {
        this.coyoteTimer = 0.11;
      } else {
        this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
      }

      if (this.jumpBufferTimer > 0) {
        this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
        if (this.coyoteTimer > 0) {
          this.playerVel.y = 8.4;
          this.onGround = false;
          this.coyoteTimer = 0;
          this.jumpBufferTimer = 0;
          voxelAudio.playJump();
        }
      }

      if (inWater && this.playerVel.y < -3.5) {
        this.playerVel.y = -3.5;
      }
    }

    // Axis-separated AABB resolution
    const nextX = this.playerPos.x + this.playerVel.x * dt;
    if (!this.collidesAt(nextX, this.playerPos.y, this.playerPos.z)) {
      this.playerPos.x = nextX;
    } else {
      this.playerVel.x = 0;
    }

    const nextZ = this.playerPos.z + this.playerVel.z * dt;
    if (!this.collidesAt(this.playerPos.x, this.playerPos.y, nextZ)) {
      this.playerPos.z = nextZ;
    } else {
      this.playerVel.z = 0;
    }

    const nextY = this.playerPos.y + this.playerVel.y * dt;
    if (!this.collidesAt(this.playerPos.x, nextY, this.playerPos.z)) {
      this.playerPos.y = nextY;
      this.onGround = false;
    } else {
      if (this.playerVel.y < 0) {
        this.onGround = true;
      }
      this.playerVel.y = 0;
    }

    // Safety floor clamp
    if (this.playerPos.y < 2) {
      this.spawnPlayerSafely();
    }

    // Walk bob & footsteps
    const horizSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);
    if (this.onGround && horizSpeed > 0.6) {
      this.walkBobPhase += horizSpeed * dt * 2.1;
      this.stepDistAccum += horizSpeed * dt;
      if (this.stepDistAccum > 2.2) {
        this.stepDistAccum = 0;
        voxelAudio.playFootstep();
      }
    }

    // Stream chunks around player
    this.ensureChunksAround(this.playerPos.x, this.playerPos.z);
    this.remeshDirtyChunks(2);

    // Camera placement with subtle walk bob & break shake
    const bobOffset = this.onGround && horizSpeed > 0.6 ? Math.sin(this.walkBobPhase) * 0.045 : 0;
    this.shakeIntensity = Math.max(0, this.shakeIntensity - dt * 0.35);
    const sx = (Math.random() - 0.5) * this.shakeIntensity;
    const sy = (Math.random() - 0.5) * this.shakeIntensity;

    this.camera.position.set(
      this.playerPos.x + sx,
      this.playerPos.y + 1.56 + bobOffset + sy,
      this.playerPos.z,
    );
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');

    // Update target block wireframe highlight
    const hit = this.raycastVoxel(6.5);
    if (hit) {
      this.targetedBlock = hit;
      this.highlightBox.visible = true;
      this.highlightBox.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    } else {
      this.targetedBlock = null;
      this.highlightBox.visible = false;
    }

    // Keep sun centered over player for crisp shadows
    this.sunLight.position.set(this.playerPos.x + 36, 70, this.playerPos.z + 28);
    this.sunLight.target.position.set(this.playerPos.x, 20, this.playerPos.z);
  }

  private updateMobsAndClouds(dt: number) {
    // Drift clouds gently
    for (const c of this.cloudsGroup.children) {
      c.position.x += dt * 1.1;
      if (c.position.x > 90) c.position.x = -90;
    }

    // Roaming multi-part mobs grounded on terrain
    for (const mob of this.mobs) {
      mob.turnTimer -= dt;
      if (mob.turnTimer <= 0) {
        mob.turnTimer = 2.5 + Math.random() * 4;
        mob.yaw += (Math.random() - 0.5) * 2.2;
      }

      const speed = mob.kind === 'explorer' ? 1.5 : 1.1;
      const nx = mob.x + Math.sin(mob.yaw) * speed * dt;
      const nz = mob.z + Math.cos(mob.yaw) * speed * dt;

      // Stay near spawn valley
      const distFromOrigin = Math.hypot(nx - 8, nz - 8);
      if (distFromOrigin > 26) {
        mob.yaw = Math.atan2(8 - mob.x, 8 - mob.z);
      } else {
        const nextSurf = this.getSurfaceHeightAt(nx, nz);
        if (nextSurf > SEA_LEVEL) {
          mob.x = nx;
          mob.z = nz;
        } else {
          mob.yaw += Math.PI * 0.65;
        }
      }

      const groundY = this.getSurfaceHeightAt(mob.x, mob.z) + 1;
      mob.group.position.set(
        mob.x,
        THREE.MathUtils.damp(mob.group.position.y || groundY, groundY, 10, dt),
        mob.z,
      );
      mob.group.rotation.y = mob.yaw;

      mob.walkPhase += dt * speed * 4.5;
      const swing = Math.sin(mob.walkPhase) * 0.55;
      if (mob.legs.length >= 2) {
        mob.legs[0].rotation.x = swing;
        mob.legs[1].rotation.x = -swing;
        if (mob.legs.length === 4) {
          mob.legs[2].rotation.x = -swing;
          mob.legs[3].rotation.x = swing;
        }
      }
      if (mob.arms.length === 2) {
        mob.arms[0].rotation.x = -swing * 0.7;
        mob.arms[1].rotation.x = swing * 0.7;
      }
    }
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private formatWorldTime(): { timeText: string; timePhase: TimePhase } {
    // worldTime 0.0 -> 06:00 Sunrise, 0.25 -> 12:00 Noon, 0.5 -> 18:00 Sunset, 0.75 -> 00:00 Midnight
    const totalHours = (this.worldTime * 24 + 6) % 24;
    const hours = Math.floor(totalHours);
    const mins = Math.floor((totalHours - hours) * 60);
    const hh = String(hours).padStart(2, '0');
    const mm = String(mins).padStart(2, '0');

    let timePhase: TimePhase = 'Day';
    if (hours >= 5 && hours < 8) timePhase = 'Dawn';
    else if (hours >= 8 && hours < 17) timePhase = 'Day';
    else if (hours >= 17 && hours < 20) timePhase = 'Dusk';
    else timePhase = 'Night';

    return { timeText: `${hh}:${mm}`, timePhase };
  }

  private updateDayNightCycle(dt: number) {
    this.elapsedTime += dt;
    this.sharedUniforms.uTime.value = this.elapsedTime;
    this.skyMaterial.uniforms.uTime.value = this.elapsedTime;

    if (dt > 0 && this.mode !== 'paused' && this.config.dayCycleSpeed > 0) {
      // Full 24h cycle = 180 seconds at 1x speed
      this.worldTime = (this.worldTime + (dt / 180) * this.config.dayCycleSpeed) % 1;
    }

    const angle = this.worldTime * Math.PI * 2;
    const sunY = Math.sin(angle);
    const sunX = Math.cos(angle);
    const sunZ = 0.28;
    _sunDir.set(sunX, sunY, sunZ).normalize();
    _moonDir.copy(_sunDir).negate();

    // Base version day colors
    _dayZenith.copy(this.skyColor);
    _dayHorizon.copy(this.fogColor);

    const isDawnSide = sunX > 0;
    const pack = this.activePack;
    let nightFactor = 0;
    let starVis = 0;
    let sunGlowInt = 0.35;

    if (sunY >= 0.28) {
      // Full Day
      const t = Math.min(1, (sunY - 0.28) / 0.45);
      _curZenith.copy(_dayZenith);
      _curHorizon.copy(_dayHorizon);
      _curSunCol.copy(_sunNoonCol);
      _curHemiSky.copy(_hemiDaySky);
      _curHemiGround.copy(_hemiDayGround);
      _curCloudCol.copy(_cloudDayCol);
      this.sunLight.intensity = (1.15 + t * 0.32) * (1 + pack.sunWarmth * 0.4);
      this.hemiLight.intensity = 0.72 + t * 0.1;
      this.scene.environmentIntensity = 0.32 + t * 0.06;
      sunGlowInt = 0.3 + (1 - t) * 0.25;
      nightFactor = 0;
      starVis = 0;
    } else if (sunY > -0.14) {
      // Sunrise / Sunset Transition
      const horizonProx = 1 - Math.abs(sunY) / 0.28;
      const twilightZenith = isDawnSide ? _dawnZenith : _duskZenith;
      const twilightHorizon = isDawnSide ? _dawnHorizon : _duskHorizon;

      if (sunY >= 0) {
        const dayMix = sunY / 0.28;
        _curZenith.lerpColors(twilightZenith, _dayZenith, dayMix);
        _curHorizon.lerpColors(twilightHorizon, _dayHorizon, dayMix);
        _curSunCol.lerpColors(_sunWarmCol, _sunNoonCol, dayMix);
        _curHemiSky.lerpColors(_hemiDawnSky, _hemiDaySky, dayMix);
        _curHemiGround.lerpColors(_hemiNightGround, _hemiDayGround, 0.4 + 0.6 * dayMix);
        _curCloudCol.lerpColors(_cloudWarmCol, _cloudDayCol, dayMix);
        this.sunLight.intensity = 0.45 + dayMix * 0.75;
        this.hemiLight.intensity = 0.45 + dayMix * 0.27;
        this.scene.environmentIntensity = 0.2 + dayMix * 0.12;
        nightFactor = (1 - dayMix) * 0.45;
      } else {
        const nightMix = Math.min(1, -sunY / 0.14);
        _curZenith.lerpColors(twilightZenith, _nightZenith, nightMix);
        _curHorizon.lerpColors(twilightHorizon, _nightHorizon, nightMix);
        _curSunCol.lerpColors(_sunWarmCol, _moonKeyCol, nightMix);
        _curHemiSky.lerpColors(_hemiDawnSky, _hemiNightSky, nightMix);
        _curHemiGround.copy(_hemiNightGround);
        _curCloudCol.lerpColors(_cloudWarmCol, _cloudNightCol, nightMix);
        this.sunLight.intensity = THREE.MathUtils.lerp(0.45, 0.36, nightMix);
        this.hemiLight.intensity = THREE.MathUtils.lerp(0.45, 0.32, nightMix);
        this.scene.environmentIntensity = THREE.MathUtils.lerp(0.2, 0.14, nightMix);
        nightFactor = 0.45 + nightMix * 0.55;
        starVis = Math.max(0, (nightMix - 0.25) / 0.75);
      }
      sunGlowInt = 0.35 + horizonProx * 0.65;
    } else {
      // Deep Night with Moonlight
      const deep = Math.min(1, (-sunY - 0.14) / 0.35);
      _curZenith.copy(_nightZenith);
      _curHorizon.copy(_nightHorizon);
      _curSunCol.copy(_moonKeyCol);
      _curHemiSky.copy(_hemiNightSky);
      _curHemiGround.copy(_hemiNightGround);
      _curCloudCol.copy(_cloudNightCol);
      this.sunLight.intensity = 0.34 - deep * 0.04;
      this.hemiLight.intensity = 0.32 - pack.shadowContrast * 0.18;
      this.scene.environmentIntensity = 0.14;
      sunGlowInt = 0.1;
      nightFactor = 1.0;
      starVis = 0.8 + deep * 0.2;
    }

    // Apply shadow contrast tuning for shader packs
    if (pack.shadowContrast > 0 && nightFactor < 0.7) {
      this.hemiLight.intensity *= 1 - pack.shadowContrast * 0.35;
      this.sunLight.intensity *= 1 + pack.shadowContrast * 0.25;
    }

    // Update sky dome, fog & shared shader uniforms
    this.skyDome.position.copy(this.camera.position);
    this.skyMaterial.uniforms.uZenithColor.value.copy(_curZenith);
    this.skyMaterial.uniforms.uHorizonColor.value.copy(_curHorizon);
    this.skyMaterial.uniforms.uSunDir.value.copy(_sunDir);
    this.skyMaterial.uniforms.uSunGlowColor.value.copy(_curSunCol);
    this.skyMaterial.uniforms.uSunGlowIntensity.value = sunGlowInt;
    this.skyMaterial.uniforms.uStarVisibility.value = starVis;

    this.sharedUniforms.uNightFactor.value = nightFactor;
    this.sharedUniforms.uSkyHorizonColor.value.copy(_curHorizon);
    this.sharedUniforms.uSunColor.value.copy(_curSunCol);

    if (this.gradePass) {
      this.gradePass.uniforms.uNightFactor.value = nightFactor;
    }

    _curFog.copy(_curHorizon);
    this.scene.background = _curFog;
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color.copy(_curFog);
    }

    // Position Sun & Moon discs on celestial arc around camera
    this.sunDisc.position.copy(this.camera.position).addScaledVector(_sunDir, 155);
    this.sunDisc.lookAt(this.camera.position);
    this.sunDisc.visible = _sunDir.y > -0.18;
    (this.sunDisc.material as THREE.MeshBasicMaterial).color.copy(_curSunCol);

    this.moonDisc.position.copy(this.camera.position).addScaledVector(_moonDir, 155);
    this.moonDisc.lookAt(this.camera.position);
    this.moonDisc.visible = _moonDir.y > -0.18;

    // Orient directional light along Sun (day) or Moon (night)
    const activeLightDir = sunY >= -0.05 ? _sunDir : _moonDir;
    const focusTarget = this.mode === 'title' ? _vec3B.set(8, 24, 8) : this.playerPos;
    this.sunLight.position.copy(focusTarget).addScaledVector(activeLightDir, 85);
    this.sunLight.target.position.copy(focusTarget);
    this.sunLight.target.updateMatrixWorld();
    this.sunLight.color.copy(_curSunCol);

    this.hemiLight.color.copy(_curHemiSky);
    this.hemiLight.groundColor.copy(_curHemiGround);

    if (this.cloudMat) {
      this.cloudMat.color.copy(_curCloudCol);
    }
  }

  private startLoop() {
    const tick = () => {
      if (this.disposed) return;
      const now = performance.now();
      const rawDt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      const dt = Math.min(rawDt, 0.05);

      // FPS counter
      this.fpsAccum += rawDt;
      this.fpsFrames++;
      if (this.fpsAccum >= 0.4) {
        this.currentFps = Math.round(this.fpsFrames / this.fpsAccum);
        this.fpsAccum = 0;
        this.fpsFrames = 0;
      }

      if (this.mode === 'title') {
        this.titleAngle += dt * 0.14;
        const radius = 22;
        const cx = 8 + Math.cos(this.titleAngle) * radius;
        const cz = 8 + Math.sin(this.titleAngle) * radius;
        const ground = this.getSurfaceHeightAt(8, 8);
        this.camera.up.set(0, 1, 0);
        this.camera.position.set(cx, ground + 12, cz);
        _vec3B.set(8, ground + 2, 8);
        this.camera.lookAt(_vec3B);
        this.highlightBox.visible = false;
        this.remeshDirtyChunks(3);
      } else if (this.mode === 'playing') {
        this.updatePlayer(dt);
      }

      this.updateDayNightCycle(dt);
      this.updateMobsAndClouds(dt);
      this.particles.update(dt);

      if (!this.isSoftwareGl && this.composer && this.activePack.id !== 'vanilla') {
        this.composer.render();
      } else {
        this.renderer.render(this.scene, this.camera);
      }

      // Push stats to UI periodically
      this.statsTimer += dt;
      if (this.statsTimer >= 0.12) {
        this.statsTimer = 0;
        const targetName = this.targetedBlock
          ? BLOCK_META[this.getBlockAt(this.targetedBlock.x, this.targetedBlock.y, this.targetedBlock.z)].name
          : null;
        const { timeText, timePhase } = this.formatWorldTime();
        this.onStatsCallback?.({
          fps: this.currentFps,
          x: Math.floor(this.playerPos.x),
          y: Math.floor(this.playerPos.y),
          z: Math.floor(this.playerPos.z),
          flying: this.flying,
          pointerLocked: this.pointerLocked,
          targetBlockName: targetName,
          chunksLoaded: this.chunks.size,
          worldTime: this.worldTime,
          timeText,
          timePhase,
        });
      }

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.afterDraw(tick);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private onResize = () => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    if (this.composer) {
      this.composer.setSize(w, h);
      const pr = this.renderer.getPixelRatio();
      this.bloomPass?.resolution.set(Math.max(1, Math.floor(w / 2)), Math.max(1, Math.floor(h / 2)));
      this.gradePass?.uniforms.uResolution.value.set(w * pr, h * pr);
    }
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.mode !== 'playing') return;

    if (e.code === 'Escape') {
      this.onRequestPauseCallback?.();
      return;
    }

    if (e.code === 'Space') {
      e.preventDefault();
      if (!this.keys.has('Space')) {
        const now = performance.now();
        if (now - this.lastSpaceTime < 260 && this.config.gameMode === 'creative') {
          this.toggleFly();
          this.lastSpaceTime = 0;
        } else {
          this.lastSpaceTime = now;
          this.jumpBufferTimer = 0.12;
        }
      }
    }

    if (e.code.startsWith('Digit')) {
      const n = parseInt(e.code.replace('Digit', ''), 10);
      if (n >= 1 && n <= 9) {
        this.onHotbarSlotCallback?.(n - 1);
      }
    }

    this.keys.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onWindowBlur = () => {
    this.keys.clear();
    this.joyX = 0;
    this.joyY = 0;
  };

  private onMouseMove = (e: MouseEvent) => {
    if (this.mode !== 'playing' || !this.pointerLocked) return;
    const sens = 0.0022;
    this.yaw -= e.movementX * sens;
    this.pitch = THREE.MathUtils.clamp(this.pitch - e.movementY * sens, -Math.PI / 2 + 0.04, Math.PI / 2 - 0.04);
  };

  private onMouseDown = (e: MouseEvent) => {
    if (this.mode !== 'playing' || this.config.platform !== 'windows') return;
    if (!this.pointerLocked) {
      this.requestPointerLock();
      return;
    }
    if (e.button === 0) {
      this.performBreakBlock();
    } else if (e.button === 2) {
      this.performPlaceBlock();
    }
  };

  private onWheel = (e: WheelEvent) => {
    if (this.mode !== 'playing') return;
    if (Math.abs(e.deltaY) > 4) {
      this.onHotbarSlotCallback?.(e.deltaY > 0 ? -1 : -2); // -1 next, -2 prev
    }
  };

  private onContextMenu = (e: MouseEvent) => {
    if (this.mode === 'playing') {
      e.preventDefault();
    }
  };

  private onPointerLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
  };

  private bindEvents() {
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onWindowBlur);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('wheel', this.onWheel, { passive: true });
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    this.renderer.domElement.addEventListener('mousedown', this.onMouseDown);
    this.renderer.domElement.addEventListener('contextmenu', this.onContextMenu);
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onWindowBlur);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('wheel', this.onWheel);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    this.renderer.domElement.removeEventListener('mousedown', this.onMouseDown);
    this.renderer.domElement.removeEventListener('contextmenu', this.onContextMenu);

    this.clearAllChunks();
    this.particles.dispose();
    this.skyDome.geometry.dispose();
    this.skyMaterial.dispose();
    this.sunDisc.geometry.dispose();
    (this.sunDisc.material as THREE.Material).dispose();
    this.moonDisc.geometry.dispose();
    (this.moonDisc.material as THREE.Material).dispose();
    this.composer?.dispose();
    this.atlasTexture?.dispose();
    this.opaqueMaterial?.dispose();
    this.waterMaterial?.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
