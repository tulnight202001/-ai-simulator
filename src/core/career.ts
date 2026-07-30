import { models } from '../data/content';
import { v1Levels, v1Upgrades, type EraId } from '../data/v1Catalog';

export const SAVE_VERSION = 2;

export interface LevelProgress {
  stars: number;
  bestScore: number;
  rewardClaims: number;
}

export interface Career {
  schemaVersion: 2;
  id: string;
  name: string;
  seed: number;
  rngState: number;
  modelId: string;
  createdAt: string;
  updatedAt: string;
  era: EraId;
  resources: number;
  subscribers: number;
  rating: number;
  complaints: string[];
  levels: Record<string, LevelProgress>;
  upgrades: Record<string, number>;
  agent: { unlocked: boolean; level: number; assignment: string | null };
  endless: { unlocked: boolean; bestScore: number };
  report?: CareerReport;
}

export interface CareerReport {
  modelName: string;
  totalStars: number;
  completedLevels: number;
  subscribers: number;
  rating: number;
  complaints: number;
  specialty: string;
  platformComment: string;
}

export function createCareer(modelId: string, seed: number, name = '新生模型'): Career {
  if (!models.some((model) => model.id === modelId)) throw new Error('未知模型');
  const now = new Date().toISOString();
  return {
    schemaVersion: 2,
    id: `career-${seed}-${modelId}`,
    name,
    seed,
    rngState: seed,
    modelId,
    createdAt: now,
    updatedAt: now,
    era: 1,
    resources: 0,
    subscribers: 0,
    rating: 3.5,
    complaints: [],
    levels: {},
    upgrades: {},
    agent: { unlocked: false, level: 0, assignment: null },
    endless: { unlocked: false, bestScore: 0 },
  };
}

/** Era 4 always grants the first visible helper; upgrade levels 2–3 improve parallel work. */
export function ensureAgentAvailability(career: Career) {
  if (career.era < 4) return false;
  let changed = false;
  if (!career.agent.unlocked) {
    career.agent.unlocked = true;
    changed = true;
  }
  if (career.agent.level < 1) {
    career.agent.level = 1;
    changed = true;
  }
  if ((career.upgrades.agent ?? 0) < 1) {
    career.upgrades.agent = 1;
    changed = true;
  }
  if (changed) career.updatedAt = new Date().toISOString();
  return changed;
}

export function recordLevel(
  career: Career,
  levelId: string,
  score: number,
  stars: number,
  satisfaction: number,
  complaint?: string,
) {
  const level = v1Levels.find((candidate) => candidate.id === levelId);
  if (!level) throw new Error('未知關卡');
  const old = career.levels[levelId] ?? { stars: 0, bestScore: 0, rewardClaims: 0 };
  const canClaim = old.rewardClaims < level.rewardCap && stars > old.stars;
  career.resources += canClaim ? level.reward : 0;
  career.subscribers += Math.max(0, Math.round(score * satisfaction / 100));
  career.rating = Math.max(1, Math.min(5, career.rating + (satisfaction - 65) / 500));
  if (complaint) career.complaints.push(complaint);
  career.levels[levelId] = {
    stars: Math.max(old.stars, stars),
    bestScore: Math.max(old.bestScore, score),
    rewardClaims: old.rewardClaims + (canClaim ? 1 : 0),
  };
  const eraLevels = v1Levels.filter((candidate) => candidate.era === career.era);
  if (eraLevels.every((candidate) => career.levels[candidate.id]?.stars >= 1) && career.era < 5) {
    career.era = (career.era + 1) as EraId;
  }
  ensureAgentAvailability(career);
  if (v1Levels.every((candidate) => career.levels[candidate.id]?.stars >= 1)) {
    career.endless.unlocked = true;
    career.report = buildCareerReport(career);
  }
  career.updatedAt = new Date().toISOString();
}

export function buyUpgrade(career: Career, id: string) {
  const item = v1Upgrades.find((upgrade) => upgrade.id === id);
  if (!item || item.era > career.era) return false;
  ensureAgentAvailability(career);
  const level = career.upgrades[id] ?? 0;
  const cost = item.cost * (level + 1);
  if (level >= item.maxLevel || career.resources < cost) return false;
  career.resources -= cost;
  career.upgrades[id] = level + 1;
  if (id === 'agent') {
    career.agent.unlocked = true;
    career.agent.level = level + 1;
    career.agent.assignment = null;
  }
  career.updatedAt = new Date().toISOString();
  return true;
}

export function buildCareerReport(career: Career): CareerReport {
  const model = models.find((candidate) => candidate.id === career.modelId)!;
  return {
    modelName: model.name,
    totalStars: Object.values(career.levels).reduce((total, level) => total + level.stars, 0),
    completedLevels: Object.values(career.levels).filter((level) => level.stars > 0).length,
    subscribers: career.subscribers,
    rating: Number(career.rating.toFixed(2)),
    complaints: career.complaints.length,
    specialty: model.strengths[0],
    platformComment: career.rating >= 4.5
      ? '它學會了最難的能力：準時下班。'
      : '持續運算不是唯一答案，偶爾讓伺服器休息吧。',
  };
}
