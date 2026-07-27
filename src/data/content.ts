export type ResourceKey = 'cpu'|'gpu'|'ram'|'context'|'server';
export type StationId = 'counter'|'text'|'art'|'code';
export interface ModelDefinition { id:string; name:string; tagline:string; color:number; rarity:'standard'|'rare'; strengths:string[]; weakness:string; speed:number; stability:number; multitask:number; capacity:Record<ResourceKey,number> }
export interface StationDefinition { id:StationId; name:string; icon:string; color:number; resource:ResourceKey; baseCost:number; processMs:number; position:{x:number;y:number} }
export interface RecipeDefinition { id:string; name:string; steps:StationId[]; reward:number; patience:number }
export const models:ModelDefinition[]=[
 {id:'atlas',name:'阿特拉斯 A7',tagline:'慢慢想，通常一次就對',color:0x77aaff,rarity:'standard',strengths:['文字','穩定'],weakness:'GPU 成本偏高',speed:.92,stability:1.18,multitask:.9,capacity:{cpu:100,gpu:76,ram:92,context:120,server:100}},
 {id:'muse',name:'繆思 Prism',tagline:'視覺靈感比說明書更快',color:0xff78bb,rarity:'standard',strengths:['繪圖','速度'],weakness:'Context 較短',speed:1.18,stability:.9,multitask:1,capacity:{cpu:86,gpu:125,ram:90,context:76,server:95}},
 {id:'relay',name:'小隊長 Relay',tagline:'平凡，但同時處理也不慌',color:0x68e0c0,rarity:'standard',strengths:['多工','程式'],weakness:'單件品質上限較低',speed:1.03,stability:1.02,multitask:1.25,capacity:{cpu:105,gpu:88,ram:125,context:100,server:120}},
 {id:'sprout',name:'新芽 Beta',tagline:'現在很小，但上限還在雲端',color:0xb6f36b,rarity:'standard',strengths:['成長','效率'],weakness:'初始能力偏弱',speed:.86,stability:.88,multitask:1.05,capacity:{cpu:82,gpu:82,ram:96,context:94,server:92}},
 {id:'nova',name:'新星 Aurora',tagline:'高階起步，耗能也很高階',color:0xffd66d,rarity:'rare',strengths:['速度','長文本'],weakness:'資源消耗高且較早達上限',speed:1.24,stability:1.08,multitask:1.08,capacity:{cpu:112,gpu:108,ram:105,context:130,server:98}}
];
export const stations:StationDefinition[]=[
 {id:'counter',name:'需求櫃台',icon:'◎',color:0xffcf66,resource:'server',baseCost:4,processMs:0,position:{x:480,y:150}},
 {id:'text',name:'文字寫作台',icon:'文',color:0x6de4ff,resource:'cpu',baseCost:30,processMs:3600,position:{x:220,y:310}},
 {id:'art',name:'光繪板',icon:'畫',color:0xff78bb,resource:'gpu',baseCost:38,processMs:4200,position:{x:740,y:310}},
 {id:'code',name:'程式電腦',icon:'</>',color:0x8bff9d,resource:'ram',baseCost:34,processMs:3900,position:{x:480,y:500}}
];
export const recipes:RecipeDefinition[]=[
 {id:'microcopy',name:'緊急產品短文',steps:['text'],reward:110,patience:32},
 {id:'avatar',name:'社群頭像草圖',steps:['art'],reward:125,patience:34},
 {id:'landing',name:'活動頁：文案＋程式',steps:['text','code'],reward:250,patience:54},
 {id:'visual-post',name:'圖文貼文：文字＋繪圖',steps:['text','art'],reward:270,patience:58}
];
export const verticalSliceLevel={id:'era1-slice',name:'第一天：需求暴雨',durationSeconds:180,starThresholds:[180,420,700],stations:stations.map(s=>s.id),recipePool:recipes.map(r=>r.id)};
