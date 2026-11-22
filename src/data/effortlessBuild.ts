export type EffortlessBuildMode = 'normal' | 'line' | 'wall' | 'floor' | 'cube' | 'circle';

export interface EffortlessBuildModeMeta {
  id: EffortlessBuildMode;
  label: string;
  hint: string;
}

export const EFFORTLESS_BUILD_MODES: EffortlessBuildModeMeta[] = [
  { id: 'normal', label: 'Normal', hint: 'Standard placement + active symmetry mirrors' },
  { id: 'line', label: 'Line', hint: '2-click straight 3D beam or trackbed bridge' },
  { id: 'wall', label: 'Wall', hint: '2-click vertical facade or station wall' },
  { id: 'floor', label: 'Floor', hint: '2-click horizontal deck or plaza slab' },
  { id: 'cube', label: 'Cube', hint: '2-click 3D cuboid (solid or hollow shell)' },
  { id: 'circle', label: 'Circle', hint: '2-click circular ring or disc platform' },
];

export interface EffortlessStatsState {
  enabled: boolean;
  mode: EffortlessBuildMode;
  mirrorX: boolean;
  mirrorZ: boolean;
  radial: boolean;
  hollow: boolean;
  mirrorCenter: [number, number, number];
  hasAnchor: boolean;
  anchorPos: [number, number, number] | null;
  previewCount: number;
  undoCount: number;
}
