import { describe, expect, it } from 'vitest';
import { v1Levels, v1Recipes, v1Workstations } from '../data/v1Catalog';
import { createCareer, recordLevel } from './career';
import {
  agentCanProcess,
  answerAddOn,
  assignAgent,
  createProject,
  createProjectQueue,
  decideCustomer,
  decideNextProject,
  deliverActiveProject,
  enqueueProject,
  isLevelUnlocked,
  offerAddOn,
  outstandingProjects,
  peekNextProject,
  processProject,
  runtimeLevel,
  runtimeRecipe,
  tickProjectQueue,
  upgradeEffects,
  validateProjectStep,
  type AgentState,
} from './v1Runtime';

describe('正式關卡與資料驅動流程', () => {
  it('依前一關星級解鎖，未解鎖關卡不能進入', () => {
    const career = createCareer('atlas', 1);
    expect(isLevelUnlocked(career, v1Levels[0])).toBe(true);
    expect(isLevelUnlocked(career, v1Levels[1])).toBe(false);
    recordLevel(career, v1Levels[0].id, 200, 1, 70);
    expect(isLevelUnlocked(career, v1Levels[1])).toBe(true);
  });

  it('將 11 工作區及單、雙、多步、大型配方轉成執行期階段', () => {
    expect(v1Workstations).toHaveLength(11);
    expect(runtimeLevel('era5-01').workstations).toHaveLength(11);
    const lengths = v1Recipes.map((recipe) => runtimeRecipe(recipe).runtimeSteps.length);
    expect(lengths).toContain(1);
    expect(lengths).toContain(2);
    expect(Math.max(...lengths)).toBeGreaterThanOrEqual(6);
  });

  it('每種配方都有目的、動作、成果與圖示摘要', () => {
    for (const recipe of v1Recipes) {
      expect(recipe.purpose.trim()).not.toBe('');
      expect(recipe.action.trim()).not.toBe('');
      expect(recipe.result.trim()).not.toBe('');
      expect(recipe.icon.trim()).not.toBe('');
    }
    expect(v1Recipes.find((recipe) => recipe.id === 'short-copy')).toMatchObject({
      purpose: '用最短篇幅讓讀者理解產品賣點',
      result: '一則產品介紹短文',
      icon: 'text',
    });
  });

  it('五紀元以資料控制到客、佇列上限與耐心壓力', () => {
    const firstLevels = ([1, 2, 3, 4, 5] as const).map((era) => v1Levels.find((level) => level.era === era && level.index === 1)!);
    expect(firstLevels.map((level) => level.maxQueue)).toEqual([1, 3, 3, 4, 5]);
    expect(firstLevels.map((level) => level.initialQueue)).toEqual([1, 2, 3, 3, 3]);
    expect(firstLevels.map((level) => level.arrivalSeconds)).toEqual([18, 14, 11, 9, 7]);
    expect(firstLevels.map((level) => level.patienceDrain)).toEqual([.75, .95, 1.08, 1.22, 1.38]);
    for (const level of v1Levels) {
      expect(level.initialQueue).toBeGreaterThanOrEqual(1);
      expect(level.initialQueue).toBeLessThanOrEqual(level.maxQueue);
      expect(level.arrivalSeconds).toBeGreaterThan(0);
      expect(level.patienceDrain).toBeGreaterThan(0);
    }
  });

  it('無副作用驗證工作站，正式加工只累加一次品質', () => {
    const level = runtimeLevel('era2-01');
    const recipe = runtimeRecipe(v1Recipes.find((candidate) => candidate.id === 'researched-copy')!);
    const box = createProject('x', recipe, level.customers[0]);
    decideCustomer(box, 'accept');

    const beforeValidation = structuredClone(box);
    expect(validateProjectStep(box, 'search')).toMatchObject({ ok: true });
    expect(box).toEqual(beforeValidation);
    expect(validateProjectStep(box, 'art')).toMatchObject({ ok: false });
    expect(box).toEqual(beforeValidation);

    expect(processProject(box, 'search', 70).ok).toBe(true);
    expect(box.outputs[0].output).toBe('research');
    expect(box.quality).toBe(70);
    const afterProcessing = structuredClone(box);
    expect(validateProjectStep(box, 'search').reason).toContain('下一階段必須送到');
    expect(box).toEqual(afterProcessing);
  });
});

describe('多訂單佇列與獨立耐心', () => {
  it('按上限排隊、接下隊首並在交付後推進下一位', () => {
    const level = runtimeLevel('era1-01');
    const recipe = level.recipes.find((candidate) => candidate.steps[0] === 'text')!;
    const first = createProject('first', recipe, level.customers[0]);
    const second = createProject('second', recipe, level.customers[1]);
    const third = createProject('third', recipe, level.customers[2]);
    const queue = createProjectQueue(2);

    expect(enqueueProject(queue, first).ok).toBe(true);
    expect(enqueueProject(queue, second).ok).toBe(true);
    expect(enqueueProject(queue, third)).toMatchObject({ ok: false, reason: '訂單佇列已滿' });
    expect(outstandingProjects(queue).map((project) => project.id)).toEqual(['first', 'second']);

    expect(decideNextProject(queue, 'accept')).toMatchObject({ ok: true, accepted: true, project: first });
    expect(queue.active).toBe(first);
    expect(peekNextProject(queue)).toBe(second);
    expect(deliverActiveProject(queue)).toMatchObject({ ok: false });

    expect(processProject(first, 'text', 74).ok).toBe(true);
    expect(deliverActiveProject(queue)).toMatchObject({ ok: true, project: first });
    expect(queue.delivered).toBe(1);
    expect(queue.active).toBeUndefined();
    expect(peekNextProject(queue)).toBe(second);
    expect(enqueueProject(queue, third).ok).toBe(true);
  });

  it('每張訂單獨立扣耐心，等待者歸零離隊而手持資料箱保留', () => {
    const level = runtimeLevel('era1-01');
    const recipe = level.recipes[0];
    const active = createProject('active', recipe, level.customers[0]);
    const waiting = createProject('waiting', recipe, level.customers[1]);
    const queue = createProjectQueue(3);
    enqueueProject(queue, active);
    enqueueProject(queue, waiting);
    decideNextProject(queue, 'accept');

    tickProjectQueue(queue, 20, 1);
    expect(active.patience).toBe(50);
    expect(waiting.patience).toBe(14);

    const waitingExpired = tickProjectQueue(queue, 14, 1);
    expect(waitingExpired.abandoned).toEqual([waiting]);
    expect(waitingExpired.activeExhausted).toBeUndefined();
    expect(queue.waiting).toEqual([]);
    expect(queue.abandoned).toBe(1);
    expect(active.patience).toBe(36);

    const activeExpired = tickProjectQueue(queue, 36, 1);
    expect(activeExpired.activeExhausted).toBe(active);
    expect(queue.active).toBe(active);
    expect(active.patience).toBe(0);
  });

  it('拒絕隊首會移出佇列且不占用手持資料箱', () => {
    const level = runtimeLevel('era1-01');
    const queue = createProjectQueue(2);
    const project = createProject('reject-me', level.recipes[0], level.customers[0]);
    enqueueProject(queue, project);
    expect(decideNextProject(queue, 'reject')).toMatchObject({ ok: true, accepted: false });
    expect(queue.active).toBeUndefined();
    expect(queue.waiting).toEqual([]);
    expect(queue.rejected).toBe(1);
  });
});

describe('客戶、升級與 Agent', () => {
  it('客戶決策依性格改變滿意度且拒絕不接單', () => {
    const level = runtimeLevel('era1-01');
    const box = createProject('x', level.recipes[0], level.customers[0]);
    expect(decideCustomer(box, 'question').satisfaction).toBeGreaterThan(0);
    const rejected = createProject('y', level.recipes[0], level.customers[0]);
    expect(decideCustomer(rejected, 'reject').accepted).toBe(false);
  });

  it('追加要求可接受返工或拒絕並影響滿意度', () => {
    const level = runtimeLevel('era1-01');
    const box = createProject('x', level.recipes[0], level.customers[0]);
    decideCustomer(box, 'accept');
    processProject(box, box.recipe.steps[0], 70);
    expect(offerAddOn(box, 0)).toBe(true);
    expect(answerAddOn(box, true).accepted).toBe(true);
    expect(offerAddOn(box, 0)).toBe(false);
    expect(box.complete).toBe(false);
    const other = createProject('y', level.recipes[0], level.customers[0]);
    other.addOn = { label: '追加' };
    expect(answerAddOn(other, false).satisfaction).toBeLessThan(0);
  });

  it('已購升級改變容量、槽位、穩定度及 Agent 等級', () => {
    const career = createCareer('atlas', 1);
    career.upgrades = { cpu: 2, 'case-slot': 1, stability: 2, agent: 1 };
    career.agent = { unlocked: true, level: 1, assignment: 'text' };
    const effects = upgradeEffects(career);
    expect(effects.capacity.cpu).toBe(130);
    expect(effects.caseSlots).toBe(2);
    expect(effects.stability).toBeCloseTo(.16);
    expect(effects.agentLevel).toBe(1);
  });

  it('Agent 只能接指定單步工作，忙碌與冷卻時不能改派', () => {
    const level = runtimeLevel('era1-01');
    const box = createProject('x', level.recipes.find((recipe) => recipe.steps[0] === 'text')!, level.customers[0]);
    decideCustomer(box, 'accept');
    const agent: AgentState = { assignment: 'text', busy: false, cooldownUntil: 0, load: 0 };
    expect(agentCanProcess(agent, box, 10)).toBe(true);
    agent.busy = true;
    expect(assignAgent(agent, 'art', 10).ok).toBe(false);
    agent.busy = false;
    agent.cooldownUntil = 20;
    expect(assignAgent(agent, 'art', 10).ok).toBe(false);
    expect(assignAgent(agent, 'video', 21).ok).toBe(false);
  });
});
