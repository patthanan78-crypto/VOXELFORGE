import * as THREE from 'three';
import { getMtrTrainSpec, MtrTrainModelId, MtrTrainSpec } from '../data/mtrTransit';

export const MTR_CAR_LENGTH = 4.24;
export const MTR_CAR_SPACING = 4.38;
export const MTR_FLOOR_Y = 0.39;

export interface MtrSeatSlot {
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export const MTR_CAR_SEAT_SLOTS: MtrSeatSlot[] = [
  { x: -0.60, y: 0.66, z: -0.22, yaw: Math.PI / 2 },
  { x: -0.60, y: 0.66, z: 0.22, yaw: Math.PI / 2 },
  { x: 0.60, y: 0.66, z: -0.22, yaw: -Math.PI / 2 },
  { x: 0.60, y: 0.66, z: 0.22, yaw: -Math.PI / 2 },
  { x: -0.60, y: 0.66, z: -1.66, yaw: Math.PI / 2 },
  { x: 0.60, y: 0.66, z: -1.66, yaw: -Math.PI / 2 },
];

export interface MtrDoorLeafRef {
  group: THREE.Group;
  baseZ: number;
  slideDir: -1 | 1;
}

export type MtrDoorPhase = 'closed' | 'opening' | 'open' | 'closing_warning' | 'closing';

export interface MtrTrainCarMesh {
  group: THREE.Group;
  isLeadCab: boolean;
  isTailCab: boolean;
  doorLeaves: MtrDoorLeafRef[];
  doorLampMat: THREE.MeshBasicMaterial;
  shineTex: THREE.CanvasTexture;
  shineMat: THREE.MeshBasicMaterial;
  seatOccupants: (number | null)[];
  textures: THREE.Texture[];
}

export interface MtrActiveTrain {
  depotId: string;
  spec: MtrTrainSpec;
  cars: MtrTrainCarMesh[];
  currentCell: [number, number, number];
  prevCell: [number, number, number] | null;
  nextCell: [number, number, number] | null;
  progress: number;
  dwellTimer: number;
  dwellTotal: number;
  doorProgress: number;
  doorTarget: number;
  doorPhase: MtrDoorPhase;
  manualDoorOverride: number | null;
  lastChimeState: 'open' | 'closing_warning' | 'closed' | null;
  shinePhase: number;
  status: 'In Depot' | 'Running' | 'At Station' | 'No Track';
  trail: { x: number; y: number; z: number; yaw: number }[];
  worldPos: THREE.Vector3;
  yaw: number;
  currentSpeed: number;
}

function createDestinationTexture(spec: MtrTrainSpec, bannerText: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#090d14';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = spec.accentHex;
    ctx.fillRect(4, 6, 12, 52);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 20px monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText(spec.lineLabel.slice(0, 18), 24, 23);
    ctx.fillStyle = '#fbbf24';
    ctx.font = '15px monospace';
    ctx.fillText(bannerText, 24, 46);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createScreenShineTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 256, 64);
    // Diagonal glossy screen gleam centered in texture so UV offset sweeps cleanly within bezel
    const grad = ctx.createLinearGradient(74, 0, 182, 64);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 0.0)');
    grad.addColorStop(0.28, 'rgba(224, 242, 254, 0.22)');
    grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.92)');
    grad.addColorStop(0.72, 'rgba(224, 242, 254, 0.22)');
    grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 64);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

function getSeatColorForModel(spec: MtrTrainSpec): string {
  switch (spec.id) {
    case 'bangkok_mrt_blue':
      return '#1e40af';
    case 'hk_mtr_m_train':
      return '#94a3b8';
    case 'hk_mtr_airport':
      return '#0f766e';
    case 'nyc_subway_r160':
      return '#1d4ed8';
    case 'nyc_subway_r211':
      return '#2563eb';
    default:
      return '#1d4ed8';
  }
}

function createTrainCar(
  spec: MtrTrainSpec,
  isLeadCab: boolean,
  isTailCab: boolean,
): MtrTrainCarMesh {
  const car = new THREE.Group();
  const textures: THREE.Texture[] = [];
  const doorLeaves: MtrDoorLeafRef[] = [];

  const bodyMat = new THREE.MeshStandardMaterial({
    color: spec.bodyHex,
    roughness: 0.42,
    metalness: 0.25,
  });
  const interiorWallMat = new THREE.MeshStandardMaterial({
    color: '#e2e8f0',
    roughness: 0.72,
    metalness: 0.05,
  });
  const floorMat = new THREE.MeshStandardMaterial({
    color: '#283240',
    roughness: 0.85,
    metalness: 0.08,
  });
  const tactileMat = new THREE.MeshStandardMaterial({
    color: '#eab308',
    roughness: 0.65,
    metalness: 0.05,
  });
  const stripeMat = new THREE.MeshStandardMaterial({
    color: spec.stripeHex,
    roughness: 0.48,
    metalness: 0.2,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: spec.accentHex,
    roughness: 0.45,
    metalness: 0.18,
  });
  const doorMat = new THREE.MeshStandardMaterial({
    color: spec.doorHex,
    roughness: 0.38,
    metalness: 0.35,
  });
  const gasketMat = new THREE.MeshStandardMaterial({
    color: '#111827',
    roughness: 0.82,
    metalness: 0.1,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color: spec.roofHex,
    roughness: 0.65,
    metalness: 0.15,
  });
  const ceilingLightMat = new THREE.MeshStandardMaterial({
    color: '#f8fafc',
    emissive: '#fef9c3',
    emissiveIntensity: 0.85,
    roughness: 0.2,
    metalness: 0.0,
  });
  const cabMat = new THREE.MeshStandardMaterial({
    color: spec.cabHex,
    roughness: 0.45,
    metalness: 0.2,
  });
  const seatMat = new THREE.MeshStandardMaterial({
    color: getSeatColorForModel(spec),
    roughness: 0.76,
    metalness: 0.08,
  });
  const steelMat = new THREE.MeshStandardMaterial({
    color: '#cbd5e1',
    roughness: 0.22,
    metalness: 0.88,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: '#bae6fd',
    roughness: 0.08,
    metalness: 0.15,
    transparent: true,
    opacity: 0.26,
    depthWrite: false,
  });
  const bogieMat = new THREE.MeshStandardMaterial({
    color: '#1e293b',
    roughness: 0.78,
    metalness: 0.45,
  });
  const doorLampMat = new THREE.MeshBasicMaterial({
    color: '#ef4444',
  });
  const shineTex = createScreenShineTexture();
  textures.push(shineTex);
  const shineMat = new THREE.MeshBasicMaterial({
    map: shineTex,
    color: '#bae6fd',
    transparent: true,
    opacity: 0.42,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  // 1. Undercarriage & Bogies (bottom at y = 0, sitting on 0.14 rail head)
  const underframe = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.14, 4.14), bogieMat);
  underframe.position.set(0, 0.24, 0);
  car.add(underframe);

  for (const bz of [-1.28, 1.28]) {
    const bogie = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.16, 0.78), bogieMat);
    bogie.position.set(0, 0.08, bz);
    car.add(bogie);
    for (const wx of [-0.46, 0.46]) {
      for (const wz of [-0.24, 0.24]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.08, 12), steelMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(wx, 0.1, bz + wz);
        car.add(wheel);
      }
    }
  }

  // 2. Walkable Hollow Floor Deck (top surface at y = 0.39)
  const floorDeck = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.08, 4.24), floorMat);
  floorDeck.position.set(0, 0.35, 0);
  floorDeck.receiveShadow = true;
  car.add(floorDeck);

  // Subtle center aisle runner + tactile yellow doorway threshold strips
  const aisleStrip = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.008, 4.02), gasketMat);
  aisleStrip.position.set(0, 0.394, 0);
  car.add(aisleStrip);

  for (const sx of [-0.84, 0.84]) {
    for (const dz of [-0.94, 0.94]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.01, 0.88), tactileMat);
      strip.position.set(sx, 0.395, dz);
      car.add(strip);
    }
  }

  // 3. Hollow Ceiling Roof + Emissive LED Light Strips + HVAC Units
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.1, 4.24), roofMat);
  roof.position.set(0, 2.45, 0);
  roof.castShadow = true;
  car.add(roof);

  const innerCeiling = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.02, 4.14), interiorWallMat);
  innerCeiling.position.set(0, 2.39, 0);
  car.add(innerCeiling);

  for (const lx of [-0.44, 0.44]) {
    const lightStrip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 3.68), ceilingLightMat);
    lightStrip.position.set(lx, 2.378, 0);
    car.add(lightStrip);
  }

  for (const hz of [-1.08, 1.08]) {
    const hvac = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.15, 0.94), roofMat);
    hvac.position.set(0, 2.57, hz);
    car.add(hvac);
  }

  // 4. Hollow Sidewalls with Real Window Cutouts & Open Doorway Bays
  // Doorways: [-1.40 .. -0.48] and [+0.48 .. +1.40]
  // Wall sections: rear [-2.12 .. -1.40], mid [-0.48 .. +0.48], front [+1.40 .. +2.12]
  const wallBays: { zCenter: number; length: number }[] = [
    { zCenter: -1.76, length: 0.72 },
    { zCenter: 0, length: 0.96 },
    { zCenter: 1.76, length: 0.72 },
  ];

  for (const side of [-1, 1] as const) {
    const wallX = side * 0.9;
    const extStripeX = side * 0.916;
    const extAccentX = side * 0.92;
    const intWallX = side * 0.878;

    // Continuous Upper Fascia above windows & doorways (y = 2.04 .. 2.40)
    const upperHeader = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.36, 4.24), bodyMat);
    upperHeader.position.set(wallX, 2.22, 0);
    upperHeader.castShadow = true;
    car.add(upperHeader);

    const upperTrimInt = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.34, 4.2), interiorWallMat);
    upperTrimInt.position.set(intWallX, 2.22, 0);
    car.add(upperTrimInt);

    // Door Status Indicator LED Lamps above both doorways
    for (const dz of [-0.94, 0.94]) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.08, 0.18), doorLampMat);
      lamp.position.set(side * 0.948, 2.15, dz);
      car.add(lamp);
    }

    // Window Wall Bays (with clear open window cutouts + transparent glass)
    for (const bay of wallBays) {
      // Lower wainscot wall (y = 0.39 .. 1.14)
      const lowerWall = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.75, bay.length), bodyMat);
      lowerWall.position.set(wallX, 0.765, bay.zCenter);
      lowerWall.castShadow = true;
      car.add(lowerWall);

      const lowerInt = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.72, bay.length - 0.02), interiorWallMat);
      lowerInt.position.set(intWallX, 0.765, bay.zCenter);
      car.add(lowerInt);

      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, bay.length + 0.005), stripeMat);
      stripe.position.set(extStripeX, 0.62, bay.zCenter);
      car.add(stripe);

      const accent = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, bay.length + 0.006), accentMat);
      accent.position.set(extAccentX, 0.84, bay.zCenter);
      car.add(accent);

      // Transparent Window Pane (y = 1.14 .. 2.04)
      const winWidth = bay.length - 0.14;
      const winPane = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.9, winWidth), glassMat);
      winPane.position.set(wallX, 1.59, bay.zCenter);
      winPane.renderOrder = 2;
      car.add(winPane);
    }

    // Structural Window Pillars framing doorways cleanly
    for (const pz of [-2.07, -1.43, -0.45, 0.45, 1.43, 2.07]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.92, 0.08), bodyMat);
      pillar.position.set(wallX, 1.59, pz);
      pillar.castShadow = true;
      car.add(pillar);
    }

    // 5. Bi-Parting Animated Sliding Doors (4 leaves per side, 8 per car)
    const doorPlaneX = side * 0.935;
    for (const dz of [-0.94, 0.94]) {
      for (const slideDir of [-1, 1] as const) {
        const leafGroup = new THREE.Group();
        const baseZ = dz + slideDir * 0.23;
        leafGroup.position.set(doorPlaneX, 0, baseZ);

        // Lower solid door panel
        const lowerLeaf = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.76, 0.45), doorMat);
        lowerLeaf.position.set(0, 0.77, 0);
        lowerLeaf.castShadow = true;

        // Upper door header
        const topLeaf = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.14, 0.45), doorMat);
        topLeaf.position.set(0, 1.97, 0);

        // Side stiles of door window
        const outerStile = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.76, 0.09), doorMat);
        outerStile.position.set(0, 1.52, slideDir * 0.18);

        const innerStile = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.76, 0.07), doorMat);
        innerStile.position.set(0, 1.52, -slideDir * 0.19);

        // Center rubber safety gasket where leaves meet
        const gasket = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.64, 0.03), gasketMat);
        gasket.position.set(0, 1.21, -slideDir * 0.22);

        // Clear Door Window
        const doorGlass = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.75, 0.26), glassMat);
        doorGlass.position.set(0, 1.52, 0);
        doorGlass.renderOrder = 2;

        leafGroup.add(lowerLeaf, topLeaf, outerStile, innerStile, gasket, doorGlass);
        car.add(leafGroup);
        doorLeaves.push({ group: leafGroup, baseZ, slideDir });
      }
    }

    // 6. Longitudinal Interior Bench Seats (Mid Bay & Rear End Bay)
    const benchConfigs = [
      { z: 0, length: 0.86 },
      { z: -1.66, length: 0.46 },
    ];
    for (const bench of benchConfigs) {
      const seatBase = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, bench.length), bogieMat);
      seatBase.position.set(side * 0.65, 0.5, bench.z);
      car.add(seatBase);

      const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.08, bench.length), seatMat);
      cushion.position.set(side * 0.63, 0.64, bench.z);
      car.add(cushion);

      const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.46, bench.length), seatMat);
      backrest.position.set(side * 0.82, 0.89, bench.z);
      car.add(backrest);
    }

    // Also add front-bay bench on non-lead cars (since lead car has Driver Cab Desk there)
    if (!isLeadCab) {
      const seatBase = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.46), bogieMat);
      seatBase.position.set(side * 0.65, 0.5, 1.66);
      car.add(seatBase);

      const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.08, 0.46), seatMat);
      cushion.position.set(side * 0.63, 0.64, 1.66);
      car.add(cushion);

      const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.46, 0.46), seatMat);
      backrest.position.set(side * 0.82, 0.89, 1.66);
      car.add(backrest);
    }

    // Overhead Stainless Handrail Bar & Hanging Hand Straps
    const overheadRail = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 3.65, 8), steelMat);
    overheadRail.rotation.x = Math.PI / 2;
    overheadRail.position.set(side * 0.42, 2.08, 0);
    car.add(overheadRail);

    for (const sz of [-1.2, -0.4, 0, 0.4, 1.2]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.18, 0.06), gasketMat);
      strap.position.set(side * 0.42, 1.97, sz);
      car.add(strap);
    }
  }

  // 7. Vertical Stainless Steel Stanchion Grab Poles near Doorways
  for (const px of [-0.42, 0.42]) {
    for (const pz of [-0.48, 0.48]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 2.0, 8), steelMat);
      pole.position.set(px, 1.39, pz);
      car.add(pole);
    }
  }

  // 8. Interior Electronic LED Route Map / PID Banner + Double-Sided Shine Overlays
  const pidTex = createDestinationTexture(spec, 'RUST MTR v2 · DOORS AUTO');
  textures.push(pidTex);
  const pidMat = new THREE.MeshBasicMaterial({ map: pidTex });
  const pidBoard = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.22, 0.04), pidMat);
  pidBoard.position.set(0, 2.18, 0);
  car.add(pidBoard);

  for (const pidSide of [-1, 1] as const) {
    const pidShine = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.22), shineMat);
    pidShine.position.set(0, 2.18, pidSide * 0.024);
    if (pidSide < 0) pidShine.rotation.y = Math.PI;
    pidShine.renderOrder = 3;
    car.add(pidShine);
  }

  // Exterior Side LED Destination & Door-Chime Displays (above center windows on both sides)
  const sideLedTex = createDestinationTexture(spec, spec.lineLabel.slice(0, 16).toUpperCase());
  textures.push(sideLedTex);
  const sideLedMat = new THREE.MeshBasicMaterial({ map: sideLedTex });
  for (const side of [-1, 1] as const) {
    const sideLed = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.16), sideLedMat);
    sideLed.position.set(side * 0.946, 2.2, 0);
    sideLed.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    car.add(sideLed);

    const sideLedShine = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.16), shineMat);
    sideLedShine.position.set(side * 0.951, 2.2, 0);
    sideLedShine.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    sideLedShine.renderOrder = 3;
    car.add(sideLedShine);
  }

  // 9. Front End (+Z): Lead Cab w/ Open Walkthrough Control Desk OR Inter-Car Gangway
  if (isLeadCab) {
    // Lower cab nose
    const noseLower = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.78, 0.1), cabMat);
    noseLower.position.set(0, 0.78, 2.1);
    noseLower.castShadow = true;
    car.add(noseLower);

    // Upper cab brow
    const noseUpper = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.42, 0.1), cabMat);
    noseUpper.position.set(0, 2.21, 2.1);
    car.add(noseUpper);

    // Left/Right windshield pillars
    for (const cx of [-0.84, 0.84]) {
      const cp = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.84, 0.1), cabMat);
      cp.position.set(cx, 1.58, 2.1);
      car.add(cp);
    }

    // Clear panoramic front windshield
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.84, 0.03), glassMat);
    windshield.position.set(0, 1.58, 2.1);
    windshield.renderOrder = 2;
    car.add(windshield);

    // Exterior front route LED headsign + shine overlay
    const frontSignTex = createDestinationTexture(spec, spec.city.toUpperCase());
    textures.push(frontSignTex);
    const frontSign = new THREE.Mesh(
      new THREE.BoxGeometry(0.96, 0.2, 0.04),
      new THREE.MeshBasicMaterial({ map: frontSignTex }),
    );
    frontSign.position.set(0, 2.18, 2.15);
    car.add(frontSign);

    const frontSignShine = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.2), shineMat);
    frontSignShine.position.set(0, 2.18, 2.174);
    frontSignShine.renderOrder = 3;
    car.add(frontSignShine);

    // Headlights
    const headlightMat = new THREE.MeshBasicMaterial({ color: '#fef08a' });
    for (const lx of [-0.56, 0.56]) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.04), headlightMat);
      lamp.position.set(lx, 0.72, 2.15);
      car.add(lamp);
    }

    // Interior Driver Control Console & Throttle Desk (z = +1.84)
    const consoleDesk = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.56, 0.34), bogieMat);
    consoleDesk.position.set(0, 0.67, 1.86);
    car.add(consoleDesk);

    const speedScreen = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.14, 0.04),
      new THREE.MeshBasicMaterial({ color: '#38bdf8' }),
    );
    speedScreen.position.set(-0.24, 0.98, 1.84);
    speedScreen.rotation.x = -0.35;
    car.add(speedScreen);

    const speedScreenShine = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.14), shineMat);
    speedScreenShine.position.set(0, 0, -0.023);
    speedScreenShine.rotation.y = Math.PI;
    speedScreenShine.renderOrder = 3;
    speedScreen.add(speedScreenShine);

    const throttleKnob = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.08), accentMat);
    throttleKnob.position.set(0.24, 1.0, 1.84);
    car.add(throttleKnob);
  } else {
    // Open Vestibule Gangway Arch (+Z end) for walking between coupled cars
    for (const gx of [-0.66, 0.66]) {
      const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.46, 2.0, 0.08), bodyMat);
      jamb.position.set(gx, 1.39, 2.1);
      car.add(jamb);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.36, 0.08), bodyMat);
    lintel.position.set(0, 2.22, 2.1);
    car.add(lintel);

    const bellows = new THREE.Mesh(new THREE.BoxGeometry(1.02, 1.66, 0.14), gasketMat);
    bellows.position.set(0, 1.24, 2.16);
    // Keep gangway center hollow: use thin frame beams instead of solid bellows
    bellows.visible = false;
  }

  // 10. Rear End (-Z): Tail Cab OR Inter-Car Gangway
  if (isTailCab) {
    const tailLower = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.78, 0.1), cabMat);
    tailLower.position.set(0, 0.78, -2.1);
    tailLower.castShadow = true;
    car.add(tailLower);

    const tailUpper = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.42, 0.1), cabMat);
    tailUpper.position.set(0, 2.21, -2.1);
    car.add(tailUpper);

    for (const cx of [-0.84, 0.84]) {
      const cp = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.84, 0.1), cabMat);
      cp.position.set(cx, 1.58, -2.1);
      car.add(cp);
    }

    const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.84, 0.03), glassMat);
    rearGlass.position.set(0, 1.58, -2.1);
    rearGlass.renderOrder = 2;
    car.add(rearGlass);

    const tailLampMat = new THREE.MeshBasicMaterial({ color: '#ef4444' });
    for (const lx of [-0.56, 0.56]) {
      const tailLamp = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.13, 0.04), tailLampMat);
      tailLamp.position.set(lx, 0.72, -2.15);
      car.add(tailLamp);
    }
  } else {
    for (const gx of [-0.66, 0.66]) {
      const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.46, 2.0, 0.08), bodyMat);
      jamb.position.set(gx, 1.39, -2.1);
      car.add(jamb);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.36, 0.08), bodyMat);
    lintel.position.set(0, 2.22, -2.1);
    car.add(lintel);
  }

  return {
    group: car,
    isLeadCab,
    isTailCab,
    doorLeaves,
    doorLampMat,
    shineTex,
    shineMat,
    seatOccupants: MTR_CAR_SEAT_SLOTS.map(() => null),
    textures,
  };
}

export function applyTrainDoorAnimation(train: MtrActiveTrain, dt = 0.016) {
  // Smooth S-curve cubic easing so bi-parting doors glide briskly mid-travel and cushion into rubber gaskets
  const p = THREE.MathUtils.clamp(train.doorProgress, 0, 1);
  const eased = p * p * (3 - 2 * p);
  const slideDist = 0.43 * eased;

  const isWarning = train.doorPhase === 'closing_warning';
  const isClosing = train.doorPhase === 'closing';
  const isOpening = train.doorPhase === 'opening' || train.doorPhase === 'open';
  const isHkMtr = train.spec.id === 'hk_mtr_m_train' || train.spec.id === 'hk_mtr_airport';
  const isBangkokMrt = train.spec.id === 'bangkok_mrt_blue';

  // Advance screen shine sweep phase (accelerates cleanly during closing chime warnings)
  const sweepSpeed = isWarning ? (isHkMtr ? 3.8 : 2.6) : isClosing ? 1.8 : 0.72;
  train.shinePhase = (train.shinePhase + Math.max(0, dt) * sweepSpeed) % 1;

  // Sweep highlight across screen bounds (-0.75 .. +0.75)
  const sweepOffset = -0.75 + train.shinePhase * 1.5;

  // Compute chime-synchronized pulse wave & screen sheen tint/opacity
  let pulseWave = 0;
  let shineHex = '#bae6fd';
  let shineOpacity = 0.34 + 0.16 * Math.sin(train.shinePhase * Math.PI);
  let lampHex = '#ef4444';

  if (isWarning) {
    const pulseHz = isHkMtr ? 11.5 : isBangkokMrt ? 6.8 : 4.2;
    pulseWave = 0.5 + 0.5 * Math.sin(train.shinePhase * Math.PI * 2 * (pulseHz / sweepSpeed));
    shineHex = pulseWave > 0.5 ? '#fde047' : '#fb923c';
    shineOpacity = 0.46 + 0.44 * pulseWave;
    lampHex = pulseWave > 0.45 ? '#facc15' : '#ef4444';
  } else if (isClosing) {
    shineHex = '#fb7185';
    shineOpacity = 0.38 + 0.25 * (1 - eased);
    lampHex = p > 0.18 ? '#f97316' : '#ef4444';
  } else if (isOpening) {
    shineHex = p > 0.85 ? '#6ee7b7' : '#7dd3fc';
    shineOpacity = 0.38 + 0.24 * Math.sin(train.shinePhase * Math.PI);
    lampHex = p > 0.55 ? '#22c55e' : '#facc15';
  }

  for (const car of train.cars) {
    car.doorLampMat.color.set(lampHex);
    car.shineTex.offset.x = sweepOffset;
    car.shineMat.color.set(shineHex);
    car.shineMat.opacity = shineOpacity;
    for (const leaf of car.doorLeaves) {
      leaf.group.position.z = leaf.baseZ + leaf.slideDir * slideDist;
    }
  }
}

export function disposeTrainConsist(train: MtrActiveTrain, scene: THREE.Scene) {
  for (const car of train.cars) {
    scene.remove(car.group);
    car.textures.forEach((t) => t.dispose());
    car.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
  }
}

export function createMtrTrainConsist(
  depotId: string,
  modelId: MtrTrainModelId,
  carCount: number,
  startCell: [number, number, number],
  scene: THREE.Scene,
): MtrActiveTrain {
  const spec = getMtrTrainSpec(modelId);
  const clampedCars = Math.max(1, Math.min(4, Math.round(carCount)));
  const cars: MtrTrainCarMesh[] = [];

  for (let i = 0; i < clampedCars; i++) {
    const isLeadCab = i === 0;
    const isTailCab = i === clampedCars - 1;
    const carMesh = createTrainCar(spec, isLeadCab, isTailCab);
    carMesh.group.position.set(startCell[0] + 0.5, startCell[1] + 0.14, startCell[2] + 0.5);
    scene.add(carMesh.group);
    cars.push(carMesh);
  }

  const train: MtrActiveTrain = {
    depotId,
    spec,
    cars,
    currentCell: [...startCell] as [number, number, number],
    prevCell: null,
    nextCell: null,
    progress: 0,
    dwellTimer: 0,
    dwellTotal: 3,
    doorProgress: 0,
    doorTarget: 0,
    doorPhase: 'closed',
    manualDoorOverride: null,
    lastChimeState: null,
    shinePhase: 0,
    status: 'In Depot',
    trail: [
      {
        x: startCell[0] + 0.5,
        y: startCell[1] + 0.14,
        z: startCell[2] + 0.5,
        yaw: 0,
      },
    ],
    worldPos: new THREE.Vector3(startCell[0] + 0.5, startCell[1] + 0.14, startCell[2] + 0.5),
    yaw: 0,
    currentSpeed: 0,
  };

  applyTrainDoorAnimation(train, 0);
  return train;
}
