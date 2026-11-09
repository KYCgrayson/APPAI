import test from 'node:test';
import assert from 'node:assert/strict';
import {Mesh,Sprite,Box3,Vector3} from 'three';
import {registry} from '../src/puzzles/registry.ts';
import {levelIds} from '../src/puzzles/types.ts';
import {person} from '../src/scene/models.ts';
// Scene geometry/animation checks need canvas-generated badge data, never a GPU or browser.
const context={fillStyle:'',strokeStyle:'',font:'',textAlign:'',textBaseline:'',lineWidth:0,beginPath(){},roundRect(){},fill(){},stroke(){},fillText(){}};
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>context}),querySelector:()=>null} as unknown as Document;
for(const def of Object.values(registry))for(const level of levelIds)test(`${def.id} ${level}: scene lifecycle, animation completion, conservative render census`,async()=>{
 const stage={night:def.id==='bridge',themeDark:false,renderer:{toneMappingExposure:1,domElement:{ownerDocument:{documentElement:{lang:'en'}}}}};
 const module=await def.loadScene(),scene=module.create(stage as any,level);let s=def.logic.initial(level);scene.sync(s);scene.update(performance.now()/1000,.016,'');
 assert.ok(scene.hit.length>0);assert.ok(scene.root.children.length>0);
 const box=new Box3().setFromObject(scene.root);assert.ok(Number.isFinite(box.min.x));
 // Upper bound includes a shadow submission for each caster and double-sided transparent passes.
 let calls=0;scene.root.traverse(o=>{if(o instanceof Mesh||o instanceof Sprite){if(o.visible){const mats=Array.isArray(o.material)?o.material:[o.material];for(const mat of mats)if(mat.visible){calls+=mat.transparent&&mat.side===2?2:1;if(o.castShadow)calls++;}}}});
 assert.ok(calls+14<=160,`${def.id}/${level}: conservative ${calls+14} calls incl atmosphere`);
 for(const a of def.logic.solution(level)){
  const r=def.logic.apply(s,a);assert.ok(r.ok);if(!r.ok)continue;
  if(def.logic.isMove(a)){let done=0;scene.animate(s,r.state,()=>{done++;});assert.equal(scene.busy,true);const now=performance.now()/1000;for(const offset of [.1,.4,.8,1.2,2.2])scene.update(now+offset,.016,'');assert.equal(done,1);assert.equal(scene.busy,false);scene.update(now+2.5,.016,'');assert.equal(done,1);}
  else scene.sync(r.state);s=r.state;
 }
 assert.ok(def.logic.isWin(s));scene.dispose();assert.equal(scene.root.children.length,0);
});
test('bridge toy variants have independent blink eyes and distinct geometry',()=>{
 const boxes=new Set<string>();for(const variant of [1,2,3,4,5,6,8,10,12]){const g=person(variant),eye=g.userData.eyes;assert.ok(eye instanceof Object);assert.equal(eye.position.y,.84);eye.scale.y=.12;assert.equal(eye.position.y,.84);boxes.add(new Box3().setFromObject(g).getSize(new Vector3()).toArray().join(','));}assert.ok(boxes.size>=7);
});

test('Stage fits all puzzle bounds between panels at every requested viewport',async()=>{
 const {Stage}=await import('../src/scene/stage.ts');
 const {PerspectiveCamera,Vector3}=await import('three');
 const viewports=[[375,812],[390,844],[768,1024],[800,600],[1440,900]];
 for(const def of Object.values(registry))for(const [w,h]of viewports){
  const top=w<=650?220:w<=1100?170:115,bottom=h-235;
  globalThis.innerWidth=w;globalThis.innerHeight=h;
  const previous=globalThis.document;
  globalThis.document={querySelector:(s:string)=>s==='.topbar'?{getBoundingClientRect:()=>({bottom:top})}:s==='.bottom'?{getBoundingClientRect:()=>({top:bottom})}:null} as unknown as Document;
  const stage:any={current:{bounds:def.id==='river'?{x:5,y:[-.7,2.3],z:4}:def.id==='bridge'?{x:5.2,y:[-1.5,2.3],z:3.5}:{x:5.1,y:[-1,3],z:3.7}},viewport:'',camera:new PerspectiveCamera(38,1,.1,360),renderer:{domElement:{style:{}},setSize(){}},controls:{target:new Vector3(),update(){},saveState(){}},defaultPosition:new Vector3(),defaultTarget:new Vector3(0,.4,0),defaultOrbit:{setFromVector3(){}}};
  Stage.prototype.resize.call(stage);stage.camera.lookAt(stage.controls.target);stage.camera.updateMatrixWorld();
  const bounds=stage.current.bounds;
  for(const x of [-bounds.x,bounds.x])for(const y of bounds.y)for(const z of [-bounds.z,bounds.z]){
   const p=new Vector3(x,y,z).project(stage.camera),px=(p.x+1)*w/2,py=(1-p.y)*h/2;
   assert.ok(px>=-1&&px<=w+1,`${def.id} ${w}x${h}: horizontal fit`);
   assert.ok(py>=top-1&&py<=bottom+1,`${def.id} ${w}x${h}: clear gameplay panels (${py})`);
  }
  globalThis.document=previous;
 }
});
