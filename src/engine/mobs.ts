import * as THREE from 'three';

export type MobTransitState = 'roam' | 'wait_platform' | 'riding' | 'alighting';

export interface VoxelMob {
  id: number;
  group: THREE.Group;
  kind: 'explorer' | 'pig' | 'slime';
  legs: THREE.Mesh[];
  arms: THREE.Mesh[];
  head: THREE.Group;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  onGround: boolean;
  halfWidth: number;
  height: number;
  yaw: number;
  walkPhase: number;
  turnTimer: number;
  hopPhase: number;
  transitState: MobTransitState;
  ridingDepotId: string | null;
  ridingCarIndex: number;
  seatSlotIndex: number;
  boardedStationKey: string | null;
  transitCooldown: number;
  targetWaitPos: [number, number, number] | null;
}

let nextMobId = 1;

export function createVoxelSlimeMob(scaleFactor = 1.0): VoxelMob {
  const group = new THREE.Group();

  const outerMat = new THREE.MeshStandardMaterial({
    color: 0x6cd94e,
    transparent: true,
    opacity: 0.72,
    roughness: 0.35,
    metalness: 0.02,
    depthWrite: false,
  });
  const innerMat = new THREE.MeshStandardMaterial({
    color: 0x459e30,
    roughness: 0.65,
    metalness: 0.0,
  });
  const faceMat = new THREE.MeshStandardMaterial({
    color: 0x183814,
    roughness: 0.4,
    metalness: 0.0,
  });

  const s = 0.88 * scaleFactor;
  const outer = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), outerMat);
  outer.position.set(0, s * 0.5, 0);
  outer.renderOrder = 3;

  const inner = new THREE.Mesh(new THREE.BoxGeometry(s * 0.68, s * 0.68, s * 0.68), innerMat);
  inner.position.set(0, s * 0.5, 0);
  inner.castShadow = true;

  const head = new THREE.Group();
  head.position.set(0, s * 0.5, 0);

  const eyeSize = s * 0.14;
  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(eyeSize, eyeSize, 0.06), faceMat);
  eyeL.position.set(-s * 0.17, s * 0.1, s * 0.35);

  const eyeR = new THREE.Mesh(new THREE.BoxGeometry(eyeSize, eyeSize, 0.06), faceMat);
  eyeR.position.set(s * 0.17, s * 0.1, s * 0.35);

  const mouth = new THREE.Mesh(new THREE.BoxGeometry(s * 0.1, s * 0.09, 0.06), faceMat);
  mouth.position.set(s * 0.05, -s * 0.12, s * 0.35);

  head.add(eyeL, eyeR, mouth);
  group.add(inner, head, outer);

  return {
    id: nextMobId++,
    group,
    kind: 'slime',
    legs: [],
    arms: [],
    head,
    x: 0,
    y: 5,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    onGround: false,
    halfWidth: s * 0.48,
    height: s,
    yaw: 0,
    walkPhase: Math.random() * Math.PI * 2,
    turnTimer: 1.5 + Math.random() * 3,
    hopPhase: Math.random() * Math.PI * 2,
    transitState: 'roam',
    ridingDepotId: null,
    ridingCarIndex: 0,
    seatSlotIndex: -1,
    boardedStationKey: null,
    transitCooldown: 0,
    targetWaitPos: null,
  };
}

export function createVoxelExplorerMob(accentColor: number): VoxelMob {
  const group = new THREE.Group();

  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd9a77c, roughness: 0.78, metalness: 0.0 });
  const tunicMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.85, metalness: 0.05 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x324663, roughness: 0.88, metalness: 0.0 });
  const beltMat = new THREE.MeshStandardMaterial({ color: 0x4b3828, roughness: 0.45, metalness: 0.35 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.25, metalness: 0.1 });
  const visorMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.3, metalness: 0.75 });

  // Bottom-center pivot: legs occupy y = [0, 0.75], torso = [0.75, 1.5], head = [1.5, 2.0]
  const legGeo = new THREE.BoxGeometry(0.24, 0.75, 0.24);
  legGeo.translate(0, -0.375, 0);
  const leftLeg = new THREE.Mesh(legGeo, pantsMat);
  leftLeg.position.set(-0.14, 0.75, 0);
  leftLeg.castShadow = true;

  const rightLeg = new THREE.Mesh(legGeo, pantsMat);
  rightLeg.position.set(0.14, 0.75, 0);
  rightLeg.castShadow = true;

  // Torso (primary silhouette)
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.75, 0.28), tunicMat);
  torso.position.set(0, 1.125, 0);
  torso.castShadow = true;
  torso.receiveShadow = true;

  // Belt buckle accent
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.12, 0.3), beltMat);
  belt.position.set(0, 0.82, 0);

  // Arms
  const armGeo = new THREE.BoxGeometry(0.2, 0.7, 0.2);
  armGeo.translate(0, -0.35, 0);
  const leftArm = new THREE.Mesh(armGeo, tunicMat);
  leftArm.position.set(-0.37, 1.48, 0);
  leftArm.castShadow = true;

  const rightArm = new THREE.Mesh(armGeo, tunicMat);
  rightArm.position.set(0.37, 1.48, 0);
  rightArm.castShadow = true;

  // Head assembly (skull + eyes + metallic explorer visor)
  const head = new THREE.Group();
  head.position.set(0, 1.5, 0);

  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.48, 0.48), skinMat);
  skull.position.set(0, 0.24, 0);
  skull.castShadow = true;

  const leftEye = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.04), eyeMat);
  leftEye.position.set(-0.11, 0.26, 0.24);

  const rightEye = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.04), eyeMat);
  rightEye.position.set(0.11, 0.26, 0.24);

  const helmetTrim = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.12, 0.52), visorMat);
  helmetTrim.position.set(0, 0.44, 0);

  head.add(skull, leftEye, rightEye, helmetTrim);
  group.add(leftLeg, rightLeg, torso, belt, leftArm, rightArm, head);

  return {
    id: nextMobId++,
    group,
    kind: 'explorer',
    legs: [leftLeg, rightLeg],
    arms: [leftArm, rightArm],
    head,
    x: 0,
    y: 5,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    onGround: false,
    halfWidth: 0.28,
    height: 1.9,
    yaw: 0,
    walkPhase: Math.random() * Math.PI * 2,
    turnTimer: 2 + Math.random() * 4,
    hopPhase: 0,
    transitState: 'roam',
    ridingDepotId: null,
    ridingCarIndex: 0,
    seatSlotIndex: -1,
    boardedStationKey: null,
    transitCooldown: 2 + Math.random() * 4,
    targetWaitPos: null,
  };
}

export function createVoxelPigMob(): VoxelMob {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf1a7b5, roughness: 0.82, metalness: 0.0 });
  const snoutMat = new THREE.MeshStandardMaterial({ color: 0xe38498, roughness: 0.52, metalness: 0.08 });
  const hoofMat = new THREE.MeshStandardMaterial({ color: 0x5c474a, roughness: 0.48, metalness: 0.15 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.2, metalness: 0.1 });

  // Bottom-center pivot: legs y=[0, 0.38], body y=[0.38, 0.92]
  const legGeo = new THREE.BoxGeometry(0.2, 0.38, 0.2);
  legGeo.translate(0, -0.19, 0);

  const fl = new THREE.Mesh(legGeo, hoofMat);
  fl.position.set(-0.18, 0.38, 0.28);
  const fr = new THREE.Mesh(legGeo, hoofMat);
  fr.position.set(0.18, 0.38, 0.28);
  const bl = new THREE.Mesh(legGeo, hoofMat);
  bl.position.set(-0.18, 0.38, -0.28);
  const br = new THREE.Mesh(legGeo, hoofMat);
  br.position.set(0.18, 0.38, -0.28);

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.54, 0.9), bodyMat);
  body.position.set(0, 0.65, 0);
  body.castShadow = true;
  body.receiveShadow = true;

  const head = new THREE.Group();
  head.position.set(0, 0.72, 0.45);

  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.44, 0.44), bodyMat);
  skull.position.set(0, 0.06, 0.18);
  skull.castShadow = true;

  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.1), snoutMat);
  snout.position.set(0, 0.0, 0.43);

  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.04), eyeMat);
  eyeL.position.set(-0.13, 0.12, 0.4);
  const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.04), eyeMat);
  eyeR.position.set(0.13, 0.12, 0.4);

  head.add(skull, snout, eyeL, eyeR);
  group.add(fl, fr, bl, br, body, head);

  return {
    id: nextMobId++,
    group,
    kind: 'pig',
    legs: [fl, fr, bl, br],
    arms: [],
    head,
    x: 0,
    y: 5,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    onGround: false,
    halfWidth: 0.34,
    height: 0.95,
    yaw: 0,
    walkPhase: Math.random() * Math.PI * 2,
    turnTimer: 2 + Math.random() * 4,
    hopPhase: 0,
    transitState: 'roam',
    ridingDepotId: null,
    ridingCarIndex: 0,
    seatSlotIndex: -1,
    boardedStationKey: null,
    transitCooldown: 0,
    targetWaitPos: null,
  };
}

interface BurstParticle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  active: boolean;
}

export class PooledParticleSystem {
  private pool: BurstParticle[] = [];
  private group = new THREE.Group();

  constructor(scene: THREE.Scene, poolSize = 96) {
    const geo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
    for (let i = 0; i < poolSize; i++) {
      const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      this.group.add(mesh);
      this.pool.push({
        mesh,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 0.5,
        active: false,
      });
    }
    scene.add(this.group);
  }

  public spawnBurst(x: number, y: number, z: number, hexColor: number, count = 12) {
    let spawned = 0;
    for (let i = 0; i < this.pool.length && spawned < count; i++) {
      const p = this.pool[i];
      if (!p.active) {
        p.active = true;
        p.life = 0;
        p.maxLife = 0.35 + Math.random() * 0.25;
        p.mesh.visible = true;
        p.mesh.position.set(
          x + 0.2 + Math.random() * 0.6,
          y + 0.2 + Math.random() * 0.6,
          z + 0.2 + Math.random() * 0.6,
        );
        p.mesh.scale.setScalar(0.7 + Math.random() * 0.7);
        (p.mesh.material as THREE.MeshStandardMaterial).color.setHex(hexColor);
        p.vx = (Math.random() - 0.5) * 4.5;
        p.vy = 2.0 + Math.random() * 3.5;
        p.vz = (Math.random() - 0.5) * 4.5;
        spawned++;
      }
    }
  }

  public update(dt: number) {
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      p.vy -= 14 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.mesh.rotation.x += 5 * dt;
      p.mesh.rotation.y += 4 * dt;
      const scale = Math.max(0.01, 1 - p.life / p.maxLife);
      p.mesh.scale.setScalar(scale);
    }
  }

  public dispose() {
    this.pool.forEach((p) => {
      (p.mesh.material as THREE.Material).dispose();
    });
    if (this.pool.length > 0) {
      this.pool[0].mesh.geometry.dispose();
    }
  }
}
