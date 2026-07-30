import type { ModelDefinition, ResourceKey } from '../data/content';
import {
  v1Customers,
  v1Levels,
  v1Recipes,
  v1Workstations,
  type CustomerData,
  type LevelData,
  type RecipeData,
  type WorkstationData,
  type WorkstationId,
} from '../data/v1Catalog';
import type { Career } from './career';

export type CustomerDecision = 'accept' | 'question' | 'limits' | 'alternative' | 'reject';

export interface RuntimeStep {
  index: number;
  stationId: WorkstationId;
  output: string;
  label: string;
}

export interface RuntimeRecipe extends RecipeData {
  runtimeSteps: RuntimeStep[];
}

export interface RuntimeLevel extends LevelData {
  workstations: WorkstationData[];
  recipes: RuntimeRecipe[];
  customers: CustomerData[];
}

export interface ProjectBox {
  id: string;
  recipe: RuntimeRecipe;
  customer: CustomerData;
  stage: number;
  outputs: RuntimeStep[];
  quality: number;
  patience: number;
  accepted: boolean;
  addOn?: { label: string; accepted?: boolean };
  complete: boolean;
}

export interface ProjectQueue {
  readonly maxQueue: number;
  waiting: ProjectBox[];
  active?: ProjectBox;
  delivered: number;
  rejected: number;
  abandoned: number;
}

export type QueueActionResult =
  | { ok: true; project: ProjectBox; reason: string }
  | { ok: false; reason: string };

export type QueueDecisionResult =
  | {
    ok: true;
    project: ProjectBox;
    accepted: boolean;
    satisfaction: number;
    message: string;
  }
  | { ok: false; reason: string };

export interface QueuePatienceResult {
  exhausted: ProjectBox[];
  abandoned: ProjectBox[];
  activeExhausted?: ProjectBox;
}

export interface UpgradeEffects {
  capacity: Record<ResourceKey, number>;
  speedMultiplier: number;
  stability: number;
  caseSlots: number;
  agentLevel: number;
}

export interface AgentState {
  assignment: string | null;
  busy: boolean;
  cooldownUntil: number;
  load: number;
}

const byId = <T extends { id: string }>(items: readonly T[], id: string) => items.find((item) => item.id === id);

export function runtimeRecipe(recipe: RecipeData): RuntimeRecipe {
  return {
    ...recipe,
    runtimeSteps: recipe.steps.map((stationId, index) => {
      const station = byId(v1Workstations, stationId);
      if (!station) throw new Error(`未知工作區：${stationId}`);
      return { index, stationId, output: station.output, label: `${station.name}：${station.output}` };
    }),
  };
}

export function runtimeLevel(levelId: string): RuntimeLevel {
  const level = byId(v1Levels, levelId);
  if (!level) throw new Error('未知關卡');
  return {
    ...level,
    workstations: level.stations.map((id) => {
      const station = byId(v1Workstations, id);
      if (!station) throw new Error(`未知工作區：${id}`);
      return station;
    }),
    recipes: level.recipeIds.map((id) => {
      const recipe = byId(v1Recipes, id);
      if (!recipe) throw new Error(`未知配方：${id}`);
      return runtimeRecipe(recipe);
    }),
    customers: level.customerIds.map((id) => {
      const customer = byId(v1Customers, id);
      if (!customer) throw new Error(`未知客戶：${id}`);
      return customer;
    }),
  };
}

export function isLevelUnlocked(career: Career, level: LevelData) {
  if (level.era > career.era) return false;
  if (level.index === 1) {
    return level.era === 1
      || v1Levels.filter((candidate) => candidate.era === level.era - 1)
        .every((candidate) => (career.levels[candidate.id]?.stars ?? 0) > 0);
  }
  const previous = v1Levels.find((candidate) => candidate.era === level.era && candidate.index === level.index - 1);
  return Boolean(previous) && (career.levels[previous!.id]?.stars ?? 0) >= level.unlockStars;
}

export function createProject(id: string, recipe: RuntimeRecipe, customer: CustomerData): ProjectBox {
  return {
    id,
    recipe,
    customer,
    stage: 0,
    outputs: [],
    quality: 0,
    patience: customer.patience,
    accepted: false,
    complete: false,
  };
}

export function decideCustomer(box: ProjectBox, decision: CustomerDecision) {
  let satisfaction = 0;
  if (decision === 'accept') {
    box.accepted = true;
    satisfaction = box.customer.completeness >= .5 ? 2 : -5;
  } else if (decision === 'question') {
    box.accepted = true;
    box.patience = Math.max(0, box.patience - 6);
    satisfaction = box.customer.questionTolerance >= .5 ? 10 : -8;
  } else if (decision === 'limits') {
    box.accepted = true;
    satisfaction = box.customer.contradictionChance > .2 ? 8 : 1;
  } else if (decision === 'alternative') {
    box.accepted = true;
    satisfaction = box.customer.alternativeTolerance >= .5 ? 8 : -6;
  } else {
    satisfaction = box.customer.patience < 40 ? 2 : -10;
  }
  return {
    accepted: box.accepted,
    satisfaction,
    message: decision === 'reject'
      ? '已拒絕專案'
      : decision === 'question'
        ? '需求已補齊，返工風險降低'
        : '客戶決策已記錄',
  };
}

/** Checks the next required station without changing stage, outputs, quality, or completion. */
export function validateProjectStep(box: ProjectBox, stationId: WorkstationId): { ok: boolean; reason: string } {
  if (!box.accepted) return { ok: false, reason: '尚未在櫃台接受此任務' };
  if (box.complete) return { ok: false, reason: '資料箱成果已齊全，請回櫃台交付' };
  const expected = box.recipe.runtimeSteps[box.stage];
  if (!expected) return { ok: false, reason: '資料箱階段資料不完整，無法繼續加工' };
  if (expected.stationId !== stationId) {
    const expectedStation = byId(v1Workstations, expected.stationId);
    return {
      ok: false,
      reason: `錯誤工作區：資料箱目前保存「${box.outputs.map((output) => output.output).join('、') || '原始需求'}」，下一階段必須送到 ${expectedStation?.name ?? expected.stationId}`,
    };
  }
  return { ok: true, reason: `可在 ${byId(v1Workstations, stationId)?.name ?? stationId} 加工` };
}

export function processProject(box: ProjectBox, stationId: WorkstationId, quality: number): { ok: boolean; reason: string } {
  const validation = validateProjectStep(box, stationId);
  if (!validation.ok) return validation;

  const expected = box.recipe.runtimeSteps[box.stage];
  if (!expected) return { ok: false, reason: '資料箱階段資料不完整，無法繼續加工' };
  box.outputs.push(expected);
  box.stage += 1;
  box.quality += quality;
  box.complete = box.stage >= box.recipe.runtimeSteps.length;
  return {
    ok: true,
    reason: box.complete
      ? '所有階段完成'
      : `已保存 ${expected.output}，下一階段：${box.recipe.runtimeSteps[box.stage]?.label ?? '回櫃台交付'}`,
  };
}

export function createProjectQueue(maxQueue = 1): ProjectQueue {
  const normalizedMax = Number.isFinite(maxQueue) ? Math.max(1, Math.floor(maxQueue)) : 1;
  return { maxQueue: normalizedMax, waiting: [], delivered: 0, rejected: 0, abandoned: 0 };
}

export function outstandingProjects(queue: ProjectQueue): ProjectBox[] {
  return queue.active ? [queue.active, ...queue.waiting] : [...queue.waiting];
}

export function peekNextProject(queue: ProjectQueue): ProjectBox | undefined {
  return queue.waiting[0];
}

export function enqueueProject(queue: ProjectQueue, project: ProjectBox): QueueActionResult {
  if (outstandingProjects(queue).some((candidate) => candidate.id === project.id)) {
    return { ok: false, reason: '相同資料箱已在訂單佇列中' };
  }
  if (outstandingProjects(queue).length >= queue.maxQueue) {
    return { ok: false, reason: '訂單佇列已滿' };
  }
  queue.waiting.push(project);
  return { ok: true, project, reason: '客戶已加入等候佇列' };
}

export function decideNextProject(queue: ProjectQueue, decision: CustomerDecision): QueueDecisionResult {
  if (queue.active) return { ok: false, reason: '先完成手上的資料箱' };
  const project = queue.waiting[0];
  if (!project) return { ok: false, reason: '目前沒有等待中的客戶' };

  const result = decideCustomer(project, decision);
  queue.waiting.shift();
  if (result.accepted) queue.active = project;
  else queue.rejected += 1;
  return { ok: true, project, ...result };
}

export function tickProjectQueue(queue: ProjectQueue, seconds: number, patienceDrain = 1): QueuePatienceResult {
  const elapsed = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const pressure = Number.isFinite(patienceDrain) ? Math.max(0, patienceDrain) : 0;
  const drain = elapsed * pressure;
  const exhausted: ProjectBox[] = [];
  const abandoned: ProjectBox[] = [];

  const reducePatience = (project: ProjectBox) => {
    const previous = project.patience;
    project.patience = Math.max(0, previous - drain);
    if (previous > 0 && project.patience === 0) exhausted.push(project);
  };

  if (queue.active) reducePatience(queue.active);
  queue.waiting.forEach(reducePatience);
  queue.waiting = queue.waiting.filter((project) => {
    if (project.patience > 0) return true;
    abandoned.push(project);
    return false;
  });
  queue.abandoned += abandoned.length;

  return {
    exhausted,
    abandoned,
    activeExhausted: queue.active && exhausted.includes(queue.active) ? queue.active : undefined,
  };
}

export function deliverActiveProject(queue: ProjectQueue): QueueActionResult {
  const project = queue.active;
  if (!project) return { ok: false, reason: '目前沒有手持資料箱' };
  if (!project.complete) return { ok: false, reason: '資料箱尚未完成所有加工步驟' };
  if (project.addOn && project.addOn.accepted === undefined) {
    return { ok: false, reason: '尚未回應客戶的追加要求' };
  }
  queue.active = undefined;
  queue.delivered += 1;
  return { ok: true, project, reason: '完整交付' };
}

export function offerAddOn(box: ProjectBox, roll: number) {
  if (box.addOn) return false;
  if (roll >= box.customer.addOnChance || !box.recipe.addOns.length) return false;
  box.addOn = { label: box.recipe.addOns[Math.floor(roll * 1000) % box.recipe.addOns.length] };
  return true;
}

export function answerAddOn(box: ProjectBox, accept: boolean) {
  if (!box.addOn) return { accepted: false, satisfaction: 0 };
  box.addOn.accepted = accept;
  if (accept) {
    const finalStep = box.recipe.runtimeSteps.at(-1);
    if (!finalStep) return { accepted: false, satisfaction: 0 };
    box.complete = false;
    box.recipe = {
      ...box.recipe,
      runtimeSteps: [...box.recipe.runtimeSteps, { ...finalStep, index: box.recipe.runtimeSteps.length }],
    };
    return { accepted: true, satisfaction: 8 };
  }
  return { accepted: false, satisfaction: -8 };
}

export function upgradeEffects(career: Career): UpgradeEffects {
  const level = (id: string) => career.upgrades[id] ?? 0;
  return {
    capacity: {
      cpu: 100 + 15 * level('cpu'),
      gpu: 100 + 15 * level('gpu'),
      ram: 100 + 15 * level('ram'),
      context: 100 + 18 * level('context'),
      server: 100 + 20 * level('server'),
    },
    speedMultiplier: 1 + level('context') * .02,
    stability: level('stability') * .08,
    caseSlots: 1 + level('case-slot'),
    agentLevel: career.agent.unlocked ? career.agent.level : 0,
  };
}

export function assignAgent(agent: AgentState, assignment: string | null, now: number) {
  if (agent.busy) return { ok: false, reason: 'Agent 正在處理任務，不可中途改派' };
  if (assignment && !['text', 'art', 'code'].includes(assignment)) return { ok: false, reason: 'Agent 只支援文字、繪圖或程式' };
  if (now < agent.cooldownUntil) return { ok: false, reason: 'Agent 冷卻中' };
  agent.assignment = assignment;
  return { ok: true, reason: assignment ? 'Agent 已指派' : 'Agent 正在休息' };
}

export function agentCanProcess(agent: AgentState, box: ProjectBox, now: number) {
  return Boolean(agent.assignment)
    && !agent.busy
    && now >= agent.cooldownUntil
    && box.recipe.runtimeSteps.length === 1
    && box.recipe.runtimeSteps[0]?.stationId === agent.assignment;
}

export function processingMs(station: WorkstationData, model: ModelDefinition, serverLoad: number, effects: UpgradeEffects) {
  const overload = 1 + Math.max(0, serverLoad - 70) / 80;
  return station.seconds * 1000 * overload * effects.speedMultiplier / Math.max(.65, model.speed);
}
