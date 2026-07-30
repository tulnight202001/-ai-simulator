import {describe,expect,it} from 'vitest';
import {buyUpgrade,createCareer,ensureAgentAvailability,recordLevel} from './career';
import {v1Levels,v1Recipes,v1Workstations} from '../data/v1Catalog';
import {migrateCareer,previewImport,exportCareer} from '../services/save';
describe('Agent 自動解鎖', () => {
  it('Era 4 會解鎖 Lv1，且不覆寫既有升級或較高 Agent 等級', () => {
    const fresh = createCareer('atlas', 41);
    fresh.era = 4;
    fresh.upgrades.cpu = 3;
    expect(ensureAgentAvailability(fresh)).toBe(true);
    expect(fresh.agent).toEqual({ unlocked: true, level: 1, assignment: null });
    expect(fresh.upgrades).toMatchObject({ cpu: 3, agent: 1 });
    expect(ensureAgentAvailability(fresh)).toBe(false);

    const upgraded = createCareer('atlas', 42);
    upgraded.era = 4;
    upgraded.upgrades = { cpu: 2, agent: 3 };
    upgraded.agent = { unlocked: false, level: 3, assignment: 'text' };
    expect(ensureAgentAvailability(upgraded)).toBe(true);
    expect(upgraded.upgrades).toEqual({ cpu: 2, agent: 3 });
    expect(upgraded.agent).toEqual({ unlocked: true, level: 3, assignment: 'text' });
  });
});
describe('完整第一版資料',()=>{it('包含 5 紀元共 47 關',()=>{expect(v1Levels).toHaveLength(47);expect(new Set(v1Levels.map(l=>l.era))).toEqual(new Set([1,2,3,4,5]))});it('所有配方工作區存在',()=>{const ids=new Set(v1Workstations.map(s=>s.id));for(const recipe of v1Recipes)for(const step of recipe.steps)expect(ids.has(step)).toBe(true)})});
describe('生涯進度',()=>{it('限制重玩資源，保留最佳星級',()=>{const c=createCareer('atlas',12);c.resources=0;recordLevel(c,'era1-01',200,2,80);const reward=c.resources;recordLevel(c,'era1-01',100,1,70);expect(c.resources).toBe(reward);expect(c.levels['era1-01'].stars).toBe(2)});it('升級有成本與上限',()=>{const c=createCareer('atlas',1);c.resources=99999;for(let i=0;i<8;i++)buyUpgrade(c,'cpu');expect(c.upgrades.cpu).toBe(5)});it('匯出可預覽且 v1 可 migration',()=>{const c=createCareer('relay',8);expect(previewImport(exportCareer(c)).career.schemaVersion).toBe(2);expect(migrateCareer({schemaVersion:1,id:'x',seed:1,modelId:'atlas',bestScore:3,bestStars:1,completedAt:'now'}).schemaVersion).toBe(2)})});
