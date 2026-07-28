import {describe,expect,it} from 'vitest';
import {v1Levels,v1Recipes,v1Workstations} from '../data/v1Catalog';
import {createCareer,recordLevel} from './career';
import {agentCanProcess,answerAddOn,assignAgent,createProject,decideCustomer,isLevelUnlocked,offerAddOn,processProject,runtimeLevel,runtimeRecipe,upgradeEffects,type AgentState} from './v1Runtime';

describe('正式關卡與資料驅動流程',()=>{
 it('依前一關星級解鎖，未解鎖關卡不能進入',()=>{const career=createCareer('atlas',1);expect(isLevelUnlocked(career,v1Levels[0])).toBe(true);expect(isLevelUnlocked(career,v1Levels[1])).toBe(false);recordLevel(career,v1Levels[0].id,200,1,70);expect(isLevelUnlocked(career,v1Levels[1])).toBe(true)});
 it('將 11 工作區及單、雙、多步、大型配方轉成執行期階段',()=>{expect(v1Workstations).toHaveLength(11);expect(runtimeLevel('era5-01').workstations).toHaveLength(11);const lengths=v1Recipes.map(r=>runtimeRecipe(r).runtimeSteps.length);expect(lengths).toContain(1);expect(lengths).toContain(2);expect(Math.max(...lengths)).toBeGreaterThanOrEqual(6)});
 it('資料箱保存完成階段並清楚阻擋錯站',()=>{const level=runtimeLevel('era2-01'),recipe=runtimeRecipe(v1Recipes.find(r=>r.id==='researched-copy')!),box=createProject('x',recipe,level.customers[0]);decideCustomer(box,'accept');expect(processProject(box,'art',70)).toMatchObject({ok:false});expect(processProject(box,'search',70).ok).toBe(true);expect(box.outputs[0].output).toBe('research');expect(processProject(box,'search',70).reason).toContain('下一階段必須送到')});
});

describe('客戶、升級與 Agent',()=>{
 it('客戶決策依性格改變滿意度且拒絕不接單',()=>{const level=runtimeLevel('era1-01'),box=createProject('x',level.recipes[0],level.customers[0]);expect(decideCustomer(box,'question').satisfaction).toBeGreaterThan(0);const rejected=createProject('y',level.recipes[0],level.customers[0]);expect(decideCustomer(rejected,'reject').accepted).toBe(false)});
 it('追加要求可接受返工或拒絕並影響滿意度',()=>{const level=runtimeLevel('era1-01'),box=createProject('x',level.recipes[0],level.customers[0]);decideCustomer(box,'accept');processProject(box,box.recipe.steps[0],70);expect(offerAddOn(box,0)).toBe(true);expect(answerAddOn(box,true).accepted).toBe(true);expect(box.complete).toBe(false);const other=createProject('y',level.recipes[0],level.customers[0]);other.addOn={label:'追加'};expect(answerAddOn(other,false).satisfaction).toBeLessThan(0)});
 it('已購升級改變容量、槽位、穩定度及 Agent 等級',()=>{const career=createCareer('atlas',1);career.upgrades={cpu:2,'case-slot':1,stability:2,agent:1};career.agent={unlocked:true,level:1,assignment:'text'};const effects=upgradeEffects(career);expect(effects.capacity.cpu).toBe(130);expect(effects.caseSlots).toBe(2);expect(effects.stability).toBeCloseTo(.16);expect(effects.agentLevel).toBe(1)});
 it('Agent 只能接指定單步工作，忙碌與冷卻時不能改派',()=>{const level=runtimeLevel('era1-01'),box=createProject('x',level.recipes.find(r=>r.steps[0]==='text')!,level.customers[0]);decideCustomer(box,'accept');const agent:AgentState={assignment:'text',busy:false,cooldownUntil:0,load:0};expect(agentCanProcess(agent,box,10)).toBe(true);agent.busy=true;expect(assignAgent(agent,'art',10).ok).toBe(false);agent.busy=false;agent.cooldownUntil=20;expect(assignAgent(agent,'art',10).ok).toBe(false);expect(assignAgent(agent,'video',21).ok).toBe(false)});
});
