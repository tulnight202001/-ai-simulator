import type { EraId, WorkstationId } from './v1Catalog';

export const MODEL_ART_IDS = ['relay', 'atlas', 'muse', 'forge', 'nova', 'abyss'] as const;
export type ModelArtId = (typeof MODEL_ART_IDS)[number];

export const CUSTOMER_ART_IDS = [
  'polite',
  'urgent',
  'vague',
  'last-change',
  'perfectionist',
  'all-tools',
] as const;
export type CustomerArtId = (typeof CUSTOMER_ART_IDS)[number];

export const STATION_ART_IDS = [
  'counter',
  'text',
  'search',
  'document',
  'art',
  'music',
  'recording',
  'studio',
  'video',
  'code',
  'deploy',
] as const satisfies readonly WorkstationId[];

export const ERA_ART_IDS = [1, 2, 3, 4, 5] as const satisfies readonly EraId[];

const GENERATED_ART_ROOT = 'art/generated/v2';
const GENERATED_CUSTOMER_ART_ROOT = 'art/generated/v3';
const GENERATED_STATION_ART_ROOT = 'art/generated/v3';

export const modelArtPaths: Readonly<Record<ModelArtId, string>> = {
  relay: `${GENERATED_ART_ROOT}/ai-relay-v2.png`,
  atlas: `${GENERATED_ART_ROOT}/ai-atlas-v2.png`,
  muse: `${GENERATED_ART_ROOT}/ai-muse-v2.png`,
  forge: `${GENERATED_ART_ROOT}/ai-forge-v2.png`,
  nova: `${GENERATED_ART_ROOT}/ai-nova-v2.png`,
  abyss: `${GENERATED_ART_ROOT}/ai-abyss-v2.png`,
};

export const customerArtPaths: Readonly<Record<CustomerArtId, string>> = {
  polite: `${GENERATED_CUSTOMER_ART_ROOT}/customer-polite-v3.png`,
  urgent: `${GENERATED_CUSTOMER_ART_ROOT}/customer-urgent-v3.png`,
  vague: `${GENERATED_CUSTOMER_ART_ROOT}/customer-vague-v3.png`,
  'last-change': `${GENERATED_CUSTOMER_ART_ROOT}/customer-last-change-v3.png`,
  perfectionist: `${GENERATED_CUSTOMER_ART_ROOT}/customer-perfectionist-v3.png`,
  'all-tools': `${GENERATED_CUSTOMER_ART_ROOT}/customer-all-tools-v3.png`,
};

export const stationArtPaths: Readonly<Record<WorkstationId, string>> = {
  counter: `${GENERATED_STATION_ART_ROOT}/station-counter-v3.png`,
  text: `${GENERATED_STATION_ART_ROOT}/station-text-v3.png`,
  search: `${GENERATED_STATION_ART_ROOT}/station-search-v3.png`,
  document: `${GENERATED_STATION_ART_ROOT}/station-document-v3.png`,
  art: `${GENERATED_STATION_ART_ROOT}/station-art-v3.png`,
  music: `${GENERATED_STATION_ART_ROOT}/station-music-v3.png`,
  recording: `${GENERATED_STATION_ART_ROOT}/station-recording-v3.png`,
  studio: `${GENERATED_STATION_ART_ROOT}/station-studio-v3.png`,
  video: `${GENERATED_STATION_ART_ROOT}/station-video-v3.png`,
  code: `${GENERATED_STATION_ART_ROOT}/station-code-v3.png`,
  deploy: `${GENERATED_STATION_ART_ROOT}/station-deploy-v3.png`,
};

export const eraBackgroundPaths: Readonly<Record<EraId, string>> = {
  1: `${GENERATED_ART_ROOT}/background-era-1-v2.png`,
  2: `${GENERATED_ART_ROOT}/background-era-2-v2.png`,
  3: `${GENERATED_ART_ROOT}/background-era-3-v2.png`,
  4: `${GENERATED_ART_ROOT}/background-era-4-v2.png`,
  5: `${GENERATED_ART_ROOT}/background-era-5-v2.png`,
};

export function isModelArtId(id: string): id is ModelArtId {
  return (MODEL_ART_IDS as readonly string[]).includes(id);
}

export function isCustomerArtId(id: string): id is CustomerArtId {
  return (CUSTOMER_ART_IDS as readonly string[]).includes(id);
}

export function getModelArtPath(id: string): string {
  if (!isModelArtId(id)) throw new Error(`Unknown model art id: ${id}`);
  return modelArtPaths[id];
}

export function getCustomerArtPath(id: string): string {
  if (!isCustomerArtId(id)) throw new Error(`Unknown customer art id: ${id}`);
  return customerArtPaths[id];
}

export function getStationArtPath(id: WorkstationId): string {
  return stationArtPaths[id];
}

export function getEraBackgroundPath(era: EraId): string {
  return eraBackgroundPaths[era];
}
