export type MtrTrainModelId =
  | 'bangkok_mrt_blue'
  | 'hk_mtr_m_train'
  | 'hk_mtr_airport'
  | 'nyc_subway_r160'
  | 'nyc_subway_r211';

export interface MtrTrainSpec {
  id: MtrTrainModelId;
  name: string;
  city: string;
  lineLabel: string;
  builder: string;
  topSpeed: number;
  bodyHex: string;
  stripeHex: string;
  accentHex: string;
  doorHex: string;
  roofHex: string;
  cabHex: string;
  description: string;
}

export const MTR_TRAIN_MODELS: MtrTrainSpec[] = [
  {
    id: 'bangkok_mrt_blue',
    name: 'Bangkok MRT Blue Line (BEM EMU-BLE)',
    city: 'Bangkok, Thailand',
    lineLabel: 'BL · Chaloem Ratchamongkhon',
    builder: 'Siemens Modular Metro',
    topSpeed: 10.5,
    bodyHex: '#f1f5f9',
    stripeHex: '#1d4ed8',
    accentHex: '#dc2626',
    doorHex: '#cbd5e1',
    roofHex: '#94a3b8',
    cabHex: '#1e3a8a',
    description:
      'Bangkok MRT Blue Line EMU with crisp white aluminum body, royal blue belly band, and crimson red stripe.',
  },
  {
    id: 'hk_mtr_m_train',
    name: 'Hong Kong MTR M-Train (Metro-Cammell)',
    city: 'Hong Kong',
    lineLabel: 'Urban Lines · Kwun Tong / Island',
    builder: 'Metro-Cammell',
    topSpeed: 11.0,
    bodyHex: '#d1d5db',
    stripeHex: '#9ca3af',
    accentHex: '#b91c1c',
    doorHex: '#dc2626',
    roofHex: '#6b7280',
    cabHex: '#b91c1c',
    description:
      'Iconic Hong Kong brushed silver stainless-steel EMU featuring MTR crimson red sliding doors and cab front.',
  },
  {
    id: 'hk_mtr_airport',
    name: 'Hong Kong MTR Airport Express (CAF Adtranz)',
    city: 'Hong Kong',
    lineLabel: 'AEL · Airport Express',
    builder: 'Adtranz / CAF',
    topSpeed: 13.5,
    bodyHex: '#e2e8f0',
    stripeHex: '#0f766e',
    accentHex: '#14b8a6',
    doorHex: '#0d9488',
    roofHex: '#64748b',
    cabHex: '#115e59',
    description:
      'High-speed Airport Express EMU with streamlined teal/silver livery and wide panoramic passenger windows.',
  },
  {
    id: 'nyc_subway_r160',
    name: 'New York City Subway R160 (MTA)',
    city: 'New York City, USA',
    lineLabel: 'A / E / F · IND / BMT',
    builder: 'Alstom / Kawasaki',
    topSpeed: 10.0,
    bodyHex: '#cbd5e1',
    stripeHex: '#1e40af',
    accentHex: '#f59e0b',
    doorHex: '#94a3b8',
    roofHex: '#64748b',
    cabHex: '#0f172a',
    description:
      'Corrugated stainless-steel New York City Subway car with matte black cab mask, amber LED headlights, and MTA blue band.',
  },
  {
    id: 'nyc_subway_r211',
    name: 'New York City Subway R211A (MTA)',
    city: 'New York City, USA',
    lineLabel: 'A / C · Modern Eighth Ave',
    builder: 'Kawasaki Rail Car',
    topSpeed: 11.5,
    bodyHex: '#dbeafe',
    stripeHex: '#2563eb',
    accentHex: '#facc15',
    doorHex: '#eab308',
    roofHex: '#475569',
    cabHex: '#1d4ed8',
    description:
      'Next-generation MTA R211 subway consist with vibrant blue front fascia, LED route display, and wide yellow-trimmed doors.',
  },
];

export type MtrDirectionMode = 'one_way_cw' | 'one_way_ccw' | 'two_way';

export interface MtrDepotConfig {
  id: string;
  name: string;
  depotPos: [number, number, number];
  trainModelId: MtrTrainModelId;
  carCount: number;
  cruiseSpeed: number;
  stationDwellSeconds: number;
  dispatched: boolean;
  directionMode?: MtrDirectionMode;
}

export interface MtrTrackSummary {
  normalCount: number;
  stationCount: number;
  depotCount: number;
  stationPositions: [number, number, number][];
  depotPositions: [number, number, number][];
}

export interface MtrTrainTelemetry {
  depotId: string;
  depotName: string;
  trainName: string;
  city: string;
  status: 'In Depot' | 'Running' | 'At Station' | 'No Track';
  x: number;
  y: number;
  z: number;
  carCount: number;
  speedBlocksPerSec: number;
  directionMode: MtrDirectionMode;
  doorOpen: boolean;
  doorProgress: number;
  onboardNpcCount: number;
}

export interface MtrDepartureItem {
  depotId: string;
  depotName: string;
  trainName: string;
  city: string;
  lineLabel: string;
  accentHex: string;
  stripeHex: string;
  etaSeconds: number;
  status: 'Boarding' | 'Approaching' | 'En Route' | 'In Depot';
  directionLabel: string;
  carCount: number;
}

export type MtrAnnouncementMode = 'preset' | 'recorded' | 'mute';

export interface MtrAnnouncementPreset {
  id: string;
  label: string;
  agency: string;
  template: string;
}

export const MTR_ANNOUNCEMENT_PRESETS: MtrAnnouncementPreset[] = [
  {
    id: 'bkk_mrt_arrive',
    label: 'Bangkok MRT Arrival',
    agency: 'MRT Blue Line',
    template: 'This station is {station}. Please mind the gap between the train and the platform.',
  },
  {
    id: 'hk_mtr_arrive',
    label: 'Hong Kong MTR Arrival',
    agency: 'MTR Corporation',
    template: 'Arriving at {station}. Doors will open on the platform side. Stand clear of the doors.',
  },
  {
    id: 'nyc_subway_arrive',
    label: 'NYC Subway Arrival',
    agency: 'MTA New York',
    template: 'This is {station}. Stand clear of the closing doors, please.',
  },
  {
    id: 'express_next',
    label: 'Express Service Chime',
    agency: 'Airport Express',
    template: 'Now arriving at {station}. Thank you for traveling on the express rail service.',
  },
  {
    id: 'terminal_stop',
    label: 'Terminal Last Stop',
    agency: 'Terminus',
    template: 'This is {station}, the final stop on this train. All passengers please exit.',
  },
];

export interface MtrStationAnnouncement {
  stationId: string;
  stationName: string;
  mode: MtrAnnouncementMode;
  presetId: string;
  customPhrase?: string;
  recordedAudioDataUrl?: string;
  recordedDurationSec?: number;
}

export function formatMtrAnnouncementText(ann: MtrStationAnnouncement): string {
  const station = ann.stationName.trim() || 'Station';
  if (ann.customPhrase && ann.customPhrase.trim().length > 0) {
    return ann.customPhrase.replace(/\{station\}/gi, station);
  }
  const preset =
    MTR_ANNOUNCEMENT_PRESETS.find((p) => p.id === ann.presetId) ?? MTR_ANNOUNCEMENT_PRESETS[0];
  return preset.template.replace(/\{station\}/gi, station);
}

export interface MtrStationPlatformSchedule {
  stationId: string;
  platformLabel: string;
  centerPos: [number, number, number];
  railCount: number;
  platformStatus: 'Boarding' | 'Approaching' | 'Clear';
  dwellRemainingSeconds: number;
  activeTrainName: string | null;
  upcomingDepartures: MtrDepartureItem[];
  announcement: MtrStationAnnouncement | null;
}

export interface MtrTrainScheduleData {
  stations: MtrStationPlatformSchedule[];
  totalDispatchedTrains: number;
  generatedAt: number;
}

export type MtrTurnCurveSpan = 'tight' | 'gentle' | 'long' | 'giant';

export interface MtrTrackBuilderOptions {
  railType: 'normal' | 'station' | 'depot';
  length: number;
  turnDirection: 'straight' | 'left' | 'right';
  turnCurveSpan: MtrTurnCurveSpan;
  includePlatform: boolean;
}

export function getMtrTrainSpec(id: MtrTrainModelId): MtrTrainSpec {
  return MTR_TRAIN_MODELS.find((t) => t.id === id) ?? MTR_TRAIN_MODELS[0];
}

