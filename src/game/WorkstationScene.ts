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
  private movementBounds={left:48,right:912,top:175,bottom:570};
  constructor(private model:ModelDefinition,private seed:number,private finish:(result:RunResult)=>void){super('workstation')}
  create(){
    const {width,height}=this.scale; this.cameras.main.setBackgroundColor('#0a1024');
    const mobile=width<620,hudHeight=mobile?138:112;this.movementBounds={left:38,right:width-38,top:hudHeight+45,bottom:height-68};
    this.add.rectangle(width/2,hudHeight/2,width,hudHeight,0x101c38);this.add.rectangle(width/2,hudHeight,width,4,0x55cde8,.45);
    this.add.polygon(width/2,hudHeight+(height-hudHeight)/2,[0,-(height-hudHeight)/2,width/2,-(height-hudHeight)*.3,width/2,(height-hudHeight)*.36,0,(height-hudHeight)/2,-width/2,(height-hudHeight)*.36,-width/2,-(height-hudHeight)*.3],0x1d2a4e).setStrokeStyle(3,0x40598c);
    for(let y=hudHeight+54;y<height;y+=54)this.add.line(0,0,12,y,width-12,y,0x8aa1c8,.12);
    stations.forEach(s=>this.makeStation(s)); this.makePlayer();
    this.add.text(16,10,'DAY 01  //  '+verticalSliceLevel.name,{fontFamily:'system-ui',fontSize:mobile?'12px':'16px',fontStyle:'bold',color:'#94a9d9'}).setDepth(900);
    this.hud=this.add.text(16,34,'',{fontFamily:'system-ui',fontSize:mobile?'9px':'12px',color:'#fff',lineSpacing:mobile?0:2}).setDepth(900);
    this.status=this.add.text(width-16,14,'等待第一位客戶…',{fontFamily:'system-ui',fontSize:mobile?'12px':'17px',fontStyle:'bold',color:'#ffda77',backgroundColor:'#17284fee',padding:{x:10,y:7},wordWrap:{width:Math.max(145,width*.43)}}).setOrigin(1,0).setDepth(900);
    this.prompt=this.add.text(width/2,height-25,'靠近設備後互動',{fontFamily:'system-ui',fontSize:'18px',fontStyle:'bold',color:'#fff',backgroundColor:'#3060aadd',padding:{x:18,y:10}}).setOrigin(.5,1).setDepth(30).setInteractive({useHandCursor:true}).on('pointerdown',()=>this.interact());
    const keyboard=this.input.keyboard!; this.keys=keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SPACE') as Record<string,Phaser.Input.Keyboard.Key>;
    keyboard.on('keydown-E',()=>this.interact()); keyboard.on('keydown-SPACE',()=>this.interact());
    this.time.addEvent({delay:1000,loop:true,callback:()=>this.tick()}); this.time.delayedCall(1100,()=>this.spawnJob());
    this.scale.on('resize',()=>this.scene.restart()); this.updateHud();
  }
  private makeStation(s:StationDefinition){
    const mobile=this.scale.width<620,index=stations.indexOf(s),cols=mobile?2:4,col=index%cols,row=Math.floor(index/cols),usableTop=mobile?190:205,usableHeight=this.scale.height-usableTop-105;
    s.position={x:(col+.5)*this.scale.width/cols,y:usableTop+(mobile?row+.45:(index%2)*.75+.25)*Math.max(150,usableHeight/(mobile?2:1.2))};
    const parts:Phaser.GameObjects.GameObject[]=[this.add.ellipse(0,42,172,48,0x050816,.55),this.add.ellipse(0,22,158,82,s.color,.12).setStrokeStyle(2,s.color,.38)];
    if(s.id==='counter')parts.push(this.add.rectangle(0,8,154,62,0x876c54).setStrokeStyle(3,0xd8bb88),this.add.rectangle(0,-27,116,27,0x223653).setStrokeStyle(2,s.color),this.add.circle(-48,-42,14,0xffd39a),this.add.rectangle(-48,-20,24,26,0x49648c));
    if(s.id==='text')parts.push(this.add.rectangle(0,18,148,17,0xb88961),this.add.rectangle(-56,44,13,52,0x6c4b39),this.add.rectangle(56,44,13,52,0x6c4b39),this.add.rectangle(0,-12,80,58,0xf1ead7).setStrokeStyle(3,0x6de4ff),this.add.text(0,-14,'≡  ≡\n  ≡',{fontSize:'18px',color:'#61728c'}).setOrigin(.5));
    if(s.id==='art')parts.push(this.add.rectangle(0,-2,96,80,0x293c59).setStrokeStyle(5,0xd6b07b),this.add.line(0,0,-42,78,0,28,0xd6b07b,1),this.add.line(0,0,42,78,0,28,0xd6b07b,1),this.add.circle(-18,-9,15,0xff78bb),this.add.circle(16,7,20,0x6de4ff));
    if(s.id==='code')parts.push(this.add.rectangle(0,20,154,16,0x526178),this.add.rectangle(0,-20,106,70,0x101827).setStrokeStyle(4,0x8bff9d),this.add.text(0,-22,'{  }',{fontFamily:'monospace',fontSize:'25px',fontStyle:'bold',color:'#8bff9d'}).setOrigin(.5),this.add.rectangle(0,39,76,13,0x253552));
    const title=this.add.text(0,75,`${s.icon}  ${s.name}`,{fontFamily:'system-ui',fontSize:'15px',fontStyle:'bold',color:'#f3f7ff',backgroundColor:'#091126e8',padding:{x:9,y:5}}).setOrigin(.5,0);parts.push(title);
    const c=this.add.container(s.position.x,s.position.y,parts).setSize(180,150).setInteractive({useHandCursor:true}).on('pointerdown',()=>{this.target=new Phaser.Math.Vector2(s.position.x,s.position.y+75)});
    this.stationObjects.set(s.id,c);
  }
  private makePlayer(){const glow=this.add.ellipse(0,34,82,30,this.model.color,.3);const legs=this.add.rectangle(0,30,34,35,0x243658);const body=this.add.ellipse(0,5,64,72,this.model.color).setStrokeStyle(4,0xffffff,.65);const head=this.add.rectangle(0,-38,64,50,0x172441).setStrokeStyle(4,this.model.color);const face=this.add.rectangle(0,-39,46,25,0x0a1226);const eyes=this.add.text(0,-41,'●  ●',{fontSize:'13px',color:'#dffaff'}).setOrigin(.5);const badge=this.add.circle(0,4,10,0xffffff,.9);this.player=this.add.container(this.scale.width/2,this.scale.height-112,[glow,legs,body,head,face,eyes,badge]).setDepth(500)}
  update(_:number,delta:number){if(this.left<=0)return;let dx=0,dy=0; if(this.keys.A.isDown||this.keys.LEFT.isDown)dx--;if(this.keys.D.isDown||this.keys.RIGHT.isDown)dx++;if(this.keys.W.isDown||this.keys.UP.isDown)dy--;if(this.keys.S.isDown||this.keys.DOWN.isDown)dy++;
    if(dx||dy){this.target=undefined;const length=Math.hypot(dx,dy);this.move(dx/length*delta*.22,dy/length*delta*.22)}else if(this.target){const distance=Phaser.Math.Distance.Between(this.player.x,this.player.y,this.target.x,this.target.y);if(distance<8)this.target=undefined;else{const angle=Phaser.Math.Angle.Between(this.player.x,this.player.y,this.target.x,this.target.y);this.move(Math.cos(angle)*delta*.2,Math.sin(angle)*delta*.2)}}
    this.nearby=stations.reduce<StationDefinition|undefined>((best,s)=>Phaser.Math.Distance.Between(this.player.x,this.player.y,s.position.x,s.position.y)<105?s:best,undefined);this.prompt.setText(this.processing?'設備運算中…':this.nearby?`互動  ${this.nearby.icon} ${this.nearby.name}`:'點擊設備尋路 · WASD 移動 · E 互動');
  }
  private move(x:number,y:number){this.player.x=Phaser.Math.Clamp(this.player.x+x,this.movementBounds.left,this.movementBounds.right);this.player.y=Phaser.Math.Clamp(this.player.y+y,this.movementBounds.top,this.movementBounds.bottom);this.player.setDepth(300+Math.round(this.player.y))}
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
