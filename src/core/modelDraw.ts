import {models,type ModelDefinition} from '../data/content';
import {SeededRandom} from './random';
export function drawModelChoices(seed:number):ModelDefinition[]{const rng=new SeededRandom(seed),pool=models.filter(m=>m.rarity==='standard'),rare=models.filter(m=>m.rarity==='rare'),choices:ModelDefinition[]=[];if(rng.next()<.1&&rare.length)choices.push(rng.pick(rare));while(choices.length<3&&pool.length){const index=Math.floor(rng.next()*pool.length);choices.push(pool.splice(index,1)[0])}return choices}
