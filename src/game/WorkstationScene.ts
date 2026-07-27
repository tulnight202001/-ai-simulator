import Phaser from 'phaser';
import { processingDuration, expectedStation, newJob, processJob, resourcePercent, starsFor, type Job } from '../core/rules';
import { SeededRandom } from '../core/random';
import { recipes, stations, verticalSliceLevel, type ModelDefinition, type ResourceKey, type StationDefinition } from '../data/content';

export interface RunResult {score:number;stars:number;delivered:number}
export class WorkstationScene extends Phaser.Scene {
  private player!:Phaser.GameObjects.Container; private keys!:Record<string,Phaser.Input.Keyboard.Key>;
  private target?:Phaser.Math.Vector2; private nearby?:StationDefinition; private held?:Job; private waiting?:Job;
  private processing=false; private score=0; private delivered=0; private left=verticalSliceLevel.durationSeconds;
  private hud!:Phaser.GameObjects.Text; private prompt!:Phaser.GameObjects.Text; private status!:Phaser.GameObjects.Text;
  private stationObjects=new Map<string,Phaser.GameObjects.Container>(); private loads:Record<ResourceKey,number>={cpu:8,gpu:6,ram:12,context:10,server:14};
  constructor(private model:ModelDefinition,private seed:number,private finish:(result:RunResult)=>void){super('workstation')}
  create(){
    const {width,height}=this.scale; this.cameras.main.setBackgroundColor('#07101d');
    this.add.circle(770,112,215,0x173a5c,.32); this.add.circle(145,530,210,0x0c2941,.45);
    this.add.text(480,82,'AI 交付中心',{fontFamily:'system-ui',fontSize:'13px',fontStyle:'bold',color:'#7293ad'}).setOrigin(.5).setAlpha(.75);
    this.add.polygon(480,355,[0,-245,390,-80,390,170,0,245,-390,170,-390,-80],0x142b3d).setStrokeStyle(3,0x3f7690,.65);
    this.add.polygon(480,355,[0,-220,365,-68,365,154,0,220,-365,154,-365,-68],0x18354a).setStrokeStyle(2,0x64bad0,.18);
    for(let x=160;x<850;x+=80)this.add.line(0,0,x,195,x,515,0x5c9aae,.18); for(let y=230;y<520;y+=55)this.add.line(0,0,95+y*.17,y,865-y*.17,y,0x5c9aae,.16);
    stations.forEach(s=>this.makeStation(s)); this.makePlayer();
    this.add.rectangle(18,16,262,205,0x06131f,.88).setOrigin(0).setStrokeStyle(1,0x71d6e2,.25).setDepth(19);
    this.add.text(34,30,'DAY 01  /  '+verticalSliceLevel.name,{fontFamily:'system-ui',fontSize:'13px',fontStyle:'bold',color:'#7bdceb'}).setDepth(20);
    this.hud=this.add.text(34,57,'',{fontFamily:'monospace',fontSize:'14px',color:'#eafcff',lineSpacing:6}).setDepth(20);
    this.status=this.add.text(width/2,24,'等待第一位客戶…',{fontFamily:'system-ui',fontSize:'17px',fontStyle:'bold',color:'#ffdc80',backgroundColor:'#06131fee',padding:{x:16,y:9}}).setOrigin(.5,0).setDepth(20).setStroke('#4b3710',1);
    this.prompt=this.add.text(width/2,height-20,'靠近設備後互動',{fontFamily:'system-ui',fontSize:'17px',fontStyle:'bold',color:'#effcff',backgroundColor:'#0b5678ee',padding:{x:20,y:11}}).setOrigin(.5,1).setDepth(30).setInteractive({useHandCursor:true}).on('pointerdown',()=>this.interact());
    const keyboard=this.input.keyboard!; this.keys=keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SPACE') as Record<string,Phaser.Input.Keyboard.Key>;
    keyboard.on('keydown-E',()=>this.interact()); keyboard.on('keydown-SPACE',()=>this.interact());
    this.time.addEvent({delay:1000,loop:true,callback:()=>this.tick()}); this.time.delayedCall(1100,()=>this.spawnJob());
    this.scale.on('resize',()=>{}); this.updateHud();
  }
  private makeStation(s:StationDefinition){
    const shadow=this.add.ellipse(0,32,142,56,0x02070b,.55); const base=this.add.polygon(0,0,[-62,-20,0,-52,62,-20,62,25,0,57,-62,25],s.color,.75).setStrokeStyle(2,0xb8f5ff,.55);
    const deck=this.add.polygon(0,-3,[-51,-17,0,-43,51,-17,0,10],0xffffff,.09); const screenGlow=this.add.ellipse(0,-23,88,62,s.color,.18);
    const screen=this.add.rectangle(0,-22,70,42,0x06131f,.96).setStrokeStyle(2,s.color); const label=this.add.text(0,-22,s.icon,{fontFamily:'system-ui',fontSize:s.id==='code'?'16px':'23px',fontStyle:'bold',color:'#f2fdff'}).setOrigin(.5);
    const title=this.add.text(0,58,s.name,{fontFamily:'system-ui',fontSize:'14px',fontStyle:'bold',color:'#e9faff',backgroundColor:'#06131fee',padding:{x:8,y:4}}).setOrigin(.5,0);
    const c=this.add.container(s.position.x,s.position.y,[shadow,base,deck,screenGlow,screen,label,title]).setSize(150,120).setInteractive({useHandCursor:true}).on('pointerdown',()=>{this.target=new Phaser.Math.Vector2(s.position.x,s.position.y+75)});
    this.stationObjects.set(s.id,c);
  }
  private makePlayer(){const shadow=this.add.ellipse(0,29,58,25,0x02070b,.48);const glow=this.add.ellipse(0,18,62,34,this.model.color,.3);const body=this.add.polygon(0,0,[-22,-8,0,-25,22,-8,22,19,0,34,-22,19],this.model.color).setStrokeStyle(3,0xe9fdff,.8);const face=this.add.rectangle(0,-7,29,17,0x071522).setStrokeStyle(2,0xffffff,.45);const eyes=this.add.text(0,-9,'•  •',{fontSize:'12px',color:'#dffcff'}).setOrigin(.5);const antenna=this.add.circle(0,-31,4,0x9cf8ff);this.player=this.add.container(480,410,[shadow,glow,body,face,eyes,antenna]).setDepth(10)}
  update(_:number,delta:number){if(this.left<=0)return;let dx=0,dy=0; if(this.keys.A.isDown||this.keys.LEFT.isDown)dx--;if(this.keys.D.isDown||this.keys.RIGHT.isDown)dx++;if(this.keys.W.isDown||this.keys.UP.isDown)dy--;if(this.keys.S.isDown||this.keys.DOWN.isDown)dy++;
    if(dx||dy){this.target=undefined;const length=Math.hypot(dx,dy);this.move(dx/length*delta*.22,dy/length*delta*.22)}else if(this.target){const distance=Phaser.Math.Distance.Between(this.player.x,this.player.y,this.target.x,this.target.y);if(distance<8)this.target=undefined;else{const angle=Phaser.Math.Angle.Between(this.player.x,this.player.y,this.target.x,this.target.y);this.move(Math.cos(angle)*delta*.2,Math.sin(angle)*delta*.2)}}
    this.nearby=stations.reduce<StationDefinition|undefined>((best,s)=>Phaser.Math.Distance.Between(this.player.x,this.player.y,s.position.x,s.position.y)<105?s:best,undefined);this.prompt.setText(this.processing?'設備運算中…':this.nearby?`互動  ${this.nearby.icon} ${this.nearby.name}`:'點擊設備尋路 · WASD 移動 · E 互動');
  }
  private move(x:number,y:number){this.player.x=Phaser.Math.Clamp(this.player.x+x,120,840);this.player.y=Phaser.Math.Clamp(this.player.y+y,190,555);this.player.setDepth(Math.round(this.player.y))}
  private spawnJob(){if(this.waiting||this.held||this.left<12)return;const rng=new SeededRandom(this.seed+this.delivered*997);const recipe=rng.pick(recipes);this.waiting=newJob(`box-${Date.now()}`,recipe);this.status.setText(`新客戶：${recipe.name}　到櫃台接資料箱`)}
  private interact(){if(!this.nearby||this.processing||this.left<=0)return;const station=this.nearby;if(station.id==='counter'){
      if(this.held?.complete){this.score+=this.held.recipe.reward+Math.max(0,Math.round(this.held.patience*2));this.delivered++;this.held=undefined;this.loads.context=Math.max(5,this.loads.context-18);this.status.setText('完整交付！客戶留下了五星手勢 ✦');this.time.delayedCall(900,()=>this.spawnJob())}
      else if(!this.held&&this.waiting){this.held=this.waiting;this.waiting=undefined;this.loads.context+=18;this.status.setText(`已接單：${this.held.recipe.name} → ${this.stepLabel()}`)} else this.status.setText(this.held?'資料箱尚未完成！':'目前沒有等待客戶');this.updateHud();return}
    if(!this.held){this.status.setText('先去櫃台領取實體資料箱');return}if(this.held.complete){this.status.setText('成果齊全，把資料箱送回櫃台');return}if(expectedStation(this.held)!==station.id){this.status.setText(`流程不符：下一步是 ${this.stepLabel()}`);return}this.startProcessing(station);
  }
  private startProcessing(station:StationDefinition){this.processing=true;this.loads[station.resource]+=station.baseCost;this.loads.server+=22;const object=this.stationObjects.get(station.id)!;const ring=this.add.arc(object.x,object.y-4,55,0,360,false,0xffffff,.16).setStrokeStyle(7,0xffffff).setDepth(600);this.tweens.add({targets:ring,angle:360,duration:processingDuration(station,this.model,this.loads.server),onComplete:()=>{ring.destroy();processJob(this.held!,station);this.processing=false;this.loads[station.resource]=Math.max(5,this.loads[station.resource]-station.baseCost*.72);this.loads.server=Math.max(12,this.loads.server-17);this.score+=35;this.status.setText(this.held!.complete?'成果完成！回櫃台交付資料箱':`步驟完成 → ${this.stepLabel()}`);this.updateHud()}});this.updateHud()}
  private stepLabel(){if(!this.held)return'';return stations.find(s=>s.id===expectedStation(this.held!))?.name??'櫃台交付'}
  private tick(){if(this.left<=0)return;this.left--;if(this.held)this.held.patience=Math.max(0,this.held.patience-1);for(const key of Object.keys(this.loads) as ResourceKey[])this.loads[key]=Math.max(key==='server'?12:5,this.loads[key]-.8);this.updateHud();if(this.left===0){this.processing=false;const result={score:this.score,stars:starsFor(this.score,verticalSliceLevel.starThresholds),delivered:this.delivered};this.time.delayedCall(350,()=>this.finish(result))}}
  private updateHud(){const mm=String(Math.floor(this.left/60)).padStart(2,'0'),ss=String(this.left%60).padStart(2,'0');const box=this.held?`▣ ${this.held.recipe.name}\n   ${this.held.step}/${this.held.recipe.steps.length}  下一步：${this.stepLabel()}`:this.waiting?'櫃台有資料箱等待領取':'雙手空空';const meters=(['cpu','gpu','ram','context','server'] as ResourceKey[]).map(k=>`${k.toUpperCase().padEnd(7)} ${'▰'.repeat(Math.ceil(resourcePercent(this.loads[k],this.model,k)/20))}${'▱'.repeat(5-Math.ceil(resourcePercent(this.loads[k],this.model,k)/20))} ${resourcePercent(this.loads[k],this.model,k)}%`).join('\n');this.hud.setText(`⏱ ${mm}:${ss}    SCORE ${this.score}\n\n${box}\n\n${meters}`)}
}
