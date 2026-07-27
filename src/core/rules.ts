import type { ModelDefinition, RecipeDefinition, ResourceKey, StationDefinition } from '../data/content';
export interface Job { id:string; recipe:RecipeDefinition; step:number; patience:number; complete:boolean }
export const newJob=(id:string,recipe:RecipeDefinition):Job=>({id,recipe,step:0,patience:recipe.patience,complete:false});
export const expectedStation=(job:Job)=>job.recipe.steps[job.step]??'counter';
export function processJob(job:Job,station:StationDefinition){if(job.complete||expectedStation(job)!==station.id)return false;job.step++;job.complete=job.step>=job.recipe.steps.length;return true}
export function starsFor(score:number,thresholds:number[]){return Math.max(1,thresholds.filter(value=>score>=value).length)}
export function resourcePercent(load:number,model:ModelDefinition,key:ResourceKey){return Math.min(100,Math.round(load/model.capacity[key]*100))}
export function processingDuration(station:StationDefinition,model:ModelDefinition,serverLoad:number){return station.processMs/model.speed*(serverLoad>80?1.45:1)}
