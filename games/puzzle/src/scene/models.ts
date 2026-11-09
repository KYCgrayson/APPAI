import { BoxGeometry, ConeGeometry, Group, Mesh, InstancedMesh, MeshStandardMaterial, SphereGeometry, CylinderGeometry, Float32BufferAttribute } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Kind } from '../logic/index.ts';
const sphere = new SphereGeometry(1, 10, 8), box = new BoxGeometry(1, 1, 1), cone = new ConeGeometry(1, 1, 8), cylinder = new CylinderGeometry(1, 1, 1, 12);
const mats = new Map<string, MeshStandardMaterial>();
export function material(color: string) { if (!mats.has(color)) mats.set(color, new MeshStandardMaterial({ color, roughness: .85 })); return mats.get(color)!; }
export function part(g: Group, shape: 'sphere' | 'box' | 'cone' | 'cylinder', color: string, pos: number[], size: number[]) {
 const m = new Mesh({ sphere, box, cone, cylinder }[shape], material(color)); m.position.set(...pos as [number,number,number]); m.scale.set(...size as [number,number,number]); g.add(m); return m;
}
// Bake decorative parts with vertex colours: a complete toy costs one body draw call.
export function bake(g: Group) {
 const geometries: import('three').BufferGeometry[] = [];
 g.updateMatrixWorld(true);
 for (const child of [...g.children]) if (child instanceof Mesh) {
  const geo = child.geometry.clone(); child.updateMatrix(); geo.applyMatrix4(child.matrix);
  const c = (child.material as MeshStandardMaterial).color, colors = new Float32Array(geo.attributes.position.count * 3);
  for (let i=0;i<colors.length;i+=3) { colors[i]=c.r; colors[i+1]=c.g; colors[i+2]=c.b; }
  if (!(child.material as MeshStandardMaterial).vertexColors || !geo.hasAttribute('color'))
   geo.setAttribute('color', new Float32BufferAttribute(colors,3));
  geometries.push(geo); g.remove(child);
  if (![sphere,box,cone,cylinder].includes(child.geometry as typeof sphere)) child.geometry.dispose();
  if (![...mats.values()].includes(child.material as MeshStandardMaterial)) (child.material as MeshStandardMaterial).dispose();
 }
 if (geometries.length) { const mesh = new Mesh(mergeGeometries(geometries), new MeshStandardMaterial({vertexColors:true, roughness:.83})); mesh.castShadow=true; mesh.receiveShadow=true; g.add(mesh); geometries.forEach(geo=>geo.dispose()); }
}
export function character(kind: Kind, captain = false): Group {
 const g = new Group(), eyes = new Group(), moving = new Group(), tail = new Group();
 const color = {farmer:'#efba94',wolf:'#7e8b99',goat:'#eee5ce',cabbage:'#88b55d',rabbit:'#d8bea2',fox:'#dc8246'}[kind];
 const add = (shape: 'sphere'|'box'|'cone'|'cylinder', c:string, p:number[], s:number[]) => part(g,shape,c,p,s);
 add('sphere',kind==='farmer'?'#547e89':color,[0,.34,0],[.24,.31,.21]);
 if (kind==='cabbage') {
  for(let i=0;i<11;i++){const a=i*2.4;const leaf=add('sphere',i%2?'#a6cd77':'#5c9858',[Math.sin(a)*.16,.26+(i%3)*.06,Math.cos(a)*.16],[.15,.24,.09]);leaf.rotation.set(Math.cos(a)*.5,a,Math.sin(a)*.5);}
 } else {
  add('sphere',color,[0,.69,0],[.23,.22,.21]);
  for(const x of [-.14,.14]) { add('sphere',kind==='farmer'?'#644b3d':kind==='fox'?'#594638':color,[x,.08,.06],[.10,.09,.15]); add('sphere',color,[x*1.7,.36,.015],[.08,.18,.09]); }
  if(kind==='farmer') {
   add('cylinder','#d7b56e',[0,.89,0],[.35,.045,.29]); add('cylinder','#e3c17b',[0,.98,0],[.20,.17,.18]); add('cylinder','#946a47',[0,.93,0],[.205,.04,.185]);
   for(const x of [-.12,.12]){ add('box','#83a6ad',[x,.49,.185],[.055,.28,.04]);add('sphere','#edcd7f',[x,.48,.215],[.025,.025,.015]); }
   add('sphere','#ba6351',[0,.56,.12],[.22,.055,.13]); add('cone','#ba6351',[.16,.43,.18],[.07,.23,.04]);
  } else {
   add('sphere',kind==='wolf'?'#c4ccd0':'#fff1d7',[0,.34,.175],[.16,.22,.065]);
   for(const x of [-.13,.13]){
    const ear=part(moving,kind==='rabbit'?'sphere':'cone',color,[x,kind==='rabbit'?1.01:.91,0],kind==='rabbit'?[.072,.29,.075]:[.115,.24,.10]);ear.rotation.z=-x*.8;
    part(moving,kind==='rabbit'?'sphere':'cone','#d69a98',[x,kind==='rabbit'?1.02:.92,.065],kind==='rabbit'?[.035,.21,.025]:[.065,.15,.025]);
   }
   if(kind==='goat') {
    for(let i=0;i<13;i++){const a=i*2.4;add('sphere','#fff3df',[Math.sin(a)*.19,.25+(i%4)*.10,Math.cos(a)*.16],[.10,.10,.10]);}
    for(const x of [-.13,.13]) add('cone','#a9987b',[x,1.04,-.02],[.045,.22,.045]);
    add('cone','#fff3df',[0,.46,.19],[.065,.18,.06]);
   }
   if(kind==='fox'||kind==='wolf') {
    add('sphere','#f2e6cf',[0,.63,.20],[.14,.09,.16]);
    part(tail,'sphere',color,[.14,.35,-.30],[.13,.15,.30]);
    if(kind==='fox') part(tail,'sphere','#fff0d6',[.14,.37,-.53],[.105,.12,.13]);
   } else add('sphere','#fff0dc',[0,.28,-.22],[.12,.12,.12]);
  }
  for(const x of [-.095,.095]) {part(eyes,'sphere','#28383d',[x,.73,.192],[.032,.041,.026]);part(eyes,'sphere','#ffffff',[x-.009,.745,.216],[.010,.012,.009]); add('sphere','#df9e91',[x*1.65,.64,.177],[.044,.025,.018]);}
  add('sphere',kind==='farmer'?'#d99277':'#5e4a44',[0,.654,kind==='fox'||kind==='wolf'?.345:.219],[.035,.026,.027]);
 }
 if(kind==='cabbage'){for(const x of [-.075,.075]){part(eyes,'sphere','#28383d',[x,.38,.215],[.026,.032,.018]);part(eyes,'sphere','#ffffff',[x-.006,.39,.231],[.008,.009,.006]);add('sphere','#d6a48e',[x*1.6,.32,.205],[.035,.02,.018]);}add('sphere','#b7cf81',[0,.335,.237],[.025,.025,.02]);}
 if(captain) {add('sphere','#203d56',[0,.94,.08],[.28,.045,.24]); add('cylinder','#fff5df',[0,1.025,.015],[.235,.14,.195]); add('cylinder','#263f57',[0,.97,.015],[.24,.045,.20]);add('sphere','#e8ba54',[0,1.025,.211],[.048,.052,.017]);}
 // Keep baked vertices local to each animation's anatomical pivot.
 const pivot = (group: Group, x: number, y: number, z: number) => {
  for (const child of group.children) child.position.set(child.position.x-x,child.position.y-y,child.position.z-z);
  group.position.set(x,y,z); bake(group);
 };
 pivot(eyes,0,kind==='cabbage'?.38:.73,kind==='cabbage'?.215:.192);
 pivot(moving,0,.82,0); pivot(tail,.14,.35,-.15);
 bake(g); g.add(eyes,moving,tail); g.userData.tail=tail; g.userData.kind=kind; g.userData.eyes=eyes; g.userData.moving=moving;
 return g;
}

/** Dispose scene-owned resources; cached primitive geometry and palette materials remain reusable. */
export function disposeRoot(root:Group){
 const sharedGeo=new Set([sphere,box,cone,cylinder]),sharedMat=new Set(mats.values()),disposed=new Set<unknown>();
 root.traverse(o=>{if(o instanceof InstancedMesh)o.dispose();if(o instanceof Mesh||o.type==='Sprite'){
  const mesh=o as Mesh; if(mesh.geometry&&!sharedGeo.has(mesh.geometry as typeof sphere)&&!disposed.has(mesh.geometry)){mesh.geometry.dispose();disposed.add(mesh.geometry);}
  for(const mat of Array.isArray(mesh.material)?mesh.material:[mesh.material])if(mat&&!sharedMat.has(mat as MeshStandardMaterial)&&!disposed.has(mat)){const map=(mat as MeshStandardMaterial).map;map?.dispose();mat.dispose();disposed.add(mat);}
 }});root.clear();
}

/** Hand-carved toy friends, differentiated by clothing, silhouette and a tiny trade prop. */
export function person(variant:number):Group{
 const g=new Group(),eyes=new Group(),skin=variant>=8?'#e4bb9a':'#f0c7a0';
 const coat:Record<number,string>={1:'#e8ad58',2:'#6fa697',3:'#c887a4',4:'#7493b5',5:'#e5c8a0',6:'#7e9c64',8:'#7797a2',10:'#b88b9e',12:'#aa7957'};
 const h=variant===1?.86:1;
 part(g,'cylinder',coat[variant],[0,.43,0],[.40,.46,.31]);
 for(const x of [-.12,.12]){part(g,'sphere','#5a5146',[x,.10,.05],[.11,.12,.18]);part(g,'sphere',coat[variant],[x*2,.44,0],[.09,.19,.09]);}
 part(g,'sphere',skin,[0,.82,0],[.25,.25,.23]);
 part(g,'sphere',variant>=8?'#d9d5c5':'#634e40',[0,.97,-.035],[.25,.13,.23]);
 part(g,'sphere',skin,[0,.76,.225],[.045,.045,.05]);
 for(const x of [-.09,.09]){part(eyes,'sphere','#283a3f',[x,0,0],[.027,.037,.021]);part(g,'sphere','#d99085',[x*1.75,.75,.18],[.04,.02,.02]);}
 if(variant===2)part(g,'box','#e7e0bd',[0,.94,.195],[.44,.06,.06]);
 if(variant===3){part(g,'cone','#dba5b8',[0,.26,0],[.44,.23,.4]);part(g,'sphere','#dba5b8',[.20,1.05,0],[.12,.12,.1]);}
 if(variant===4){part(g,'sphere','#4c647c',[0,1.05,0],[.28,.08,.24]);part(g,'box','#ceaa75',[.3,.32,.04],[.2,.05,.25]);part(g,'sphere','#c56f5c',[.30,.37,.07],[.04,.025,.04]);}
 if(variant===5){part(g,'sphere','#fff1d2',[0,1.08,0],[.27,.17,.24]);part(g,'box','#fff0d0',[0,.41,.17],[.3,.32,.025]);}
 if(variant===6){part(g,'cylinder','#d5b577',[0,1.04,0],[.35,.06,.30]);part(g,'cone','#9eab79',[.33,.3,.05],[.13,.2,.1]);}
 if(variant===8){part(g,'cylinder','#74583f',[.36,.25,.10],[.035,.65,.035]);for(const x of [-.10,.10])part(g,'sphere','#bdc5bc',[x,.83,.213],[.09,.08,.025]);}
 if(variant===10){part(g,'sphere','#ca9a64',[.36,.27,.04],[.16,.19,.14]);part(g,'sphere','#d6bd81',[.36,.43,.04],[.14,.025,.13]);}
 if(variant===12)for(let i=0;i<3;i++){const log=part(g,'cylinder','#977047',[.33,.3+i*.1,0],[.08,.43,.08]);log.rotation.x=Math.PI/2;}
 bake(g);bake(eyes);eyes.position.set(0,.84,.211);g.add(eyes);g.userData.eyes=eyes;g.userData.height=h;g.scale.setScalar(h);return g;
}
