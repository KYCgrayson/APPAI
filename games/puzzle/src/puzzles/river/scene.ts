import { BufferGeometry, Float32BufferAttribute, SphereGeometry, PointLight, BoxGeometry, CircleGeometry, ConeGeometry, CylinderGeometry, DoubleSide, DynamicDrawUsage, Group, InstancedMesh, MathUtils, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, PlaneGeometry, RingGeometry, Vector3 } from 'three';
import { levels, type State } from './logic.ts';
import { character, part, material, bake } from '../../scene/models.ts';
import { ACTOR_SCALE, HIT_WIDTH, bankSlot, boatSeats, TREE_Z, BUSH_X, BUSH_Z, SIGN_X, ROCK_Z } from './layout.ts';
import type { Stage } from '../../scene/stage.ts';
import { disposeRoot } from '../../scene/models.ts';
export class RiverScene {
    root = new Group();
    bounds = {x:5,y:[-.7,2.3] as [number,number],z:4};
    secondaryIds = ['boat'];
    boat = new Group();
    actors = new Map<string, Group>();
    targets = new Map<string, Vector3>();
    hit: Object3D[] = [];
    state?: State;
    sailing = false;
    private sailStart = 0;
    private sailFrom = 0;
    private sailTo = 0;
    private onLand?: () => void;
    private rings = new Map<string, Mesh<RingGeometry, MeshBasicMaterial>>();
    private ringGeo = new RingGeometry(.32, .38, 20);
    private hitGeo = new BoxGeometry(HIT_WIDTH, 1.3, HIT_WIDTH);
    private hitMat = new MeshBasicMaterial({ visible: false });
    private blobs = new InstancedMesh(new CircleGeometry(.28, 12), new MeshBasicMaterial({ color: '#304435', transparent: true, opacity: .15, depthWrite: false }), 10);
    private water: Mesh;
    private oars: Group[] = [];
    private flyers: Group[] = [];
    private fireflies?: InstancedMesh;
    private wake = new Group();
    private blobMatrix = new Matrix4();
    private flyMatrix = new Matrix4();
    private flyScale = new Vector3();
    private won = false;
    private markers = new Map<string, Group>();
    get busy(){ return this.sailing; }
    constructor(_stage: Stage, level: import('./logic.ts').LevelId, dark: boolean) {
        const board = new Group();
        this.root.add(board);
        part(board, 'box', '#bca383', [0, -.47, 0], [10, .5, 8]);
        // Three rectangular rings make a tiny bevelled bank without a general extrusion engine.
        const bankGeometry=new BufferGeometry(), bankVertices:number[]=[], bankIndices:number[]=[];
        for(const [w,d,y] of [[1.51,3.75,.04],[1.59,3.83,-.015],[1.59,3.83,-.10]])
            for(const [x,z] of [[-w,-d],[w,-d],[w,d],[-w,d]])bankVertices.push(x,y,z);
        bankIndices.push(0,2,1,0,3,2);
        for(let r=0;r<2;r++)for(let i=0;i<4;i++){const a=r*4+i,b=r*4+(i+1)%4;bankIndices.push(a,b,b+4,a,b+4,a+4);}
        bankGeometry.setAttribute('position',new Float32BufferAttribute(bankVertices,3));bankGeometry.setIndex(bankIndices);bankGeometry.computeVertexNormals();
        for (const x of [-3.35, 3.35])
            {
            part(board, 'box', '#8a7765', [x, -.30, 0], [3.3,.22,7.8]);
            part(board, 'box', '#b59672', [x, -.16, 0], [3.26,.18,7.76]);
            const bank=new Mesh(bankGeometry,material('#92af73'));bank.position.set(x,-.04,0);bank.receiveShadow=true;board.add(bank);
            part(board,'box','#dcc794',[Math.sign(x)*1.79,.035,0],[.23,.075,7.65]);
        }
        const waterGeo = new PlaneGeometry(3.35, 7.8, 12, 20);
        waterGeo.rotateX(-Math.PI / 2);
        this.water = new Mesh(waterGeo, new MeshStandardMaterial({ color: '#71b9bd', flatShading: true, metalness: .1, roughness: .24 }));
        (this.water.material as MeshStandardMaterial).onBeforeCompile=shader=>{
            shader.uniforms.time={value:0};this.water.userData.shader=shader;
            shader.vertexShader='uniform float time;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n transformed.y += sin(position.x*4.0+time*1.6+position.z*2.0)*0.025;');
            shader.fragmentShader='uniform float time;\n'+shader.fragmentShader.replace('#include <dithering_fragment>','#include <dithering_fragment>\n gl_FragColor.rgb += pow(max(0.0,sin(gl_FragCoord.x*.17+time)*sin(gl_FragCoord.y*.19-time*.7)),24.0)*0.10;');
        };
        this.water.position.y = -.06;
        this.root.add(this.water);
        // Seeded placement; each repeated geometry/material is one draw call.
        let seed=7319;
        const random=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};
        const scatter=(geometry: import('three').BufferGeometry,color:string,count:number,place:(i:number,o:Object3D)=>void)=>{
            const mesh=new InstancedMesh(geometry,material(color),count),o=new Object3D();
            for(let i=0;i<count;i++){o.position.set(0,0,0);o.rotation.set(0,0,0);o.scale.set(1,1,1);place(i,o);o.updateMatrix();mesh.setMatrixAt(i,o.matrix);}
            mesh.receiveShadow=true;this.root.add(mesh);return mesh;
        };
        const edge=(o:Object3D)=>{o.position.set((random()<.5?-1:1)*(2.15+random()*2.65),.12,(random()<.5?-1:1)*(2.7+random()*.95));};
        scatter(new ConeGeometry(.06,.27,4),'#71985a',100,(_,o)=>{edge(o);o.rotation.z=(random()-.5)*.6;o.scale.y=.6+random();});
        for(const c of ['#e5b46c','#d89caa','#f5e5b9'])scatter(new SphereGeometry(.045,5,4),c,22,(_,o)=>{edge(o);o.position.y=.23;o.scale.set(1,.7,1);});
        scatter(new SphereGeometry(1,7,5),'#aaa99a',30,(_,o)=>{edge(o);o.scale.set(.05+random()*.10,.04+random()*.05,.07+random()*.08);});
        scatter(new CylinderGeometry(.018,.025,.6,5),'#81935c',36,(_,o)=>{o.position.set((iSide(_))*(1.85+random()*.12),.27,(random()<.5?-1:1)*(2.6+random()));});
        function iSide(i:number){return i%2?1:-1;}
        scatter(new CylinderGeometry(.045,.045,.15,6),'#795b40',18,(i,o)=>{o.position.set(iSide(i)*1.9,.59,(i%9/9)*1.1+2.5);});
        const trunks=new Group(), crowns=new Group();
        for(let i=0;i<6;i++){
            const x=(i<3?-1:1)*(3.05+i%3*.55),z=TREE_Z,h=.8+random()*.55;
            part(trunks,'cylinder','#90694f',[x,h*.32,z],[.085,h*.64,.085]);
            part(crowns,i%2?'cone':'sphere',i%3?'#54866b':'#75955e',[x,h+.25,z],i%2?[.25,h,.25]:[.25,h*.52,.25]);
        }bake(trunks);bake(crowns);this.root.add(trunks,crowns);
        scatter(new SphereGeometry(1,8,6),'#6c925e',8,(i,o)=>{o.position.set(iSide(i)*(BUSH_X+random()*.06),.22,BUSH_Z+random()*.12);o.scale.set(.12+random()*.04,.20,.14);});
        const details=new Group();
        for(const side of [-1,1]){
            for(let i=0;i<7;i++)part(details,'box',i%2?'#bc946a':'#c9a378',[side*1.94,.13,-.65+i*.21],[.68,.10,.18]);
            for(const z of [-.7,.7])part(details,'cylinder','#806149',[side*2.12,.05,z],[.055,.65,.055]);
            part(details,'cylinder','#826344',[side*SIGN_X,.65,2.75],[.055,1.3,.055]);
            part(details,'box','#caaa74',[side*SIGN_X,1.17,2.75],[.46,.27,.09]);
            part(details,'sphere',dark?'#ffc878':'#e5c89b',[side*SIGN_X,.94,2.85],[.10,.13,.10]);
            if(dark){const light=new PointLight('#ffbf71',1.4,2.4);light.position.set(side*SIGN_X,1,2.8);this.root.add(light);}
        }
        bake(details);this.root.add(details);
        for(const side of [-1,1])scatter(new SphereGeometry(1,6,4),'#c8e6d8',40,(i,o)=>{o.position.set(side*1.66,.005,-3.8+i*.195);o.scale.set(.055,.012,.11);});
        for(let i=0;i<2;i++){
            const bird=new Group();for(const side of [-1,1]){const wing=part(bird,'sphere','#e9ce94',[side*.1,0,0],[.13,.018,.065]);wing.rotation.z=side*.3;}
            bake(bird);bird.name='snapshot-hidden';bird.traverse(o => { o.castShadow = false; o.receiveShadow = false; o.raycast = () => {}; });this.flyers.push(bird);this.root.add(bird);
        }
        if(dark){this.fireflies=new InstancedMesh(new SphereGeometry(.025,5,4),new MeshBasicMaterial({color:'#ffe6a0'}),18);this.root.add(this.fireflies);}
        for(let i=0;i<3;i++){const r=new Mesh(new RingGeometry(.2+i*.15,.22+i*.15,20),new MeshBasicMaterial({color:'#d6efdf',transparent:true,opacity:.25,side:DoubleSide,depthWrite:false}));r.rotation.x=-Math.PI/2;r.scale.y=2;this.wake.add(r);}this.root.add(this.wake);
        this.blobs.instanceMatrix.setUsage(DynamicDrawUsage);
        this.root.add(this.blobs);
        for (const x of [-4.5, 4.5])
            part(board, 'sphere', '#a5a89b', [x, .14, ROCK_Z], [.35, .23, .3]);
        part(this.boat, 'box', '#895b3e', [0, .08, 0], [1.35, .19, 4.7]);
        for (const x of [-.73, .73]) part(this.boat, 'box', '#c38d5a', [x, .27, 0], [.13, .35, 4.9]);
        for (const z of [-2.4, 2.4]) part(this.boat, 'box', '#ad774b', [0, .24, z], [1.45, .29, .12]);
        for (const z of [-1.5, 0, 1.5]) part(this.boat, 'box', '#d4ab75', [0, .3, z], [1.4, .09, .3]);
        for (const side of [-1, 1]) {
            const oar = new Group(); oar.position.set(side * .8, .45, 0);
            part(oar, 'box', '#e0bb83', [side * .48, 0, 0], [1.3, .07, .09]);
            part(oar, 'box', '#d4ab75', [side * 1.12, 0, 0], [.5, .09, .28]);
            bake(oar); this.oars.push(oar); this.boat.add(oar);
        }
        for(let i=0;i<7;i++)part(this.boat,'box',i%2?'#a7774d':'#bb8a59',[-.55+i*.18,.19,0],[.16,.045,4.65]);
        for(const z of [-1.9,-.9,.9,1.9])for(const side of [-1,1])part(this.boat,'box','#755039',[side*.64,.3,z],[.08,.32,.09]);
        part(this.boat,'cylinder','#76543b',[.55,.8,-2.15],[.025,1,.025]);
        part(this.boat,'box','#cb7860',[.72,1.15,-2.15],[.34,.20,.025]);
        bake(this.boat);
        this.boat.userData.id = 'boat';
        this.boat.userData.pickHeight = .3;
        this.root.add(this.boat);
        this.hit.push(this.boat);

        this.sync({level,positions:Object.fromEntries(levels[level].pieces.map(p=>[p.id,0])),boat:0,aboard:[],crossings:0});
    }
    sync(s: State) {
        if (this.state?.level !== s.level) {
            for (const g of this.actors.values()) {
                g.traverse(o => { if (o instanceof Mesh && o.material instanceof MeshStandardMaterial) {o.material.dispose();if(o.geometry!==this.hitGeo)o.geometry.dispose();} });
                this.root.remove(g);
            }
            this.actors.clear();
            for (const marker of this.markers.values()) this.root.remove(marker);
            this.markers.clear();
            for (const ring of this.rings.values()) {
                this.root.remove(ring);
                ring.material.dispose();
            }
            this.rings.clear();
            this.hit = [this.boat];
            for (const p of levels[s.level].pieces) {
                const g = character(p.kind, levels[s.level].captains?.includes(p.id));
                const marker = new Group();
                part(marker, 'box', '#ff493e', [0, .15, 0], [.12, .4, .12]);
                part(marker, 'sphere', '#ff493e', [0, -.18, 0], [.08, .08, .08]);
                this.markers.set(p.id, marker); this.root.add(marker);
                g.userData.id = p.id;
                g.userData.phase = Array.from(p.id).reduce((n, c) => n + c.charCodeAt(0), 0) * .73;
                const hitbox = new Mesh(this.hitGeo, this.hitMat);
                hitbox.position.y = .55;
                g.add(hitbox);
                const ring = new Mesh(this.ringGeo, new MeshBasicMaterial({ color: '#ffe1a0', transparent: true, opacity: .9, side: DoubleSide }));
                ring.rotation.x = -Math.PI / 2;
                this.rings.set(p.id, ring);
                this.root.add(ring);
                this.actors.set(p.id, g);
                this.root.add(g);
                this.hit.push(hitbox);
            }
        }
        const previous = this.state;
        this.state = s;
        this.won = Object.values(s.positions).every(b => b === 1) && !s.failure;
        this.boat.position.x = s.boat === 0 ? -1.08 : 1.08;
        for (const bank of [0, 1]) {
            const pieces = levels[s.level].pieces;
            pieces.forEach((p, i) => {
                if (s.positions[p.id] !== bank || s.aboard.includes(p.id)) return;
                const slot = bankSlot(s.level, i, bank);
                this.targets.set(p.id, new Vector3(slot.x, .12, slot.z));
            });
        }
        const seats = boatSeats(levels[s.level].capacity);
        const occupied = new Set<number>();
        for (const id of s.aboard) {
            const actor = this.actors.get(id)!;
            let seat = actor.userData.seat as number | undefined;
            if (seat === undefined || occupied.has(seat)) seat = seats.findIndex((_, i) => !occupied.has(i));
            occupied.add(seat); actor.userData.seat = seat;
            this.targets.set(id, new Vector3(this.boat.position.x, .38, seats[seat]));
        }
        for (const [id, actor] of this.actors) if (!s.aboard.includes(id)) delete actor.userData.seat;
        for (const [id, g] of this.actors) {
            if (g.position.lengthSq() === 0) g.position.copy(this.targets.get(id)!);
            else if(previous && previous.aboard.includes(id)!==s.aboard.includes(id)) g.userData.hop={start:performance.now(),from:g.position.clone()};
        }
    }
    sail(to: State, done: () => void) { this.sailing = true; this.sailStart = performance.now(); this.sailFrom = this.boat.position.x; this.sailTo = to.boat === 0 ? -1.08 : 1.08; this.onLand = () => { this.sync(to); done(); }; }

    animate(_from: State,to: State,done:()=>void){this.sail(to,done);}
    update(t:number,dt:number,hover:string){
        const now=t*1000;
        this.oars.forEach((oar, i) => { oar.rotation.y = this.sailing ? Math.sin(t * 10) * .45 * (i ? 1 : -1) : 0; oar.rotation.z = this.sailing ? Math.cos(t * 10) * .12 : 0; });
        if (this.sailing) {
            const p = Math.min((now - this.sailStart) / 800, 1), ease = p * p * (3 - 2 * p);
            this.boat.position.x = MathUtils.lerp(this.sailFrom, this.sailTo, ease);
            this.boat.rotation.z = Math.sin(p * Math.PI * 4) * .035;
            for (const id of this.state?.aboard ?? []) {
                const target = this.targets.get(id);
                if (target)
                    target.x = this.boat.position.x;
            }
            if (p === 1) {
                this.sailing = false;
                this.boat.rotation.z = 0;
                this.onLand?.();
            }
        }
        this.boat.position.y = Math.sin(t * 2) * .025;
        this.wake.visible=this.sailing;this.wake.position.set(this.boat.position.x-(this.sailTo>this.sailFrom?.6:-.6),.025,0);
        this.wake.scale.setScalar(1+Math.sin(t*9)*.08);
        this.flyers.forEach((bird,i)=>{bird.position.set(Math.sin(t*.18+i*3)*4,2.4+Math.sin(t*.7+i)*.25,-2+Math.cos(t*.18+i*3));bird.rotation.z=Math.sin(t*8+i)*.25;});
        if(this.fireflies){const m=this.flyMatrix;for(let i=0;i<18;i++){m.makeTranslation((i%2?1:-1)*(2.1+(i%5)*.48+Math.sin(t*.4+i)*.12),.4+(i%4)*.2+Math.sin(t+i)*.1,-3+(i%7));m.scale(this.flyScale.setScalar(.6+.4*Math.sin(t*2+i)**2));this.fireflies.setMatrixAt(i,m);}this.fireflies.instanceMatrix.needsUpdate=true;}
        let blobIndex = 0;
        const blobMatrix = this.blobMatrix;
        for (const [id, g] of this.actors) {
            const target = this.targets.get(id);
            const hop=g.userData.hop;
            if (target && hop) {const p=Math.min((now-hop.start)/380,1);g.position.lerpVectors(hop.from,target,p*p*(3-2*p));g.position.y+=Math.sin(p*Math.PI)*.28;if(p===1)delete g.userData.hop;}
            else if (target) g.position.lerp(target, 1 - Math.exp(-dt * 13));
            const phase=g.userData.phase;
            const blink=(t+phase)% (3.7+(phase%2));
            g.userData.eyes.scale.y=blink<.13?.12:1;
            g.userData.moving.rotation.z=Math.sin(t*2+phase)*.045;
            g.userData.moving.rotation.y=Math.sin(t*1.6+phase)*.065;
            g.userData.tail.rotation.y=Math.sin(t*2.4+phase)*.1;
            g.rotation.y=Math.sin(t*.6+phase)*.04+(g.position.x<0?.08:-.08);
            const failed = this.state?.failure?.ids.includes(id);
            g.rotation.z = failed ? Math.sin(t * 12) * .13 : g.userData.kind==='cabbage'?Math.sin(t*1.7+phase)*.035:0;
            g.position.y += (isFinite(dt) ? Math.sin(t * 3 + id.length) * .0015 : 0);
            if (this.won)
                g.position.y = Math.max(g.position.y, (target?.y ?? 0) + Math.abs(Math.sin(t * 5 + id.length)) * .24);
            const ring = this.rings.get(id)!;
            ring.position.set(g.position.x, .14, g.position.z);
            ring.visible = !!failed || hover === id || !!this.state?.aboard.includes(id);
            ring.material.color.set(failed ? '#f35c4b' : '#ffe1a0');
            ring.material.opacity = failed ? .5 + Math.sin(t * 9) * .4 : .9;
            g.scale.setScalar(ACTOR_SCALE * (hover === id ? 1.04 : 1));
            g.traverse(o => { if (o instanceof Mesh && o.material instanceof MeshStandardMaterial) {
                // Each actor owns its materials so failure tint cannot leak to companions.
                o.material.emissive.set(failed ? '#ff2418' : '#000000');
                o.material.emissiveIntensity = failed ? .35 + (Math.sin(t * 9) + 1) * .35 : 0;
            }});
            const marker = this.markers.get(id)!;
            marker.visible = !!failed; marker.position.set(g.position.x, g.position.y + 2.6 + Math.sin(t * 4) * .1, g.position.z);
            blobMatrix.makeRotationX(-Math.PI / 2);
            blobMatrix.setPosition(g.position.x, .105, g.position.z);
            this.blobs.setMatrixAt(blobIndex++, blobMatrix);
        }
        this.blobs.count = blobIndex;
        this.blobs.instanceMatrix.needsUpdate = true;
        if(this.water.userData.shader)this.water.userData.shader.uniforms.time.value=t;

    }
    dispose(){disposeRoot(this.root);}
}
export function create(stage:Stage,level:import('./logic.ts').LevelId){return new RiverScene(stage,level,stage.themeDark);}
