import type { ResourceKey } from './content';

export type WorkstationId = 'counter'|'text'|'search'|'document'|'art'|'music'|'recording'|'studio'|'video'|'code'|'deploy';
export type EraId = 1|2|3|4|5;
export interface WorkstationData {id:WorkstationId;name:string;output:string;era:EraId;resource:ResourceKey;seconds:number;quality:number;cost:number;maxLevel:number}
export interface CustomerData {id:string;name:string;patience:number;completeness:number;addOnChance:number;complaintChance:number;questionTolerance:number;alternativeTolerance:number;contradictionChance:number}
export interface RecipeData {id:string;name:string;era:EraId;steps:WorkstationId[];qualityTarget:number;reward:number;addOns:string[]}
export interface LevelData {id:string;era:EraId;index:number;name:string;duration:number;mapId:string;stations:WorkstationId[];recipeIds:string[];customerIds:string[];unlockStars:number;stars:[number,number,number];reward:number;rewardCap:number;specialGoal?:string}
export interface UpgradeData {id:string;name:string;category:'model'|'hardware'|'station'|'workflow'|'agent';era:EraId;cost:number;maxLevel:number;effect:string;tradeoff?:string}

export const v1Workstations:WorkstationData[]=[
 {id:'counter',name:'需求櫃台',output:'project',era:1,resource:'server',seconds:0,quality:100,cost:2,maxLevel:5},
 {id:'text',name:'文字寫作台',output:'text',era:1,resource:'cpu',seconds:4,quality:74,cost:22,maxLevel:5},
 {id:'art',name:'光繪板',output:'image',era:1,resource:'gpu',seconds:5,quality:72,cost:28,maxLevel:5},
 {id:'code',name:'程式開發電腦',output:'code',era:1,resource:'cpu',seconds:5,quality:72,cost:26,maxLevel:5},
 {id:'search',name:'搜尋與資料終端',output:'research',era:2,resource:'context',seconds:4,quality:76,cost:20,maxLevel:5},
 {id:'document',name:'文件與表格台',output:'document',era:2,resource:'ram',seconds:4,quality:78,cost:20,maxLevel:5},
 {id:'music',name:'音樂編曲台',output:'music',era:2,resource:'gpu',seconds:5,quality:72,cost:25,maxLevel:5},
 {id:'recording',name:'聲音錄製室',output:'recording',era:3,resource:'ram',seconds:5,quality:76,cost:23,maxLevel:5},
 {id:'studio',name:'攝影棚',output:'footage',era:3,resource:'gpu',seconds:6,quality:75,cost:31,maxLevel:5},
 {id:'video',name:'影片剪輯與合成台',output:'video',era:3,resource:'gpu',seconds:6,quality:78,cost:34,maxLevel:5},
 {id:'deploy',name:'伺服器與部署區',output:'deployment',era:2,resource:'server',seconds:5,quality:80,cost:30,maxLevel:5}
];

export const v1Customers:CustomerData[]=[
 {id:'polite',name:'禮貌但細節很多的企劃',patience:70,completeness:.8,addOnChance:.28,complaintChance:.08,questionTolerance:.9,alternativeTolerance:.75,contradictionChance:.05},
 {id:'urgent',name:'什麼都要現在的窗口',patience:34,completeness:.62,addOnChance:.35,complaintChance:.3,questionTolerance:.35,alternativeTolerance:.5,contradictionChance:.12},
 {id:'vague',name:'只說「幫我弄一下」的客戶',patience:55,completeness:.25,addOnChance:.45,complaintChance:.25,questionTolerance:.72,alternativeTolerance:.7,contradictionChance:.25},
 {id:'last-change',name:'永遠最後一次修改的人',patience:62,completeness:.52,addOnChance:.72,complaintChance:.2,questionTolerance:.58,alternativeTolerance:.42,contradictionChance:.2},
 {id:'perfectionist',name:'像素級品質審查員',patience:78,completeness:.9,addOnChance:.38,complaintChance:.4,questionTolerance:.8,alternativeTolerance:.2,contradictionChance:.08},
 {id:'all-tools',name:'相信所有 AI 什麼都會的人',patience:45,completeness:.42,addOnChance:.5,complaintChance:.36,questionTolerance:.25,alternativeTolerance:.65,contradictionChance:.32}
];

export const v1Recipes:RecipeData[]=[
 {id:'short-copy',name:'產品短文',era:1,steps:['text'],qualityTarget:58,reward:90,addOns:['再短一點','再有感覺一點']},
 {id:'quick-art',name:'社群主圖',era:1,steps:['art'],qualityTarget:58,reward:100,addOns:['再做一個尺寸','背景透明']},
 {id:'bug-fix',name:'緊急修 Bug',era:1,steps:['code'],qualityTarget:62,reward:110,addOns:['順便加按鈕','補一個測試']},
 {id:'researched-copy',name:'資料核對文章',era:2,steps:['search','text'],qualityTarget:68,reward:180,addOns:['補上來源']},
 {id:'pdf-report',name:'PDF 整理報告',era:2,steps:['document','text'],qualityTarget:70,reward:185,addOns:['再附圖表']},
 {id:'release-site',name:'活動網站發布',era:2,steps:['text','code','deploy'],qualityTarget:70,reward:270,addOns:['手機也要完美']},
 {id:'audio-demo',name:'歌曲試聽帶',era:3,steps:['text','music','recording'],qualityTarget:72,reward:300,addOns:['副歌再一次']},
 {id:'campaign-video',name:'活動短片',era:3,steps:['art','studio','video'],qualityTarget:74,reward:340,addOns:['加上直式版本']},
 {id:'research-launch',name:'資料產品上線',era:3,steps:['search','document','code','deploy'],qualityTarget:76,reward:420,addOns:['再做監控頁']},
 {id:'full-song',name:'完整歌曲與封面',era:4,steps:['text','music','recording','art'],qualityTarget:78,reward:520,addOns:['這真的是最後一版']},
 {id:'product-platform',name:'產品平台專案',era:4,steps:['search','document','text','code','deploy'],qualityTarget:80,reward:610,addOns:['臨時改商業模式']},
 {id:'song-mv',name:'完整歌曲與 MV',era:5,steps:['text','music','recording','art','studio','video'],qualityTarget:84,reward:820,addOns:['再輸出三種格式']}
];

const eraNames=['','初生模型期','多工具模型期','複合專案期','Agent 協作期','高負載平台期'];
const counts=[0,7,10,10,10,10];
export const v1Levels:LevelData[]=[];
for(let era=1 as EraId;era<=5;era=(era+1) as EraId){
 const availableStations=v1Workstations.filter(s=>s.era<=era).map(s=>s.id);
 const availableRecipes=v1Recipes.filter(r=>r.era<=era&&r.steps.every(step=>availableStations.includes(step))).map(r=>r.id);
 for(let index=1;index<=counts[era];index++){
  const difficulty=(era-1)*10+index;
  v1Levels.push({id:`era${era}-${String(index).padStart(2,'0')}`,era,index,name:`${eraNames[era]} ${index}`,duration:180,mapId:`studio-${era}-${(index-1)%3+1}`,stations:availableStations,recipeIds:availableRecipes.slice(Math.max(0,availableRecipes.length-(2+Math.ceil(index/3)))),customerIds:v1Customers.slice(0,Math.min(v1Customers.length,2+era)).map(c=>c.id),unlockStars:index===1?0:1,stars:[160+difficulty*8,310+difficulty*13,500+difficulty*18],reward:80+difficulty*12,rewardCap:2,specialGoal:index%5===0?'保持伺服器負載低於 90%':undefined});
 }
}

export const v1Upgrades:UpgradeData[]=[
 {id:'cpu',name:'推理核心',category:'hardware',era:1,cost:160,maxLevel:5,effect:'CPU 容量 +15'},
 {id:'gpu',name:'圖像運算陣列',category:'hardware',era:1,cost:180,maxLevel:5,effect:'GPU 容量 +15'},
 {id:'ram',name:'專案記憶體',category:'hardware',era:1,cost:150,maxLevel:5,effect:'RAM 容量 +15'},
 {id:'context',name:'條件記憶窗',category:'model',era:2,cost:210,maxLevel:4,effect:'Context +18',tradeoff:'處理速度 -2%'},
 {id:'server',name:'平台伺服器',category:'hardware',era:2,cost:230,maxLevel:5,effect:'伺服器容量 +20'},
 {id:'case-slot',name:'額外資料暫存槽',category:'workflow',era:3,cost:420,maxLevel:2,effect:'可多暫存一個資料箱'},
 {id:'agent',name:'流程 Agent',category:'agent',era:4,cost:650,maxLevel:3,effect:'自動處理指定單步工作',tradeoff:'持續占用 RAM 與伺服器'},
 {id:'stability',name:'穩定度微調',category:'model',era:2,cost:260,maxLevel:4,effect:'降低過載錯誤 8%'}
];
