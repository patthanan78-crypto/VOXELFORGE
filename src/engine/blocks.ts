import * as THREE from 'three';

export enum BlockId {
  Air = 0,
  Grass = 1,
  Dirt = 2,
  Stone = 3,
  Cobblestone = 4,
  OakLog = 5,
  OakLeaves = 6,
  OakPlanks = 7,
  Sand = 8,
  Water = 9,
  Glass = 10,
  Bedrock = 11,
  CoalOre = 12,
  IronOre = 13,
  GoldOre = 14,
  DiamondOre = 15,
  Bricks = 16,
  Glowstone = 17,
  CherryLeaves = 18,
  Deepslate = 19,
  CopperBlock = 20,
  Snow = 21,
  CraftingTable = 22,
}

export interface BlockMeta {
  id: BlockId;
  name: string;
  solid: boolean;
  transparent: boolean;
  opaque: boolean;
  breakColor: number;
  soundType: 'grass' | 'stone' | 'wood' | 'sand' | 'glass';
  // Atlas tile indices [top, side, bottom]
  tiles: [number, number, number];
}

export const BLOCK_META: Record<BlockId, BlockMeta> = {
  [BlockId.Air]: {
    id: BlockId.Air,
    name: 'Air',
    solid: false,
    transparent: true,
    opaque: false,
    breakColor: 0xffffff,
    soundType: 'grass',
    tiles: [0, 0, 0],
  },
  [BlockId.Grass]: {
    id: BlockId.Grass,
    name: 'Grass Block',
    solid: true,
    transparent: false,
    opaque: true,
    breakColor: 0x62b046,
    soundType: 'grass',
    tiles: [0, 1, 2],
  },
  [BlockId.Dirt]: {
    id: BlockId.Dirt,
    name: 'Dirt',
    solid: true,
    transparent: false,
    opaque: true,
    breakColor: 0x866043,
    soundType: 'grass',
    tiles: [2, 2, 2],
  },
  [BlockId.Stone]: {
    id: BlockId.Stone,
    name: 'Stone',
    solid: true,
    transparent: false,
    opaque: true,
    breakColor: 0x7d7d7d,
    soundType: 'stone',
    tiles: [3, 3, 3],
  },
  [BlockId.Cobblestone]: {
    id: BlockId.Cobblestone,
    name: 'Cobblestone',
    solid: true,
    transparent: false,
    opaque: true,
    breakColor: 0x6f6f6f,
    soundType: 'stone',
    tiles: [4, 4, 4],
  },
  [BlockId.OakLog]: {
    id: BlockId.OakLog,
    name: 'Oak Log',
    solid: true,
    transparent: false,
    opaque: true,
    breakColor: 0x6d5232,
    soundType: 'wood',
    tiles: [6, 5, 6],
  },
  [BlockId.OakLeaves]: {
    id: BlockId.OakLeaves,
    name: 'Oak Leaves',
    solid: true,
    transparent: false,
    opaque: true,
    breakColor: 0x4b8f33,
    soundType: 'grass',
    tiles: [7, 7, 7],
  },
  [BlockId.OakPlanks]: {
    id: BlockId.OakPlanks,
    name: 'Oak Planks',
    solid: true,
    transparent: false,
    opaque: true,
    breakColor: 0xb18c58,
    soundType: 'wood',
    tiles: [8, 8, 8],
  },
  [BlockId.Sand]: {
    id: BlockId.Sand,
    name: 'Sand',
    solid: true,
    transparent: false,
    opaque: true,
    breakColor: 0xd9cf9c,
    soundType: 'sand',
    tiles: [9, 9, 9],
  },
  [BlockId.Water]: {
    id: BlockId.Water,
    name: 'Water',
    solid: false,
    transparent: true,
    opaque: false,
    breakColor: 0x2b8cd6,
    soundType: 'sand',
    tiles: [10, 10, 10],
  },
  [BlockId.Glass]: {
    id: BlockId.Glass,
    name: 'Glass',
    solid: true,
    transparent: true,
    opaque: false,
    breakColor: 0xc8f0ff,
    soundType: 'glass',
    tiles: [11, 11, 11],
  },
  [BlockId.Bedrock]: {
    id: BlockId.Bedrock,
    name: 'Bedrock',
    solid: true,
    transparent: false,
    opaque: true,
    breakColor: 0x333333,
    soundType: 'stone',
    tiles: [12, 12, 12],
  },
  [BlockId.CoalOre]: {
    id: BlockId.CoalOre,
    name: 'Coal Ore',
    solid: true,
    transparent: false,
    opaque: true,
    breakColor: 0x404040,
    soundType: 'stone',
    tiles: [13, 13, 13],
  },
  [BlockId.IronOre]: {
    id: BlockId.IronOre,
    name: 'Iron Ore',
    solid: true,
    transparent: false,
    opaque: true,
    breakColor: 0xc2a086,
    soundType: 'stone',
    tiles: [14, 14, 14],
  },
  [BlockId.GoldOre]: {
    id: BlockId.GoldOre,
    name: 'Gold Ore',
    solid: true,
    transparent: false,
    opaque: true,
    breakColor: 0xf4cc3c,
    soundType: 'stone',
    tiles: [15, 15, 15],
  },
  [BlockId.DiamondOre]: {
    id: BlockId.DiamondOre,
    name: 'Diamond Ore',
    solid: true,
    transparent: false,
    opaque: true,
    breakColor: 0x5be3e8,
    soundType: 'stone',
    tiles: [16, 16, 16],
  },
  [BlockId.Bricks]: {
    id: BlockId.Bricks,
    name: 'Bricks',
    solid: true,
    transparent: false,
    opaque: true,
    breakColor: 0x9b4b3c,
    soundType: 'stone',
    tiles: [17, 17, 17],
  },
  [BlockId.Glowstone]: {
    id: BlockId.Glowstone,
    name: 'Glowstone',
    solid: true,
    transparent: false,
    opaque: true,
    breakColor: 0xf9d876,
    soundType: 'glass',
    tiles: [18, 18, 18],
  },
  [BlockId.CherryLeaves]: {
    id: BlockId.CherryLeaves,
    name: 'Cherry Blossom Leaves',
    solid: true,
    transparent: false,
    opaque: true,
    breakColor: 0xf6a9c6,
    soundType: 'grass',
    tiles: [19, 19, 19],
  },
  [BlockId.Deepslate]: {
    id: BlockId.Deepslate,
    name: 'Deepslate',
    solid: true,
    transparent: false,
    opaque: true,
    breakColor: 0x45474f,
    soundType: 'stone',
    tiles: [20, 20, 20],
  },
  [BlockId.CopperBlock]: {
    id: BlockId.CopperBlock,
    name: 'Copper Block',
    solid: true,
    transparent: false,
    opaque: true,
    breakColor: 0xc26c4b,
    soundType: 'stone',
    tiles: [21, 21, 21],
  },
  [BlockId.Snow]: {
    id: BlockId.Snow,
    name: 'Snow Block',
    solid: true,
    transparent: false,
    opaque: true,
    breakColor: 0xf4f8fc,
    soundType: 'sand',
    tiles: [22, 22, 22],
  },
  [BlockId.CraftingTable]: {
    id: BlockId.CraftingTable,
    name: 'Crafting Table',
    solid: true,
    transparent: false,
    opaque: true,
    breakColor: 0xa67c4c,
    soundType: 'wood',
    tiles: [23, 24, 8],
  },
};

export const HOTBAR_BLOCKS: BlockId[] = [
  BlockId.Grass,
  BlockId.Cobblestone,
  BlockId.OakPlanks,
  BlockId.OakLog,
  BlockId.Bricks,
  BlockId.Glass,
  BlockId.Glowstone,
  BlockId.DiamondOre,
  BlockId.CraftingTable,
];

export const ALL_PLACEABLE_BLOCKS: BlockId[] = [
  BlockId.Grass,
  BlockId.Dirt,
  BlockId.Stone,
  BlockId.Cobblestone,
  BlockId.OakLog,
  BlockId.OakLeaves,
  BlockId.OakPlanks,
  BlockId.Sand,
  BlockId.Glass,
  BlockId.Bricks,
  BlockId.Glowstone,
  BlockId.CherryLeaves,
  BlockId.Deepslate,
  BlockId.CopperBlock,
  BlockId.Snow,
  BlockId.DiamondOre,
  BlockId.GoldOre,
  BlockId.CraftingTable,
];

// Atlas layout: 8x8 tiles (each tile is 16x16 px -> 128x128 canvas)
export const ATLAS_GRID = 8;
export const TILE_PX = 16;

function pseudoRand(x: number, y: number, seed: number): number {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041);
  n = (n ^ (n >> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return ((n ^ (n >> 16)) >>> 0) / 4294967295;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const n = parseInt(clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function shadeRgb(rgb: [number, number, number], delta: number): string {
  const r = Math.max(0, Math.min(255, Math.round(rgb[0] + delta)));
  const g = Math.max(0, Math.min(255, Math.round(rgb[1] + delta)));
  const b = Math.max(0, Math.min(255, Math.round(rgb[2] + delta)));
  return `rgb(${r},${g},${b})`;
}

export interface ProceduralAtlasResult {
  texture: THREE.CanvasTexture;
  tileIcons: Record<number, string>;
}

export function createProceduralAtlas(
  grassTintHex: string,
  waterColorHex: string,
  maxAnisotropy: number,
): ProceduralAtlasResult {
  const size = ATLAS_GRID * TILE_PX;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grassRgb = hexToRgb(grassTintHex);
  const waterRgb = hexToRgb(waterColorHex);

  const drawTile = (tileIndex: number, painter: (px: number, py: number) => string) => {
    const col = tileIndex % ATLAS_GRID;
    const row = Math.floor(tileIndex / ATLAS_GRID);
    const ox = col * TILE_PX;
    const oy = row * TILE_PX;
    for (let y = 0; y < TILE_PX; y++) {
      for (let x = 0; x < TILE_PX; x++) {
        ctx.fillStyle = painter(x, y);
        ctx.fillRect(ox + x, oy + y, 1, 1);
      }
    }
  };

  // 0: Grass Top
  drawTile(0, (x, y) => {
    const n = (pseudoRand(x, y, 1) - 0.5) * 32;
    return shadeRgb(grassRgb, n);
  });

  // 1: Grass Side
  drawTile(1, (x, y) => {
    const edge = 3 + Math.floor(pseudoRand(x, 0, 2) * 3);
    if (y < edge) {
      return shadeRgb(grassRgb, (pseudoRand(x, y, 3) - 0.5) * 26);
    }
    const dirt: [number, number, number] = [134, 96, 67];
    const pebble = pseudoRand(x, y, 4) > 0.88 ? -20 : (pseudoRand(x, y, 5) - 0.5) * 24;
    return shadeRgb(dirt, pebble);
  });

  // 2: Dirt
  drawTile(2, (x, y) => {
    const dirt: [number, number, number] = [134, 96, 67];
    const pebble = pseudoRand(x, y, 6) > 0.86 ? -22 : (pseudoRand(x, y, 7) - 0.5) * 24;
    return shadeRgb(dirt, pebble);
  });

  // 3: Stone
  drawTile(3, (x, y) => {
    const stone: [number, number, number] = [125, 125, 125];
    const streak = ((x + Math.floor(pseudoRand(0, y, 8) * 3)) % 5 === 0) ? -10 : 0;
    return shadeRgb(stone, streak + (pseudoRand(x, y, 9) - 0.5) * 24);
  });

  // 4: Cobblestone
  drawTile(4, (x, y) => {
    const stone: [number, number, number] = [115, 115, 115];
    const isMortar =
      y === 0 || y === 5 || y === 10 ||
      (x === 0 && y < 5) || (x === 8 && y < 5) ||
      (x === 4 && y >= 5 && y < 10) || (x === 12 && y >= 5 && y < 10) ||
      (x === 2 && y >= 10) || (x === 10 && y >= 10);
    if (isMortar) return shadeRgb(stone, -36);
    return shadeRgb(stone, (pseudoRand(x, y, 10) - 0.45) * 28);
  });

  // 5: Oak Log Side
  drawTile(5, (x, y) => {
    const bark: [number, number, number] = [104, 79, 49];
    const groove = x % 4 === 0 ? -18 : x % 4 === 2 ? 10 : 0;
    return shadeRgb(bark, groove + (pseudoRand(x, y, 11) - 0.5) * 18);
  });

  // 6: Oak Log Top
  drawTile(6, (x, y) => {
    const dx = Math.abs(x - 7.5);
    const dy = Math.abs(y - 7.5);
    const d = Math.max(dx, dy);
    if (d > 6.5) return shadeRgb([104, 79, 49], -8);
    const wood: [number, number, number] = [177, 140, 88];
    const ring = Math.floor(d) % 2 === 0 ? -12 : 8;
    return shadeRgb(wood, ring + (pseudoRand(x, y, 12) - 0.5) * 12);
  });

  // 7: Oak Leaves
  drawTile(7, (x, y) => {
    const leaf: [number, number, number] = [
      Math.max(40, grassRgb[0] - 25),
      Math.max(70, grassRgb[1] - 18),
      Math.max(30, grassRgb[2] - 20),
    ];
    const shadow = pseudoRand(x, y, 13) > 0.72 ? -35 : (pseudoRand(x, y, 14) - 0.5) * 26;
    return shadeRgb(leaf, shadow);
  });

  // 8: Oak Planks
  drawTile(8, (x, y) => {
    const plank: [number, number, number] = [179, 143, 92];
    if (y % 4 === 0) return shadeRgb(plank, -34);
    const joint = (Math.floor(y / 4) % 2 === 0 && x === 8) || (Math.floor(y / 4) % 2 === 1 && x === 3);
    if (joint) return shadeRgb(plank, -28);
    return shadeRgb(plank, (pseudoRand(x, y, 15) - 0.5) * 16);
  });

  // 9: Sand
  drawTile(9, (x, y) => {
    const sand: [number, number, number] = [219, 209, 158];
    return shadeRgb(sand, (pseudoRand(x, y, 16) - 0.5) * 20);
  });

  // 10: Water
  drawTile(10, (x, y) => {
    const wave = ((x + y) % 5 === 0) ? 16 : 0;
    return shadeRgb(waterRgb, wave + (pseudoRand(x, y, 17) - 0.5) * 12);
  });

  // 11: Glass
  drawTile(11, (x, y) => {
    if (x === 0 || y === 0 || x === 15 || y === 15) {
      return 'rgba(205, 238, 250, 0.95)';
    }
    if ((x + y === 6 || x + y === 7 || x + y === 22) && x > 2 && x < 13) {
      return 'rgba(240, 252, 255, 0.85)';
    }
    return 'rgba(175, 226, 245, 0.25)';
  });

  // 12: Bedrock
  drawTile(12, (x, y) => {
    const r = pseudoRand(x, y, 18);
    const c = r > 0.7 ? 36 : r < 0.25 ? 88 : 58;
    return `rgb(${c},${c},${c})`;
  });

  // Ore helper
  const drawOre = (tileIdx: number, oreRgb: [number, number, number], seed: number) => {
    drawTile(tileIdx, (x, y) => {
      const isCluster =
        ((x >= 3 && x <= 5 && y >= 3 && y <= 5) ||
          (x >= 10 && x <= 12 && y >= 5 && y <= 7) ||
          (x >= 5 && x <= 7 && y >= 10 && y <= 12) ||
          (x >= 11 && x <= 13 && y >= 11 && y <= 13)) &&
        pseudoRand(x, y, seed) > 0.32;
      if (isCluster) return shadeRgb(oreRgb, (pseudoRand(x, y, seed + 1) - 0.5) * 22);
      return shadeRgb([125, 125, 125], (pseudoRand(x, y, seed + 2) - 0.5) * 22);
    });
  };

  drawOre(13, [42, 42, 46], 20); // Coal
  drawOre(14, [216, 175, 147], 30); // Iron
  drawOre(15, [250, 214, 62], 40); // Gold
  drawOre(16, [84, 235, 240], 50); // Diamond

  // 17: Bricks
  drawTile(17, (x, y) => {
    const mortar = y % 4 === 0 || (Math.floor(y / 4) % 2 === 0 ? x % 8 === 0 : (x + 4) % 8 === 0);
    if (mortar) return 'rgb(198, 192, 182)';
    return shadeRgb([155, 76, 61], (pseudoRand(x, y, 60) - 0.5) * 24);
  });

  // 18: Glowstone
  drawTile(18, (x, y) => {
    const rim = x === 0 || y === 0 || x === 15 || y === 15;
    if (rim) return shadeRgb([180, 126, 52], 0);
    const bright = pseudoRand(x, y, 70) > 0.45 ? 20 : -15;
    return shadeRgb([249, 216, 118], bright);
  });

  // 19: Cherry Blossom Leaves
  drawTile(19, (x, y) => {
    const cherry: [number, number, number] = [245, 168, 200];
    const accent = pseudoRand(x, y, 80) > 0.78 ? 24 : pseudoRand(x, y, 81) < 0.25 ? -28 : 0;
    return shadeRgb(cherry, accent + (pseudoRand(x, y, 82) - 0.5) * 16);
  });

  // 20: Deepslate
  drawTile(20, (x, y) => {
    const ds: [number, number, number] = [68, 70, 79];
    const line = y % 3 === 0 && pseudoRand(x, y, 90) > 0.4 ? -12 : 0;
    return shadeRgb(ds, line + (pseudoRand(x, y, 91) - 0.5) * 18);
  });

  // 21: Copper Block
  drawTile(21, (x, y) => {
    const cop: [number, number, number] = [194, 108, 75];
    const border = x === 0 || y === 0 || x === 15 || y === 15 || x === 8 || y === 8;
    if (border) return shadeRgb(cop, -24);
    return shadeRgb(cop, (pseudoRand(x, y, 100) - 0.5) * 14);
  });

  // 22: Snow
  drawTile(22, (x, y) => {
    return shadeRgb([242, 248, 255], (pseudoRand(x, y, 110) - 0.5) * 10);
  });

  // 23: Crafting Table Top
  drawTile(23, (x, y) => {
    const wood: [number, number, number] = [166, 120, 68];
    if (x < 2 || x > 13 || y < 2 || y > 13) return shadeRgb(wood, -22);
    if ((x - 2) % 4 === 0 || (y - 2) % 4 === 0) return 'rgb(70, 48, 28)';
    return shadeRgb(wood, (pseudoRand(x, y, 120) - 0.5) * 14);
  });

  // 24: Crafting Table Side
  drawTile(24, (x, y) => {
    const wood: [number, number, number] = [158, 115, 66];
    if (y < 3) return shadeRgb(wood, -24);
    if (x >= 4 && x <= 11 && y >= 5 && y <= 11) {
      if (x === 4 || x === 11 || y === 5) return 'rgb(88, 92, 98)';
      return shadeRgb(wood, -14);
    }
    return shadeRgb(wood, (pseudoRand(x, y, 125) - 0.5) * 14);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.anisotropy = Math.min(4, maxAnisotropy);
  texture.needsUpdate = true;

  // Generate crisp 32x32 UI data URLs for each block's primary preview tile
  const tileIcons: Record<number, string> = {};
  const iconCanvas = document.createElement('canvas');
  iconCanvas.width = 32;
  iconCanvas.height = 32;
  const ictx = iconCanvas.getContext('2d')!;
  ictx.imageSmoothingEnabled = false;

  for (const id of ALL_PLACEABLE_BLOCKS) {
    const meta = BLOCK_META[id];
    const tileIdx = id === BlockId.Grass ? meta.tiles[1] : meta.tiles[0];
    const col = tileIdx % ATLAS_GRID;
    const row = Math.floor(tileIdx / ATLAS_GRID);
    ictx.clearRect(0, 0, 32, 32);
    ictx.drawImage(
      canvas,
      col * TILE_PX,
      row * TILE_PX,
      TILE_PX,
      TILE_PX,
      0,
      0,
      32,
      32,
    );
    tileIcons[id] = iconCanvas.toDataURL('image/png');
  }

  return { texture, tileIcons };
}
