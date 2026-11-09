import { ACESFilmicToneMapping, PCFSoftShadowMap, BufferGeometry, Float32BufferAttribute, SphereGeometry, PointLight, BoxGeometry, CircleGeometry, ConeGeometry, CylinderGeometry, DirectionalLight, Fog, DoubleSide, DynamicDrawUsage, Group, HemisphereLight, InstancedMesh, MathUtils, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, PerspectiveCamera, PlaneGeometry, Raycaster, RingGeometry, SRGBColorSpace, Scene, Spherical, Vector2, Vector3, WebGLRenderer } from 'three';
import { Atmosphere, horizonColor } from './atmosphere.ts';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { levels, type State } from '../logic/index.ts';
import { character, part, material, bake } from './models.ts';
import { ACTOR_SCALE, HIT_WIDTH, bankSlot, boatSeats, TREE_Z, BUSH_X, BUSH_Z, SIGN_X, ROCK_Z } from './layout.ts';
export interface Metrics {
    firstFrameMs: number;
    fps: number;
    drawCalls: number;
    triangles: number;
}
export class Diorama {
    renderer: WebGLRenderer;
    scene = new Scene();
    camera = new PerspectiveCamera(38, 1, .1, 360);
    controls: OrbitControls;
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
    private ray = new Raycaster();
    private pointer = new Vector2();
    private hover = '';
    private down = { x: 0, y: 0 };
    private dragged = false;
    private activePointer = -1;
    private pointers = new Set<number>();
    private oars: Group[] = [];
    private atmosphere: Atmosphere;
    private flyers: Group[] = [];
    private fireflies?: InstancedMesh;
    private wake = new Group();
    private qualityChecked = false;
    private qualityStart = 0;
    private sun!: DirectionalLight;
    private blobMatrix = new Matrix4();
    private flyMatrix = new Matrix4();
    private flyScale = new Vector3();
    private cloudPoint = new Vector3();
    private defaultPosition = new Vector3();
    private defaultTarget = new Vector3(0, .4, 0);
    private returning = false;
    private idleOrbit = true;
    private returnOrbit = new Spherical();
    private defaultOrbit = new Spherical();
    private won = false;
    private emptyTap = { time: 0, x: 0, y: 0 };
    private qualityFrames = 0;
    private markers = new Map<string, Group>();
    menu = true;
    private viewport = '';
    private last = 0;
    private frames = 0;
    private epoch = performance.now();
    private raf = 0;
    metrics: Metrics = { firstFrameMs: 0, fps: 0, drawCalls: 0, triangles: 0 };
    constructor(canvas: HTMLCanvasElement, dark: boolean, private pick: (id: string) => void) {
        this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
        this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        this.renderer.setClearColor('#000000', 0);
        this.scene.fog = new Fog(horizonColor(dark), 70, 260);
        this.atmosphere = new Atmosphere(dark);
        this.scene.add(this.atmosphere);
        this.renderer.outputColorSpace = SRGBColorSpace;
        this.renderer.toneMapping = ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = dark ? .85 : 1.1;
        this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = PCFSoftShadowMap;
        this.renderer.info.autoReset = true;
        this.scene.add(new HemisphereLight(dark ? '#a5afd7' : '#d9e9f5', dark ? '#716675' : '#a79b7b', dark ? 1.4 : 2));
        const sun = this.sun = new DirectionalLight(dark ? '#d6b4ce' : '#ffdeb0', dark ? 1.8 : 3);
        sun.castShadow = true; sun.shadow.mapSize.set(512,512);
        Object.assign(sun.shadow.camera, {left:-6,right:6,top:5,bottom:-5,near:1,far:20}); sun.shadow.bias=-.001; sun.shadow.normalBias=.025;
        sun.position.set(-3, 9, 6);
        this.scene.add(sun);
        const board = new Group();
        this.scene.add(board);
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
        this.scene.add(this.water);
        // Seeded placement; each repeated geometry/material is one draw call.
        let seed=7319;
        const random=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};
        const scatter=(geometry: import('three').BufferGeometry,color:string,count:number,place:(i:number,o:Object3D)=>void)=>{
            const mesh=new InstancedMesh(geometry,material(color),count),o=new Object3D();
            for(let i=0;i<count;i++){o.position.set(0,0,0);o.rotation.set(0,0,0);o.scale.set(1,1,1);place(i,o);o.updateMatrix();mesh.setMatrixAt(i,o.matrix);}
            mesh.receiveShadow=true;this.scene.add(mesh);return mesh;
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
        }bake(trunks);bake(crowns);this.scene.add(trunks,crowns);
        scatter(new SphereGeometry(1,8,6),'#6c925e',8,(i,o)=>{o.position.set(iSide(i)*(BUSH_X+random()*.06),.22,BUSH_Z+random()*.12);o.scale.set(.12+random()*.04,.20,.14);});
        const details=new Group();
        for(const side of [-1,1]){
            for(let i=0;i<7;i++)part(details,'box',i%2?'#bc946a':'#c9a378',[side*1.94,.13,-.65+i*.21],[.68,.10,.18]);
            for(const z of [-.7,.7])part(details,'cylinder','#806149',[side*2.12,.05,z],[.055,.65,.055]);
            part(details,'cylinder','#826344',[side*SIGN_X,.65,2.75],[.055,1.3,.055]);
            part(details,'box','#caaa74',[side*SIGN_X,1.17,2.75],[.46,.27,.09]);
            part(details,'sphere',dark?'#ffc878':'#e5c89b',[side*SIGN_X,.94,2.85],[.10,.13,.10]);
            if(dark){const light=new PointLight('#ffbf71',1.4,2.4);light.position.set(side*SIGN_X,1,2.8);this.scene.add(light);}
        }
        bake(details);this.scene.add(details);
        for(const side of [-1,1])scatter(new SphereGeometry(1,6,4),'#c8e6d8',40,(i,o)=>{o.position.set(side*1.66,.005,-3.8+i*.195);o.scale.set(.055,.012,.11);});
        for(let i=0;i<2;i++){
            const bird=new Group();for(const side of [-1,1]){const wing=part(bird,'sphere','#e9ce94',[side*.1,0,0],[.13,.018,.065]);wing.rotation.z=side*.3;}
            bake(bird);bird.traverse(o => { o.castShadow = false; o.receiveShadow = false; o.raycast = () => {}; });this.flyers.push(bird);this.scene.add(bird);
        }
        if(dark){this.fireflies=new InstancedMesh(new SphereGeometry(.025,5,4),new MeshBasicMaterial({color:'#ffe6a0'}),18);this.scene.add(this.fireflies);}
        for(let i=0;i<3;i++){const r=new Mesh(new RingGeometry(.2+i*.15,.22+i*.15,20),new MeshBasicMaterial({color:'#d6efdf',transparent:true,opacity:.25,side:DoubleSide,depthWrite:false}));r.rotation.x=-Math.PI/2;r.scale.y=2;this.wake.add(r);}this.scene.add(this.wake);
        this.blobs.instanceMatrix.setUsage(DynamicDrawUsage);
        this.scene.add(this.blobs);
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
        this.scene.add(this.boat);
        this.hit.push(this.boat);
        this.controls = new OrbitControls(this.camera, canvas);
        this.controls.enableDamping = true;
        this.controls.enablePan = false;
        this.controls.minPolarAngle = .15;
        this.controls.maxPolarAngle = 1.30;
        this.controls.minAzimuthAngle = -Infinity;
        this.controls.maxAzimuthAngle = Infinity;
        this.controls.enableZoom = true;
        this.controls.addEventListener('start', () => { this.returning = false; });
        this.controls.minDistance = 10;
        this.controls.maxDistance = 25;
        this.controls.target.set(0, 0, 0);
        canvas.addEventListener('pointerdown', e => { this.pointers.add(e.pointerId); if (this.pointers.size > 1) { this.dragged = true; this.emptyTap.time = 0; return; } this.down = { x: e.clientX, y: e.clientY }; this.dragged = false; this.activePointer = e.pointerId; });
        canvas.addEventListener('pointerup', e => { if (e.pointerId === this.activePointer && !this.dragged && Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) <= 8) {
            const id = this.intersect(e);
            if (id) { this.emptyTap.time = 0; this.pick(id); }
            else {
                const now = performance.now();
                if (this.emptyTap.time > 0 && now - this.emptyTap.time < 350 && Math.hypot(e.clientX - this.emptyTap.x, e.clientY - this.emptyTap.y) < 24) { this.resetView(true); this.emptyTap.time = 0; }
                else this.emptyTap = { time: now, x: e.clientX, y: e.clientY };
            }
        } this.pointers.delete(e.pointerId); if (!this.pointers.size) this.activePointer = -1; });
        canvas.addEventListener('pointercancel', e => { this.pointers.delete(e.pointerId); this.activePointer = -1; this.dragged = true; this.emptyTap.time = 0; });
        canvas.addEventListener('pointermove', e => { if (e.pointerId === this.activePointer && Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 8) { this.dragged = true; this.emptyTap.time = 0; } this.hover = this.intersect(e); canvas.style.cursor = this.hover ? 'pointer' : 'grab'; });
        window.addEventListener('resize', () => this.resize());
        window.addEventListener('orientationchange', () => requestAnimationFrame(() => this.resize()));
        document.addEventListener('visibilitychange', () => { if (document.hidden)
            cancelAnimationFrame(this.raf);
        else {
            this.last = performance.now();
            this.epoch = this.last;
            this.frames = 0;
            this.qualityStart = 0; this.qualityFrames = 0;
            this.loop();
        } });
        this.resize();
        this.loop();
    }
    private intersect(e: PointerEvent) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1);
        this.scene.updateMatrixWorld(true);
        this.ray.setFromCamera(this.pointer, this.camera);
        const candidates = new Map<string, number>();
        for (const hit of this.ray.intersectObjects(this.hit, true)) {
            let o: Object3D | null = hit.object;
            while (o && !o.userData.id) o = o.parent;
            if (!o) continue;
            const center = o.localToWorld(new Vector3(0, o === this.boat ? .3 : .6, 0)).project(this.camera);
            const distance = Math.hypot((center.x - this.pointer.x) * rect.width, (center.y - this.pointer.y) * rect.height);
            candidates.set(String(o.userData.id), distance);
        }
        const pieces = [...candidates].filter(([id]) => id !== 'boat');
        return (pieces.length ? pieces : [...candidates]).sort((a, b) => a[1] - b[1])[0]?.[0] ?? '';
    }
    snapshot(): HTMLCanvasElement {
        // Capture only the diorama, regardless of menu state or orbit angle.
        const atmosphere = [this.atmosphere, ...this.flyers];
        const visibility = atmosphere.map(o => o.visible);
        try {
            atmosphere.forEach(o => { o.visible = false; });
            this.renderer.render(this.scene, this.camera);
            const copy = document.createElement('canvas');
            copy.width = this.renderer.domElement.width; copy.height = this.renderer.domElement.height;
            copy.getContext('2d')!.drawImage(this.renderer.domElement, 0, 0);
            return copy;
        } finally {
            atmosphere.forEach((o, i) => { o.visible = visibility[i]; });
            this.renderer.render(this.scene, this.camera);
        }
    }

    resetView(animate = false) {
        const position = this.camera.position.clone(), target = this.controls.target.clone();
        this.controls.autoRotate = false;
        this.idleOrbit = false;
        this.returning = false;
        this.controls.enableDamping = false; this.controls.update();
        this.controls.enableDamping = true;
        this.viewport = '';
        this.resize();
        this.controls.reset(); // Clear residual damping and zoom momentum.
        this.camera.zoom = 1;
        this.camera.position.copy(this.defaultPosition);
        this.controls.target.copy(this.defaultTarget);
        this.controls.update();
        if (animate) { this.camera.position.copy(position); this.controls.target.copy(target); this.returning = true; }
    }
    resize() {
        const top = document.querySelector('.topbar')?.getBoundingClientRect().bottom ?? 0;
        const bottom = document.querySelector('.bottom')?.getBoundingClientRect().top ?? innerHeight;
        const h = Math.max(180, bottom - top), w = innerWidth;
        const viewport = `${w}:${h}:${top}`;
        if (viewport === this.viewport) return;
        this.viewport = viewport;
        const canvas = this.renderer.domElement;
        canvas.style.top = '0px';
        this.renderer.setSize(w, innerHeight);
        this.camera.setViewOffset(w, h, 0, -top, w, innerHeight);
        this.camera.aspect = w / h;
        const elevation = 43 * Math.PI / 180;
        const vertical = this.camera.fov * Math.PI / 360;
        // Fit the board's projected corners, including perspective depth and actor height.
        const portrait = innerWidth < innerHeight;
        const widthFraction = portrait ? .92 : .94, heightFraction = portrait ? .94 : .70;
        let distance = 0;
        for (const x of [-5, 5]) for (const z of [-4, 4]) for (const y of [-.7, 2.3]) {
            const depth = y * Math.sin(elevation) + z * Math.cos(elevation);
            const up = y * Math.cos(elevation) - z * Math.sin(elevation);
            distance = Math.max(distance, depth + Math.abs(x) / (Math.tan(vertical) * this.camera.aspect * widthFraction), depth + Math.abs(up) / (Math.tan(vertical) * heightFraction));
        }
        this.controls.target.set(0, .4, 0);
        this.camera.position.set(0, .4 + distance * Math.sin(elevation), distance * Math.cos(elevation));
        this.controls.minDistance = distance * .6; this.controls.maxDistance = distance * 1.6;
        this.defaultPosition.copy(this.camera.position);
        this.defaultOrbit.setFromVector3(this.camera.position.clone().sub(this.defaultTarget));
        this.camera.updateProjectionMatrix(); this.controls.update(); this.controls.saveState();
    }
    sync(s: State) {
        if (this.state?.level !== s.level) {
            for (const g of this.actors.values()) {
                g.traverse(o => { if (o instanceof Mesh && o.material instanceof MeshStandardMaterial) {o.material.dispose();if(o.geometry!==this.hitGeo)o.geometry.dispose();} });
                this.scene.remove(g);
            }
            this.actors.clear();
            for (const marker of this.markers.values()) this.scene.remove(marker);
            this.markers.clear();
            for (const ring of this.rings.values()) {
                this.scene.remove(ring);
                ring.material.dispose();
            }
            this.rings.clear();
            this.hit = [this.boat];
            for (const p of levels[s.level].pieces) {
                const g = character(p.kind, levels[s.level].captains?.includes(p.id));
                const marker = new Group();
                part(marker, 'box', '#ff493e', [0, .15, 0], [.12, .4, .12]);
                part(marker, 'sphere', '#ff493e', [0, -.18, 0], [.08, .08, .08]);
                this.markers.set(p.id, marker); this.scene.add(marker);
                g.userData.id = p.id;
                g.userData.phase = Array.from(p.id).reduce((n, c) => n + c.charCodeAt(0), 0) * .73;
                const hitbox = new Mesh(this.hitGeo, this.hitMat);
                hitbox.position.y = .55;
                g.add(hitbox);
                const ring = new Mesh(this.ringGeo, new MeshBasicMaterial({ color: '#ffe1a0', transparent: true, opacity: .9, side: DoubleSide }));
                ring.rotation.x = -Math.PI / 2;
                this.rings.set(p.id, ring);
                this.scene.add(ring);
                this.actors.set(p.id, g);
                this.scene.add(g);
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
    private loop = () => {
        if (document.hidden)
            return;
        this.raf = requestAnimationFrame(this.loop);
        const now = performance.now(), dt = Math.min((now - this.last) / 1000, .05);
        this.last = now;
        const t = now / 1000;
        this.controls.autoRotate = this.menu && this.idleOrbit && !this.returning;
        this.controls.autoRotateSpeed = .35;
        this.controls.minAzimuthAngle = -Infinity;
        this.controls.maxAzimuthAngle = Infinity;
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
            ring.visible = !!failed || this.hover === id || !!this.state?.aboard.includes(id);
            ring.material.color.set(failed ? '#f35c4b' : '#ffe1a0');
            ring.material.opacity = failed ? .5 + Math.sin(t * 9) * .4 : .9;
            g.scale.setScalar(ACTOR_SCALE * (this.hover === id ? 1.04 : 1));
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
        if (this.returning) {
            const a = 1 - Math.exp(-dt * 8);
            this.returnOrbit.setFromVector3(this.cloudPoint.copy(this.camera.position).sub(this.controls.target));
            const turn = Math.atan2(Math.sin(this.defaultOrbit.theta-this.returnOrbit.theta), Math.cos(this.defaultOrbit.theta-this.returnOrbit.theta));
            this.returnOrbit.theta += turn*a;
            this.returnOrbit.phi = MathUtils.lerp(this.returnOrbit.phi,this.defaultOrbit.phi,a);
            this.returnOrbit.radius = MathUtils.lerp(this.returnOrbit.radius,this.defaultOrbit.radius,a);
            this.controls.target.lerp(this.defaultTarget, a);
            this.camera.position.setFromSpherical(this.returnOrbit).add(this.controls.target);
            if (this.camera.position.distanceToSquared(this.defaultPosition) < .00001) { this.camera.position.copy(this.defaultPosition); this.controls.target.copy(this.defaultTarget); this.returning = false; }
        }
        this.controls.update();
        this.camera.updateMatrixWorld();
        this.atmosphere.update(this.camera, dt, innerWidth / innerHeight);
        this.renderer.render(this.scene, this.camera);
        if (!this.metrics.firstFrameMs)
            this.metrics.firstFrameMs = performance.now();
        this.frames++;
        if (!this.qualityStart) { this.qualityStart = performance.now(); this.qualityFrames = 0; }
        else this.qualityFrames++;
        if(!this.qualityChecked && now-this.qualityStart>=2000){this.qualityChecked=true;if(this.qualityFrames*1000/(now-this.qualityStart)<45){this.atmosphere.lowerQuality();this.sun.castShadow=false;this.renderer.shadowMap.enabled=false;this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));this.viewport='';this.resize();}}

        if (now - this.epoch >= 1000) {
            this.metrics.fps = Math.round(this.frames * 1000 / (now - this.epoch));
            this.metrics.drawCalls = this.renderer.info.render.calls;
            this.metrics.triangles = this.renderer.info.render.triangles;
            this.frames = 0;
            this.epoch = now;
        }
    };
}
