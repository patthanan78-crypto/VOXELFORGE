export type PlatformTarget = 'windows' | 'android';
export type PerformancePreset = 'ultra_fps' | 'balanced' | 'vibrant';
export type GameMode = 'creative' | 'survival';

export type VersionEraId =
  | 'nextgen'
  | 'caves_trials'
  | 'aquatic_nether'
  | 'modern_classic'
  | 'golden_alpha';

export interface MinecraftVersion {
  id: string;
  name: string;
  era: VersionEraId;
  eraLabel: string;
  year: number;
  skyColor: string;
  fogColor: string;
  grassTint: string;
  waterColor: string;
  waterOpacity: number;
  terrainAmplitude: number;
  baseHeight: number;
  hasCherryTrees: boolean;
  hasDeepslate: boolean;
  hasCopper: boolean;
  classicAlphaShade: boolean;
  summary: string;
  isOfficialJava?: boolean;
  manifestUrl?: string;
  releaseType?: 'release' | 'snapshot' | 'old_beta' | 'old_alpha';
}

export const VERSION_ERAS: { id: 'all' | VersionEraId; label: string }[] = [
  { id: 'all', label: 'All (1.0 – 1.26.3)' },
  { id: 'nextgen', label: '1.22 – 1.26.3' },
  { id: 'caves_trials', label: '1.18 – 1.21.5' },
  { id: 'aquatic_nether', label: '1.13 – 1.17.1' },
  { id: 'modern_classic', label: '1.8 – 1.12.2' },
  { id: 'golden_alpha', label: '1.0 – 1.7.10' },
];

interface EraTemplate {
  era: VersionEraId;
  eraLabel: string;
  skyColor: string;
  fogColor: string;
  grassTint: string;
  waterColor: string;
  waterOpacity: number;
  terrainAmplitude: number;
  baseHeight: number;
  hasCherryTrees: boolean;
  hasDeepslate: boolean;
  hasCopper: boolean;
  classicAlphaShade: boolean;
}

const ERA_TEMPLATES: Record<VersionEraId, EraTemplate> = {
  nextgen: {
    era: 'nextgen',
    eraLabel: 'Next-Gen Era',
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
    eraLabel: 'Caves & Trials Era',
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
    eraLabel: 'Aquatic & Nether Era',
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
    eraLabel: 'Modern Classic Era',
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
    eraLabel: 'Classic Era',
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

function makeVer(
  id: string,
  title: string,
  era: VersionEraId,
  year: number,
  summary: string,
  overrides: Partial<MinecraftVersion> = {},
): MinecraftVersion {
  const tpl = ERA_TEMPLATES[era];
  return {
    id,
    name: `${id} — ${title}`,
    year,
    summary,
    ...tpl,
    ...overrides,
  };
}

export const MINECRAFT_VERSIONS: MinecraftVersion[] = [
  // Official Mojang Java Edition 26.x (2026)
  makeVer('26.3', 'Java Edition 26.3', 'nextgen', 2026, 'Latest official Minecraft: Java Edition 26.3 release with Java 25 runtime support.', {
    isOfficialJava: true,
    releaseType: 'release',
    manifestUrl: 'https://piston-meta.mojang.com/v1/packages/ead839cbccf0ddf013c3f935f2840080b5cb0d26/26.3.json',
  }),
  makeVer('26.2', 'Java Edition 26.2', 'nextgen', 2026, 'Official 2026 Minecraft: Java Edition 26.2 release for PC & mobile JVM.', {
    isOfficialJava: true,
    releaseType: 'release',
  }),
  makeVer('26.1', 'Java Edition 26.1', 'nextgen', 2026, 'Official 2026 Minecraft: Java Edition 26.1 release.', {
    isOfficialJava: true,
    releaseType: 'release',
  }),

  // 1.26.x
  makeVer('1.26.3', 'Vibrant Horizons', 'nextgen', 2026, 'Latest 1.26.3 release with peak chunk culling, vibrant foliage, and balanced mountain valleys.'),
  makeVer('1.26.2', 'Pale Canopy', 'nextgen', 2026, 'Performance-tuned 1.26.2 build with refined biome transitions and fast mesh batching.'),
  makeVer('1.26.1', 'Skyward Patch', 'nextgen', 2026, 'Low-latency terrain streaming update for Android touch and Windows desktop.'),
  makeVer('1.26.0', 'Alpine Overhaul', 'nextgen', 2026, 'Elevated ridgelines, deep strata deepslate, and cherry blossom groves.', { terrainAmplitude: 20, baseHeight: 23 }),

  // 1.25.x
  makeVer('1.25.2', 'Meadow Springs', 'nextgen', 2025, 'Rolling emerald meadows and crystal spring basins.', { grassTint: '#72c452' }),
  makeVer('1.25.1', 'Lush Foothills', 'nextgen', 2025, 'Balanced overworld slopes with optimized Android touch frame pacing.'),
  makeVer('1.25.0', 'Copper & Craft', 'nextgen', 2025, 'Expanded copper vein clusters and crisp lighting.'),

  // 1.24.x
  makeVer('1.24.2', 'Timberline', 'nextgen', 2025, 'Dense mixed oak and cherry forests along coastal cliffs.'),
  makeVer('1.24.1', 'Wildwood', 'nextgen', 2025, 'Smooth chunk streaming across elevated forested hills.'),
  makeVer('1.24.0', 'Frontier Skies', 'nextgen', 2025, 'Bright atmospheric horizons and fast terrain mesh updates.'),

  // 1.23.x
  makeVer('1.23.2', 'Pale Garden', 'nextgen', 2024, 'Cool misty atmosphere with high-contrast stone ridges.', { skyColor: '#7daec9', fogColor: '#a7c8db', grassTint: '#64a95a' }),
  makeVer('1.23.1', 'Mist & Moss', 'nextgen', 2024, 'Subtle fog gradients and crisp surface AO shading.', { skyColor: '#7eb2cc', fogColor: '#aac9dc' }),
  makeVer('1.23.0', 'Winter Drop', 'nextgen', 2024, 'Snow-capped peaks and brisk mountain valleys.'),

  // 1.22.x
  makeVer('1.22.3', 'Streamlined Chunks', 'nextgen', 2024, 'Refined greedy face culling for high mobile FPS.'),
  makeVer('1.22.2', 'Pathfinder', 'nextgen', 2024, 'Polished collision physics and smooth jump buffering.'),
  makeVer('1.22.1', 'Breeze Patch', 'nextgen', 2024, 'Responsive input handling for keyboard and touch.'),
  makeVer('1.22.0', 'Bundles & Stride', 'nextgen', 2024, 'Smooth movement polish and streamlined voxel terrain.'),

  // 1.21.x
  makeVer('1.21.5', 'Spring to Life', 'caves_trials', 2025, 'Lively overworld groves and balanced mountain curves.'),
  makeVer('1.21.4', 'Tricky Trials', 'caves_trials', 2024, 'Rich copper veins, deepslate caverns, and towering terrain peaks.'),
  makeVer('1.21.3', 'Trial Hotfix', 'caves_trials', 2024, 'Fast chunk updates and crisp block placement.'),
  makeVer('1.21.2', 'Bundles of Bravery', 'caves_trials', 2024, 'Streamlined inventory and solid exploration performance.'),
  makeVer('1.21.1', 'Trials Stability', 'caves_trials', 2024, 'Optimized surface meshing and fluid controls.'),
  makeVer('1.21.0', 'Trial Chambers', 'caves_trials', 2024, 'Copper-rich bedrock strata and refined combat responsiveness.'),

  // 1.20.x
  makeVer('1.20.6', 'Armored Paws', 'caves_trials', 2024, 'Vibrant trails, cherry groves, and high-visibility daylight.'),
  makeVer('1.20.4', 'Trails & Tales', 'caves_trials', 2023, 'Introduces vibrant Cherry Blossom groves across hillside plateaus.'),
  makeVer('1.20.2', 'Villager Trade', 'caves_trials', 2023, 'Lively roaming explorers across sunlit plains.'),
  makeVer('1.20.1', 'Modding Milestone', 'caves_trials', 2023, 'Classic 1.20 worldgen with cherry trees and deepslate.'),
  makeVer('1.20.0', 'Trails Release', 'caves_trials', 2023, 'Cherry blossom trees and refined bamboo-era colors.'),

  // 1.19.x
  makeVer('1.19.4', 'The Wild Update', 'caves_trials', 2022, 'Deep dark deepslate foundations and lush hillside forests.', { hasCherryTrees: false }),
  makeVer('1.19.3', 'Wild Refinement', 'caves_trials', 2022, 'Crisp terrain curves and deep stone strata.', { hasCherryTrees: false }),
  makeVer('1.19.2', 'Deep Dark Patch', 'caves_trials', 2022, 'Popular 1.19 multiplayer & sandbox baseline.', { hasCherryTrees: false }),
  makeVer('1.19.0', 'Wild Horizon', 'caves_trials', 2022, 'Expansive valleys with deepslate and copper.', { hasCherryTrees: false }),

  // 1.18.x
  makeVer('1.18.2', 'Caves & Cliffs II', 'caves_trials', 2022, 'Iconic sweeping mountain peaks, deep valleys, and dramatic cliff faces.', { hasCherryTrees: false, terrainAmplitude: 21, baseHeight: 23 }),
  makeVer('1.18.1', 'Mountain Fog', 'caves_trials', 2021, 'Tall snow-topped cliffs with gentle horizon haze.', { hasCherryTrees: false, terrainAmplitude: 21, baseHeight: 23 }),
  makeVer('1.18.0', 'Cliffs Overhaul', 'caves_trials', 2021, 'Amplified 3D noise terrain and tall ridgelines.', { hasCherryTrees: false, terrainAmplitude: 21, baseHeight: 23 }),

  // 1.17.x
  makeVer('1.17.1', 'Caves & Cliffs I', 'aquatic_nether', 2021, 'Adds copper ore, deepslate, and classic pre-1.18 terrain curves.', { hasDeepslate: true, hasCopper: true }),
  makeVer('1.17.0', 'Copper & Deepslate', 'aquatic_nether', 2021, 'First appearance of deepslate strata and copper blocks.', { hasDeepslate: true, hasCopper: true }),

  // 1.16.x
  makeVer('1.16.5', 'Nether Update', 'aquatic_nether', 2021, 'Beloved speedrunning & survival milestone with crisp classic hills.'),
  makeVer('1.16.4', 'Piglin Patch', 'aquatic_nether', 2020, 'Clean terrain generation and fast chunk meshing.'),
  makeVer('1.16.3', 'Nether Refinement', 'aquatic_nether', 2020, 'Classic 1.16 overworld generation.'),
  makeVer('1.16.1', 'Speedrun Classic', 'aquatic_nether', 2020, 'Iconic 2020 survival & speedrun release.'),
  makeVer('1.16.0', 'Nether Release', 'aquatic_nether', 2020, 'Mid-era terrain balance and bright blue lakes.'),

  // 1.15.x
  makeVer('1.15.2', 'Buzzy Bees', 'aquatic_nether', 2020, 'Blazingly fast rendering engine overhaul with sunny meadow valleys.'),
  makeVer('1.15.1', 'Beehive Fix', 'aquatic_nether', 2019, 'Smooth frame pacing and bright sunlit plains.'),
  makeVer('1.15.0', 'Bees & FPS', 'aquatic_nether', 2019, 'Rendering optimization milestone for smooth gameplay.'),

  // 1.14.x
  makeVer('1.14.4', 'Village & Pillage', 'aquatic_nether', 2019, 'Refined block textures and lively roaming villagers.'),
  makeVer('1.14.3', 'Village Update', 'aquatic_nether', 2019, 'Modernized pixel-art texture palette.'),
  makeVer('1.14.2', 'Outpost Patch', 'aquatic_nether', 2019, 'Balanced terrain and classic oak groves.'),
  makeVer('1.14.0', 'Pillage Release', 'aquatic_nether', 2019, 'Major texture refresh across stone, grass, and timber.'),

  // 1.13.x
  makeVer('1.13.2', 'Update Aquatic', 'aquatic_nether', 2018, 'Crystal clear turquoise oceans and shimmering water surfaces.', { waterOpacity: 0.65 }),
  makeVer('1.13.1', 'Coral Shores', 'aquatic_nether', 2018, 'Translucent blue water basins and sandy coastlines.', { waterOpacity: 0.65 }),
  makeVer('1.13.0', 'Aquatic Release', 'aquatic_nether', 2018, 'Vibrant turquoise water overhaul.', { waterOpacity: 0.65 }),

  // 1.12.x
  makeVer('1.12.2', 'World of Color', 'modern_classic', 2017, 'Golden modding standard with vivid blocks and classic deep-blue water.'),
  makeVer('1.12.1', 'Color Patch', 'modern_classic', 2017, 'Snappy classic chunk loading and bright oak forests.'),
  makeVer('1.12.0', 'Color Release', 'modern_classic', 2017, 'Vivid palette and fast classic rendering.'),

  // 1.11.x
  makeVer('1.11.2', 'Exploration Update', 'modern_classic', 2016, 'Balanced survival worldgen and crisp classic lighting.'),
  makeVer('1.11.0', 'Mansion Release', 'modern_classic', 2016, 'Classic woodland generation and royal blue water.'),

  // 1.10.x
  makeVer('1.10.2', 'Frostburn Update', 'modern_classic', 2016, 'Crisp high-altitude snow caps and classic plains.'),
  makeVer('1.10.0', 'Frostburn Release', 'modern_classic', 2016, 'Early 1.10 terrain with snow ridges.'),

  // 1.9.x
  makeVer('1.9.4', 'Combat Update', 'modern_classic', 2016, 'Classic 1.9 exploration with smooth chunk updates.'),
  makeVer('1.9.2', 'Elytra Patch', 'modern_classic', 2016, 'Fast movement and soaring mountain views.'),
  makeVer('1.9.0', 'Combat Release', 'modern_classic', 2016, 'Iconic 2016 overhaul build.'),

  // 1.8.x
  makeVer('1.8.9', 'Bountiful Update', 'modern_classic', 2015, 'Legendary high-FPS PvP & builder favorite with snappy input response.'),
  makeVer('1.8.8', 'PvP Classic', 'modern_classic', 2015, 'Ultra-responsive classic desktop & mobile movement.'),
  makeVer('1.8.0', 'Bountiful Release', 'modern_classic', 2014, 'Smooth classic terrain and vibrant green pastures.'),

  // 1.7.x
  makeVer('1.7.10', 'The Update That Changed the World', 'golden_alpha', 2014, 'Iconic 1.7 biome generation and beloved classic oak groves.', { grassTint: '#74c64b' }),
  makeVer('1.7.4', 'Biome Update', 'golden_alpha', 2013, 'Classic rolling hills and vivid foliage.', { grassTint: '#74c64b' }),
  makeVer('1.7.2', 'Worldgen Overhaul', 'golden_alpha', 2013, 'Expanded classic biome transitions.', { grassTint: '#74c64b' }),

  // 1.6.x
  makeVer('1.6.4', 'Horse Update', 'golden_alpha', 2013, 'Open classic grasslands with crisp retro shading.', { grassTint: '#78cc4b' }),
  makeVer('1.6.2', 'Plains Patch', 'golden_alpha', 2013, 'Fast single-pass classic voxel rendering.', { grassTint: '#78cc4b' }),
  makeVer('1.6.1', 'Horse Release', 'golden_alpha', 2013, 'Wide open retro meadows.', { grassTint: '#78cc4b' }),

  // 1.5.x
  makeVer('1.5.2', 'Redstone Update', 'golden_alpha', 2013, 'Nostalgic 1.5 texture clarity and fast single-pass chunk meshes.', { grassTint: '#7ad04c' }),
  makeVer('1.5.1', 'Quartz Patch', 'golden_alpha', 2013, 'Retro bright sky and crisp pixel blocks.', { grassTint: '#7ad04c' }),
  makeVer('1.5.0', 'Redstone Release', 'golden_alpha', 2013, 'Classic 2013 sandbox world.'),

  // 1.4.x
  makeVer('1.4.7', 'Pretty Scary Update', 'golden_alpha', 2013, 'Pure survival sandbox feel from the early golden era.', { grassTint: '#76cc4b' }),
  makeVer('1.4.6', 'Fireworks Patch', 'golden_alpha', 2012, 'Festive retro worldgen with crisp shadows.'),
  makeVer('1.4.2', 'Beacon Release', 'golden_alpha', 2012, 'Early classic terrain with bright green hills.'),

  // 1.3.x
  makeVer('1.3.2', 'Trading & Emeralds', 'golden_alpha', 2012, 'Lightweight early-release worldgen with punchy lime foliage.', { grassTint: '#7bd24c' }),
  makeVer('1.3.1', 'Emerald Release', 'golden_alpha', 2012, 'Classic 2012 singleplayer engine.'),

  // 1.2.x
  makeVer('1.2.5', 'Jungle & Height', 'golden_alpha', 2012, 'Classic 2012 build loved for pure, snappy voxel simplicity.'),
  makeVer('1.2.4', 'Birch & Spruce', 'golden_alpha', 2012, 'Early 1.2 timberlands and rolling hills.'),
  makeVer('1.2.1', 'Anvil Release', 'golden_alpha', 2012, 'Pure classic voxel terrain.'),

  // 1.1.0 & 1.0.0
  makeVer('1.1.0', 'Spawn & Hills', 'golden_alpha', 2012, 'Early post-launch patch with bright classic grass and flat skies.', { grassTint: '#82db4d', terrainAmplitude: 10 }),
  makeVer('1.0.0', 'Adventure Update', 'golden_alpha', 2011, 'The original 2011 full release! Vivid neon-lime grass, deep royal water, and ultra-fast retro chunks.', { skyColor: '#99d9ff', fogColor: '#d1efff', grassTint: '#86e04f', waterColor: '#1f53c7', waterOpacity: 0.86, terrainAmplitude: 10, baseHeight: 18 }),
];

export function detectDefaultPlatform(): PlatformTarget {
  if (typeof navigator === 'undefined') return 'windows';
  const ua = navigator.userAgent || '';
  if (/Android|Mobile|Tablet|iPad|iPhone/i.test(ua) || (navigator.maxTouchPoints > 1 && window.innerWidth < 1024)) {
    return 'android';
  }
  return 'windows';
}
