export type ResourceKey = 'cpu'|'gpu'|'ram'|'context'|'server';
export type StationId = 'counter'|'text'|'art'|'code';
export interface ModelDefinition {
 id:string;
 name:string;
 role:string;
 tagline:string;
 color:number;
 rarity:'standard'|'rare';
 strengths:string[];
 weakness:string;
 glyph:string;
 visualCue:string;
 skillName:string;
 skillDescription:string;
 speed:number;
 stability:number;
 multitask:number;
 capacity:Record<ResourceKey,number>;
}
export interface StationDefinition { id:StationId; name:string; icon:string; color:number; resource:ResourceKey; baseCost:number; processMs:number; position:{x:number;y:number} }
export interface RecipeDefinition { id:string; name:string; steps:StationId[]; reward:number; patience:number }
export const models:ModelDefinition[]=[
 {id:'relay',name:'中樞 Relay',role:'萬用調度者',tagline:'工具很多，冷卻更要算準',color:0x56e0c2,rarity:'standard',strengths:['多工','流程串聯'],weakness:'多工具同開容易過熱',glyph:'◎',visualCue:'翡翠核心、多工具環、對話粒子',skillName:'串聯',skillDescription:'立即釋放伺服器與 Context 負載。',speed:1.02,stability:1.04,multitask:1.25,capacity:{cpu:106,gpu:96,ram:116,context:112,server:122}},
 {id:'atlas',name:'阿特拉斯 A7',role:'品質守門員',tagline:'慢一點，通常不用重做',color:0xffb36a,rarity:'standard',strengths:['長需求','品質穩定'],weakness:'急單處理速度較慢',glyph:'≋',visualCue:'暖橙光體、文件光帶、沉穩表情',skillName:'校準',skillDescription:'短時間提高品質並安撫客戶。',speed:.9,stability:1.22,multitask:.9,capacity:{cpu:104,gpu:82,ram:98,context:130,server:104}},
 {id:'muse',name:'繆思 Prism',role:'多模態轉換師',tagline:'文字、畫面與聲音一起折射',color:0x9b78ff,rarity:'standard',strengths:['多模態','創意轉換'],weakness:'頻繁切換會累積同步負荷',glyph:'◇',visualCue:'藍紫稜鏡、雙感測器、多色資料流',skillName:'折射',skillDescription:'立即釋放大量 GPU 負載。',speed:1.12,stability:.94,multitask:1.08,capacity:{cpu:92,gpu:128,ram:98,context:90,server:100}},
 {id:'forge',name:'工匠 Link',role:'自動化工程師',tagline:'重複工作交給模組就好',color:0xb6e84b,rarity:'standard',strengths:['程式','自動化'],weakness:'非標準需求容易卡住',glyph:'▦',visualCue:'綠黃光體、模組工具窗、自動化方塊',skillName:'自動化',skillDescription:'立即釋放 RAM 與 CPU 負載。',speed:1.03,stability:1.06,multitask:1.18,capacity:{cpu:120,gpu:86,ram:126,context:96,server:112}},
 {id:'nova',name:'新星 Aurora',role:'即時衝刺手',tagline:'先衝到終點，再處理警告燈',color:0x45a8ff,rarity:'rare',strengths:['速度','急單'],weakness:'衝刺會提高失誤與負載風險',glyph:'➤',visualCue:'電藍光體、高速殘影、俐落衝刺姿態',skillName:'超頻',skillDescription:'五秒內提升移動速度。',speed:1.28,stability:.9,multitask:1.02,capacity:{cpu:114,gpu:108,ram:104,context:98,server:102}},
 {id:'abyss',name:'深核 Echo',role:'資源最佳化師',tagline:'每一點算力都有第二種用法',color:0x2ab7d7,rarity:'standard',strengths:['節能','持續運算'],weakness:'創意型任務加成較少',glyph:'◉',visualCue:'深海藍核心、聲納環、壓縮立方體',skillName:'壓縮',skillDescription:'立即降低所有系統負載。',speed:.98,stability:1.1,multitask:1.12,capacity:{cpu:108,gpu:100,ram:116,context:114,server:128}}
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
