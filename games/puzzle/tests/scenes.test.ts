/* eslint-disable @typescript-eslint/no-explicit-any -- GPU-free scene fixtures inspect puzzle-specific objects and animation state. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {Mesh,Sprite,Box3,Vector3,PointLight,PerspectiveCamera,ShaderMaterial,Spherical,InstancedMesh,Matrix4} from 'three';
import {registry} from '../src/puzzles/registry.ts';
import {levelIds} from '../src/puzzles/types.ts';
import {person} from '../src/scene/models.ts';
import {fitBoard} from '../src/scene/fit.ts';
import {Atmosphere} from '../src/scene/atmosphere.ts';
// Scene geometry/animation checks need canvas-generated badge data, never a GPU or browser.
const context={fillStyle:'',strokeStyle:'',font:'',textAlign:'',textBaseline:'',lineWidth:0,beginPath(){},roundRect(){},fill(){},stroke(){},fillText(){}};
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>context}),querySelector:()=>null} as unknown as Document;
const motion={matches:false};
globalThis.matchMedia=(()=>motion) as typeof matchMedia;
function census(scene:any){
 let calls=14; // Includes every atmosphere mesh and a shadow submission for every caster.
 scene.root.traverse((o:any)=>{if(o instanceof Mesh||o instanceof Sprite){if(o.visible){const mats=Array.isArray(o.material)?o.material:[o.material];for(const mat of mats)if(mat.visible){calls+=mat.transparent&&mat.side===2?2:1;if(o.castShadow)calls++;}}}});
 assert.ok(calls<=160,`conservative ${calls} submissions including hidden-group children`);return calls;
}
for(const def of Object.values(registry))for(const level of levelIds)test(`${def.id} ${level}: scene lifecycle, animation completion, conservative render census`,async()=>{
 const stage={night:def.id==='bridge',themeDark:false,lamps:[new PointLight(),new PointLight()],renderer:{toneMappingExposure:1}};
 const sceneModule=await def.loadScene(),scene=sceneModule.create(stage as any,level);let s=def.logic.initial(level);scene.sync(s);scene.update(performance.now()/1000,.016,'');
 assert.ok(scene.hit.length>0);assert.ok(scene.root.children.length>0);
 const box=new Box3().setFromObject(scene.root);assert.ok(Number.isFinite(box.min.x));census(scene);
 for(const a of def.logic.solution(level)){
  const r=def.logic.apply(s,a);assert.ok(r.ok);if(!r.ok)continue;
  if(def.logic.isMove(a)){let done=0;scene.animate(s,r.state,()=>{done++;});assert.equal(scene.busy,true);const now=performance.now()/1000;for(const offset of [.1,.4,.8,1.2,2.2,3.6]){scene.update(now+offset,.016,'');census(scene);}assert.equal(done,1);assert.equal(scene.busy,false);scene.update(now+4,.016,'');assert.equal(done,1);}
  else {scene.sync(r.state);scene.update(performance.now()/1000,0,'');census(scene);}s=r.state;
 }
 assert.ok(def.logic.isWin(s));scene.dispose();assert.equal(scene.root.children.length,0);
});
test('bridge toy variants have independent blink eyes and distinct geometry',()=>{
 const boxes=new Set<string>();for(const variant of [1,2,3,4,5,6,8,10,12]){const g=person(variant),eye=g.userData.eyes;assert.ok(eye instanceof Object);assert.equal(eye.position.y,.84);eye.scale.y=.12;assert.equal(eye.position.y,.84);boxes.add(new Box3().setFromObject(g).getSize(new Vector3()).toArray().join(','));}assert.ok(boxes.size>=7);
});

test('night river failure and all selection rings stay within the draw budget',async()=>{
 const def=registry.river,sceneModule=await def.loadScene();
 for(const level of levelIds){
  const scene=sceneModule.create({night:true,themeDark:true,lamps:[new PointLight(),new PointLight()]} as any,level);
  const s=def.logic.initial(level);const selected=def.logic.apply(s,{type:'toggle',id:level==='easy'?'farmer':'rabbit1'});assert.ok(selected.ok);if(!selected.ok)continue;
  const failed=def.logic.apply(selected.state,{type:'cross'});assert.ok(failed.ok);if(!failed.ok)continue;
  assert.ok(def.logic.failure(failed.state));scene.sync(failed.state);scene.update(0,0,'');census(scene);scene.dispose();
 }
});

test('actual visible scene boxes fit the free band at every requested size',async()=>{
 for(const def of Object.values(registry))for(const level of levelIds){
  const scene=(await def.loadScene()).create({night:def.id==='bridge',themeDark:false,lamps:[new PointLight(),new PointLight()]} as any,level);
  scene.sync(def.logic.initial(level));scene.update(0,0,'');scene.root.updateMatrixWorld(true);
  for(const [w,h] of [[375,812],[390,844],[768,1024],[800,600],[1440,900]]){
   const top=w<=650?220:w<=1100?170:115,bottom=h-235,fit=fitBoard(scene.bounds,w/(bottom-top));
   const camera=new PerspectiveCamera(38,w/(bottom-top),.1,360);camera.setViewOffset(w,bottom-top,0,-top,w,h);camera.aspect=w/(bottom-top);
   camera.position.set(fit.position.x,fit.position.y,fit.position.z);camera.lookAt(fit.target.x,fit.target.y,fit.target.z);camera.updateProjectionMatrix();camera.updateMatrixWorld();
   scene.root.traverseVisible(o=>{
    let p=o.parent;while(p){if(p.name==='snapshot-hidden')return;p=p.parent;}
    if(!(o instanceof Mesh||o instanceof Sprite))return;
    if((Array.isArray(o.material)?o.material:[o.material]).every(m=>!m.visible))return;
    const box=new Box3().setFromObject(o);
    for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
     const point=new Vector3(x,y,z).project(camera),px=(point.x+1)*w/2,py=(1-point.y)*h/2;
     assert.ok(px>=0&&px<=w&&py>=top&&py<=bottom,`${def.id}/${level} ${w}×${h}: actual geometry (${px},${py}) clears panels`);
    }
   });
  }
  scene.dispose();
 }
});

test('every puzzle and home sky composes the horizon and hides puffs/birds at low orbits',async()=>{
 for(const def of Object.values(registry))for(const level of levelIds){
  const scene=(await def.loadScene()).create({night:def.id==='bridge',themeDark:false,lamps:[new PointLight(),new PointLight()]} as any,level);
  const atmosphere=new Atmosphere(def.id==='bridge');
  const sky=atmosphere.getObjectByName('sky') as Mesh<import('three').PlaneGeometry,ShaderMaterial>;
  // Include the reported 800×600 regression as well as both required test sizes.
  for(const [w,h] of [[390,844],[800,600],[1440,900]])for(const home of [false,true]){
   const top=home?0:w<=650?220:w<=1100?170:115,bottom=home?h:h-235;
   const camera=new PerspectiveCamera(38,w/(bottom-top),.1,360),fit=fitBoard(scene.bounds,w/(bottom-top));
   camera.setViewOffset(w,bottom-top,0,-top,w,h);camera.aspect=w/(bottom-top);
   camera.position.set(fit.position.x,fit.position.y,fit.position.z);camera.lookAt(fit.target.x,fit.target.y,fit.target.z);
   camera.updateProjectionMatrix();camera.updateMatrixWorld();
   const label=`${def.id}/${level} ${w}×${h} ${home?'home':'play'}`;
   // Evaluate the shader's actual uniforms and reconstructed rays, independently
   // of camera-fit assumptions. Find the altitude-zero horizon by bisection.
   const altitude=(x:number,fromTop:number)=>{
    const u=sky.material.uniforms;
    const ray=new Vector3(x*2-1,1-fromTop*2,1).applyMatrix4(u.inverseProjection.value).transformDirection(u.cameraWorld.value);
    const screen=(1-fromTop-u.skyHorizon.value)*.8/(1-u.skyHorizon.value);
    return ray.y*(1-u.skyBlend.value)+screen*u.skyBlend.value;
   };
   // Home rotates freely; also check player zoom, near top-down and low orbits.
   for(const polar of [47*Math.PI/180,.15,1.15,1.30])for(const azimuth of [0,Math.PI/2,Math.PI,3*Math.PI/2])for(const zoom of [.6,1,1.6]){
    camera.position.setFromSpherical(new Spherical(fit.distance*zoom,polar,azimuth)).add(new Vector3(fit.target.x,fit.target.y,fit.target.z));
    camera.lookAt(fit.target.x,fit.target.y,fit.target.z);camera.updateMatrixWorld();atmosphere.update(camera,0,w/h);
    assert.equal(sky.material.uniforms.night.value,def.id==='bridge'?1:0);
    for(const x of [.1,.5,.9]){
     let lo=0,hi=1;
     for(let i=0;i<32;i++){const mid=(lo+hi)/2;if(altitude(x,mid)>0)lo=mid;else hi=mid;}
     const horizon=(lo+hi)/2;
     assert.ok(horizon>0&&horizon<1,`${label}: horizon ${horizon} is onscreen`);
     if(polar<=47*Math.PI/180){
      assert.ok(horizon<=.5,`${label}: horizon ${horizon} is visible in the top half`);
      assert.ok(altitude(x,0)>=.79&&altitude(x,horizon+.1)<-.1,`${label}: distinct blue/star and hill/ground bands`);
     }
     if(polar===47*Math.PI/180)assert.ok(horizon>=.35&&horizon<=.45,`${label}: default sky fills 35–45%`);
    }
    if(polar>=1.15){
     assert.ok(atmosphere.getObjectsByProperty('name','puff-cloud').every(cloud=>!cloud.visible),`${label}: low-orbit puffs are hidden`);
     assert.equal(atmosphere.getObjectByName('sky-birds')!.visible,false,`${label}: low-orbit birds are hidden`);
    }
    if(polar===47*Math.PI/180){
     const u=sky.material.uniforms,light=u.lightPosition.value,cy=(1-light.y)*h;
     const radius=u.lightRadius.value*h, cx=light.x*w;
     assert.ok(cx-radius>0&&cx+radius<w&&cy-radius>0,`${label}: whole disc is onscreen`);
     assert.ok(altitude(light.x,1-light.y)>.02,`${label}: disc clears hill/ground masks`);
     // Conservative rectangles around the real control cluster/heading/menu.
     const overlaps=(left:number,right:number,y0:number,y1:number)=>cx+radius>left&&cx-radius<right&&cy+radius>y0&&cy-radius<y1;
     assert.ok(!overlaps(w-(w<=650?300:290),w,0,w<=650?65:75),`${label}: disc clears top-right buttons`);
     if(home)assert.ok(cy+radius<76,`${label}: disc clears the home menu`);
     else if(w<=650)assert.ok(cy-radius>top,`${label}: disc clears portrait heading`);
     else if(w<=1100)assert.ok(cy+radius<80,`${label}: disc clears tablet heading`);
     else assert.ok(cy-radius>top,`${label}: disc clears desktop heading`);
    }
   }
  }
  atmosphere.traverse(o=>{if(o instanceof Mesh){o.geometry.dispose();const materials=Array.isArray(o.material)?o.material:[o.material];materials.forEach(m=>m.dispose());}});
  scene.dispose();
 }
});

test('bridge fire advances with crossing minutes and reverses on undo/restart; fast companions visibly wait',async t=>{
 const {create}=await import('../src/puzzles/bridge/scene.ts');
 const {crossingDuration}=await import('../src/puzzles/bridge/presentation.ts');
 const lights=[new PointLight(),new PointLight()];
 const scene=create({lamps:lights} as any,'easy');
 let clock=1000;t.mock.method(performance,'now',()=>clock);
 const from={...registry.bridge.logic.initial('easy'),selected:['1','10']};
 const result=registry.bridge.logic.apply(from,{type:'walk'});assert.ok(result.ok);if(!result.ok)return;
 scene.sync(from);scene.update(clock/1000,0,'');
 const fire=scene.root.getObjectByName('start-bank-fire')!;
 const calm=fire.position.clone();assert.equal(fire.visible,true);
 const distantLight=lights[1].intensity;assert.ok(distantLight>0);
 scene.root.updateMatrixWorld(true);
 const distantBox=new Box3().setFromObject(fire),distantMatrices=Array.from((fire as InstancedMesh).instanceMatrix.array);
 const approach=new Matrix4();(fire as InstancedMesh).getMatrixAt((fire as InstancedMesh).count-2,approach);
 const distantApproach=new Vector3().setFromMatrixPosition(approach).add(fire.position);
 let done=0;scene.animate(from,result.state,()=>done++);
 clock+=crossingDuration(10)*(.18+.64*.2);scene.update(clock/1000,.016,'');
 const fast=scene.hit.find(o=>o.userData.id==='1')!,slow=scene.hit.find(o=>o.userData.id==='10')!;
 assert.ok(fast.position.x>slow.position.x);
 assert.ok(fast.userData.legs.every((leg:any)=>leg.rotation.x===0));
 assert.ok(slow.userData.legs.some((leg:any)=>leg.rotation.x!==0));
 assert.equal(done,0);assert.ok(scene.root.userData.fireProgress>0);
 clock+=3500;scene.update(clock/1000,.016,'');assert.equal(done,1);
 assert.equal(scene.root.userData.fireProgress,10/22);assert.ok(fire.position.x>calm.x);
 scene.sync({...result.state,minutes:20});scene.update(clock/1000,0,'');
 assert.ok(fire.visible);assert.ok(lights[1].intensity>0);census(scene);
 scene.root.updateMatrixWorld(true);
 (fire as InstancedMesh).computeBoundingBox();
 const fireBox=new Box3().setFromObject(fire);
 assert.ok(fireBox.max.y>distantBox.max.y*3,'flames grow taller');
 (fire as InstancedMesh).getMatrixAt((fire as InstancedMesh).count-2,approach);
 assert.ok(new Vector3().setFromMatrixPosition(approach).add(fire.position).z>distantApproach.z+1,'bank tongues advance beside the bridge approach');
 assert.ok(fireBox.getSize(new Vector3()).x>distantBox.getSize(new Vector3()).x,'wall widens');
 assert.ok(fireBox.min.x<-scene.bounds.x&&fireBox.min.z<-scene.bounds.z,'burning forest extends beyond the bank');
 assert.equal(fire.parent?.name,'snapshot-hidden','world scenery does not shrink the fitted board or enter share cards');
 scene.sync(registry.bridge.logic.initial('easy'));scene.update(1,0,'');
 assert.equal(scene.root.userData.fireProgress,0);assert.equal(fire.visible,true);
 assert.equal(lights[1].intensity,distantLight);assert.deepEqual(fire.position,calm);
 assert.deepEqual(Array.from((fire as InstancedMesh).instanceMatrix.array),distantMatrices);
 scene.dispose();
});

test('bridge fire respects waiting slots, instance budget, failure edge, victory and live reduced motion',async()=>{
 const {create}=await import('../src/puzzles/bridge/scene.ts');
 const lights=[new PointLight(),new PointLight()],scene=create({lamps:lights} as any,'hard');
 const initial=registry.bridge.logic.initial('hard'),fire=scene.root.getObjectByName('start-bank-fire') as InstancedMesh;
 const smoke=scene.root.getObjectByName('start-bank-smoke') as InstancedMesh;
 const embers=scene.root.getObjectByName('bridge-embers') as InstancedMesh;
 const matrix=new Matrix4(),box=new Box3(),position=new Vector3(),scale=new Vector3();
 try{
  for(const danger of [0,.3,.76,.95,1]){
   scene.sync({...initial,minutes:36*danger});scene.update(1,0,'');
   assert.ok(fire.visible);assert.ok(!scene.hit.includes(fire)&&!scene.hit.includes(smoke));
   let instances=0;scene.root.traverse(o=>{if(o instanceof InstancedMesh)instances+=o.count;});
   assert.ok(instances<=144,`${instances} total instances including 22 planks; fire/smoke/embers stay below 150`);
   if(danger>=.3){assert.ok(embers.count>16);assert.equal((embers.material as any).color.getHexString(),'ffab50');}
   for(let i=0;i<fire.count;i++){
    fire.getMatrixAt(i,matrix);fire.geometry.computeBoundingBox();box.copy(fire.geometry.boundingBox!).applyMatrix4(matrix).translate(fire.position);
    for(const actor of scene.hit.filter(o=>Object.hasOwn(initial.side,o.userData.id))){
     // Conservative footprint includes the toy's shoulders; no flame enters any waiting slot.
     assert.ok(box.max.x<actor.position.x-.4||box.min.x>actor.position.x+.4||box.max.z<actor.position.z-.4||box.min.z>actor.position.z+.4,`${danger}: flame ${i} ${JSON.stringify({min:box.min.toArray(),max:box.max.toArray()})} overlaps traveler ${actor.userData.id} at ${actor.position.toArray()}`);
    }
   }
  }
  scene.sync({...initial,minutes:35});scene.update(1,0,'');assert.notEqual(scene.root.position.x,0);
  motion.matches=true;scene.update(2,0,'');assert.equal(scene.root.position.x,0);assert.equal(scene.root.rotation.z,0);
  const staticFlames=Array.from(fire.instanceMatrix.array),staticSmoke=Array.from(smoke.instanceMatrix.array),staticEmbers=Array.from(embers.instanceMatrix.array),staticLight=lights[1].intensity;
  scene.update(10,0,'');assert.deepEqual(Array.from(fire.instanceMatrix.array),staticFlames);assert.deepEqual(Array.from(smoke.instanceMatrix.array),staticSmoke);assert.deepEqual(Array.from(embers.instanceMatrix.array),staticEmbers);assert.equal(lights[1].intensity,staticLight);
  scene.sync({...initial,minutes:37,failure:{reason:'timeout'}});scene.update(1,0,'');
  assert.equal(scene.root.userData.fireProgress,1);fire.computeBoundingBox();scene.root.updateMatrixWorld(true);
  const failedBox=new Box3().setFromObject(fire);assert.ok(failedBox.max.x>=-1.99&&failedBox.max.z>-.95,'fire reaches the bridge-side edge of the start bank');
  assert.ok(failedBox.max.y>=10&&failedBox.max.y<13,'final forest flames tower over the travelers');
  const tense=lights[1].intensity;
  scene.sync({...initial,minutes:36,side:Object.fromEntries(Object.keys(initial.side).map(id=>[id,1]))});scene.update(1,0,'');
  assert.equal(scene.root.userData.fireRelaxed,true);assert.ok(lights[1].intensity<tense);assert.ok(lights[0].intensity>0);
  scene.sync(initial);assert.equal(scene.root.userData.fireProgress,0);assert.equal(scene.root.userData.fireRelaxed,false);assert.equal(scene.root.position.x,0);
  // Initial flames span the rear of the whole waiting area, rather than a single corner.
  fire.getMatrixAt(0,matrix);position.setFromMatrixPosition(matrix);scale.setFromMatrixScale(matrix);assert.ok(scale.y>0);
  fire.computeBoundingBox();scene.root.updateMatrixWorld(true);assert.ok(new Box3().setFromObject(fire).getSize(position).x>2);
 }finally{motion.matches=false;scene.dispose();}
});
