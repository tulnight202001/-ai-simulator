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
  decision?: CustomerDecision;
  specificationsRevealed: boolean;
  qualityBonus: number;
  decisionImpact?: CustomerDecisionImpact;
  addOn?: { label: string; accepted?: boolean };
  complete: boolean;
}

export interface CustomerDecisionImpact {
  decision: CustomerDecision;
  label: string;
  summary: string;
  details: string[];
  patienceDelta: number;
  satisfactionDelta: number;
  qualityBonus: number;
  rewardBefore: number;
  rewardAfter: number;
  stepCountBefore: number;
  stepCountAfter: number;
  specificationsRevealed: boolean;
}

export interface CustomerDecisionResult {
  accepted: boolean;
  satisfaction: number;
  message: string;
  impact: CustomerDecisionImpact;
}

export interface ProjectQueue {
  readonly maxQueue: number;
  waiting: ProjectBox[];
  delegated: ProjectBox[];
  active?: ProjectBox;
  delivered: number;
  rejected: number;
  abandoned: number;
}

export type QueueActionResult =
  | { ok: true; project: ProjectBox; reason: string }
  | { ok: false; reason: string };

export type QueueDecisionResult =
  | ({ ok: true; project: ProjectBox } & CustomerDecisionResult)
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

function cloneRuntimeRecipe(recipe: RuntimeRecipe): RuntimeRecipe {
  return {
    ...recipe,
    steps: [...recipe.steps],
    addOns: [...recipe.addOns],
    runtimeSteps: recipe.runtimeSteps.map((step) => ({ ...step })),
  };
}

function recipeWithRoute(
  recipe: RuntimeRecipe,
  route: readonly RuntimeStep[],
  rewardMultiplier: number,
  qualityTargetMultiplier: number,
): RuntimeRecipe {
  const runtimeSteps = route.map((step, index) => ({ ...step, index }));
  return {
    ...recipe,
    steps: runtimeSteps.map((step) => step.stationId),
    runtimeSteps,
    reward: Math.max(1, Math.round(recipe.reward * rewardMultiplier)),
    qualityTarget: Math.max(1, Math.round(recipe.qualityTarget * qualityTargetMultiplier)),
  };
}

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
    recipe: cloneRuntimeRecipe(recipe),
    customer,
    stage: 0,
    outputs: [],
    quality: 0,
    patience: customer.patience,
    accepted: false,
    specificationsRevealed: false,
    qualityBonus: 0,
    complete: false,
  };
}

export function decideCustomer(box: ProjectBox, decision: CustomerDecision): CustomerDecisionResult {
  const rewardBefore = box.recipe.reward;
  const stepCountBefore = box.recipe.runtimeSteps.length;
  const patienceBefore = box.patience;
  let satisfaction = 0;
  let label = '';
  let summary = '';
  let details: string[] = [];

  box.accepted = decision !== 'reject';
  box.decision = decision;
  box.specificationsRevealed = false;
  box.qualityBonus = 0;

  if (decision === 'accept') {
    label = '接受原單';
    satisfaction = Math.round((box.customer.completeness - .5) * 4);
    summary = '照原規格、原工序與原報酬執行。';
    details = [`工序 ${stepCountBefore} 道`, `報酬 ${rewardBefore}`, `順序：${box.recipe.sequenceMode === 'ordered' ? '固定' : '自由'}`];
  } else if (decision === 'question') {
    label = '追問完整規格';
    const patienceCost = Math.min(6, box.patience);
    box.patience -= patienceCost;
    box.specificationsRevealed = true;
    box.qualityBonus = 8;
    satisfaction = Math.round(4 + box.customer.questionTolerance * 4);
    summary = '花少量耐心換取完整規格，每道工序獲得品質加成。';
    details = [
      `耐心 -${patienceCost}`,
      `每道工序品質 +${box.qualityBonus}`,
      `完整工序：${box.recipe.runtimeSteps.map((step) => step.label).join(' → ')}`,
    ];
  } else if (decision === 'limits') {
    label = '限制委託範圍';
    const targetCount = Math.max(1, stepCountBefore - 1);
    box.recipe = recipeWithRoute(box.recipe, box.recipe.runtimeSteps.slice(-targetCount), .7, .88);
    satisfaction = Math.round(1 + box.customer.contradictionChance * 4);
    summary = stepCountBefore === 1
      ? '已是最短工序；維持單步交付但降低範圍與報酬。'
      : '省略一個可選前置工序，較快完成但報酬降低。';
    details = [`工序 ${stepCountBefore} → ${box.recipe.runtimeSteps.length}`, `報酬 ${rewardBefore} → ${box.recipe.reward}`, '品質門檻降低 12%'];
  } else if (decision === 'alternative') {
    label = '提出替代方案';
    const targetCount = Math.max(1, Math.floor(stepCountBefore / 2));
    box.recipe = recipeWithRoute(box.recipe, box.recipe.runtimeSteps.slice(-targetCount), .82, .92);
    satisfaction = Math.round(2 + box.customer.alternativeTolerance * 4);
    summary = '改走較短且仍可交付的替代路線，報酬與滿意度居中。';
    details = [`工序 ${stepCountBefore} → ${box.recipe.runtimeSteps.length}`, `報酬 ${rewardBefore} → ${box.recipe.reward}`, '品質門檻降低 8%'];
  } else {
    label = '拒絕委託';
    satisfaction = -2;
    summary = '釋放佇列與手持欄位，承受小幅滿意度代價。';
    details = ['不接單', '滿意度 -2', '不占用資料夾欄位'];
  }

  const impact: CustomerDecisionImpact = {
    decision,
    label,
    summary,
    details,
    patienceDelta: box.patience - patienceBefore,
    satisfactionDelta: satisfaction,
    qualityBonus: box.qualityBonus,
    rewardBefore,
    rewardAfter: box.recipe.reward,
    stepCountBefore,
    stepCountAfter: box.recipe.runtimeSteps.length,
    specificationsRevealed: box.specificationsRevealed,
  };
  box.decisionImpact = impact;
  return { accepted: box.accepted, satisfaction, message: summary, impact };
}

/** Checks the next required station without changing stage, outputs, quality, or completion. */
export function validateProjectStep(box: ProjectBox, stationId: WorkstationId): { ok: boolean; reason: string } {
  if (!box.accepted) return { ok: false, reason: '尚未在櫃台接受此任務' };
  if (box.complete) return { ok: false, reason: '資料箱成果已齊全，請回櫃台交付' };
  const pending = pendingProjectSteps(box);
  const expected = box.recipe.sequenceMode === 'ordered'
    ? box.recipe.runtimeSteps[box.stage]
    : pending.find((step) => step.stationId === stationId);
  if (!expected) {
    if (box.recipe.sequenceMode === 'flexible' && pending.length) {
      return { ok: false, reason: '此工作區不在尚未完成的自由工序中' };
    }
    return { ok: false, reason: '資料箱階段資料不完整，無法繼續加工' };
  }
  if (box.recipe.sequenceMode === 'ordered' && expected.stationId !== stationId) {
    const expectedStation = byId(v1Workstations, expected.stationId);
    return {
      ok: false,
      reason: `錯誤工作區：資料箱目前保存「${box.outputs.map((output) => output.output).join('、') || '原始需求'}」，下一階段必須送到 ${expectedStation?.name ?? expected.stationId}`,
    };
  }
  return { ok: true, reason: `可在 ${byId(v1Workstations, stationId)?.name ?? stationId} 加工` };
}

export function isProjectStepComplete(box: ProjectBox, step: RuntimeStep): boolean {
  return box.outputs.some((output) => output.index === step.index);
}

export function pendingProjectSteps(box: ProjectBox): RuntimeStep[] {
  return box.recipe.runtimeSteps.filter((step) => !isProjectStepComplete(box, step));
}

export function processProject(box: ProjectBox, stationId: WorkstationId, quality: number): { ok: boolean; reason: string } {
  const validation = validateProjectStep(box, stationId);
  if (!validation.ok) return validation;

  const expected = box.recipe.sequenceMode === 'ordered'
    ? box.recipe.runtimeSteps[box.stage]
    : pendingProjectSteps(box).find((step) => step.stationId === stationId);
  if (!expected) return { ok: false, reason: '資料箱階段資料不完整，無法繼續加工' };
  box.outputs.push(expected);
  box.stage = box.outputs.length;
  box.quality += quality + box.qualityBonus;
  box.complete = pendingProjectSteps(box).length === 0;
  return {
    ok: true,
    reason: box.complete
      ? '所有階段完成'
      : box.recipe.sequenceMode === 'ordered'
        ? `已保存 ${expected.output}，下一階段：${box.recipe.runtimeSteps[box.stage]?.label ?? '回櫃台交付'}`
        : `已保存 ${expected.output}，尚有 ${pendingProjectSteps(box).length} 道自由工序`,
  };
}

export function createProjectQueue(maxQueue = 1): ProjectQueue {
  const normalizedMax = Number.isFinite(maxQueue) ? Math.max(1, Math.floor(maxQueue)) : 1;
  return { maxQueue: normalizedMax, waiting: [], delegated: [], delivered: 0, rejected: 0, abandoned: 0 };
}

export function outstandingProjects(queue: ProjectQueue): ProjectBox[] {
  return queue.active
    ? [queue.active, ...queue.delegated, ...queue.waiting]
    : [...queue.delegated, ...queue.waiting];
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

export function delegateActiveProject(queue: ProjectQueue, maxAgents: number): QueueActionResult {
  const project = queue.active;
  if (!project) return { ok: false, reason: '玩家手上沒有可委派的資料箱' };
  const agentSlots = Number.isFinite(maxAgents) ? Math.max(0, Math.floor(maxAgents)) : 0;
  if (queue.delegated.length >= agentSlots) {
    return { ok: false, reason: agentSlots === 0 ? '目前沒有可用 Agent' : '可見 Agent 都已持有資料箱' };
  }
  queue.active = undefined;
  queue.delegated.push(project);
  return { ok: true, project, reason: '資料箱已交給 Agent' };
}

export function reclaimDelegatedProject(queue: ProjectQueue, id: string): QueueActionResult {
  if (queue.active) return { ok: false, reason: '玩家手上已有資料箱，無法取回' };
  const index = queue.delegated.findIndex((project) => project.id === id);
  if (index < 0) return { ok: false, reason: '找不到 Agent 持有的資料箱' };
  const [project] = queue.delegated.splice(index, 1);
  if (!project) return { ok: false, reason: '資料箱取回失敗' };
  queue.active = project;
  return { ok: true, project, reason: '已從 Agent 取回資料箱' };
}

export function deliverDelegatedProject(queue: ProjectQueue, id: string): QueueActionResult {
  const index = queue.delegated.findIndex((project) => project.id === id);
  if (index < 0) return { ok: false, reason: '找不到 Agent 持有的資料箱' };
  const project = queue.delegated[index];
  if (!project.complete) return { ok: false, reason: 'Agent 的資料箱尚未完成，不能交付' };
  if (project.addOn && project.addOn.accepted === undefined) {
    return { ok: false, reason: '尚未回覆客戶的追加要求' };
  }
  queue.delegated.splice(index, 1);
  queue.delivered += 1;
  return { ok: true, project, reason: 'Agent 已完成交付' };
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
  queue.delegated.forEach(reducePatience);
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
      steps: [...box.recipe.steps, finalStep.stationId],
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
