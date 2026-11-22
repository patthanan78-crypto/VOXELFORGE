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
import { ForgeModId } from '../data/forgeMods';
import {
  EFFORTLESS_BUILD_MODES,
  EffortlessBuildMode,
  EffortlessStatsState,
} from '../data/effortlessBuild';
import {
  formatMtrAnnouncementText,
  getMtrTrainSpec,
  MtrDepartureItem,
  MtrDepotConfig,
  MtrDirectionMode,
  MtrStationAnnouncement,
  MtrStationPlatformSchedule,
  MtrTrackBuilderOptions,
  MtrTrackSummary,
  MtrTrainScheduleData,
  MtrTrainTelemetry,
  MtrTurnCurveSpan,
} from '../data/mtrTransit';
import {
  applyTrainDoorAnimation,
  createMtrTrainConsist,
  disposeTrainConsist,
  MTR_CAR_SEAT_SLOTS,
  MTR_CAR_SPACING,
  MTR_FLOOR_Y,
  MtrActiveTrain,
} from './mtrTrains';
import {
  ATLAS_GRID,
  BLOCK_META,
  BlockId,
  createHeldBlockGeometry,
  createProceduralAtlas,
  updateHeldBlockUvs,
} from './blocks';
import { hashSeed, SeededNoise } from './noise';
import {
  createVoxelExplorerMob,
  createVoxelPigMob,
  createVoxelSlimeMob,
  PooledParticleSystem,
  VoxelMob,
} from './mobs';
import { voxelAudio } from './audio';
import {
  makeWorldKey,
  normalizeSeed,
  SavedWorldState,
  WorldType,
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
  trackWalkMode: boolean;
  trackCurveStyle: 'smooth' | 'straight';
  trackAnchor: {
    startPos: [number, number, number];
    endPos: [number, number, number];
    lengthBlocks: number;
    railName: string;
    isCurve: boolean;
  } | null;
  trainInteraction: {
    riding: boolean;
    seated: boolean;
    depotId: string | null;
    trainName: string | null;
    carIndex: number;
    carCount: number;
    doorOpen: boolean;
    doorProgress: number;
    trainStatus: string | null;
    nearbyTrain: {
      depotId: string;
      trainName: string;
      carIndex: number;
      doorOpen: boolean;
      status: string;
    } | null;
    onboardNpcCount: number;
  };
  effortless: EffortlessStatsState;
}

export interface EngineConfig {
  version: MinecraftVersion;
  platform: PlatformTarget;
  performance: PerformancePreset;
  gameMode: GameMode;
  worldType: WorldType;
  seed: string;
  shaderPack: ShaderPackId;
  dayCycleSpeed: number;
  activeMods?: ForgeModId[];
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

  private heldBlockGeo: THREE.BoxGeometry | null = null;
  private heldBlockMat: THREE.MeshStandardMaterial | null = null;
  private heldBlockMesh: THREE.Mesh | null = null;
  private swingTimer = 0;

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
  private yaw = 0;
  private pitch = -0.02;
  private onGround = false;
  private flying = false;
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private lastSpaceTime = 0;
  private walkBobPhase = 0;
  private stepDistAccum = 0;
  private shakeIntensity = 0;

  private selectedBlock: BlockId = BlockId.OakPlanks;
  private targetedBlock: { x: number; y: number; z: number; nx: number; ny: number; nz: number } | null = null;

  // Inputs
  private keys = new Set<string>();
  private joyX = 0;
  private joyY = 0;
  private touchSprint = false;
  private touchDescend = false;
  private pointerLocked = false;
  private activeMods = new Set<ForgeModId>();

  // Minecraft Transit Railway (MTR) Depots & Active Trains
  private mtrDepots: MtrDepotConfig[] = [];
  private mtrTrains = new Map<string, MtrActiveTrain>();
  private mtrAnnouncements = new Map<string, MtrStationAnnouncement>();
  private lastAnnouncementAt = 0;
  private stationPassTracker = new Map<string, string>();
  private ridingDepotId: string | null = null;
  private ridingCarIndex = 0;
  private ridingLocalPos = new THREE.Vector3(0, MTR_FLOOR_Y, 0);
  private ridingSeated = false;
  private ridingSeatIndex = -1;
  private cachedNearbyTrain: {
    depotId: string;
    trainName: string;
    carIndex: number;
    doorOpen: boolean;
    status: string;
  } | null = null;
  private cachedStationClusters: {
    id: string;
    stopCell: [number, number, number];
    waitPos: [number, number, number];
    cells: Set<string>;
  }[] = [];
  private stationScanTimer = 0;

  // Create-Mod style Walk-to-Extend Rail Placement
  private trackWalkModeEnabled = true;
  private trackCurveStyle: 'smooth' | 'straight' = 'smooth';
  private trackAnchorStart: {
    x: number;
    y: number;
    z: number;
    railId: BlockId;
    fx: number;
    fz: number;
  } | null = null;
  private trackPreviewMesh!: THREE.InstancedMesh;
  private trackPreviewDummy = new THREE.Object3D();

  // Effortless Building (Rust Remake) state
  private effortlessMode: EffortlessBuildMode = 'normal';
  private effortlessMirrorX = false;
  private effortlessMirrorZ = false;
  private effortlessRadial = false;
  private effortlessHollow = false;
  private effortlessMirrorCenter: [number, number, number] = [8, 5, 8];
  private effortlessAnchor: [number, number, number] | null = null;
  private effortlessUndoStack: { edits: { x: number; y: number; z: number; prev: BlockId }[] }[] = [];
  private effortlessPreviewMesh!: THREE.InstancedMesh;
  private effortlessPreviewDummy = new THREE.Object3D();
  private effortlessPreviewCount = 0;

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
  private railFacingHints = new Map<string, 'ns' | 'ew'>();

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
    this.activeMods = new Set(initialConfig.activeMods ?? []);
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
    this.camera = new THREE.PerspectiveCamera(72, width / height, 0.05, 260);
    this.camera.up.set(0, 1, 0);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

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

    // Ghost 3D preview for Create-style Walk-to-Extend rail length & long turns
    const previewGeo = new THREE.BoxGeometry(0.88, 0.14, 0.88);
    const previewMat = new THREE.MeshBasicMaterial({
      color: 0x34d399,
      transparent: true,
      opacity: 0.56,
      depthWrite: false,
    });
    this.trackPreviewMesh = new THREE.InstancedMesh(previewGeo, previewMat, 180);
    this.trackPreviewMesh.frustumCulled = false;
    this.trackPreviewMesh.visible = false;
    this.scene.add(this.trackPreviewMesh);

    // Ghost 3D preview for Effortless Building shapes & symmetry mirrors
    const effGeo = new THREE.BoxGeometry(1.01, 1.01, 1.01);
    const effMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
    });
    this.effortlessPreviewMesh = new THREE.InstancedMesh(effGeo, effMat, 600);
    this.effortlessPreviewMesh.frustumCulled = false;
    this.effortlessPreviewMesh.visible = false;
    this.scene.add(this.effortlessPreviewMesh);

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

    if (!this.heldBlockMesh) {
      this.heldBlockGeo = createHeldBlockGeometry(this.selectedBlock);
      this.heldBlockMat = new THREE.MeshStandardMaterial({
        map: this.atlasTexture,
        roughness: 0.85,
        metalness: 0.04,
      });
      this.heldBlockMesh = new THREE.Mesh(this.heldBlockGeo, this.heldBlockMat);
      this.heldBlockMesh.position.set(0.205, -0.165, -0.255);
      this.heldBlockMesh.rotation.set(0.18, -0.62, 0.08);
      this.heldBlockMesh.scale.set(1, this.selectedBlock === BlockId.PlatformEdge ? 0.5 : 1, 1);
      this.heldBlockMesh.castShadow = false;
      this.heldBlockMesh.receiveShadow = false;
      this.heldBlockMesh.visible = this.mode !== 'title';
      this.camera.add(this.heldBlockMesh);
    } else if (this.heldBlockMat) {
      this.heldBlockMat.map = this.atlasTexture;
      this.heldBlockMat.needsUpdate = true;
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

  public setActiveMods(mods: ForgeModId[]) {
    this.activeMods = new Set(mods);
    this.config = { ...this.config, activeMods: mods };
    if (!this.activeMods.has('effortless_building')) {
      this.effortlessAnchor = null;
      this.effortlessPreviewCount = 0;
      if (this.effortlessPreviewMesh) {
        this.effortlessPreviewMesh.visible = false;
      }
    }
    this.updateDayNightCycle(0);
  }

  public applyVersionAndPerformance(nextConfig: EngineConfig, forceWorldRebuild = false) {
    const worldChanged =
      this.config.version.id !== nextConfig.version.id ||
      this.config.seed !== nextConfig.seed ||
      this.config.worldType !== nextConfig.worldType;

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

    if (worldChanged || forceWorldRebuild) {
      this.noise = new SeededNoise(hashSeed(nextConfig.seed || 'voxelforge'));
      this.blockEdits.clear();
      this.chunkEdits.clear();
      this.clearAllChunks();
      this.clearMobs();
      this.clearMtrTrains();
      this.mtrDepots = [];
      this.mtrAnnouncements.clear();
      this.effortlessAnchor = null;
      this.effortlessUndoStack = [];
      this.spawnMobs();
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
    const announcements: Record<string, MtrStationAnnouncement> = {};
    this.mtrAnnouncements.forEach((val, key) => {
      announcements[key] = { ...val };
    });
    return {
      key: makeWorldKey(this.config.version.id, this.config.seed, this.config.worldType),
      versionId: this.config.version.id,
      seed: normalizeSeed(this.config.seed),
      worldType: this.config.worldType,
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
      mtrDepots: this.mtrDepots.map((d) => ({ ...d, depotPos: [...d.depotPos] as [number, number, number] })),
      mtrAnnouncements: announcements,
    };
  }

  public importWorldState(saved: SavedWorldState | null) {
    this.blockEdits.clear();
    this.chunkEdits.clear();
    this.clearMtrTrains();
    this.mtrDepots = [];
    this.mtrAnnouncements.clear();
    this.effortlessAnchor = null;
    this.effortlessUndoStack = [];

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
      if (Array.isArray(saved.mtrDepots)) {
        this.mtrDepots = saved.mtrDepots.map((d) => ({
          ...d,
          depotPos: [...d.depotPos] as [number, number, number],
        }));
      }
      if (saved.mtrAnnouncements && typeof saved.mtrAnnouncements === 'object') {
        for (const [stationId, ann] of Object.entries(saved.mtrAnnouncements)) {
          if (ann && typeof ann.stationId === 'string') {
            this.mtrAnnouncements.set(stationId, { ...ann });
          }
        }
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
    for (const d of this.mtrDepots) {
      this.syncTrainForDepot(d);
    }
  }

  public resetWorld() {
    this.blockEdits.clear();
    this.chunkEdits.clear();
    this.clearMtrTrains();
    this.mtrDepots = [];
    this.mtrAnnouncements.clear();
    this.effortlessAnchor = null;
    this.effortlessUndoStack = [];
    this.worldTime = 0.16;
    this.updateDayNightCycle(0);
    this.spawnPlayerSafely();
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    this.clearAllChunks();
    this.ensureChunksAround(this.playerPos.x, this.playerPos.z);
    this.remeshDirtyChunks();
  }

  public setMode(nextMode: 'title' | 'playing' | 'paused') {
    this.mode = nextMode;
    if (this.heldBlockMesh) {
      this.heldBlockMesh.visible = nextMode !== 'title';
    }
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
    if (this.heldBlockGeo) {
      updateHeldBlockUvs(this.heldBlockGeo, blockId);
    }
    if (this.heldBlockMesh) {
      this.heldBlockMesh.scale.set(1, blockId === BlockId.PlatformEdge ? 0.5 : 1, 1);
    }
  }

  public setTouchJoystick(x: number, y: number) {
    this.joyX = x;
    this.joyY = y;
  }

  public setTouchSprint(active: boolean) {
    this.touchSprint = active;
  }

  public setTouchDescend(active: boolean) {
    this.touchDescend = active;
  }

  public executeCommand(rawCmd: string): { reply: string; gameModeChanged?: GameMode } {
    const cmd = rawCmd.trim();
    if (!cmd) return { reply: '' };
    const clean = cmd.startsWith('/') ? cmd.slice(1) : cmd;
    const parts = clean.split(/\s+/);
    const root = (parts[0] || '').toLowerCase();

    if (root === 'time' && parts[1]?.toLowerCase() === 'set') {
      const target = (parts[2] || '').toLowerCase();
      if (target === 'day' || target === 'noon' || target === '6000') {
        this.setWorldTime(0.25);
        return { reply: 'Set the time to Day (12:00)' };
      }
      if (target === 'dawn' || target === 'sunrise' || target === '0') {
        this.setWorldTime(0.01);
        return { reply: 'Set the time to Dawn (06:15)' };
      }
      if (target === 'dusk' || target === 'sunset' || target === '12000') {
        this.setWorldTime(0.49);
        return { reply: 'Set the time to Dusk (17:45)' };
      }
      if (target === 'night' || target === 'midnight' || target === '18000') {
        this.setWorldTime(0.75);
        return { reply: 'Set the time to Night (00:00)' };
      }
      return { reply: 'Usage: /time set <dawn|day|dusk|night>' };
    }

    if (root === 'gamemode' || root === 'gm') {
      const modeArg = (parts[1] || '').toLowerCase();
      if (modeArg === 'creative' || modeArg === 'c' || modeArg === '1') {
        return { reply: 'Set game mode to Creative', gameModeChanged: 'creative' };
      }
      if (modeArg === 'survival' || modeArg === 's' || modeArg === '0') {
        this.flying = false;
        return { reply: 'Set game mode to Survival', gameModeChanged: 'survival' };
      }
      return { reply: 'Usage: /gamemode <creative|survival>' };
    }

    if (root === 'fly') {
      if (this.config.gameMode !== 'creative') {
        return { reply: 'Switch to Creative mode first (/gamemode creative)' };
      }
      this.toggleFly();
      return { reply: this.flying ? 'Flight enabled' : 'Flight disabled' };
    }

    if (root === 'tp') {
      const tx = Number(parts[1]);
      const ty = Number(parts[2]);
      const tz = Number(parts[3]);
      if (Number.isFinite(tx) && Number.isFinite(ty) && Number.isFinite(tz)) {
        this.playerPos.set(tx, Math.max(2, Math.min(CHUNK_H - 3, ty)), tz);
        this.playerVel.set(0, 0, 0);
        this.ensureChunksAround(this.playerPos.x, this.playerPos.z);
        this.remeshDirtyChunks();
        return { reply: `Teleported to ${Math.floor(tx)}, ${Math.floor(ty)}, ${Math.floor(tz)}` };
      }
      return { reply: 'Usage: /tp <x> <y> <z>' };
    }

    if (root === 'anchor') {
      const dest = (parts[1] || '').toLowerCase();
      if (dest === 'village') {
        this.playerPos.set(8.5, 5.2, -20.5);
        this.playerVel.set(0, 0, 0);
        this.yaw = 0;
        this.ensureChunksAround(this.playerPos.x, this.playerPos.z);
        this.remeshDirtyChunks();
        return { reply: 'Drin Anchor warped to Plains Village [8, 5, -20]' };
      }
      if (dest === 'spawn' || dest === 'home') {
        this.spawnPlayerSafely();
        this.ensureChunksAround(this.playerPos.x, this.playerPos.z);
        this.remeshDirtyChunks();
        return { reply: 'Drin Anchor warped back to Spawn Plains [8, 5, 8]' };
      }
      return { reply: 'Usage: /anchor <spawn|village>' };
    }

    if (root === 'mtr') {
      const sub = (parts[1] || '').toLowerCase();
      if (sub === 'demo') {
        const built = this.buildStarterMtrLine();
        return {
          reply: `Built MTR Line & Yellow Depot [${built.depotPos.join(', ')}] + Red Station [${built.stationPos.join(', ')}]`,
        };
      }
      if (sub === 'leave' || sub === 'dismount') {
        this.exitTrainCleanly(1);
        return { reply: 'Stepped off train' };
      }
      return { reply: 'Usage: /mtr demo | /mtr leave' };
    }

    return { reply: 'Commands: /time set day|night · /gamemode creative|survival · /fly · /anchor village|spawn · /mtr demo · /tp x y z' };
  }

  private isRailBlock(id: BlockId): boolean {
    return id === BlockId.RailNormal || id === BlockId.RailStation || id === BlockId.RailDepot;
  }

  private disembarkNpcsFromTrain(depotId: string) {
    const train = this.mtrTrains.get(depotId);
    for (const mob of this.mobs) {
      if (mob.ridingDepotId !== depotId) continue;
      const car = train?.cars[mob.ridingCarIndex] ?? train?.cars[0];
      if (car && mob.seatSlotIndex >= 0 && mob.seatSlotIndex < car.seatOccupants.length) {
        car.seatOccupants[mob.seatSlotIndex] = null;
      }
      if (car) {
        this.carLocalToWorld(1.45, 0, 0.94, car.group, _vec3A);
        mob.x = _vec3A.x;
        mob.z = _vec3A.z;
      }
      mob.y = this.findSafeStandY(mob.x, Math.round(mob.y), mob.z);
      mob.vy = 0;
      mob.onGround = true;
      mob.transitState = 'roam';
      mob.ridingDepotId = null;
      mob.seatSlotIndex = -1;
      mob.boardedStationKey = null;
      mob.transitCooldown = 6 + Math.random() * 5;
      if (mob.legs.length >= 2) {
        mob.legs[0].rotation.x = 0;
        mob.legs[1].rotation.x = 0;
      }
      if (mob.arms.length >= 2) {
        mob.arms[0].rotation.x = 0;
        mob.arms[1].rotation.x = 0;
      }
      mob.group.position.set(mob.x, mob.y, mob.z);
    }
  }

  private clearMtrTrains() {
    for (const depotId of this.mtrTrains.keys()) {
      this.disembarkNpcsFromTrain(depotId);
    }
    this.ridingDepotId = null;
    this.ridingSeated = false;
    this.ridingSeatIndex = -1;
    this.stationPassTracker.clear();
    for (const train of this.mtrTrains.values()) {
      disposeTrainConsist(train, this.scene);
    }
    this.mtrTrains.clear();
  }

  private syncTrainForDepot(depot: MtrDepotConfig) {
    this.disembarkNpcsFromTrain(depot.id);
    const existing = this.mtrTrains.get(depot.id);
    if (existing) {
      disposeTrainConsist(existing, this.scene);
      this.mtrTrains.delete(depot.id);
    }
    this.stationPassTracker.delete(depot.id);

    const train = createMtrTrainConsist(
      depot.id,
      depot.trainModelId,
      depot.carCount,
      depot.depotPos,
      this.scene,
    );
    train.status = depot.dispatched ? 'Running' : 'In Depot';
    train.dwellTotal = Math.max(2.6, depot.stationDwellSeconds);
    train.doorProgress = depot.dispatched ? 0 : 1;
    train.doorTarget = depot.dispatched ? 0 : 1;
    train.doorPhase = depot.dispatched ? 'closed' : 'open';
    train.lastChimeState = depot.dispatched ? 'closed' : 'open';

    // Pre-orient train toward first connected track neighbor & seed spaced trail for trailing cars
    const neighbors = this.getNeighborRails(
      depot.depotPos[0],
      depot.depotPos[1],
      depot.depotPos[2],
    );
    const dirMode: MtrDirectionMode = depot.directionMode ?? 'one_way_cw';
    const firstNext = this.chooseNextRailCell(depot.depotPos, null, dirMode) ?? neighbors[0] ?? null;
    const yaw = firstNext
      ? Math.atan2(firstNext[0] - depot.depotPos[0], firstNext[2] - depot.depotPos[2])
      : 0;
    train.yaw = yaw;
    train.trail = [];
    const totalTrailPts = Math.ceil((depot.carCount * MTR_CAR_SPACING + 4) / 0.25);
    for (let k = 0; k <= totalTrailPts; k++) {
      const dist = k * 0.25;
      train.trail.push({
        x: depot.depotPos[0] + 0.5 - Math.sin(yaw) * dist,
        y: depot.depotPos[1] + 0.14,
        z: depot.depotPos[2] + 0.5 - Math.cos(yaw) * dist,
        yaw,
      });
    }
    for (let i = 0; i < train.cars.length; i++) {
      const offset = i * MTR_CAR_SPACING;
      train.cars[i].group.position.set(
        train.worldPos.x - Math.sin(yaw) * offset,
        train.worldPos.y,
        train.worldPos.z - Math.cos(yaw) * offset,
      );
      train.cars[i].group.rotation.y = yaw;
    }
    applyTrainDoorAnimation(train, 0);
    this.mtrTrains.set(depot.id, train);
  }

  public scanMtrTracks(): MtrTrackSummary {
    let normalCount = 0;
    let stationCount = 0;
    let depotCount = 0;
    const stationPositions: [number, number, number][] = [];
    const depotPositions: [number, number, number][] = [];

    for (const chunk of this.chunks.values()) {
      const ox = chunk.cx * CHUNK_W;
      const oz = chunk.cz * CHUNK_D;
      for (let y = 0; y < CHUNK_H; y++) {
        for (let lz = 0; lz < CHUNK_D; lz++) {
          for (let lx = 0; lx < CHUNK_W; lx++) {
            const id = chunk.blocks[(y * CHUNK_D + lz) * CHUNK_W + lx] as BlockId;
            if (id === BlockId.RailNormal) {
              normalCount++;
            } else if (id === BlockId.RailStation) {
              stationCount++;
              if (stationPositions.length < 32) {
                stationPositions.push([ox + lx, y, oz + lz]);
              }
            } else if (id === BlockId.RailDepot) {
              depotCount++;
              if (depotPositions.length < 32) {
                depotPositions.push([ox + lx, y, oz + lz]);
              }
            }
          }
        }
      }
    }

    return { normalCount, stationCount, depotCount, stationPositions, depotPositions };
  }

  public getMtrDepots(): MtrDepotConfig[] {
    return this.mtrDepots.map((d) => ({ ...d, depotPos: [...d.depotPos] as [number, number, number] }));
  }

  private getTrainOnboardNpcCount(depotId: string): number {
    let count = 0;
    for (const mob of this.mobs) {
      if (mob.transitState === 'riding' && mob.ridingDepotId === depotId) {
        count++;
      }
    }
    return count;
  }

  public getMtrTrainTelemetry(): MtrTrainTelemetry[] {
    return this.mtrDepots.map((d) => {
      const active = this.mtrTrains.get(d.id);
      const spec = getMtrTrainSpec(d.trainModelId);
      const doorProgress = active ? active.doorProgress : 0;
      return {
        depotId: d.id,
        depotName: d.name,
        trainName: spec.name,
        city: spec.city,
        status: active ? active.status : d.dispatched ? 'No Track' : 'In Depot',
        x: Math.round(active?.worldPos.x ?? d.depotPos[0]),
        y: Math.round(active?.worldPos.y ?? d.depotPos[1]),
        z: Math.round(active?.worldPos.z ?? d.depotPos[2]),
        carCount: d.carCount,
        speedBlocksPerSec: active ? Number(active.currentSpeed.toFixed(1)) : 0,
        directionMode: d.directionMode ?? 'one_way_cw',
        doorOpen: doorProgress > 0.65,
        doorProgress: Number(doorProgress.toFixed(2)),
        onboardNpcCount: this.getTrainOnboardNpcCount(d.id),
      };
    });
  }

  public reverseTrainDirection(depotId: string) {
    const depot = this.mtrDepots.find((d) => d.id === depotId);
    if (!depot) return;
    const currentMode: MtrDirectionMode = depot.directionMode ?? 'one_way_cw';
    depot.directionMode =
      currentMode === 'one_way_cw'
        ? 'one_way_ccw'
        : currentMode === 'one_way_ccw'
          ? 'one_way_cw'
          : 'two_way';

    const train = this.mtrTrains.get(depotId);
    if (train) {
      const oldNext = train.nextCell;
      const oldPrev = train.prevCell;
      train.prevCell = oldNext;
      train.nextCell = oldPrev;
      train.progress = oldNext && oldPrev ? Math.max(0, 1 - train.progress) : 0;
      train.dwellTimer = 0;
    }
    this.onWorldDirtyCallback?.();
  }

  public getMtrAnnouncements(): MtrStationAnnouncement[] {
    return Array.from(this.mtrAnnouncements.values());
  }

  public setMtrAnnouncement(ann: MtrStationAnnouncement) {
    this.mtrAnnouncements.set(ann.stationId, { ...ann });
    this.onWorldDirtyCallback?.();
  }

  public deleteMtrAnnouncement(stationId: string) {
    this.mtrAnnouncements.delete(stationId);
    this.onWorldDirtyCallback?.();
  }

  public testStationAnnouncement(stationId: string) {
    const ann = this.mtrAnnouncements.get(stationId);
    if (ann) {
      const text = formatMtrAnnouncementText(ann);
      voxelAudio.playStationAnnouncement(
        text,
        ann.mode === 'recorded' ? ann.recordedAudioDataUrl : undefined,
      );
      return;
    }
    const schedule = this.getMtrTrainSchedule();
    const matched = schedule.stations.find((s) => s.stationId === stationId);
    const label = matched?.platformLabel ?? 'Station Platform';
    voxelAudio.playStationAnnouncement(
      `This station is ${label}. Please mind the gap between the train and the platform.`,
    );
  }

  private triggerArrivalAnnouncementForCell(cell: [number, number, number], depotId: string) {
    if (this.cachedStationClusters.length === 0) {
      this.refreshStationClusters();
    }
    const cellKey = `${cell[0]},${cell[1]},${cell[2]}`;
    const clusterIdx = this.cachedStationClusters.findIndex((st) => st.cells.has(cellKey));
    const cluster = clusterIdx >= 0 ? this.cachedStationClusters[clusterIdx] : null;
    const dist = Math.hypot(this.playerPos.x - (cell[0] + 0.5), this.playerPos.z - (cell[2] + 0.5));
    if (this.ridingDepotId !== depotId && dist > 28) return;

    const now = performance.now();
    if (now - this.lastAnnouncementAt < 1800) return;

    const ann = cluster ? this.mtrAnnouncements.get(cluster.id) : undefined;
    if (ann && ann.mode === 'mute') return;

    this.lastAnnouncementAt = now;
    if (ann) {
      const text = formatMtrAnnouncementText(ann);
      voxelAudio.playStationAnnouncement(
        text,
        ann.mode === 'recorded' ? ann.recordedAudioDataUrl : undefined,
      );
    } else {
      const label = clusterIdx >= 0 ? `Platform ${clusterIdx + 1}` : 'this station';
      voxelAudio.playStationAnnouncement(
        `This station is ${label}. Please mind the gap between the train and the platform.`,
      );
    }
  }

  public getMtrTrainSchedule(): MtrTrainScheduleData {
    // Cluster all Red Station Rail blocks into individual station platforms
    const stationCells = new Map<string, [number, number, number]>();
    for (const chunk of this.chunks.values()) {
      const ox = chunk.cx * CHUNK_W;
      const oz = chunk.cz * CHUNK_D;
      for (let y = 0; y < CHUNK_H; y++) {
        for (let lz = 0; lz < CHUNK_D; lz++) {
          for (let lx = 0; lx < CHUNK_W; lx++) {
            const id = chunk.blocks[(y * CHUNK_D + lz) * CHUNK_W + lx] as BlockId;
            if (id === BlockId.RailStation) {
              const wx = ox + lx;
              const wz = oz + lz;
              stationCells.set(`${wx},${y},${wz}`, [wx, y, wz]);
            }
          }
        }
      }
    }

    const visited = new Set<string>();
    const clusters: { id: string; cells: Set<string>; center: [number, number, number] }[] = [];

    for (const [key, coord] of stationCells.entries()) {
      if (visited.has(key)) continue;
      const queue: [number, number, number][] = [coord];
      const clusterSet = new Set<string>([key]);
      visited.add(key);
      let sumX = 0;
      let sumY = 0;
      let sumZ = 0;
      let count = 0;

      while (queue.length > 0) {
        const cur = queue.shift()!;
        sumX += cur[0];
        sumY += cur[1];
        sumZ += cur[2];
        count++;
        for (const [dx, dz] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          for (const dy of [0, 1, -1]) {
            const nk = `${cur[0] + dx},${cur[1] + dy},${cur[2] + dz}`;
            if (stationCells.has(nk) && !visited.has(nk)) {
              visited.add(nk);
              clusterSet.add(nk);
              queue.push(stationCells.get(nk)!);
            }
          }
        }
      }

      clusters.push({
        id: `station-${Math.round(sumX / count)}-${Math.round(sumZ / count)}`,
        cells: clusterSet,
        center: [Math.round(sumX / count), Math.round(sumY / count), Math.round(sumZ / count)],
      });
    }

    clusters.sort((a, b) => a.center[2] - b.center[2] || a.center[0] - b.center[0]);

    const formatDirLabel = (mode: MtrDirectionMode | undefined): string => {
      if (mode === 'one_way_ccw') return 'One-Way CCW';
      if (mode === 'two_way') return 'Two-Way Shuttle';
      return 'One-Way CW';
    };

    const stations: MtrStationPlatformSchedule[] = clusters.map((cluster, idx) => {
      let platformStatus: 'Boarding' | 'Approaching' | 'Clear' = 'Clear';
      let dwellRemainingSeconds = 0;
      let activeTrainName: string | null = null;
      const departures: MtrDepartureItem[] = [];

      for (const depot of this.mtrDepots) {
        const spec = getMtrTrainSpec(depot.trainModelId);
        const train = this.mtrTrains.get(depot.id);
        const mode: MtrDirectionMode = depot.directionMode ?? 'one_way_cw';
        const dirLabel = formatDirLabel(mode);

        if (!depot.dispatched || !train) {
          departures.push({
            depotId: depot.id,
            depotName: depot.name,
            trainName: spec.name,
            city: spec.city,
            lineLabel: spec.lineLabel,
            accentHex: spec.accentHex,
            stripeHex: spec.stripeHex,
            etaSeconds: 999,
            status: 'In Depot',
            directionLabel: dirLabel,
            carCount: depot.carCount,
          });
          continue;
        }

        const curKey = `${train.currentCell[0]},${train.currentCell[1]},${train.currentCell[2]}`;
        if (cluster.cells.has(curKey) && train.dwellTimer > 0) {
          platformStatus = 'Boarding';
          dwellRemainingSeconds = Math.max(dwellRemainingSeconds, Number(train.dwellTimer.toFixed(1)));
          activeTrainName = spec.name;
          departures.push({
            depotId: depot.id,
            depotName: depot.name,
            trainName: spec.name,
            city: spec.city,
            lineLabel: spec.lineLabel,
            accentHex: spec.accentHex,
            stripeHex: spec.stripeHex,
            etaSeconds: 0,
            status: 'Boarding',
            directionLabel: dirLabel,
            carCount: depot.carCount,
          });
          continue;
        }

        // Trace rail path forward up to 220 hops to estimate ETA to the stop block at end of this station
        let simCur: [number, number, number] = [...train.currentCell] as [number, number, number];
        let simPrev: [number, number, number] | null = train.prevCell
          ? ([...train.prevCell] as [number, number, number])
          : null;
        let simNext: [number, number, number] | null = train.nextCell
          ? ([...train.nextCell] as [number, number, number])
          : null;
        let hops = -1;
        let insideThisStation = cluster.cells.has(curKey) && !this.stationPassTracker.has(depot.id);

        for (let step = 1; step <= 220; step++) {
          const next =
            step === 1 && simNext
              ? simNext
              : this.chooseNextRailCell(simCur, simPrev, mode);
          if (!next) {
            if (insideThisStation) {
              hops = Math.max(1, step - 1);
            }
            break;
          }
          const nk = `${next[0]},${next[1]},${next[2]}`;
          const isTurnBack =
            simPrev !== null &&
            next[0] === simPrev[0] &&
            next[1] === simPrev[1] &&
            next[2] === simPrev[2];
          if (insideThisStation && (!cluster.cells.has(nk) || isTurnBack)) {
            hops = Math.max(1, step - 1);
            break;
          }
          if (!insideThisStation && cluster.cells.has(nk) && !(cluster.cells.has(curKey) && this.stationPassTracker.has(depot.id))) {
            insideThisStation = true;
            // Check immediately if next is also the last cell of this station
            const afterNext = this.chooseNextRailCell(next, simCur, mode);
            const afterKey = afterNext ? `${afterNext[0]},${afterNext[1]},${afterNext[2]}` : '';
            if (!afterNext || !cluster.cells.has(afterKey)) {
              hops = step;
              break;
            }
          }
          simPrev = simCur;
          simCur = next;
          simNext = null;
        }

        const speed = Math.max(2, depot.cruiseSpeed);
        const etaSeconds =
          hops > 0
            ? Math.max(1, Math.round((hops - train.progress) / speed + train.dwellTimer))
            : 180;
        const depStatus: MtrDepartureItem['status'] =
          hops > 0 && etaSeconds <= 6 ? 'Approaching' : 'En Route';
        if (depStatus === 'Approaching' && platformStatus === 'Clear') {
          platformStatus = 'Approaching';
        }

        departures.push({
          depotId: depot.id,
          depotName: depot.name,
          trainName: spec.name,
          city: spec.city,
          lineLabel: spec.lineLabel,
          accentHex: spec.accentHex,
          stripeHex: spec.stripeHex,
          etaSeconds,
          status: depStatus,
          directionLabel: dirLabel,
          carCount: depot.carCount,
        });
      }

      departures.sort((a, b) => a.etaSeconds - b.etaSeconds);

      const ann = this.mtrAnnouncements.get(cluster.id) ?? null;
      return {
        stationId: cluster.id,
        platformLabel: ann?.stationName?.trim() || `Platform ${idx + 1}`,
        centerPos: cluster.center,
        railCount: cluster.cells.size,
        platformStatus,
        dwellRemainingSeconds,
        activeTrainName,
        upcomingDepartures: departures,
        announcement: ann,
      };
    });

    return {
      stations,
      totalDispatchedTrains: this.mtrDepots.filter((d) => d.dispatched).length,
      generatedAt: Date.now(),
    };
  }

  public upsertMtrDepot(depot: MtrDepotConfig) {
    const idx = this.mtrDepots.findIndex((d) => d.id === depot.id);
    const cloned: MtrDepotConfig = {
      ...depot,
      depotPos: [...depot.depotPos] as [number, number, number],
    };
    const existingTrain = this.mtrTrains.get(depot.id);
    const shouldRebuildMesh =
      !existingTrain ||
      existingTrain.spec.id !== cloned.trainModelId ||
      existingTrain.cars.length !== cloned.carCount ||
      !cloned.dispatched;

    if (idx >= 0) {
      this.mtrDepots[idx] = cloned;
    } else {
      this.mtrDepots.push(cloned);
    }

    if (shouldRebuildMesh) {
      this.syncTrainForDepot(cloned);
    } else if (existingTrain) {
      existingTrain.status = cloned.dispatched ? 'Running' : 'In Depot';
    }
    this.onWorldDirtyCallback?.();
  }

  public deleteMtrDepot(depotId: string) {
    this.disembarkNpcsFromTrain(depotId);
    this.mtrDepots = this.mtrDepots.filter((d) => d.id !== depotId);
    const train = this.mtrTrains.get(depotId);
    if (train) {
      disposeTrainConsist(train, this.scene);
      this.mtrTrains.delete(depotId);
    }
    this.stationPassTracker.delete(depotId);
    if (this.ridingDepotId === depotId) {
      this.ridingDepotId = null;
      this.ridingSeated = false;
      this.ridingSeatIndex = -1;
    }
    this.onWorldDirtyCallback?.();
  }

  private worldToCarLocal(
    wx: number,
    wy: number,
    wz: number,
    carGroup: THREE.Group,
    out: THREE.Vector3,
  ): THREE.Vector3 {
    const dx = wx - carGroup.position.x;
    const dy = wy - carGroup.position.y;
    const dz = wz - carGroup.position.z;
    const yaw = carGroup.rotation.y;
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    out.set(dx * cosY - dz * sinY, dy, dx * sinY + dz * cosY);
    return out;
  }

  private carLocalToWorld(
    lx: number,
    ly: number,
    lz: number,
    carGroup: THREE.Group,
    out: THREE.Vector3,
  ): THREE.Vector3 {
    const yaw = carGroup.rotation.y;
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    out.set(
      carGroup.position.x + lx * cosY + lz * sinY,
      carGroup.position.y + ly,
      carGroup.position.z - lx * sinY + lz * cosY,
    );
    return out;
  }

  private findSafeStandY(wx: number, approxY: number, wz: number): number {
    const bx = Math.floor(wx);
    const bz = Math.floor(wz);
    for (let y = approxY + 3; y >= Math.max(2, approxY - 5); y--) {
      const below = this.getBlockAt(bx, y - 1, bz);
      const at = this.getBlockAt(bx, y, bz);
      const head = this.getBlockAt(bx, y + 1, bz);
      const aboveHead = this.getBlockAt(bx, y + 2, bz);
      if (at === BlockId.PlatformEdge && !BLOCK_META[head].solid && !BLOCK_META[aboveHead].solid) {
        return y + 0.52;
      }
      if (below === BlockId.PlatformEdge && !BLOCK_META[at].solid && !BLOCK_META[head].solid) {
        return y - 0.48;
      }
      if (BLOCK_META[below].solid && !BLOCK_META[at].solid && !BLOCK_META[head].solid) {
        return y + 0.05;
      }
    }
    return this.getSurfaceHeightAt(wx, wz) + 1.05;
  }

  private findNearestCarDoor(maxDist = 4.2): {
    depotId: string;
    train: MtrActiveTrain;
    carIndex: number;
    localPos: THREE.Vector3;
    nearestDoorZ: number;
    dist: number;
  } | null {
    let best: {
      depotId: string;
      train: MtrActiveTrain;
      carIndex: number;
      localPos: THREE.Vector3;
      nearestDoorZ: number;
      dist: number;
    } | null = null;
    const tmp = new THREE.Vector3();

    for (const [depotId, train] of this.mtrTrains.entries()) {
      for (let i = 0; i < train.cars.length; i++) {
        const car = train.cars[i];
        this.worldToCarLocal(this.playerPos.x, this.playerPos.y, this.playerPos.z, car.group, tmp);
        if (Math.abs(tmp.y) > 2.2) continue;
        const doorZ = Math.abs(tmp.z + 0.94) < Math.abs(tmp.z - 0.94) ? -0.94 : 0.94;
        const doorX = tmp.x >= 0 ? 0.92 : -0.92;
        const d = Math.hypot(tmp.x - doorX, tmp.z - doorZ);
        if (d <= maxDist && (!best || d < best.dist)) {
          best = {
            depotId,
            train,
            carIndex: i,
            localPos: tmp.clone(),
            nearestDoorZ: doorZ,
            dist: d,
          };
        }
      }
    }
    return best;
  }

  private exitTrainCleanly(sideSign = 1) {
    if (!this.ridingDepotId) return;
    const train = this.mtrTrains.get(this.ridingDepotId);
    const car = train?.cars[this.ridingCarIndex] ?? train?.cars[0];
    if (car) {
      const doorZ = Math.abs(this.ridingLocalPos.z + 0.94) < Math.abs(this.ridingLocalPos.z - 0.94) ? -0.94 : 0.94;
      const side = this.ridingLocalPos.x !== 0 ? Math.sign(this.ridingLocalPos.x) : sideSign;
      this.carLocalToWorld(side * 1.48, 0.1, doorZ, car.group, _vec3A);
      const safeY = this.findSafeStandY(_vec3A.x, Math.round(_vec3A.y), _vec3A.z);
      this.playerPos.set(_vec3A.x, safeY, _vec3A.z);
    }
    this.ridingDepotId = null;
    this.ridingSeated = false;
    this.ridingSeatIndex = -1;
    this.playerVel.set(0, 0, 0);
  }

  public boardOrExitNearestTrain(): boolean {
    if (this.ridingDepotId) {
      this.exitTrainCleanly(1);
      return false;
    }
    const near = this.findNearestCarDoor(4.6);
    if (!near) return false;
    this.ridingDepotId = near.depotId;
    this.ridingCarIndex = near.carIndex;
    this.ridingLocalPos.set(
      THREE.MathUtils.clamp(near.localPos.x * 0.4, -0.45, 0.45),
      MTR_FLOOR_Y,
      near.nearestDoorZ,
    );
    this.ridingSeated = false;
    this.ridingSeatIndex = -1;
    this.flying = false;
    this.playerVel.set(0, 0, 0);
    return true;
  }

  public toggleSitInTrain(): boolean {
    if (!this.ridingDepotId) return false;
    const train = this.mtrTrains.get(this.ridingDepotId);
    const car = train?.cars[this.ridingCarIndex];
    if (!train || !car) return false;

    if (this.ridingSeated) {
      this.ridingSeated = false;
      this.ridingSeatIndex = -1;
      this.ridingLocalPos.set(this.ridingLocalPos.x * 0.35, MTR_FLOOR_Y, this.ridingLocalPos.z);
      return false;
    }

    let bestSlotIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < MTR_CAR_SEAT_SLOTS.length; i++) {
      if (car.seatOccupants[i] !== null) continue;
      const slot = MTR_CAR_SEAT_SLOTS[i];
      const d = Math.hypot(this.ridingLocalPos.x - slot.x, this.ridingLocalPos.z - slot.z);
      if (d < bestDist) {
        bestDist = d;
        bestSlotIdx = i;
      }
    }
    if (bestSlotIdx < 0) return false;

    const chosen = MTR_CAR_SEAT_SLOTS[bestSlotIdx];
    this.ridingSeated = true;
    this.ridingSeatIndex = bestSlotIdx;
    this.ridingLocalPos.set(chosen.x, chosen.y, chosen.z);
    this.yaw = car.group.rotation.y + chosen.yaw;
    return true;
  }

  public toggleTrainDoors(depotId?: string): boolean {
    const id = depotId ?? this.ridingDepotId ?? this.cachedNearbyTrain?.depotId;
    if (!id) return false;
    const train = this.mtrTrains.get(id);
    if (!train) return false;
    if (train.currentSpeed > 1.2 && train.status === 'Running') {
      return false;
    }
    const nextTarget = train.doorProgress > 0.5 ? 0 : 1;
    train.manualDoorOverride = nextTarget;
    train.doorTarget = nextTarget;
    train.doorPhase = nextTarget === 1 ? 'opening' : 'closing_warning';
    train.lastChimeState = nextTarget === 1 ? 'open' : 'closing_warning';
    voxelAudio.playTrainDoorChime(nextTarget === 1, train.spec.id);
    return nextTarget === 1;
  }

  public switchTrainCar(delta: -1 | 1): void {
    if (!this.ridingDepotId) return;
    const train = this.mtrTrains.get(this.ridingDepotId);
    if (!train) return;
    const nextIdx = THREE.MathUtils.clamp(this.ridingCarIndex + delta, 0, train.cars.length - 1);
    if (nextIdx !== this.ridingCarIndex) {
      this.ridingCarIndex = nextIdx;
      this.ridingSeated = false;
      this.ridingSeatIndex = -1;
      this.ridingLocalPos.set(0, MTR_FLOOR_Y, 0);
    }
  }

  public toggleRideTrain(depotId: string): boolean {
    if (this.ridingDepotId === depotId) {
      this.exitTrainCleanly(1);
      return false;
    }
    const train = this.mtrTrains.get(depotId);
    if (!train) return false;
    this.ridingDepotId = depotId;
    this.ridingCarIndex = 0;
    this.ridingLocalPos.set(0, MTR_FLOOR_Y, 0.2);
    this.ridingSeated = false;
    this.ridingSeatIndex = -1;
    this.flying = false;
    this.playerVel.set(0, 0, 0);
    return true;
  }

  public warpToPoint(x: number, y: number, z: number) {
    this.ridingDepotId = null;
    this.ridingSeated = false;
    this.ridingSeatIndex = -1;
    this.playerPos.set(x + 0.5, y + 1.2, z + 0.5);
    this.playerVel.set(0, 0, 0);
    this.ensureChunksAround(this.playerPos.x, this.playerPos.z);
    this.remeshDirtyChunks();
  }

  public buildStarterMtrLine(): { depotPos: [number, number, number]; stationPos: [number, number, number] } {
    const baseY = this.config.worldType === 'superflat' ? 5 : Math.max(5, Math.floor(this.playerPos.y));
    const minX = 20;
    const maxX = 38;
    const minZ = -6;
    const maxZ = 8;

    this.ensureChunksAround((minX + maxX) / 2, (minZ + maxZ) / 2);

    const setTrack = (wx: number, wy: number, wz: number, blockId: BlockId) => {
      // Ensure solid ground underneath track
      const under = this.getBlockAt(wx, wy - 1, wz);
      if (!BLOCK_META[under].solid) {
        this.setBlockAt(wx, wy - 1, wz, BlockId.Cobblestone);
      }
      // Clear 3 blocks headroom above track
      this.setBlockAt(wx, wy, wz, blockId);
      this.setBlockAt(wx, wy + 1, wz, BlockId.Air);
      this.setBlockAt(wx, wy + 2, wz, BlockId.Air);
    };

    // Main closed loop of Silver/Grey Normal Rails
    for (let x = minX; x <= maxX; x++) {
      setTrack(x, baseY, maxZ, BlockId.RailNormal);
      setTrack(x, baseY, minZ, BlockId.RailNormal);
    }
    for (let z = minZ; z <= maxZ; z++) {
      setTrack(minX, baseY, z, BlockId.RailNormal);
      setTrack(maxX, baseY, z, BlockId.RailNormal);
    }

    // Yellow Depot Siding Track spur entering from wx = 16..19 at wz = 8
    for (let x = 16; x <= 19; x++) {
      setTrack(x, baseY, maxZ, BlockId.RailDepot);
    }

    // South Red Station Rail (wx = 25..32, wz = 8) + Concrete Station Platform Slabs (wz = 9..10)
    for (let x = 25; x <= 32; x++) {
      setTrack(x, baseY, maxZ, BlockId.RailStation);
      this.setBlockAt(x, baseY, maxZ + 1, BlockId.PlatformEdge);
      this.setBlockAt(x, baseY, maxZ + 2, BlockId.PlatformEdge);
    }

    // North Red Station Rail (wx = 25..32, wz = -6) + Concrete Station Platform Slabs (wz = -7..-8)
    for (let x = 25; x <= 32; x++) {
      setTrack(x, baseY, minZ, BlockId.RailStation);
      this.setBlockAt(x, baseY, minZ - 1, BlockId.PlatformEdge);
      this.setBlockAt(x, baseY, minZ - 2, BlockId.PlatformEdge);
    }

    this.remeshDirtyChunks();

    const depotPos: [number, number, number] = [16, baseY, maxZ];
    const stationPos: [number, number, number] = [28, baseY, maxZ];

    if (this.mtrDepots.length === 0) {
      this.upsertMtrDepot({
        id: 'depot-bkk-blue',
        name: 'Central Depot (Bangkok MRT Blue)',
        depotPos,
        trainModelId: 'bangkok_mrt_blue',
        carCount: 3,
        cruiseSpeed: 9.5,
        stationDwellSeconds: 4,
        dispatched: true,
        directionMode: 'one_way_cw',
      });
    }

    this.ensureStationCommuters([
      [28, baseY, maxZ + 1],
      [29, baseY, minZ - 1],
    ]);
    this.refreshStationClusters();

    return { depotPos, stationPos };
  }

  private ensureStationCommuters(platformSpots: [number, number, number][]) {
    const explorerColors = [0x22c55e, 0x3b82f6, 0xf59e0b, 0xec4899];
    for (const [px, py, pz] of platformSpots) {
      const nearbyExplorers = this.mobs.filter(
        (m) => m.kind === 'explorer' && Math.hypot(m.x - (px + 0.5), m.z - (pz + 0.5)) < 20,
      );
      if (nearbyExplorers.length < 2) {
        const needed = 2 - nearbyExplorers.length;
        for (let i = 0; i < needed; i++) {
          const mob = createVoxelExplorerMob(explorerColors[(this.mobs.length + i) % explorerColors.length]);
          mob.x = px + 0.5 + i * 1.1;
          mob.z = pz + 0.5;
          mob.y = this.findSafeStandY(mob.x, py + 1, mob.z);
          mob.onGround = true;
          mob.yaw = Math.random() * Math.PI * 2;
          mob.transitState = 'wait_platform';
          mob.transitCooldown = 0;
          mob.targetWaitPos = [mob.x, mob.y, mob.z];
          mob.group.position.set(mob.x, mob.y, mob.z);
          this.scene.add(mob.group);
          this.mobs.push(mob);
        }
      }
    }
  }

  private refreshStationClusters() {
    const stationCells = new Map<string, [number, number, number]>();
    for (const chunk of this.chunks.values()) {
      const ox = chunk.cx * CHUNK_W;
      const oz = chunk.cz * CHUNK_D;
      for (let y = 0; y < CHUNK_H; y++) {
        for (let lz = 0; lz < CHUNK_D; lz++) {
          for (let lx = 0; lx < CHUNK_W; lx++) {
            if (chunk.blocks[(y * CHUNK_D + lz) * CHUNK_W + lx] === BlockId.RailStation) {
              const wx = ox + lx;
              const wz = oz + lz;
              stationCells.set(`${wx},${y},${wz}`, [wx, y, wz]);
            }
          }
        }
      }
    }

    const visited = new Set<string>();
    const out: {
      id: string;
      stopCell: [number, number, number];
      waitPos: [number, number, number];
      cells: Set<string>;
    }[] = [];

    for (const [key, coord] of stationCells.entries()) {
      if (visited.has(key)) continue;
      const queue: [number, number, number][] = [coord];
      const clusterSet = new Set<string>([key]);
      visited.add(key);
      const members: [number, number, number][] = [];
      let sumX = 0;
      let sumZ = 0;

      while (queue.length > 0) {
        const cur = queue.shift()!;
        members.push(cur);
        sumX += cur[0];
        sumZ += cur[2];
        for (const [dx, dz] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          for (const dy of [0, 1, -1]) {
            const nk = `${cur[0] + dx},${cur[1] + dy},${cur[2] + dz}`;
            if (stationCells.has(nk) && !visited.has(nk)) {
              visited.add(nk);
              clusterSet.add(nk);
              queue.push(stationCells.get(nk)!);
            }
          }
        }
      }

      const mid = members[Math.floor(members.length / 2)] ?? coord;
      const count = Math.max(1, members.length);
      const clusterId = `station-${Math.round(sumX / count)}-${Math.round(sumZ / count)}`;
      // Pick adjacent platform wait block beside the station rail
      let waitPos: [number, number, number] = [mid[0] + 0.5, mid[1], mid[2] + 1.5];
      for (const [dx, dz] of [
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
      ]) {
        const adj = this.getBlockAt(mid[0] + dx, mid[1], mid[2] + dz);
        if (adj === BlockId.PlatformEdge || (!this.isRailBlock(adj) && !BLOCK_META[adj].solid)) {
          const safeY = this.findSafeStandY(mid[0] + dx + 0.5, mid[1] + 1, mid[2] + dz + 0.5);
          waitPos = [mid[0] + dx + 0.5, safeY, mid[2] + dz + 0.5];
          break;
        }
      }

      out.push({
        id: clusterId,
        stopCell: mid,
        waitPos,
        cells: clusterSet,
      });
    }
    this.cachedStationClusters = out;
  }

  private getCurveRadiusForSpan(span: MtrTurnCurveSpan): number {
    if (span === 'tight') return 7;
    if (span === 'gentle') return 14;
    if (span === 'long') return 24;
    return 38;
  }

  private appendManhattanSteppedArc(
    path: [number, number][],
    startX: number,
    startZ: number,
    ctrlX: number,
    ctrlZ: number,
    endX: number,
    endZ: number,
  ) {
    let curX = path.length > 0 ? path[path.length - 1][0] : startX;
    let curZ = path.length > 0 ? path[path.length - 1][1] : startZ;
    if (path.length === 0) path.push([curX, curZ]);

    const samples = Math.max(24, Math.abs(endX - startX) + Math.abs(endZ - startZ) + 12);
    for (let s = 1; s <= samples; s++) {
      const t = s / samples;
      const omt = 1 - t;
      const targetX = Math.round(omt * omt * startX + 2 * omt * t * ctrlX + t * t * endX);
      const targetZ = Math.round(omt * omt * startZ + 2 * omt * t * ctrlZ + t * t * endZ);

      while (curX !== targetX || curZ !== targetZ) {
        if (Math.abs(targetX - curX) >= Math.abs(targetZ - curZ) && curX !== targetX) {
          curX += Math.sign(targetX - curX);
        } else if (curZ !== targetZ) {
          curZ += Math.sign(targetZ - curZ);
        }
        const last = path[path.length - 1];
        if (!last || last[0] !== curX || last[1] !== curZ) {
          path.push([curX, curZ]);
        }
      }
    }
  }

  private layTrackCell(wx: number, wy: number, wz: number, blockId: BlockId) {
    const under = this.getBlockAt(wx, wy - 1, wz);
    if (!BLOCK_META[under].solid) {
      this.setBlockAt(wx, wy - 1, wz, BlockId.Cobblestone);
    }
    this.setBlockAt(wx, wy, wz, blockId);
    this.setBlockAt(wx, wy + 1, wz, BlockId.Air);
    this.setBlockAt(wx, wy + 2, wz, BlockId.Air);
  }

  public placeMtrTrackSegment(
    opts: MtrTrackBuilderOptions,
  ): { placedCount: number; endPos: [number, number, number]; stationPlaced: boolean } {
    // Determine player forward & right unit cardinal vectors from yaw
    const rawFx = -Math.sin(this.yaw);
    const rawFz = -Math.cos(this.yaw);
    let fx = 0;
    let fz = -1;
    if (Math.abs(rawFx) >= Math.abs(rawFz)) {
      fx = rawFx >= 0 ? 1 : -1;
      fz = 0;
    } else {
      fx = 0;
      fz = rawFz >= 0 ? 1 : -1;
    }
    // Right-hand perpendicular in XZ (+X East, +Z South)
    const rx = -fz;
    const rz = fx;

    const px = Math.floor(this.playerPos.x);
    const pz = Math.floor(this.playerPos.z);
    const baseY =
      this.config.worldType === 'superflat' ? 5 : Math.max(5, Math.floor(this.playerPos.y));

    let sx = px + fx * 2;
    let sz = pz + fz * 2;
    let sy = baseY;

    // Snap onto nearby existing rail block within 2 blocks if present
    for (let dist = 1; dist <= 2; dist++) {
      const tx = px + fx * dist;
      const tz = pz + fz * dist;
      for (const dy of [0, -1, 1]) {
        if (this.isRailBlock(this.getBlockAt(tx, baseY + dy, tz))) {
          sx = tx;
          sy = baseY + dy;
          sz = tz;
          break;
        }
      }
    }

    const totalLen = Math.max(4, Math.min(64, Math.round(opts.length)));
    const railBlockId =
      opts.railType === 'station'
        ? BlockId.RailStation
        : opts.railType === 'depot'
          ? BlockId.RailDepot
          : BlockId.RailNormal;

    const cells: [number, number][] = [];
    if (opts.turnDirection === 'straight') {
      for (let i = 0; i < totalLen; i++) {
        cells.push([sx + fx * i, sz + fz * i]);
      }
    } else {
      const sideSign = opts.turnDirection === 'right' ? 1 : -1;
      const sxDir = rx * sideSign;
      const szDir = rz * sideSign;
      const baseRadius = this.getCurveRadiusForSpan(opts.turnCurveSpan);
      const radius = Math.max(4, Math.min(48, Math.round((baseRadius + totalLen) * 0.5)));
      const leadStraight = Math.max(2, Math.floor(totalLen * 0.2));

      for (let i = 0; i < leadStraight; i++) {
        cells.push([sx + fx * i, sz + fz * i]);
      }
      const turnStart = cells[cells.length - 1];
      const ctrlX = turnStart[0] + fx * radius;
      const ctrlZ = turnStart[1] + fz * radius;
      const endX = turnStart[0] + fx * radius + sxDir * radius;
      const endZ = turnStart[1] + fz * radius + szDir * radius;
      this.appendManhattanSteppedArc(cells, turnStart[0], turnStart[1], ctrlX, ctrlZ, endX, endZ);
    }

    // Ensure chunks covering the track segment exist before placing blocks
    const minX = Math.min(...cells.map((c) => c[0]));
    const maxX = Math.max(...cells.map((c) => c[0]));
    const minZ = Math.min(...cells.map((c) => c[1]));
    const maxZ = Math.max(...cells.map((c) => c[1]));
    for (let cx = Math.floor(minX / CHUNK_W); cx <= Math.floor(maxX / CHUNK_W); cx++) {
      for (let cz = Math.floor(minZ / CHUNK_D); cz <= Math.floor(maxZ / CHUNK_D); cz++) {
        const key = this.chunkKey(cx, cz);
        if (!this.chunks.has(key)) {
          this.chunks.set(key, this.generateChunk(cx, cz));
        }
      }
    }

    for (let i = 0; i < cells.length; i++) {
      const [wx, wz] = cells[i];
      this.layTrackCell(wx, sy, wz, railBlockId);
      if (opts.includePlatform && opts.railType === 'station') {
        const next = cells[Math.min(cells.length - 1, i + 1)];
        const prev = cells[Math.max(0, i - 1)];
        const tx = Math.sign(next[0] - prev[0]) || fx;
        const tz = Math.sign(next[1] - prev[1]) || fz;
        const pxSide = -tz;
        const pzSide = tx;
        this.setBlockAt(wx + pxSide, sy, wz + pzSide, BlockId.PlatformEdge);
        if (!this.isRailBlock(this.getBlockAt(wx + pxSide * 2, sy, wz + pzSide * 2))) {
          this.setBlockAt(wx + pxSide * 2, sy, wz + pzSide * 2, BlockId.PlatformEdge);
        }
      }
    }

    this.remeshDirtyChunks();
    const last = cells[cells.length - 1] ?? [sx, sz];
    if (opts.railType === 'station') {
      this.ensureStationCommuters([[last[0], sy, last[1]]]);
      this.refreshStationClusters();
    }
    return {
      placedCount: cells.length,
      endPos: [last[0], sy, last[1]],
      stationPlaced: opts.railType === 'station',
    };
  }

  public setTrackWalkMode(enabled: boolean) {
    this.trackWalkModeEnabled = enabled;
    if (!enabled) {
      this.trackAnchorStart = null;
      this.trackPreviewMesh.visible = false;
    }
  }

  public setTrackCurveStyle(style: 'smooth' | 'straight') {
    this.trackCurveStyle = style;
  }

  public cancelTrackAnchor() {
    this.trackAnchorStart = null;
    this.trackPreviewMesh.visible = false;
  }

  // ---- Effortless Building (Rust Remake Engine) ----

  public setEffortlessMode(mode: EffortlessBuildMode) {
    this.effortlessMode = mode;
    this.effortlessAnchor = null;
  }

  public cycleEffortlessMode() {
    const idx = EFFORTLESS_BUILD_MODES.findIndex((m) => m.id === this.effortlessMode);
    const next = EFFORTLESS_BUILD_MODES[(idx + 1) % EFFORTLESS_BUILD_MODES.length];
    this.setEffortlessMode(next.id);
  }

  public setEffortlessOption(opt: 'mirrorX' | 'mirrorZ' | 'radial' | 'hollow', value: boolean) {
    if (opt === 'mirrorX') this.effortlessMirrorX = value;
    else if (opt === 'mirrorZ') this.effortlessMirrorZ = value;
    else if (opt === 'radial') this.effortlessRadial = value;
    else if (opt === 'hollow') this.effortlessHollow = value;
  }

  public setEffortlessMirrorCenterHere() {
    this.effortlessMirrorCenter = [
      Math.floor(this.playerPos.x),
      Math.floor(this.playerPos.y),
      Math.floor(this.playerPos.z),
    ];
  }

  public cancelEffortlessAnchor() {
    this.effortlessAnchor = null;
    this.effortlessPreviewCount = 0;
    this.effortlessPreviewMesh.visible = false;
  }

  public undoEffortlessBuild(): boolean {
    const entry = this.effortlessUndoStack.pop();
    if (!entry || entry.edits.length === 0) return false;
    for (let i = entry.edits.length - 1; i >= 0; i--) {
      const ed = entry.edits[i];
      this.setBlockAt(ed.x, ed.y, ed.z, ed.prev);
    }
    this.remeshDirtyChunks(16);
    voxelAudio.playBlockBreak('stone');
    this.onWorldDirtyCallback?.();
    return true;
  }

  private pushEffortlessUndo(edits: { x: number; y: number; z: number; prev: BlockId }[]) {
    if (edits.length === 0) return;
    this.effortlessUndoStack.push({ edits });
    if (this.effortlessUndoStack.length > 25) {
      this.effortlessUndoStack.shift();
    }
  }

  private computeEffortlessBaseCells(
    p1: [number, number, number],
    p2: [number, number, number],
    mode: EffortlessBuildMode,
    hollow: boolean,
  ): [number, number, number][] {
    if (mode === 'normal') return [p2];

    const out: [number, number, number][] = [];
    const seen = new Set<string>();
    const push = (x: number, y: number, z: number) => {
      if (y < 1 || y >= CHUNK_H - 1 || out.length >= 400) return;
      const k = `${x},${y},${z}`;
      if (!seen.has(k)) {
        seen.add(k);
        out.push([x, y, z]);
      }
    };

    if (mode === 'line') {
      const dx = p2[0] - p1[0];
      const dy = p2[1] - p1[1];
      const dz = p2[2] - p1[2];
      const steps = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz), 1);
      const capped = Math.min(steps, 120);
      for (let i = 0; i <= capped; i++) {
        const t = i / steps;
        push(Math.round(p1[0] + dx * t), Math.round(p1[1] + dy * t), Math.round(p1[2] + dz * t));
      }
      return out;
    }

    if (mode === 'wall') {
      const dx = p2[0] - p1[0];
      const dz = p2[2] - p1[2];
      const steps = Math.max(Math.abs(dx), Math.abs(dz), 1);
      const minY = Math.min(p1[1], p2[1]);
      const maxY = p1[1] === p2[1] ? p1[1] + 3 : Math.max(p1[1], p2[1]);
      for (let i = 0; i <= Math.min(steps, 48); i++) {
        const t = i / steps;
        const x = Math.round(p1[0] + dx * t);
        const z = Math.round(p1[2] + dz * t);
        for (let y = minY; y <= maxY; y++) {
          push(x, y, z);
        }
      }
      return out;
    }

    if (mode === 'floor') {
      const minX = Math.min(p1[0], p2[0]);
      const maxX = Math.max(p1[0], p2[0]);
      const minZ = Math.min(p1[2], p2[2]);
      const maxZ = Math.max(p1[2], p2[2]);
      for (let x = minX; x <= maxX; x++) {
        for (let z = minZ; z <= maxZ; z++) {
          push(x, p1[1], z);
        }
      }
      return out;
    }

    if (mode === 'cube') {
      const minX = Math.min(p1[0], p2[0]);
      const maxX = Math.max(p1[0], p2[0]);
      const minY = Math.min(p1[1], p2[1]);
      const maxY = Math.max(p1[1], p2[1]);
      const minZ = Math.min(p1[2], p2[2]);
      const maxZ = Math.max(p1[2], p2[2]);
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          for (let z = minZ; z <= maxZ; z++) {
            if (
              hollow &&
              x !== minX &&
              x !== maxX &&
              y !== minY &&
              y !== maxY &&
              z !== minZ &&
              z !== maxZ
            ) {
              continue;
            }
            push(x, y, z);
          }
        }
      }
      return out;
    }

    // 'circle' centered at p1 with radius to p2
    const rad = Math.max(1, Math.min(12, Math.round(Math.hypot(p2[0] - p1[0], p2[2] - p1[2]))));
    for (let dx = -rad; dx <= rad; dx++) {
      for (let dz = -rad; dz <= rad; dz++) {
        const d = Math.hypot(dx, dz);
        if (hollow) {
          if (d >= rad - 0.65 && d <= rad + 0.55) {
            push(p1[0] + dx, p1[1], p1[2] + dz);
          }
        } else if (d <= rad + 0.4) {
          push(p1[0] + dx, p1[1], p1[2] + dz);
        }
      }
    }
    return out;
  }

  private expandEffortlessSymmetry(baseCells: [number, number, number][]): [number, number, number][] {
    const [cx, , cz] = this.effortlessMirrorCenter;
    let map = new Map<string, [number, number, number]>();
    const addCell = (target: Map<string, [number, number, number]>, x: number, y: number, z: number) => {
      if (y < 1 || y >= CHUNK_H - 1 || target.size >= 600) return;
      target.set(`${x},${y},${z}`, [x, y, z]);
    };

    for (const [x, y, z] of baseCells) {
      addCell(map, x, y, z);
    }

    if (this.effortlessMirrorX) {
      const next = new Map(map);
      for (const [x, y, z] of map.values()) {
        addCell(next, 2 * cx - x, y, z);
      }
      map = next;
    }

    if (this.effortlessMirrorZ) {
      const next = new Map(map);
      for (const [x, y, z] of map.values()) {
        addCell(next, x, y, 2 * cz - z);
      }
      map = next;
    }

    if (this.effortlessRadial) {
      const next = new Map(map);
      for (const [x, y, z] of map.values()) {
        const dx = x - cx;
        const dz = z - cz;
        addCell(next, cx - dz, y, cz + dx);
        addCell(next, cx - dx, y, cz - dz);
        addCell(next, cx + dz, y, cz - dx);
      }
      map = next;
    }

    return Array.from(map.values());
  }

  private getEffortlessCursorTarget(): [number, number, number] | null {
    if (this.targetedBlock) {
      return [
        this.targetedBlock.x + this.targetedBlock.nx,
        this.targetedBlock.y + this.targetedBlock.ny,
        this.targetedBlock.z + this.targetedBlock.nz,
      ];
    }
    if (!this.effortlessAnchor) return null;
    this.camera.getWorldDirection(_vec3A);
    const tx = Math.floor(this.playerPos.x + _vec3A.x * 4.5);
    const ty = THREE.MathUtils.clamp(Math.floor(this.playerPos.y + 1.4 + _vec3A.y * 4.5), 1, CHUNK_H - 2);
    const tz = Math.floor(this.playerPos.z + _vec3A.z * 4.5);
    return [tx, ty, tz];
  }

  private updateEffortlessPreviewMesh() {
    if (
      !this.activeMods.has('effortless_building') ||
      this.mode !== 'playing' ||
      (this.trackWalkModeEnabled && this.isRailBlock(this.selectedBlock))
    ) {
      this.effortlessPreviewMesh.visible = false;
      this.effortlessPreviewCount = 0;
      return;
    }

    const hasSymmetry = this.effortlessMirrorX || this.effortlessMirrorZ || this.effortlessRadial;
    if (!this.effortlessAnchor && !hasSymmetry) {
      this.effortlessPreviewMesh.visible = false;
      this.effortlessPreviewCount = 0;
      return;
    }

    const cursor = this.getEffortlessCursorTarget();
    if (!cursor) {
      this.effortlessPreviewMesh.visible = false;
      this.effortlessPreviewCount = 0;
      return;
    }

    const base = this.effortlessAnchor
      ? this.computeEffortlessBaseCells(this.effortlessAnchor, cursor, this.effortlessMode, this.effortlessHollow)
      : [cursor];
    const cells = this.expandEffortlessSymmetry(base);
    const count = Math.min(cells.length, 600);
    if (count === 0) {
      this.effortlessPreviewMesh.visible = false;
      this.effortlessPreviewCount = 0;
      return;
    }

    const isSlab = this.selectedBlock === BlockId.PlatformEdge;
    this.effortlessPreviewDummy.scale.set(1, isSlab ? 0.5 : 1, 1);
    const yOff = isSlab ? 0.25 : 0.5;
    for (let i = 0; i < count; i++) {
      const [wx, wy, wz] = cells[i];
      this.effortlessPreviewDummy.position.set(wx + 0.5, wy + yOff, wz + 0.5);
      this.effortlessPreviewDummy.updateMatrix();
      this.effortlessPreviewMesh.setMatrixAt(i, this.effortlessPreviewDummy.matrix);
    }
    this.effortlessPreviewMesh.count = count;
    this.effortlessPreviewMesh.instanceMatrix.needsUpdate = true;
    const mat = this.effortlessPreviewMesh.material as THREE.MeshBasicMaterial;
    mat.color.setHex(this.effortlessAnchor ? 0x38bdf8 : 0xfbbf24);
    this.effortlessPreviewMesh.visible = true;
    this.effortlessPreviewCount = count;
  }

  private getCardinalFacing(): [number, number] {
    const rawFx = -Math.sin(this.yaw);
    const rawFz = -Math.cos(this.yaw);
    if (Math.abs(rawFx) >= Math.abs(rawFz)) {
      return [rawFx >= 0 ? 1 : -1, 0];
    }
    return [0, rawFz >= 0 ? 1 : -1];
  }

  private getWalkPreviewPath(): {
    cells: [number, number][];
    startPos: [number, number, number];
    endPos: [number, number, number];
    isCurve: boolean;
  } | null {
    const anchor = this.trackAnchorStart;
    if (!anchor) return null;

    // Use targeted block if within reach, otherwise use player's walked position
    const hit = this.targetedBlock;
    let ex = Math.floor(this.playerPos.x);
    let ez = Math.floor(this.playerPos.z);
    if (hit) {
      ex = hit.x + hit.nx;
      ez = hit.z + hit.nz;
    }

    // Clamp max single-span stretch to 80 blocks
    const dx = ex - anchor.x;
    const dz = ez - anchor.z;
    const maxSpan = 80;
    const dist = Math.hypot(dx, dz);
    if (dist > maxSpan) {
      ex = anchor.x + Math.round((dx / dist) * maxSpan);
      ez = anchor.z + Math.round((dz / dist) * maxSpan);
    }

    const cells: [number, number][] = [[anchor.x, anchor.z]];
    const adx = Math.abs(ex - anchor.x);
    const adz = Math.abs(ez - anchor.z);
    const fwdDot = (ex - anchor.x) * anchor.fx + (ez - anchor.z) * anchor.fz;
    const sideDot = Math.abs((ex - anchor.x) * -anchor.fz + (ez - anchor.z) * anchor.fx);
    const isCurve = this.trackCurveStyle === 'smooth' && adx >= 2 && adz >= 2;

    if (ex === anchor.x && ez === anchor.z) {
      // Single anchor block
    } else if (this.trackCurveStyle === 'straight') {
      // Pure orthogonal L or straight axis along dominant walked direction
      if (adx >= adz) {
        const sx = Math.sign(ex - anchor.x);
        for (let x = anchor.x + sx; x !== ex + sx; x += sx) cells.push([x, anchor.z]);
        const sz = Math.sign(ez - anchor.z);
        if (sz !== 0) {
          for (let z = anchor.z + sz; z !== ez + sz; z += sz) cells.push([ex, z]);
        }
      } else {
        const sz = Math.sign(ez - anchor.z);
        for (let z = anchor.z + sz; z !== ez + sz; z += sz) cells.push([anchor.x, z]);
        const sx = Math.sign(ex - anchor.x);
        if (sx !== 0) {
          for (let x = anchor.x + sx; x !== ex + sx; x += sx) cells.push([x, ez]);
        }
      }
    } else if (isCurve) {
      // Create-mod style smooth quadratic Bezier tangent to anchor facing direction
      let ctrlX = anchor.x;
      let ctrlZ = anchor.z;
      if (fwdDot >= 2 && sideDot >= 2) {
        ctrlX = anchor.x + anchor.fx * Math.round(fwdDot);
        ctrlZ = anchor.z + anchor.fz * Math.round(fwdDot);
      } else if (adx >= adz) {
        ctrlX = ex;
        ctrlZ = anchor.z;
      } else {
        ctrlX = anchor.x;
        ctrlZ = ez;
      }
      this.appendManhattanSteppedArc(cells, anchor.x, anchor.z, ctrlX, ctrlZ, ex, ez);
    } else {
      // Straight line stepped
      this.appendManhattanSteppedArc(
        cells,
        anchor.x,
        anchor.z,
        Math.round((anchor.x + ex) * 0.5),
        Math.round((anchor.z + ez) * 0.5),
        ex,
        ez,
      );
    }

    return {
      cells,
      startPos: [anchor.x, anchor.y, anchor.z],
      endPos: [ex, anchor.y, ez],
      isCurve,
    };
  }

  private updateTrackPreviewMesh() {
    if (!this.trackAnchorStart || !this.trackWalkModeEnabled || !this.isRailBlock(this.selectedBlock)) {
      this.trackPreviewMesh.visible = false;
      return;
    }

    const preview = this.getWalkPreviewPath();
    if (!preview || preview.cells.length === 0) {
      this.trackPreviewMesh.visible = false;
      return;
    }

    const count = Math.min(preview.cells.length, 180);
    const y = this.trackAnchorStart.y + 0.16;
    for (let i = 0; i < count; i++) {
      const [wx, wz] = preview.cells[i];
      this.trackPreviewDummy.position.set(wx + 0.5, y, wz + 0.5);
      this.trackPreviewDummy.updateMatrix();
      this.trackPreviewMesh.setMatrixAt(i, this.trackPreviewDummy.matrix);
    }
    this.trackPreviewMesh.count = count;
    this.trackPreviewMesh.instanceMatrix.needsUpdate = true;

    const mat = this.trackPreviewMesh.material as THREE.MeshBasicMaterial;
    if (this.selectedBlock === BlockId.RailStation) mat.color.setHex(0xfb7185);
    else if (this.selectedBlock === BlockId.RailDepot) mat.color.setHex(0xfacc15);
    else mat.color.setHex(0x34d399);

    this.trackPreviewMesh.visible = true;
  }

  public confirmTrackAnchorPlacement(): { placedCount: number; endPos: [number, number, number] } | null {
    const anchor = this.trackAnchorStart;
    if (!anchor) return null;
    const preview = this.getWalkPreviewPath();
    if (!preview || preview.cells.length === 0) return null;

    const railId = this.isRailBlock(this.selectedBlock) ? this.selectedBlock : anchor.railId;
    const minX = Math.min(...preview.cells.map((c) => c[0]));
    const maxX = Math.max(...preview.cells.map((c) => c[0]));
    const minZ = Math.min(...preview.cells.map((c) => c[1]));
    const maxZ = Math.max(...preview.cells.map((c) => c[1]));
    for (let cx = Math.floor(minX / CHUNK_W); cx <= Math.floor(maxX / CHUNK_W); cx++) {
      for (let cz = Math.floor(minZ / CHUNK_D); cz <= Math.floor(maxZ / CHUNK_D); cz++) {
        const key = this.chunkKey(cx, cz);
        if (!this.chunks.has(key)) {
          this.chunks.set(key, this.generateChunk(cx, cz));
        }
      }
    }

    for (const [wx, wz] of preview.cells) {
      this.layTrackCell(wx, anchor.y, wz, railId);
    }

    this.remeshDirtyChunks(16);
    voxelAudio.playBlockPlace(BLOCK_META[railId].soundType);
    this.trackAnchorStart = null;
    this.trackPreviewMesh.visible = false;

    const last = preview.cells[preview.cells.length - 1];
    return {
      placedCount: preview.cells.length,
      endPos: [last[0], anchor.y, last[1]],
    };
  }

  public buildCurvedLoopMtrLine(
    straightLen: number,
    turnSpan: MtrTurnCurveSpan,
  ): { depotPos: [number, number, number]; stationPos: [number, number, number]; trackCount: number } {
    const baseY =
      this.config.worldType === 'superflat' ? 5 : Math.max(5, Math.floor(this.playerPos.y));
    const straight = Math.max(8, Math.min(48, Math.round(straightLen)));
    const rad = Math.max(6, Math.min(28, Math.round(this.getCurveRadiusForSpan(turnSpan) * 0.6)));

    // Build rounded stadium oval centered near x=20..20+straight+2*rad, z=-rad..+10+rad
    const leftX = 22;
    const rightX = leftX + straight;
    const southZ = 10 + rad;
    const northZ = -8 - rad;
    const midZ = Math.round((southZ + northZ) / 2);

    const loopPath: [number, number][] = [];
    // South straight Eastbound -> SE long curve -> East side -> NE long curve -> North straight Westbound -> NW curve -> West side -> SW curve
    for (let x = leftX; x <= rightX; x++) loopPath.push([x, southZ]);
    this.appendManhattanSteppedArc(
      loopPath,
      rightX,
      southZ,
      rightX + rad,
      southZ,
      rightX + rad,
      midZ + 2,
    );
    for (let z = midZ + 2; z >= midZ - 2; z--) {
      loopPath.push([rightX + rad, z]);
    }
    this.appendManhattanSteppedArc(
      loopPath,
      rightX + rad,
      midZ - 2,
      rightX + rad,
      northZ,
      rightX,
      northZ,
    );
    for (let x = rightX; x >= leftX; x--) loopPath.push([x, northZ]);
    this.appendManhattanSteppedArc(
      loopPath,
      leftX,
      northZ,
      leftX - rad,
      northZ,
      leftX - rad,
      midZ - 2,
    );
    for (let z = midZ - 2; z <= midZ + 2; z++) {
      loopPath.push([leftX - rad, z]);
    }
    this.appendManhattanSteppedArc(
      loopPath,
      leftX - rad,
      midZ + 2,
      leftX - rad,
      southZ,
      leftX,
      southZ,
    );

    // Ensure chunks for the entire curved loop are generated
    const minCx = Math.floor((leftX - rad - 4) / CHUNK_W);
    const maxCx = Math.floor((rightX + rad + 4) / CHUNK_W);
    const minCz = Math.floor((northZ - 4) / CHUNK_D);
    const maxCz = Math.floor((southZ + 4) / CHUNK_D);
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        const key = this.chunkKey(cx, cz);
        if (!this.chunks.has(key)) {
          this.chunks.set(key, this.generateChunk(cx, cz));
        }
      }
    }

    const stationMidStart = leftX + Math.max(1, Math.floor(straight * 0.25));
    const stationMidEnd = Math.min(rightX - 1, stationMidStart + 7);

    for (const [wx, wz] of loopPath) {
      const isSouthStation = wz === southZ && wx >= stationMidStart && wx <= stationMidEnd;
      const isNorthStation = wz === northZ && wx >= stationMidStart && wx <= stationMidEnd;
      const block = isSouthStation || isNorthStation ? BlockId.RailStation : BlockId.RailNormal;
      this.layTrackCell(wx, baseY, wz, block);
      if (isSouthStation) {
        this.setBlockAt(wx, baseY, wz + 1, BlockId.PlatformEdge);
        if (!this.isRailBlock(this.getBlockAt(wx, baseY, wz + 2))) {
          this.setBlockAt(wx, baseY, wz + 2, BlockId.PlatformEdge);
        }
      } else if (isNorthStation) {
        this.setBlockAt(wx, baseY, wz - 1, BlockId.PlatformEdge);
        if (!this.isRailBlock(this.getBlockAt(wx, baseY, wz - 2))) {
          this.setBlockAt(wx, baseY, wz - 2, BlockId.PlatformEdge);
        }
      }
    }

    // Yellow Depot siding connected at south-west junction [leftX, baseY, southZ]
    const depotStartX = leftX - 4;
    for (let dx = 0; dx < 4; dx++) {
      this.layTrackCell(depotStartX + dx, baseY, southZ + 1, BlockId.RailDepot);
    }
    this.layTrackCell(leftX, baseY, southZ + 1, BlockId.RailNormal);

    this.remeshDirtyChunks();

    const depotPos: [number, number, number] = [depotStartX, baseY, southZ + 1];
    const stationPos: [number, number, number] = [
      Math.round((stationMidStart + stationMidEnd) / 2),
      baseY,
      southZ,
    ];

    if (this.mtrDepots.length === 0) {
      this.upsertMtrDepot({
        id: 'depot-curved-line',
        name: 'Express Curved Depot',
        depotPos,
        trainModelId: 'bangkok_mrt_blue',
        carCount: 3,
        cruiseSpeed: 10.5,
        stationDwellSeconds: 4,
        dispatched: true,
        directionMode: 'one_way_cw',
      });
    }

    this.ensureStationCommuters([
      [stationPos[0], baseY, southZ + 1],
      [stationPos[0], baseY, northZ - 1],
    ]);
    this.refreshStationClusters();

    return { depotPos, stationPos, trackCount: loopPath.length + 5 };
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
    if (this.config.worldType === 'superflat') {
      this.playerPos.set(sx + 0.5, 5.2, sz + 0.5);
      this.yaw = 0;
      this.pitch = -0.02;
    } else {
      const h = this.getSurfaceHeightAt(sx, sz);
      this.playerPos.set(sx + 0.5, Math.max(h + 2.2, SEA_LEVEL + 2), sz + 0.5);
      this.yaw = 0.6;
      this.pitch = -0.15;
    }
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

  private clearMobs() {
    for (const mob of this.mobs) {
      this.scene.remove(mob.group);
    }
    this.mobs = [];
  }

  private spawnMobs() {
    const placeMobOnGround = (mob: VoxelMob, mx: number, mz: number) => {
      mob.x = mx;
      mob.z = mz;
      const baseSurf = this.getSurfaceHeightAt(mx, mz) + 1;
      mob.y = baseSurf;
      mob.vy = 0;
      mob.onGround = true;
      mob.group.position.set(mob.x, mob.y, mob.z);
      this.scene.add(mob.group);
      this.mobs.push(mob);
    };

    if (this.config.worldType === 'superflat') {
      // Bouncing green Slimes across the foreground left & plains (matching classic Bedrock Superflat)
      const slimePositions: [number, number, number][] = [
        [2.5, 5.2, 1.1],
        [-3.0, -3.5, 1.45],
        [-1.0, -9.0, 0.85],
        [-8.5, -6.5, 1.15],
        [4.5, -16.0, 1.1],
        [-12.0, -14.0, 1.35],
        [15.5, -12.5, 0.95],
      ];
      for (const [sx, sz, scale] of slimePositions) {
        const slime = createVoxelSlimeMob(scale);
        slime.yaw = Math.random() * Math.PI * 2;
        placeMobOnGround(slime, sx, sz);
      }
      // Villagers roaming open courtyard/path of the Plains Village (clear of cottages)
      const villagerCoords: [number, number][] = [
        [8.5, -27.5],
        [13.5, -31.5],
      ];
      const colors = [0x92400e, 0x15803d];
      villagerCoords.forEach(([vx, vz], idx) => {
        const villager = createVoxelExplorerMob(colors[idx % colors.length]);
        villager.yaw = Math.random() * Math.PI * 2;
        placeMobOnGround(villager, vx, vz);
      });
      return;
    }

    const explorerColors = [0x22c55e, 0x3b82f6, 0xf59e0b];
    for (let i = 0; i < 3; i++) {
      const mob = createVoxelExplorerMob(explorerColors[i % explorerColors.length]);
      const angle = (i / 3) * Math.PI * 2;
      mob.yaw = Math.random() * Math.PI * 2;
      placeMobOnGround(mob, 8 + Math.cos(angle) * (10 + i * 3), 8 + Math.sin(angle) * (10 + i * 3));
    }
    for (let i = 0; i < 3; i++) {
      const pig = createVoxelPigMob();
      const angle = (i / 3) * Math.PI * 2 + 1.0;
      pig.yaw = Math.random() * Math.PI * 2;
      placeMobOnGround(pig, 8 + Math.cos(angle) * (7 + i * 4), 8 + Math.sin(angle) * (7 + i * 4));
    }
  }

  private chunkKey(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

  private getSurfaceHeightAt(wx: number, wz: number): number {
    if (this.config.worldType === 'superflat') {
      return 4;
    }
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

    if (this.config.worldType === 'superflat') {
      // Classic Superflat layers: Bedrock (y=0), Dirt (y=1..3), Grass (y=4)
      for (let lx = 0; lx < CHUNK_W; lx++) {
        for (let lz = 0; lz < CHUNK_D; lz++) {
          setLocal(lx, 0, lz, BlockId.Bedrock);
          setLocal(lx, 1, lz, BlockId.Dirt);
          setLocal(lx, 2, lz, BlockId.Dirt);
          setLocal(lx, 3, lz, BlockId.Dirt);
          setLocal(lx, 4, lz, BlockId.Grass);
        }
      }

      // Deterministic Plains Village along the north horizon (wx: -6..25, wz: -42..-22)
      if (cx >= -1 && cx <= 2 && cz >= -3 && cz <= -2) {
        const setWorld = (wx: number, wy: number, wz: number, id: BlockId) => {
          const lx = wx - cx * CHUNK_W;
          const lz = wz - cz * CHUNK_D;
          setLocal(lx, wy, lz, id);
        };

        const buildCottage = (ox: number, oz: number, w: number, d: number, wallH: number, roofBlock: BlockId) => {
          // Cobblestone foundation & floor at y=5
          for (let dx = 0; dx < w; dx++) {
            for (let dz = 0; dz < d; dz++) {
              setWorld(ox + dx, 4, oz + dz, BlockId.Cobblestone);
              for (let y = 5; y < 5 + wallH; y++) {
                const isCorner = (dx === 0 || dx === w - 1) && (dz === 0 || dz === d - 1);
                const isWall = dx === 0 || dx === w - 1 || dz === 0 || dz === d - 1;
                if (isWall) {
                  const isDoor = dz === d - 1 && dx === Math.floor(w / 2) && y < 7;
                  const isWin = !isCorner && y === 6 && ((dz === 0 || dz === d - 1) ? dx === 2 || dx === w - 3 : dz === Math.floor(d / 2));
                  if (isDoor) {
                    setWorld(ox + dx, y, oz + dz, BlockId.Air);
                  } else if (isWin) {
                    setWorld(ox + dx, y, oz + dz, BlockId.Glass);
                  } else {
                    setWorld(ox + dx, y, oz + dz, isCorner ? BlockId.OakLog : BlockId.OakPlanks);
                  }
                }
              }
            }
          }
          // Interior crafting table
          setWorld(ox + 1, 5, oz + 1, BlockId.CraftingTable);
          // Pitched stepped roof
          const steps = Math.ceil(w / 2);
          for (let s = 0; s < steps; s++) {
            const ry = 5 + wallH + s;
            for (let dx = s; dx < w - s; dx++) {
              for (let dz = -1; dz <= d; dz++) {
                if (s === 0 || dx === s || dx === w - 1 - s || s === steps - 1) {
                  setWorld(ox + dx, ry, oz + dz, roofBlock);
                }
              }
            }
          }
        };

        // Cobblestone village path leading toward center
        for (let wx = -4; wx <= 22; wx++) {
          setWorld(wx, 4, -27, BlockId.Cobblestone);
          setWorld(wx, 4, -28, BlockId.Cobblestone);
        }
        for (let wz = -39; wz <= -23; wz++) {
          setWorld(8, 4, wz, BlockId.Cobblestone);
          setWorld(9, 4, wz, BlockId.Cobblestone);
        }

        // Glowstone lamp posts along path
        for (const [lx, lz] of [[6, -26], [11, -26], [6, -34]]) {
          setWorld(lx, 5, lz, BlockId.OakLog);
          setWorld(lx, 6, lz, BlockId.OakLog);
          setWorld(lx, 7, lz, BlockId.Glowstone);
        }

        // Plains Village Houses & Church Tower
        buildCottage(-4, -36, 6, 6, 4, BlockId.OakPlanks); // West cottage
        buildCottage(2, -39, 5, 5, 4, BlockId.Cobblestone); // North-west house
        buildCottage(11, -41, 5, 5, 8, BlockId.Cobblestone); // Tall village church / bell tower
        buildCottage(17, -36, 7, 6, 4, BlockId.OakPlanks); // East large house
        buildCottage(1, -25, 5, 5, 3, BlockId.OakLog); // Front blacksmith hut

        // Two village oak trees
        for (const [tx, tz] of [[10, -25], [15, -30]]) {
          for (let ty = 5; ty <= 8; ty++) setWorld(tx, ty, tz, BlockId.OakLog);
          for (let dy = 8; dy <= 10; dy++) {
            const rad = dy === 10 ? 1 : 2;
            for (let dx = -rad; dx <= rad; dx++) {
              for (let dz = -rad; dz <= rad; dz++) {
                if (Math.abs(dx) === rad && Math.abs(dz) === rad && dy !== 9) continue;
                if (dx === 0 && dz === 0 && dy < 9) continue;
                setWorld(tx + dx, dy, tz + dz, BlockId.OakLeaves);
              }
            }
          }
        }
      }
    } else {
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
    if (!this.isRailBlock(id)) {
      this.railFacingHints.delete(`${wx},${wy},${wz}`);
    }
    this.onWorldDirtyCallback?.();

    // Mark neighbor chunks dirty if on boundary
    if (lx === 0) this.markDirty(cx - 1, cz);
    if (lx === CHUNK_W - 1) this.markDirty(cx + 1, cz);
    if (lz === 0) this.markDirty(cx, cz - 1);
    if (lz === CHUNK_D - 1) this.markDirty(cx, cz + 1);
  }

  private getRailTopTileAndRotation(
    id: BlockId,
    wx: number,
    y: number,
    wz: number,
  ): { tileIdx: number; rotSteps: number } {
    const hasRailAt = (rx: number, ry: number, rz: number) =>
      this.isRailBlock(this.getBlockAt(rx, ry, rz)) ||
      this.isRailBlock(this.getBlockAt(rx, ry + 1, rz)) ||
      this.isRailBlock(this.getBlockAt(rx, ry - 1, rz));

    const hasN = hasRailAt(wx, y, wz - 1);
    const hasS = hasRailAt(wx, y, wz + 1);
    const hasE = hasRailAt(wx + 1, y, wz);
    const hasW = hasRailAt(wx - 1, y, wz);

    const typeOffset = id === BlockId.RailStation ? 1 : id === BlockId.RailDepot ? 2 : 0;
    const straightTile = 25 + typeOffset;
    const cornerTile = 30 + typeOffset;
    const tTile = 33 + typeOffset;
    const crossTile = 36 + typeOffset;

    const count = (hasN ? 1 : 0) + (hasS ? 1 : 0) + (hasE ? 1 : 0) + (hasW ? 1 : 0);

    if (count === 0) {
      const hint = this.railFacingHints.get(`${wx},${y},${wz}`);
      return { tileIdx: straightTile, rotSteps: hint === 'ew' ? 1 : 0 };
    }
    if (count === 1) {
      return { tileIdx: straightTile, rotSteps: hasE || hasW ? 1 : 0 };
    }
    if (count === 2) {
      if (hasN && hasS) return { tileIdx: straightTile, rotSteps: 0 };
      if (hasE && hasW) return { tileIdx: straightTile, rotSteps: 1 };
      if (hasN && hasE) return { tileIdx: cornerTile, rotSteps: 0 };
      if (hasE && hasS) return { tileIdx: cornerTile, rotSteps: 1 };
      if (hasS && hasW) return { tileIdx: cornerTile, rotSteps: 2 };
      if (hasW && hasN) return { tileIdx: cornerTile, rotSteps: 3 };
    }
    if (count === 3) {
      if (!hasN) return { tileIdx: tTile, rotSteps: 0 };
      if (!hasE) return { tileIdx: tTile, rotSteps: 1 };
      if (!hasS) return { tileIdx: tTile, rotSteps: 2 };
      return { tileIdx: tTile, rotSteps: 3 };
    }
    return { tileIdx: crossTile, rotSteps: 0 };
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
          const isRail = this.isRailBlock(id);
          const isPlatformSlab = id === BlockId.PlatformEdge;
          const swayFlag = id === BlockId.OakLeaves || id === BlockId.CherryLeaves ? 0.9 : 0.0;
          const emissiveFlag =
            id === BlockId.Glowstone
              ? 1.4
              : id === BlockId.DiamondOre || id === BlockId.GoldOre
                ? 0.25
                : isRail && id !== BlockId.RailNormal
                  ? 0.35
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
            } else if (isRail) {
              if (face.faceType === 'bottom' && neighborMeta.opaque) continue;
            } else if (isPlatformSlab) {
              if (face.faceType === 'bottom' && neighborMeta.opaque) continue;
              if (
                face.faceType === 'side' &&
                (neighborId === BlockId.PlatformEdge || neighborMeta.opaque)
              ) {
                continue;
              }
            } else if (id === BlockId.Glass) {
              if (neighborId === BlockId.Glass || neighborMeta.opaque) continue;
            } else {
              if (neighborMeta.opaque) continue;
            }

            let tileIdx =
              face.faceType === 'top'
                ? meta.tiles[0]
                : face.faceType === 'side'
                  ? meta.tiles[1]
                  : meta.tiles[2];
            let rotSteps = 0;

            if (isRail && face.faceType === 'top') {
              const railVis = this.getRailTopTileAndRotation(id, wx, y, wz);
              tileIdx = railVis.tileIdx;
              rotSteps = railVis.rotSteps;
            }

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
            const topYOffset =
              isWater && face.faceType === 'top'
                ? -0.14
                : isRail
                  ? -0.86
                  : isPlatformSlab
                    ? -0.5
                    : 0;

            for (let i = 0; i < 4; i++) {
              const c = face.corners[i];
              targetPos.push(
                wx + c[0],
                y + c[1] + (c[1] === 1 ? topYOffset : 0),
                wz + c[2],
              );
              targetNorm.push(face.dir[0], face.dir[1], face.dir[2]);

              const uv = face.uvs[(i + rotSteps) % 4];
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
      if (b === BlockId.PlatformEdge) {
        const invX = dx !== 0 ? 1 / dx : 1e9;
        const invY = dy !== 0 ? 1 / dy : 1e9;
        const invZ = dz !== 0 ? 1 / dz : 1e9;
        const tx0 = (bx - ox) * invX;
        const tx1 = (bx + 1 - ox) * invX;
        const ty0 = (by - oy) * invY;
        const ty1 = (by + 0.5 - oy) * invY;
        const tz0 = (bz - oz) * invZ;
        const tz1 = (bz + 1 - oz) * invZ;
        const tminX = Math.min(tx0, tx1);
        const tmaxX = Math.max(tx0, tx1);
        const tminY = Math.min(ty0, ty1);
        const tmaxY = Math.max(ty0, ty1);
        const tminZ = Math.min(tz0, tz1);
        const tmaxZ = Math.max(tz0, tz1);
        const tEnter = Math.max(tminX, tminY, tminZ);
        const tExit = Math.min(tmaxX, tmaxY, tmaxZ);
        if (tExit >= Math.max(0, tEnter) && tEnter <= maxDist) {
          let snx = 0;
          let sny = 0;
          let snz = 0;
          if (tEnter === tminY) sny = dy > 0 ? -1 : 1;
          else if (tEnter === tminX) snx = dx > 0 ? -1 : 1;
          else snz = dz > 0 ? -1 : 1;
          return { x: bx, y: by, z: bz, nx: snx, ny: sny, nz: snz, block: b };
        }
      } else if (b !== BlockId.Air && b !== BlockId.Water) {
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
    this.swingTimer = 1.0;
    const hit = this.raycastVoxel(6.5);
    if (!hit) return;
    if (hit.block === BlockId.Bedrock && this.config.gameMode === 'survival') return;

    const meta = BLOCK_META[hit.block];
    const targetBlock = hit.block;

    if (this.activeMods.has('tnt_blaster')) {
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dz = -1; dz <= 1; dz++) {
            if (dx * dx + dy * dy + dz * dz <= 2) {
              const b = this.getBlockAt(hit.x + dx, hit.y + dy, hit.z + dz);
              if (b !== BlockId.Air && (b !== BlockId.Bedrock || this.config.gameMode === 'creative')) {
                this.setBlockAt(hit.x + dx, hit.y + dy, hit.z + dz, BlockId.Air);
              }
            }
          }
        }
      }
      this.particles.spawnBurst(hit.x, hit.y, hit.z, meta.breakColor, 24);
    } else if (
      (this.activeMods.has('veinminer') &&
        (targetBlock === BlockId.Stone ||
          targetBlock === BlockId.Cobblestone ||
          targetBlock === BlockId.CoalOre ||
          targetBlock === BlockId.IronOre ||
          targetBlock === BlockId.GoldOre ||
          targetBlock === BlockId.DiamondOre ||
          targetBlock === BlockId.Deepslate ||
          targetBlock === BlockId.CopperBlock)) ||
      (this.activeMods.has('tree_capitator') &&
        (targetBlock === BlockId.OakLog ||
          targetBlock === BlockId.OakLeaves ||
          targetBlock === BlockId.CherryLeaves))
    ) {
      const visited = new Set<string>();
      const queue: [number, number, number][] = [[hit.x, hit.y, hit.z]];
      visited.add(`${hit.x},${hit.y},${hit.z}`);
      let broken = 0;
      while (queue.length > 0 && broken < 16) {
        const [cx, cy, cz] = queue.shift()!;
        this.setBlockAt(cx, cy, cz, BlockId.Air);
        broken++;
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            for (let dz = -1; dz <= 1; dz++) {
              const nx = cx + dx;
              const ny = cy + dy;
              const nz = cz + dz;
              const k = `${nx},${ny},${nz}`;
              if (!visited.has(k) && this.getBlockAt(nx, ny, nz) === targetBlock) {
                visited.add(k);
                queue.push([nx, ny, nz]);
              }
            }
          }
        }
      }
      this.particles.spawnBurst(hit.x, hit.y, hit.z, meta.breakColor, 20);
    } else if (
      this.activeMods.has('effortless_building') &&
      (this.effortlessMirrorX || this.effortlessMirrorZ || this.effortlessRadial)
    ) {
      const mirrored = this.expandEffortlessSymmetry([[hit.x, hit.y, hit.z]]);
      const undoEdits: { x: number; y: number; z: number; prev: BlockId }[] = [];
      for (const [bx, by, bz] of mirrored) {
        const cur = this.getBlockAt(bx, by, bz);
        if (cur !== BlockId.Air && (cur !== BlockId.Bedrock || this.config.gameMode === 'creative')) {
          undoEdits.push({ x: bx, y: by, z: bz, prev: cur });
          this.setBlockAt(bx, by, bz, BlockId.Air);
        }
      }
      this.pushEffortlessUndo(undoEdits);
      this.particles.spawnBurst(hit.x, hit.y, hit.z, meta.breakColor, 18);
    } else {
      if (this.activeMods.has('effortless_building')) {
        this.pushEffortlessUndo([{ x: hit.x, y: hit.y, z: hit.z, prev: targetBlock }]);
      }
      this.setBlockAt(hit.x, hit.y, hit.z, BlockId.Air);
      this.particles.spawnBurst(hit.x, hit.y, hit.z, meta.breakColor, 14);
    }

    this.remeshDirtyChunks(8);
    this.shakeIntensity = 0.04;
    voxelAudio.playBlockBreak(meta.soundType);
  }

  private performPlaceBlock() {
    if (this.mode !== 'playing') return;

    // Create-Mod style Walk-to-Extend automatic rail anchor
    if (this.trackWalkModeEnabled && this.isRailBlock(this.selectedBlock)) {
      if (this.trackAnchorStart) {
        this.swingTimer = 1.0;
        this.confirmTrackAnchorPlacement();
        return;
      }
      const hit = this.raycastVoxel(6.5);
      if (!hit) return;
      const px = hit.x + hit.nx;
      const py = hit.y + hit.ny;
      const pz = hit.z + hit.nz;
      const overlapsPlayerAt = (bx: number, by: number, bz: number) =>
        bx + 1 > this.playerPos.x - 0.3 &&
        bx < this.playerPos.x + 0.3 &&
        by + 1 > this.playerPos.y &&
        by < this.playerPos.y + 1.75 &&
        bz + 1 > this.playerPos.z - 0.3 &&
        bz < this.playerPos.z + 0.3;
      if (overlapsPlayerAt(px, py, pz)) return;

      const [fx, fz] = this.getCardinalFacing();
      this.railFacingHints.set(`${px},${py},${pz}`, Math.abs(fx) > Math.abs(fz) ? 'ew' : 'ns');
      this.swingTimer = 1.0;
      this.setBlockAt(px, py, pz, this.selectedBlock);
      this.remeshDirtyChunks(8);
      voxelAudio.playBlockPlace(BLOCK_META[this.selectedBlock].soundType);

      this.trackAnchorStart = {
        x: px,
        y: py,
        z: pz,
        railId: this.selectedBlock,
        fx,
        fz,
      };
      this.updateTrackPreviewMesh();
      return;
    }

    const hit = this.raycastVoxel(6.5);
    const cursorFallback = !hit && this.activeMods.has('effortless_building') && this.effortlessAnchor
      ? this.getEffortlessCursorTarget()
      : null;
    if (!hit && !cursorFallback) return;

    const px = hit ? hit.x + hit.nx : cursorFallback![0];
    const py = hit ? hit.y + hit.ny : cursorFallback![1];
    const pz = hit ? hit.z + hit.nz : cursorFallback![2];

    const blockH = this.selectedBlock === BlockId.PlatformEdge ? 0.5 : 1;
    const overlapsPlayerAt = (bx: number, by: number, bz: number) =>
      bx + 1 > this.playerPos.x - 0.3 &&
      bx < this.playerPos.x + 0.3 &&
      by + blockH > this.playerPos.y &&
      by < this.playerPos.y + 1.75 &&
      bz + 1 > this.playerPos.z - 0.3 &&
      bz < this.playerPos.z + 0.3;

    // Effortless Building (Rust Remake): 2-click shape builders + symmetry mirrors + instant undo
    if (this.activeMods.has('effortless_building')) {
      if (this.effortlessMode !== 'normal') {
        if (!this.effortlessAnchor) {
          this.effortlessAnchor = [px, py, pz];
          this.swingTimer = 1.0;
          voxelAudio.playBlockPlace(BLOCK_META[this.selectedBlock].soundType);
          this.updateEffortlessPreviewMesh();
          return;
        }
        const baseCells = this.computeEffortlessBaseCells(
          this.effortlessAnchor,
          [px, py, pz],
          this.effortlessMode,
          this.effortlessHollow,
        );
        const targets = this.expandEffortlessSymmetry(baseCells);
        this.effortlessAnchor = null;
        this.effortlessPreviewMesh.visible = false;
        this.effortlessPreviewCount = 0;

        const undoEdits: { x: number; y: number; z: number; prev: BlockId }[] = [];
        for (const [bx, by, bz] of targets) {
          if (overlapsPlayerAt(bx, by, bz)) continue;
          const prev = this.getBlockAt(bx, by, bz);
          if (prev !== this.selectedBlock) {
            undoEdits.push({ x: bx, y: by, z: bz, prev });
            if (this.isRailBlock(this.selectedBlock)) {
              const [fx, fz] = this.getCardinalFacing();
              this.railFacingHints.set(`${bx},${by},${bz}`, Math.abs(fx) > Math.abs(fz) ? 'ew' : 'ns');
            }
            this.setBlockAt(bx, by, bz, this.selectedBlock);
          }
        }
        this.pushEffortlessUndo(undoEdits);
        this.swingTimer = 1.0;
        this.remeshDirtyChunks(16);
        voxelAudio.playBlockPlace(BLOCK_META[this.selectedBlock].soundType);
        this.onWorldDirtyCallback?.();
        return;
      }

      if (this.effortlessMirrorX || this.effortlessMirrorZ || this.effortlessRadial) {
        const targets = this.expandEffortlessSymmetry([[px, py, pz]]);
        const undoEdits: { x: number; y: number; z: number; prev: BlockId }[] = [];
        for (const [bx, by, bz] of targets) {
          if (overlapsPlayerAt(bx, by, bz)) continue;
          const prev = this.getBlockAt(bx, by, bz);
          if (prev === BlockId.Air || prev === BlockId.Water) {
            undoEdits.push({ x: bx, y: by, z: bz, prev });
            if (this.isRailBlock(this.selectedBlock)) {
              const [fx, fz] = this.getCardinalFacing();
              this.railFacingHints.set(`${bx},${by},${bz}`, Math.abs(fx) > Math.abs(fz) ? 'ew' : 'ns');
            }
            this.setBlockAt(bx, by, bz, this.selectedBlock);
          }
        }
        this.pushEffortlessUndo(undoEdits);
        this.swingTimer = 1.0;
        this.remeshDirtyChunks(12);
        voxelAudio.playBlockPlace(BLOCK_META[this.selectedBlock].soundType);
        this.onWorldDirtyCallback?.();
        return;
      }
    }

    if (!hit || overlapsPlayerAt(px, py, pz)) return;

    this.swingTimer = 1.0;

    if (this.isRailBlock(this.selectedBlock)) {
      const [fx, fz] = this.getCardinalFacing();
      this.railFacingHints.set(`${px},${py},${pz}`, Math.abs(fx) > Math.abs(fz) ? 'ew' : 'ns');
    }

    if (this.activeMods.has('builders_wand')) {
      for (let u = -1; u <= 1; u++) {
        for (let v = -1; v <= 1; v++) {
          const tx = hit.nx !== 0 ? px : px + u;
          const ty = hit.ny !== 0 ? py : hit.nx !== 0 ? py + u : py + v;
          const tz = hit.nz !== 0 ? pz : hit.ny !== 0 ? pz + v : pz + v;
          if (!overlapsPlayerAt(tx, ty, tz) && this.getBlockAt(tx, ty, tz) === BlockId.Air) {
            this.setBlockAt(tx, ty, tz, this.selectedBlock);
          }
        }
      }
    } else {
      if (this.activeMods.has('effortless_building')) {
        this.pushEffortlessUndo([{ x: px, y: py, z: pz, prev: this.getBlockAt(px, py, pz) }]);
      }
      this.setBlockAt(px, py, pz, this.selectedBlock);
    }

    this.remeshDirtyChunks(8);
    const meta = BLOCK_META[this.selectedBlock];
    voxelAudio.playBlockPlace(meta.soundType);
  }

  private getBlockTopHeight(b: BlockId): number {
    if (!BLOCK_META[b]?.solid) return 0;
    return b === BlockId.PlatformEdge ? 0.5 : 1.0;
  }

  private getSupportingTopY(
    x: number,
    prevY: number,
    nextY: number,
    z: number,
    halfW: number,
  ): number | null {
    const minX = Math.floor(x - halfW);
    const maxX = Math.floor(x + halfW);
    const minZ = Math.floor(z - halfW);
    const maxZ = Math.floor(z + halfW);
    const minBy = Math.floor(nextY);
    const maxBy = Math.floor(prevY + 0.55);
    let bestTop: number | null = null;

    for (let bx = minX; bx <= maxX; bx++) {
      for (let by = minBy; by <= maxBy; by++) {
        for (let bz = minZ; bz <= maxZ; bz++) {
          const b = this.getBlockAt(bx, by, bz);
          const h = this.getBlockTopHeight(b);
          if (h <= 0) continue;
          const top = by + h;
          if (top <= prevY + 0.55 && top >= nextY - 0.05) {
            if (bestTop === null || top > bestTop) {
              bestTop = top;
            }
          }
        }
      }
    }
    return bestTop;
  }

  private isChunkLoadedAt(wx: number, wz: number): boolean {
    const cx = Math.floor(wx / CHUNK_W);
    const cz = Math.floor(wz / CHUNK_D);
    return this.chunks.has(this.chunkKey(cx, cz));
  }

  private collidesAt(x: number, y: number, z: number): boolean {
    const hw = 0.28;
    const height = 1.72;
    const minX = Math.floor(x - hw);
    const maxX = Math.floor(x + hw);
    const minY = Math.floor(y + 0.001);
    const maxY = Math.floor(y + height);
    const minZ = Math.floor(z - hw);
    const maxZ = Math.floor(z + hw);
    const entityMinY = y + 0.001;
    const entityMaxY = y + height;

    for (let bx = minX; bx <= maxX; bx++) {
      for (let by = minY; by <= maxY; by++) {
        for (let bz = minZ; bz <= maxZ; bz++) {
          const h = this.getBlockTopHeight(this.getBlockAt(bx, by, bz));
          if (h > 0 && entityMaxY > by && entityMinY < by + h) {
            return true;
          }
        }
      }
    }
    return false;
  }

  private collidesMobAt(
    x: number,
    y: number,
    z: number,
    halfW: number,
    height: number,
  ): boolean {
    const minX = Math.floor(x - halfW);
    const maxX = Math.floor(x + halfW);
    const entityMinY = y + 0.02;
    const entityMaxY = y + height - 0.02;
    const minY = Math.floor(entityMinY);
    const maxY = Math.floor(entityMaxY);
    const minZ = Math.floor(z - halfW);
    const maxZ = Math.floor(z + halfW);

    for (let bx = minX; bx <= maxX; bx++) {
      for (let by = minY; by <= maxY; by++) {
        for (let bz = minZ; bz <= maxZ; bz++) {
          const h = this.getBlockTopHeight(this.getBlockAt(bx, by, bz));
          if (h > 0 && entityMaxY > by && entityMinY < by + h) {
            return true;
          }
        }
      }
    }
    return false;
  }

  private updatePlayer(dt: number) {
    // Track nearest doorway for HUD prompt + walk-in open-door boarding
    const nearDoor = this.findNearestCarDoor(3.8);
    this.cachedNearbyTrain = nearDoor
      ? {
          depotId: nearDoor.depotId,
          trainName: nearDoor.train.spec.name,
          carIndex: nearDoor.carIndex,
          doorOpen: nearDoor.train.doorProgress > 0.65,
          status: nearDoor.train.status,
        }
      : null;

    // Seamless walk-in boarding when walking directly through an open doorway
    if (!this.ridingDepotId && !this.flying && nearDoor && nearDoor.train.doorProgress > 0.65) {
      const lx = nearDoor.localPos.x;
      const lz = nearDoor.localPos.z;
      const inDoorGapZ = Math.abs(lz - 0.94) < 0.44 || Math.abs(lz + 0.94) < 0.44;
      if (inDoorGapZ && Math.abs(lx) < 0.78 && Math.abs(nearDoor.localPos.y) < 1.25) {
        this.ridingDepotId = nearDoor.depotId;
        this.ridingCarIndex = nearDoor.carIndex;
        this.ridingLocalPos.set(
          THREE.MathUtils.clamp(lx * 0.65, -0.45, 0.45),
          MTR_FLOOR_Y,
          THREE.MathUtils.clamp(lz, -1.85, 1.85),
        );
        this.ridingSeated = false;
        this.ridingSeatIndex = -1;
        this.playerVel.set(0, 0, 0);
      }
    }

    // If riding inside an MTR train car, simulate full cabin interior walking, seating, gangways & open doors
    if (this.ridingDepotId) {
      const ridden = this.mtrTrains.get(this.ridingDepotId);
      const car = ridden?.cars[this.ridingCarIndex] ?? ridden?.cars[0];
      if (!ridden || !car) {
        this.ridingDepotId = null;
        this.ridingSeated = false;
        this.ridingSeatIndex = -1;
      } else {
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

        if (!this.ridingSeated && mag > 0.05) {
          const sinY = Math.sin(this.yaw);
          const cosY = Math.cos(this.yaw);
          const wishX = -sinY * forward + cosY * strafe;
          const wishZ = -cosY * forward - sinY * strafe;

          const carYaw = car.group.rotation.y;
          const cCos = Math.cos(carYaw);
          const cSin = Math.sin(carYaw);
          const localWishX = wishX * cCos - wishZ * cSin;
          const localWishZ = wishX * cSin + wishZ * cCos;

          let nextLX = this.ridingLocalPos.x + localWishX * 3.1 * dt;
          let nextLZ = this.ridingLocalPos.z + localWishZ * 3.1 * dt;

          const inDoorZone = Math.abs(nextLZ - 0.94) < 0.42 || Math.abs(nextLZ + 0.94) < 0.42;
          const doorsOpen = ridden.doorProgress > 0.65;

          // Walk physically out onto platform through an open doorway!
          if (doorsOpen && inDoorZone && Math.abs(nextLX) > 0.68 && ridden.currentSpeed < 1.2) {
            this.exitTrainCleanly(Math.sign(nextLX));
            return;
          }

          // Cabin interior wall + closed-door AABB bounds
          const maxSide = doorsOpen && inDoorZone ? 0.84 : 0.56;
          nextLX = THREE.MathUtils.clamp(nextLX, -maxSide, maxSide);

          // Walk between articulated cars through open vestibule gangways
          if (nextLZ > 1.9) {
            if (this.ridingCarIndex > 0 && Math.abs(nextLX) < 0.42) {
              this.ridingCarIndex -= 1;
              nextLZ = -1.82;
            } else {
              nextLZ = car.isLeadCab ? 1.56 : 1.9;
            }
          } else if (nextLZ < -1.9) {
            if (this.ridingCarIndex < ridden.cars.length - 1 && Math.abs(nextLX) < 0.42) {
              this.ridingCarIndex += 1;
              nextLZ = 1.82;
            } else {
              nextLZ = -1.9;
            }
          }

          this.ridingLocalPos.set(nextLX, MTR_FLOOR_Y, nextLZ);
        }

        const activeCar = ridden.cars[this.ridingCarIndex] ?? car;
        this.carLocalToWorld(
          this.ridingLocalPos.x,
          this.ridingLocalPos.y,
          this.ridingLocalPos.z,
          activeCar.group,
          this.playerPos,
        );
        this.playerVel.set(0, 0, 0);
        this.onGround = true;

        const eyeHeight = this.ridingSeated ? 0.94 : 1.54;
        this.camera.position.set(this.playerPos.x, this.playerPos.y + eyeHeight, this.playerPos.z);
        this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
        if (this.heldBlockMesh) this.heldBlockMesh.visible = false;
        this.highlightBox.visible = false;
        this.ensureChunksAround(this.playerPos.x, this.playerPos.z);
        this.remeshDirtyChunks(2);
        return;
      }
    }

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

    const sprinting = (this.keys.has('ShiftLeft') || this.touchSprint) && !this.flying;
    const hasBoots = this.activeMods.has('super_jump');
    const baseSpeed = this.flying ? 11.5 : sprinting ? (hasBoots ? 9.2 : 7.8) : 5.2;

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
      if (this.keys.has('Space') || this.jumpBufferTimer > 0) {
        vyTarget += 7.5;
        this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
      }
      if (this.keys.has('ShiftLeft') || this.keys.has('KeyC') || this.touchDescend) vyTarget -= 7.5;
      this.playerVel.y = THREE.MathUtils.damp(this.playerVel.y, vyTarget, 12, dt);
    } else {
      const gravity = inWater ? 8.0 : 24.0;
      this.playerVel.y -= gravity * dt;
      if (inWater && (this.keys.has('Space') || this.jumpBufferTimer > 0)) {
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
          this.playerVel.y = hasBoots ? 11.8 : 8.4;
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

    // Axis-separated AABB resolution (with automatic 0.5-block slab step-up)
    const nextX = this.playerPos.x + this.playerVel.x * dt;
    if (!this.collidesAt(nextX, this.playerPos.y, this.playerPos.z)) {
      this.playerPos.x = nextX;
    } else if (
      this.onGround &&
      !this.flying &&
      !this.collidesAt(this.playerPos.x, this.playerPos.y + 0.55, this.playerPos.z) &&
      !this.collidesAt(nextX, this.playerPos.y + 0.55, this.playerPos.z)
    ) {
      const stepTop = this.getSupportingTopY(nextX, this.playerPos.y, this.playerPos.y, this.playerPos.z, 0.28);
      this.playerPos.y = stepTop !== null ? Math.max(this.playerPos.y, stepTop) : this.playerPos.y + 0.52;
      this.playerPos.x = nextX;
    } else {
      this.playerVel.x = 0;
    }

    const nextZ = this.playerPos.z + this.playerVel.z * dt;
    if (!this.collidesAt(this.playerPos.x, this.playerPos.y, nextZ)) {
      this.playerPos.z = nextZ;
    } else if (
      this.onGround &&
      !this.flying &&
      !this.collidesAt(this.playerPos.x, this.playerPos.y + 0.55, this.playerPos.z) &&
      !this.collidesAt(this.playerPos.x, this.playerPos.y + 0.55, nextZ)
    ) {
      const stepTop = this.getSupportingTopY(this.playerPos.x, this.playerPos.y, this.playerPos.y, nextZ, 0.28);
      this.playerPos.y = stepTop !== null ? Math.max(this.playerPos.y, stepTop) : this.playerPos.y + 0.52;
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
        const snapTop = this.getSupportingTopY(this.playerPos.x, this.playerPos.y, nextY, this.playerPos.z, 0.28);
        if (snapTop !== null && !this.collidesAt(this.playerPos.x, snapTop, this.playerPos.z)) {
          this.playerPos.y = snapTop;
        }
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

    // Animate first-person held block in bottom-right hand
    if (this.heldBlockMesh) {
      this.heldBlockMesh.visible = this.mode === 'playing';
      if (this.swingTimer > 0) {
        this.swingTimer = Math.max(0, this.swingTimer - dt * 4.5);
      }
      const swingArc = Math.sin(this.swingTimer * Math.PI);
      const walkHandBobX = this.onGround && horizSpeed > 0.6 ? Math.cos(this.walkBobPhase * 0.5) * 0.008 : 0;
      const walkHandBobY = this.onGround && horizSpeed > 0.6 ? Math.abs(Math.sin(this.walkBobPhase * 0.5)) * 0.01 : 0;
      this.heldBlockMesh.position.set(
        0.205 + walkHandBobX - swingArc * 0.055,
        -0.165 - walkHandBobY - swingArc * 0.035,
        -0.255 - swingArc * 0.045,
      );
      this.heldBlockMesh.rotation.set(
        0.18 - swingArc * 0.55,
        -0.62 + swingArc * 0.28,
        0.08 + swingArc * 0.22,
      );
    }

    // Update target block wireframe highlight
    const hit = this.raycastVoxel(6.5);
    if (hit) {
      this.targetedBlock = hit;
      this.highlightBox.visible = true;
      if (hit.block === BlockId.PlatformEdge) {
        this.highlightBox.scale.set(1, 0.5, 1);
        this.highlightBox.position.set(hit.x + 0.5, hit.y + 0.25, hit.z + 0.5);
      } else {
        this.highlightBox.scale.set(1, 1, 1);
        this.highlightBox.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
      }
    } else {
      this.targetedBlock = null;
      this.highlightBox.visible = false;
    }

    // Keep sun centered over player for crisp shadows
    this.sunLight.position.set(this.playerPos.x + 36, 70, this.playerPos.z + 28);
    this.sunLight.target.position.set(this.playerPos.x, 20, this.playerPos.z);

    // Update Create-style walk-to-extend 3D ghost track preview & Effortless Building preview
    this.updateTrackPreviewMesh();
    this.updateEffortlessPreviewMesh();
  }

  private updateMobsAndClouds(dt: number) {
    // Drift clouds gently
    for (const c of this.cloudsGroup.children) {
      c.position.x += dt * 1.1;
      if (c.position.x > 90) c.position.x = -90;
    }

    this.stationScanTimer -= dt;
    if (this.stationScanTimer <= 0) {
      this.stationScanTimer = 1.6;
      this.refreshStationClusters();
    }

    const isSuperflat = this.config.worldType === 'superflat';

    // Roaming multi-part mobs & commuter NPCs with axis-separated AABB collision + MTR station/train interaction
    for (const mob of this.mobs) {
      // Handle NPC commuters actively seated & riding inside a moving MTR train car
      if (mob.kind === 'explorer' && mob.transitState === 'riding' && mob.ridingDepotId) {
        const train = this.mtrTrains.get(mob.ridingDepotId);
        const car = train?.cars[mob.ridingCarIndex];
        const slot = MTR_CAR_SEAT_SLOTS[mob.seatSlotIndex];
        if (!train || !car || !slot) {
          mob.transitState = 'roam';
          mob.ridingDepotId = null;
          mob.seatSlotIndex = -1;
          mob.y = this.findSafeStandY(mob.x, Math.round(mob.y), mob.z);
          continue;
        }

        // Sync seated position & bent-leg sitting pose directly inside the hollow train interior
        this.carLocalToWorld(slot.x, slot.y - 0.12, slot.z, car.group, _vec3A);
        mob.x = _vec3A.x;
        mob.y = _vec3A.y;
        mob.z = _vec3A.z;
        mob.yaw = car.group.rotation.y + slot.yaw;
        mob.group.position.set(mob.x, mob.y, mob.z);
        mob.group.rotation.y = mob.yaw;

        if (mob.legs.length >= 2) {
          mob.legs[0].rotation.x = -Math.PI * 0.46;
          mob.legs[1].rotation.x = -Math.PI * 0.46;
        }
        if (mob.arms.length >= 2) {
          mob.arms[0].rotation.x = -0.18;
          mob.arms[1].rotation.x = -0.18;
        }

        // Alight onto destination platform when train stops at a different station & doors open
        if (train.status === 'At Station' && train.doorProgress > 0.65 && train.dwellTimer > 0.85) {
          const curCellKey = `${train.currentCell[0]},${train.currentCell[1]},${train.currentCell[2]}`;
          const curCluster = this.cachedStationClusters.find((st) => st.cells.has(curCellKey));
          if (curCluster && curCluster.id !== mob.boardedStationKey) {
            if (mob.seatSlotIndex >= 0 && mob.seatSlotIndex < car.seatOccupants.length) {
              car.seatOccupants[mob.seatSlotIndex] = null;
            }
            const exitSide = slot.x < 0 ? -1 : 1;
            this.carLocalToWorld(exitSide * 1.48, 0.05, 0.94, car.group, _vec3B);
            mob.x = _vec3B.x;
            mob.z = _vec3B.z;
            mob.y = this.findSafeStandY(mob.x, train.currentCell[1] + 1, mob.z);
            mob.vy = 0;
            mob.onGround = true;
            mob.transitState = 'roam';
            mob.ridingDepotId = null;
            mob.seatSlotIndex = -1;
            mob.boardedStationKey = null;
            mob.transitCooldown = 10 + Math.random() * 6;
            if (mob.legs.length >= 2) {
              mob.legs[0].rotation.x = 0;
              mob.legs[1].rotation.x = 0;
            }
            if (mob.arms.length >= 2) {
              mob.arms[0].rotation.x = 0;
              mob.arms[1].rotation.x = 0;
            }
            mob.group.position.set(mob.x, mob.y, mob.z);
          }
        }
        continue;
      }

      if (!this.isChunkLoadedAt(mob.x, mob.z)) continue;

      // Explorer NPC commuter decision: head to nearest Red Station Rail platform to catch trains
      let waitingStill = false;
      if (mob.kind === 'explorer') {
        if (mob.transitState === 'roam') {
          mob.transitCooldown = Math.max(0, mob.transitCooldown - dt);
          if (mob.transitCooldown <= 0 && this.cachedStationClusters.length > 0) {
            let bestCluster = this.cachedStationClusters[0];
            let bestDist = Infinity;
            for (const st of this.cachedStationClusters) {
              const d = Math.hypot(mob.x - st.waitPos[0], mob.z - st.waitPos[2]);
              if (d < bestDist) {
                bestDist = d;
                bestCluster = st;
              }
            }
            if (bestDist <= 46) {
              mob.transitState = 'wait_platform';
              mob.targetWaitPos = [
                bestCluster.waitPos[0] + (Math.random() - 0.5) * 1.6,
                bestCluster.waitPos[1],
                bestCluster.waitPos[2] + (Math.random() - 0.5) * 0.6,
              ];
            }
          }
        }

        if (mob.transitState === 'wait_platform' && mob.targetWaitPos) {
          const distToWait = Math.hypot(
            mob.targetWaitPos[0] - mob.x,
            mob.targetWaitPos[2] - mob.z,
          );
          if (distToWait > 1.2) {
            mob.yaw = Math.atan2(mob.targetWaitPos[0] - mob.x, mob.targetWaitPos[2] - mob.z);
          } else {
            waitingStill = true;
          }

          // Check if any train with open doors is dwelling near this NPC
          for (const [depotId, train] of this.mtrTrains.entries()) {
            if (train.status !== 'At Station' || train.doorProgress < 0.65 || train.dwellTimer <= 0.85) {
              continue;
            }
            const curCellKey = `${train.currentCell[0]},${train.currentCell[1]},${train.currentCell[2]}`;
            const curCluster = this.cachedStationClusters.find((st) => st.cells.has(curCellKey));
            for (let carIdx = 0; carIdx < train.cars.length; carIdx++) {
              const car = train.cars[carIdx];
              const carDist = Math.hypot(
                car.group.position.x - mob.x,
                car.group.position.z - mob.z,
              );
              if (carDist <= 8.5) {
                const openSlotIdx = car.seatOccupants.indexOf(null);
                if (openSlotIdx >= 0) {
                  car.seatOccupants[openSlotIdx] = mob.id;
                  mob.transitState = 'riding';
                  mob.ridingDepotId = depotId;
                  mob.ridingCarIndex = carIdx;
                  mob.seatSlotIndex = openSlotIdx;
                  mob.boardedStationKey = curCluster?.id ?? curCellKey;
                  break;
                }
              }
            }
            if (mob.transitState === 'riding') break;
          }

          if (mob.transitState === 'riding') continue;
        }
      }

      mob.turnTimer -= dt;
      if (mob.turnTimer <= 0) {
        mob.turnTimer = 2.4 + Math.random() * 3.8;
        if (mob.transitState !== 'wait_platform') {
          mob.yaw += (Math.random() - 0.5) * 2.2;
        }
      }

      // If somehow spawned overlapping a newly placed block, lift gently above it
      if (this.collidesMobAt(mob.x, mob.y, mob.z, mob.halfWidth, mob.height)) {
        let lifted = false;
        for (let up = 1; up <= 5; up++) {
          if (!this.collidesMobAt(mob.x, mob.y + up, mob.z, mob.halfWidth, mob.height)) {
            mob.y += up;
            lifted = true;
            break;
          }
        }
        if (!lifted) {
          mob.y = this.getSurfaceHeightAt(mob.x, mob.z) + 1;
        }
      }

      const speed = waitingStill
        ? 0
        : mob.kind === 'explorer'
          ? 1.65
          : mob.kind === 'slime'
            ? 1.2
            : 1.05;
      const moveFactor = mob.kind === 'slime' ? (mob.onGround ? 0.15 : 1.0) : 1.0;
      const dx = Math.sin(mob.yaw) * speed * moveFactor * dt;
      const dz = Math.cos(mob.yaw) * speed * moveFactor * dt;

      const anchorZ = isSuperflat ? -12 : 8;
      const maxRange = isSuperflat ? 44 : 34;
      const distFromAnchor = Math.hypot(mob.x + dx - 8, mob.z + dz - anchorZ);

      let blocked = false;
      if (!waitingStill && mob.transitState !== 'wait_platform' && distFromAnchor > maxRange) {
        mob.yaw = Math.atan2(8 - mob.x, anchorZ - mob.z);
      } else if (!waitingStill) {
        // Avoid stepping into water blocks
        const aheadWater =
          this.getBlockAt(
            Math.floor(mob.x + Math.sin(mob.yaw) * (mob.halfWidth + 0.5)),
            Math.floor(mob.y - 0.2),
            Math.floor(mob.z + Math.cos(mob.yaw) * (mob.halfWidth + 0.5)),
          ) === BlockId.Water;

        if (aheadWater) {
          mob.yaw += Math.PI * 0.72;
        } else {
          // X-axis AABB resolution with slab (0.54) and full-block (1.02) auto-step-up
          const nextX = mob.x + dx;
          if (this.isChunkLoadedAt(nextX, mob.z)) {
            if (!this.collidesMobAt(nextX, mob.y, mob.z, mob.halfWidth, mob.height)) {
              mob.x = nextX;
            } else if (
              mob.onGround &&
              !this.collidesMobAt(mob.x, mob.y + 0.54, mob.z, mob.halfWidth, mob.height) &&
              !this.collidesMobAt(nextX, mob.y + 0.54, mob.z, mob.halfWidth, mob.height)
            ) {
              const stepTop = this.getSupportingTopY(nextX, mob.y, mob.y, mob.z, mob.halfWidth);
              mob.y = stepTop !== null ? Math.max(mob.y, stepTop) : mob.y + 0.52;
              mob.x = nextX;
            } else if (
              mob.onGround &&
              !this.collidesMobAt(mob.x, mob.y + 1.02, mob.z, mob.halfWidth, mob.height) &&
              !this.collidesMobAt(nextX, mob.y + 1.02, mob.z, mob.halfWidth, mob.height)
            ) {
              mob.y += 1.02;
              mob.x = nextX;
            } else {
              blocked = true;
            }
          }

          // Z-axis AABB resolution with slab (0.54) and full-block (1.02) auto-step-up
          const nextZ = mob.z + dz;
          if (this.isChunkLoadedAt(mob.x, nextZ)) {
            if (!this.collidesMobAt(mob.x, mob.y, nextZ, mob.halfWidth, mob.height)) {
              mob.z = nextZ;
            } else if (
              mob.onGround &&
              !this.collidesMobAt(mob.x, mob.y + 0.54, mob.z, mob.halfWidth, mob.height) &&
              !this.collidesMobAt(mob.x, mob.y + 0.54, nextZ, mob.halfWidth, mob.height)
            ) {
              const stepTop = this.getSupportingTopY(mob.x, mob.y, mob.y, nextZ, mob.halfWidth);
              mob.y = stepTop !== null ? Math.max(mob.y, stepTop) : mob.y + 0.52;
              mob.z = nextZ;
            } else if (
              mob.onGround &&
              !this.collidesMobAt(mob.x, mob.y + 1.02, mob.z, mob.halfWidth, mob.height) &&
              !this.collidesMobAt(mob.x, mob.y + 1.02, nextZ, mob.halfWidth, mob.height)
            ) {
              mob.y += 1.02;
              mob.z = nextZ;
            } else {
              blocked = true;
            }
          }
        }
      }

      if (blocked) {
        mob.yaw += Math.PI * (0.55 + Math.random() * 0.6);
        mob.turnTimer = 1.1;
      }

      // Vertical gravity + slime hopping impulse
      if (mob.kind === 'slime') {
        if (mob.onGround) {
          mob.hopPhase += dt * 3.4;
          if (mob.hopPhase >= Math.PI * 2) {
            mob.hopPhase = 0;
            mob.vy = 6.2;
            mob.onGround = false;
          }
        }
      }

      mob.vy -= 22.0 * dt;
      const nextY = mob.y + mob.vy * dt;
      if (!this.collidesMobAt(mob.x, nextY, mob.z, mob.halfWidth, mob.height)) {
        mob.y = nextY;
        mob.onGround = false;
      } else {
        if (mob.vy < 0) {
          // Snap cleanly onto supporting slab (0.5) or full block (1.0) top
          const snapTop = this.getSupportingTopY(mob.x, mob.y, nextY, mob.z, mob.halfWidth);
          if (snapTop !== null && !this.collidesMobAt(mob.x, snapTop, mob.z, mob.halfWidth, mob.height)) {
            mob.y = snapTop;
          }
          mob.onGround = true;
        }
        mob.vy = 0;
      }

      // Safety bedrock floor clamp
      if (mob.y < 1) {
        mob.y = this.getSurfaceHeightAt(mob.x, mob.z) + 1;
        mob.vy = 0;
        mob.onGround = true;
      }

      mob.group.position.set(mob.x, mob.y, mob.z);
      mob.group.rotation.y = mob.yaw;

      if (mob.kind === 'slime') {
        const squash = mob.onGround ? 0.92 : mob.vy > 0 ? 1.08 : 0.98;
        mob.group.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
        continue;
      }

      if (waitingStill) {
        if (mob.legs.length >= 2) {
          mob.legs[0].rotation.x = 0;
          mob.legs[1].rotation.x = 0;
        }
        if (mob.arms.length === 2) {
          mob.arms[0].rotation.x = 0;
          mob.arms[1].rotation.x = 0;
        }
        continue;
      }

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

    // Night Vision / Fullbright Forge Mod Floor
    if (this.activeMods.has('night_vision')) {
      this.hemiLight.intensity = Math.max(this.hemiLight.intensity, 0.92);
      this.sunLight.intensity = Math.max(this.sunLight.intensity, 0.65);
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
        const isFlat = this.config.worldType === 'superflat';
        const radius = isFlat ? 18 : 22;
        const anchorZ = isFlat ? -6 : 8;
        const cx = 8 + Math.cos(this.titleAngle) * radius;
        const cz = anchorZ + Math.sin(this.titleAngle) * radius;
        const ground = this.getSurfaceHeightAt(8, 8);
        this.camera.up.set(0, 1, 0);
        this.camera.position.set(cx, ground + (isFlat ? 6 : 12), cz);
        _vec3B.set(8, ground + (isFlat ? 2 : 2), isFlat ? -22 : 8);
        this.camera.lookAt(_vec3B);
        if (this.heldBlockMesh) this.heldBlockMesh.visible = false;
        this.highlightBox.visible = false;
        this.remeshDirtyChunks(3);
      } else if (this.mode === 'playing') {
        this.updatePlayer(dt);
      }

      this.updateDayNightCycle(dt);
      this.updateMobsAndClouds(dt);
      this.updateMtrTrains(dt);
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
        const walkPreview =
          this.trackAnchorStart && this.trackWalkModeEnabled && this.isRailBlock(this.selectedBlock)
            ? this.getWalkPreviewPath()
            : null;
        const riddenTrain = this.ridingDepotId ? this.mtrTrains.get(this.ridingDepotId) : null;
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
          trackWalkMode: this.trackWalkModeEnabled,
          trackCurveStyle: this.trackCurveStyle,
          trackAnchor:
            walkPreview && this.trackAnchorStart
              ? {
                  startPos: walkPreview.startPos,
                  endPos: walkPreview.endPos,
                  lengthBlocks: walkPreview.cells.length,
                  railName: BLOCK_META[this.selectedBlock]?.name ?? 'Rail',
                  isCurve: walkPreview.isCurve,
                }
              : null,
          trainInteraction: {
            riding: Boolean(riddenTrain),
            seated: this.ridingSeated,
            depotId: this.ridingDepotId,
            trainName: riddenTrain?.spec.name ?? null,
            carIndex: this.ridingCarIndex,
            carCount: riddenTrain?.cars.length ?? 0,
            doorOpen: riddenTrain ? riddenTrain.doorProgress > 0.65 : Boolean(this.cachedNearbyTrain?.doorOpen),
            doorProgress: riddenTrain ? Number(riddenTrain.doorProgress.toFixed(2)) : 0,
            trainStatus: riddenTrain?.status ?? this.cachedNearbyTrain?.status ?? null,
            nearbyTrain: this.cachedNearbyTrain,
            onboardNpcCount: this.ridingDepotId
              ? this.getTrainOnboardNpcCount(this.ridingDepotId)
              : this.cachedNearbyTrain
                ? this.getTrainOnboardNpcCount(this.cachedNearbyTrain.depotId)
                : 0,
          },
          effortless: {
            enabled: this.activeMods.has('effortless_building'),
            mode: this.effortlessMode,
            mirrorX: this.effortlessMirrorX,
            mirrorZ: this.effortlessMirrorZ,
            radial: this.effortlessRadial,
            hollow: this.effortlessHollow,
            mirrorCenter: [...this.effortlessMirrorCenter] as [number, number, number],
            hasAnchor: this.effortlessAnchor !== null,
            anchorPos: this.effortlessAnchor ? ([...this.effortlessAnchor] as [number, number, number]) : null,
            previewCount: this.effortlessPreviewCount,
            undoCount: this.effortlessUndoStack.length,
          },
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

  private getNeighborRails(cx: number, cy: number, cz: number): [number, number, number][] {
    const out: [number, number, number][] = [];
    const dirs: [number, number][] = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    for (const [dx, dz] of dirs) {
      for (const dy of [0, 1, -1]) {
        const nx = cx + dx;
        const ny = cy + dy;
        const nz = cz + dz;
        if (ny < 1 || ny >= CHUNK_H - 1) continue;
        if (this.isRailBlock(this.getBlockAt(nx, ny, nz))) {
          out.push([nx, ny, nz]);
          break;
        }
      }
    }
    return out;
  }

  private chooseNextRailCell(
    currentCell: [number, number, number],
    prevCell: [number, number, number] | null,
    directionMode: MtrDirectionMode,
  ): [number, number, number] | null {
    const neighbors = this.getNeighborRails(currentCell[0], currentCell[1], currentCell[2]);
    if (neighbors.length === 0) return null;

    const nonPrev = prevCell
      ? neighbors.filter(
          (n) => n[0] !== prevCell[0] || n[1] !== prevCell[1] || n[2] !== prevCell[2],
        )
      : neighbors;
    const candidates = nonPrev.length > 0 ? nonPrev : neighbors;
    const nonDepot = candidates.filter(
      (n) => this.getBlockAt(n[0], n[1], n[2]) !== BlockId.RailDepot,
    );
    const pool = nonDepot.length > 0 ? nonDepot : candidates;

    if (pool.length === 1) return pool[0];

    if (prevCell) {
      const dirX = Math.sign(currentCell[0] - prevCell[0]);
      const dirZ = Math.sign(currentCell[2] - prevCell[2]);
      const straight = pool.find(
        (n) =>
          Math.sign(n[0] - currentCell[0]) === dirX &&
          Math.sign(n[2] - currentCell[2]) === dirZ,
      );
      if (straight) return straight;

      // Directional preference on junctions for One-Way CW vs One-Way CCW
      if (directionMode === 'one_way_cw' || directionMode === 'one_way_ccw') {
        const wantSign = directionMode === 'one_way_cw' ? 1 : -1;
        const preferred = pool.find((n) => {
          const cx = Math.sign(n[0] - currentCell[0]);
          const cz = Math.sign(n[2] - currentCell[2]);
          const cross = dirX * cz - dirZ * cx;
          return cross * wantSign > 0;
        });
        if (preferred) return preferred;
      }
      return pool[0];
    }

    // Starting at depot or junction without prevCell: break ties consistently by one_way_cw vs one_way_ccw
    if (directionMode === 'one_way_ccw') {
      return pool[pool.length - 1];
    }
    return pool[0];
  }

  private shouldPlayTrainDoorAudio(train: MtrActiveTrain): boolean {
    if (this.ridingDepotId === train.depotId) return true;
    for (const car of train.cars) {
      const dist = Math.hypot(
        car.group.position.x - this.playerPos.x,
        car.group.position.z - this.playerPos.z,
      );
      if (dist <= 32) return true;
    }
    return false;
  }

  private updateMtrTrains(dt: number) {
    if (this.mode === 'paused') return;

    for (const depot of this.mtrDepots) {
      let train = this.mtrTrains.get(depot.id);
      if (!train) {
        this.syncTrainForDepot(depot);
        train = this.mtrTrains.get(depot.id);
        if (!train) continue;
      }

      const directionMode: MtrDirectionMode = depot.directionMode ?? 'one_way_cw';

      if (!depot.dispatched) {
        this.stationPassTracker.delete(depot.id);
        train.currentCell = [...depot.depotPos] as [number, number, number];
        train.prevCell = null;
        train.nextCell = null;
        train.progress = 0;
        train.dwellTimer = 0;
        train.status = 'In Depot';
        train.currentSpeed = 0;
        train.doorTarget = train.manualDoorOverride ?? 1;
        train.doorPhase =
          train.doorTarget === 1
            ? train.doorProgress > 0.94
              ? 'open'
              : 'opening'
            : train.doorProgress < 0.04
              ? 'closed'
              : train.doorProgress > 0.78
                ? 'closing_warning'
                : 'closing';
        train.doorProgress = THREE.MathUtils.damp(train.doorProgress, train.doorTarget, 6.2, dt);
        applyTrainDoorAnimation(train, dt);

        const neighbors = this.getNeighborRails(
          depot.depotPos[0],
          depot.depotPos[1],
          depot.depotPos[2],
        );
        const firstNext = this.chooseNextRailCell(depot.depotPos, null, directionMode) ?? neighbors[0];
        const yaw = firstNext
          ? Math.atan2(firstNext[0] - depot.depotPos[0], firstNext[2] - depot.depotPos[2])
          : 0;
        train.yaw = yaw;
        train.worldPos.set(depot.depotPos[0] + 0.5, depot.depotPos[1] + 0.14, depot.depotPos[2] + 0.5);
        for (let i = 0; i < train.cars.length; i++) {
          const offset = i * MTR_CAR_SPACING;
          train.cars[i].group.position.set(
            train.worldPos.x - Math.sin(yaw) * offset,
            train.worldPos.y,
            train.worldPos.z - Math.cos(yaw) * offset,
          );
          train.cars[i].group.rotation.y = yaw;
        }
        continue;
      }

      // Verify current cell is still a rail
      const curBlock = this.getBlockAt(train.currentCell[0], train.currentCell[1], train.currentCell[2]);
      if (!this.isRailBlock(curBlock)) {
        const depotBlock = this.getBlockAt(depot.depotPos[0], depot.depotPos[1], depot.depotPos[2]);
        if (this.isRailBlock(depotBlock)) {
          train.currentCell = [...depot.depotPos] as [number, number, number];
          train.prevCell = null;
          train.nextCell = null;
          train.progress = 0;
        } else {
          train.status = 'No Track';
          train.currentSpeed = 0;
          train.doorTarget = train.manualDoorOverride ?? 1;
          train.doorPhase =
            train.doorTarget === 1
              ? train.doorProgress > 0.94
                ? 'open'
                : 'opening'
              : train.doorProgress < 0.04
                ? 'closed'
                : 'closing';
          train.doorProgress = THREE.MathUtils.damp(train.doorProgress, train.doorTarget, 6.2, dt);
          applyTrainDoorAnimation(train, dt);
          continue;
        }
      }

      // Synchronized station dwell & multi-phase bi-parting door animation cycle
      if (train.dwellTimer > 0) {
        train.dwellTimer = Math.max(0, train.dwellTimer - dt);
        train.status = 'At Station';
        train.currentSpeed = 0;

        if (train.manualDoorOverride !== null) {
          const wantOpen = train.manualDoorOverride === 1;
          train.doorTarget = wantOpen ? 1 : 0;
          train.doorPhase = wantOpen
            ? train.doorProgress > 0.94
              ? 'open'
              : 'opening'
            : train.doorProgress < 0.04
              ? 'closed'
              : train.doorProgress > 0.78
                ? 'closing_warning'
                : 'closing';
          train.doorProgress = THREE.MathUtils.damp(
            train.doorProgress,
            train.doorTarget,
            wantOpen ? 6.4 : 5.4,
            dt,
          );
        } else {
          const elapsed = Math.max(0, train.dwellTotal - train.dwellTimer);
          if (elapsed < 0.14) {
            // Brief train suspension settle before unsealing doors
            train.doorTarget = 0;
            train.doorPhase = 'closed';
          } else if (train.dwellTimer > 1.45) {
            // Doors open & boarding window active
            train.doorTarget = 1;
            train.doorPhase = train.doorProgress > 0.94 ? 'open' : 'opening';
            if (train.lastChimeState !== 'open') {
              train.lastChimeState = 'open';
              if (this.shouldPlayTrainDoorAudio(train)) {
                voxelAudio.playTrainDoorChime(true, depot.trainModelId);
              }
            }
            train.doorProgress = THREE.MathUtils.damp(train.doorProgress, 1, 6.2, dt);
          } else if (train.dwellTimer > 0.72) {
            // Door-closing safety warning: trigger agency chimes + screen shine pulse before doors slide shut
            train.doorTarget = 1;
            train.doorPhase = 'closing_warning';
            if (train.lastChimeState !== 'closing_warning') {
              train.lastChimeState = 'closing_warning';
              if (this.shouldPlayTrainDoorAudio(train)) {
                voxelAudio.playTrainDoorChime(false, depot.trainModelId);
              }
            }
            train.doorProgress = THREE.MathUtils.damp(train.doorProgress, 1, 8.0, dt);
          } else {
            // Smooth powered door slide shut onto rubber center gasket
            train.doorTarget = 0;
            train.doorPhase = train.doorProgress < 0.03 ? 'closed' : 'closing';
            train.lastChimeState = 'closed';
            train.doorProgress = THREE.MathUtils.damp(train.doorProgress, 0, 5.6, dt);
          }
        }

        applyTrainDoorAnimation(train, dt);
        continue;
      }

      // Hold station brakes until doors are fully sealed before departing
      train.manualDoorOverride = null;
      train.doorTarget = 0;
      train.doorProgress = THREE.MathUtils.damp(train.doorProgress, 0, 6.4, dt);
      if (train.doorProgress > 0.015) {
        train.doorPhase = 'closing';
        applyTrainDoorAnimation(train, dt);
        train.status = 'At Station';
        train.currentSpeed = 0;
        continue;
      }
      train.doorProgress = 0;
      train.doorPhase = 'closed';
      train.lastChimeState = null;
      applyTrainDoorAnimation(train, dt);

      // Acquire next rail cell along connected path
      if (!train.nextCell) {
        const chosen = this.chooseNextRailCell(train.currentCell, train.prevCell, directionMode);
        if (!chosen) {
          train.status = 'No Track';
          train.currentSpeed = 0;
          continue;
        }
        train.nextCell = chosen;
      }

      // Smooth arrival deceleration into station platforms & smooth departure acceleration out of stations
      const cruiseSpeed = Math.max(2, Math.min(18, depot.cruiseSpeed));
      let targetSpeed = cruiseSpeed;
      if (curBlock === BlockId.RailStation) {
        targetSpeed = Math.max(3.4, cruiseSpeed * 0.45);
      } else if (train.nextCell) {
        const nextBlock = this.getBlockAt(train.nextCell[0], train.nextCell[1], train.nextCell[2]);
        const lookAheadCell = this.chooseNextRailCell(train.nextCell, train.currentCell, directionMode);
        const lookAheadBlock = lookAheadCell
          ? this.getBlockAt(lookAheadCell[0], lookAheadCell[1], lookAheadCell[2])
          : BlockId.Air;
        if (nextBlock === BlockId.RailStation || lookAheadBlock === BlockId.RailStation) {
          targetSpeed = Math.max(4.6, cruiseSpeed * 0.65);
        }
      }

      const accelLambda = targetSpeed < train.currentSpeed ? 5.2 : 3.6;
      train.currentSpeed = THREE.MathUtils.damp(train.currentSpeed, targetSpeed, accelLambda, dt);
      train.status = curBlock === BlockId.RailStation ? 'At Station' : 'Running';
      train.progress += train.currentSpeed * dt;

      while (train.progress >= 1.0 && train.nextCell) {
        train.progress -= 1.0;
        train.prevCell = train.currentCell;
        train.currentCell = train.nextCell;
        train.nextCell = null;

        const arrivedBlock = this.getBlockAt(
          train.currentCell[0],
          train.currentCell[1],
          train.currentCell[2],
        );
        const upcomingCell = this.chooseNextRailCell(train.currentCell, train.prevCell, directionMode);

        if (arrivedBlock === BlockId.RailStation) {
          const isTurnBackAtEnd =
            upcomingCell !== null &&
            train.prevCell !== null &&
            upcomingCell[0] === train.prevCell[0] &&
            upcomingCell[1] === train.prevCell[1] &&
            upcomingCell[2] === train.prevCell[2];
          const upcomingBlock = upcomingCell
            ? this.getBlockAt(upcomingCell[0], upcomingCell[1], upcomingCell[2])
            : BlockId.Air;
          const isLastStationBlock =
            !upcomingCell || isTurnBackAtEnd || upcomingBlock !== BlockId.RailStation;

          if (
            isLastStationBlock &&
            !this.stationPassTracker.has(depot.id) &&
            depot.stationDwellSeconds > 0
          ) {
            const cellKey = `${train.currentCell[0]},${train.currentCell[1]},${train.currentCell[2]}`;
            this.stationPassTracker.set(depot.id, cellKey);
            train.dwellTotal = Math.max(2.6, depot.stationDwellSeconds);
            train.dwellTimer = train.dwellTotal;
            train.progress = 0;
            train.status = 'At Station';
            train.currentSpeed = 0;
            train.nextCell = upcomingCell;
            train.doorTarget = 0;
            train.doorPhase = 'closed';
            train.lastChimeState = null;
            this.triggerArrivalAnnouncementForCell(train.currentCell, depot.id);
            break;
          }
        } else {
          this.stationPassTracker.delete(depot.id);
        }

        train.nextCell = upcomingCell;
      }

      // Compute smooth interpolated position & lookahead yaw so long curved turns glide seamlessly
      const a = train.currentCell;
      const b = train.nextCell ?? train.currentCell;
      const t = train.nextCell ? train.progress : 0;
      const lx = a[0] + 0.5 + (b[0] - a[0]) * t;
      const ly = a[1] + 0.14 + (b[1] - a[1]) * t;
      const lz = a[2] + 0.5 + (b[2] - a[2]) * t;

      let lookTarget = b;
      if (train.nextCell) {
        const ahead = this.chooseNextRailCell(train.nextCell, train.currentCell, directionMode);
        if (ahead) lookTarget = ahead;
      }
      if (lookTarget[0] !== a[0] || lookTarget[2] !== a[2]) {
        const targetYaw = Math.atan2(lookTarget[0] - a[0], lookTarget[2] - a[2]);
        let delta = targetYaw - train.yaw;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        train.yaw += delta * Math.min(1, dt * 8.5);
      }
      train.worldPos.set(lx, ly, lz);

      const lastTrail = train.trail[0];
      const moved = lastTrail
        ? Math.hypot(lx - lastTrail.x, ly - lastTrail.y, lz - lastTrail.z)
        : 99;
      if (moved >= 0.2) {
        train.trail.unshift({ x: lx, y: ly, z: lz, yaw: train.yaw });
        if (train.trail.length > 180) {
          train.trail.length = 180;
        }
      }

      // Position lead car & trailing articulated cars cleanly along breadcrumb trail
      for (let i = 0; i < train.cars.length; i++) {
        if (i === 0) {
          train.cars[0].group.position.set(lx, ly, lz);
          train.cars[0].group.rotation.y = train.yaw;
        } else {
          const targetDist = i * MTR_CAR_SPACING;
          let accum = 0;
          let placed = false;
          for (let k = 0; k < train.trail.length - 1; k++) {
            const p0 = train.trail[k];
            const p1 = train.trail[k + 1];
            const seg = Math.hypot(p1.x - p0.x, p1.y - p0.y, p1.z - p0.z);
            if (accum + seg >= targetDist && seg > 0.0001) {
              const frac = (targetDist - accum) / seg;
              train.cars[i].group.position.set(
                p0.x + (p1.x - p0.x) * frac,
                p0.y + (p1.y - p0.y) * frac,
                p0.z + (p1.z - p0.z) * frac,
              );
              train.cars[i].group.rotation.y = p0.yaw;
              placed = true;
              break;
            }
            accum += seg;
          }
          if (!placed) {
            train.cars[i].group.position.set(
              lx - Math.sin(train.yaw) * targetDist,
              ly,
              lz - Math.cos(train.yaw) * targetDist,
            );
            train.cars[i].group.rotation.y = train.yaw;
          }
        }
      }
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
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if (e.code === 'Escape') {
      this.onRequestPauseCallback?.();
      return;
    }

    if (e.code === 'KeyF') {
      e.preventDefault();
      this.boardOrExitNearestTrain();
      return;
    }

    if (e.code === 'KeyR' && this.ridingDepotId) {
      e.preventDefault();
      this.toggleSitInTrain();
      return;
    }

    if (e.code === 'KeyG' && (this.ridingDepotId || this.cachedNearbyTrain)) {
      e.preventDefault();
      this.toggleTrainDoors();
      return;
    }

    if ((e.code === 'AltLeft' || e.code === 'AltRight') && this.activeMods.has('effortless_building')) {
      e.preventDefault();
      this.cycleEffortlessMode();
      return;
    }

    if (e.code === 'KeyZ' && this.activeMods.has('effortless_building')) {
      e.preventDefault();
      this.undoEffortlessBuild();
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
    this.clearMobs();
    this.clearMtrTrains();
    this.particles.dispose();
    this.heldBlockGeo?.dispose();
    this.heldBlockMat?.dispose();
    this.skyDome.geometry.dispose();
    this.skyMaterial.dispose();
    this.sunDisc.geometry.dispose();
    (this.sunDisc.material as THREE.Material).dispose();
    this.moonDisc.geometry.dispose();
    (this.moonDisc.material as THREE.Material).dispose();
    this.trackPreviewMesh.geometry.dispose();
    (this.trackPreviewMesh.material as THREE.Material).dispose();
    this.effortlessPreviewMesh.geometry.dispose();
    (this.effortlessPreviewMesh.material as THREE.Material).dispose();
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
