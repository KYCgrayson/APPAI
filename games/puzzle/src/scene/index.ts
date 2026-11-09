import { BoxGeometry, CircleGeometry, ConeGeometry, CylinderGeometry, DirectionalLight, Fog, DoubleSide, DynamicDrawUsage, Group, HemisphereLight, InstancedMesh, MathUtils, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, PerspectiveCamera, PlaneGeometry, Raycaster, RingGeometry, SRGBColorSpace, Scene, Vector2, Vector3, WebGLRenderer } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { levels, type State } from '../logic/index.ts';
import { character, part, material } from './models.ts';
import { ACTOR_SCALE, HIT_WIDTH, bankSlot, boatSeats } from './layout.ts';
export interface Metrics {
    firstFrameMs: number;
    fps: number;
    drawCalls: number;
    triangles: number;
}
export class Diorama {
    renderer: WebGLRenderer;
    scene = new Scene();
    camera = new PerspectiveCamera(38, 1, .1, 80);
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
    private oars: Group[] = [];
    private clouds: Group[] = [];
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
        this.scene.fog = new Fog(dark ? '#44465e' : '#cbded9', 32, 65);
        for (let i = 0; i < 4; i++) {
            const cloud = new Group();
            for (let j = 0; j < 3; j++) part(cloud, 'sphere', dark ? '#858899' : '#ffffff', [(j - 1) * .65, j === 1 ? .2 : 0, 0], [.85, .4, .5]);
            cloud.position.set(i * 4 - 6, 4 + i % 2, -5 - i % 2);
            this.clouds.push(cloud); this.scene.add(cloud);
        }
        this.renderer.outputColorSpace = SRGBColorSpace;
        this.renderer.info.autoReset = true;
        this.scene.add(new HemisphereLight('#fff3dc', '#687961', 3));
        const sun = new DirectionalLight('#ffdeb0', 3);
        sun.position.set(-3, 9, 6);
        this.scene.add(sun);
        const board = new Group();
        this.scene.add(board);
        part(board, 'box', '#bca383', [0, -.47, 0], [10, .5, 8]);
        for (const x of [-3.35, 3.35])
            part(board, 'box', '#92af73', [x, -.12, 0], [3.3, .4, 7.8]);
        const waterGeo = new PlaneGeometry(3.35, 7.8, 12, 20);
        waterGeo.rotateX(-Math.PI / 2);
        this.water = new Mesh(waterGeo, new MeshStandardMaterial({ color: '#71b9bd', flatShading: true, metalness: .1, roughness: .4 }));
        this.water.position.y = -.06;
        this.scene.add(this.water);
        // Repeated scenery uses two instanced draw calls.
        const trunks = new InstancedMesh(new CylinderGeometry(.08, .1, .7, 5), material('#99704f'), 6);
        const crowns = new InstancedMesh(new ConeGeometry(.5, 1.3, 6), material('#527e62'), 6);
        const matrix = new Matrix4();
        for (let i = 0; i < 6; i++) {
            const x = (i < 3 ? -1 : 1) * (3.1 + (i % 3) * .55), z = -3.35 + (i % 3) * .18;
            matrix.makeTranslation(x, .38, z);
            trunks.setMatrixAt(i, matrix);
            matrix.makeTranslation(x, 1.25, z);
            crowns.setMatrixAt(i, matrix);
        }
        this.scene.add(trunks, crowns);
        this.blobs.instanceMatrix.setUsage(DynamicDrawUsage);
        this.scene.add(this.blobs);
        for (const x of [-4.5, 4.5])
            part(board, 'sphere', '#a5a89b', [x, .14, 1.9], [.35, .23, .3]);
        part(this.boat, 'box', '#895b3e', [0, .08, 0], [1.35, .19, 4.7]);
        for (const x of [-.73, .73]) part(this.boat, 'box', '#c38d5a', [x, .27, 0], [.13, .35, 4.9]);
        for (const z of [-2.4, 2.4]) part(this.boat, 'box', '#ad774b', [0, .24, z], [1.45, .29, .12]);
        for (const z of [-1.5, 0, 1.5]) part(this.boat, 'box', '#d4ab75', [0, .3, z], [1.4, .09, .3]);
        for (const side of [-1, 1]) {
            const oar = new Group(); oar.position.set(side * .8, .45, 0);
            part(oar, 'box', '#e0bb83', [side * .48, 0, 0], [1.3, .07, .09]);
            part(oar, 'box', '#d4ab75', [side * 1.12, 0, 0], [.5, .09, .28]);
            this.oars.push(oar); this.boat.add(oar);
        }
        this.boat.userData.id = 'boat';
        this.scene.add(this.boat);
        this.hit.push(this.boat);
        this.controls = new OrbitControls(this.camera, canvas);
        this.controls.enableDamping = true;
        this.controls.enablePan = false;
        this.controls.minPolarAngle = .48;
        this.controls.maxPolarAngle = 1.05;
        this.controls.minAzimuthAngle = -.35;
        this.controls.maxAzimuthAngle = .35;
        this.controls.minDistance = 10;
        this.controls.maxDistance = 25;
        this.controls.target.set(0, 0, 0);
        canvas.addEventListener('pointerdown', e => { this.down = { x: e.clientX, y: e.clientY }; this.dragged = false; this.activePointer = e.pointerId; });
        canvas.addEventListener('pointerup', e => { if (e.pointerId === this.activePointer && !this.dragged && Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) <= 8) {
            const id = this.intersect(e);
            if (id)
                this.pick(id);
        } });
        canvas.addEventListener('pointercancel', () => { this.activePointer = -1; this.dragged = true; });
        canvas.addEventListener('pointermove', e => { if (e.pointerId === this.activePointer && Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 8) this.dragged = true; this.hover = this.intersect(e); canvas.style.cursor = this.hover ? 'pointer' : 'grab'; });
        window.addEventListener('resize', () => this.resize());
        window.addEventListener('orientationchange', () => requestAnimationFrame(() => this.resize()));
        document.addEventListener('visibilitychange', () => { if (document.hidden)
            cancelAnimationFrame(this.raf);
        else {
            this.last = performance.now();
            this.epoch = this.last;
            this.frames = 0;
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
        this.renderer.render(this.scene, this.camera);
        const copy = document.createElement('canvas');
        copy.width = this.renderer.domElement.width; copy.height = this.renderer.domElement.height;
        copy.getContext('2d')!.drawImage(this.renderer.domElement, 0, 0);
        return copy;
    }
    resize() {
        const top = document.querySelector('.topbar')?.getBoundingClientRect().bottom ?? 0;
        const bottom = document.querySelector('.bottom')?.getBoundingClientRect().top ?? innerHeight;
        const h = Math.max(180, bottom - top), w = innerWidth;
        const viewport = `${w}:${h}:${top}`;
        if (viewport === this.viewport) return;
        this.viewport = viewport;
        const canvas = this.renderer.domElement;
        canvas.style.top = `${top}px`;
        this.renderer.setSize(w, h);
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
        this.controls.minDistance = distance * .9; this.controls.maxDistance = distance * 1.3;
        this.camera.updateProjectionMatrix(); this.controls.update();
    }
    sync(s: State) {
        if (this.state?.level !== s.level) {
            for (const g of this.actors.values()) {
                g.traverse(o => { if (o instanceof Mesh && o.material instanceof MeshStandardMaterial) o.material.dispose(); });
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
        this.state = s;
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
        for (const [id, g] of this.actors)
            if (g.position.lengthSq() === 0)
                g.position.copy(this.targets.get(id)!);
    }
    sail(to: State, done: () => void) { this.sailing = true; this.sailStart = performance.now(); this.sailFrom = this.boat.position.x; this.sailTo = to.boat === 0 ? -1.08 : 1.08; this.onLand = () => { this.sync(to); done(); }; }
    private loop = () => {
        if (document.hidden)
            return;
        this.raf = requestAnimationFrame(this.loop);
        const now = performance.now(), dt = Math.min((now - this.last) / 1000, .05);
        this.last = now;
        const t = now / 1000;
        this.controls.autoRotate = this.menu;
        this.controls.autoRotateSpeed = .35;
        this.controls.minAzimuthAngle = this.menu ? -Infinity : -.35;
        this.controls.maxAzimuthAngle = this.menu ? Infinity : .35;
        for (let i = 0; i < this.clouds.length; i++) this.clouds[i].position.x = Math.sin(t * .035 + i * 1.7) * 7;
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
        let blobIndex = 0;
        const blobMatrix = new Matrix4();
        for (const [id, g] of this.actors) {
            const target = this.targets.get(id);
            if (target)
                g.position.lerp(target, 1 - Math.exp(-dt * 13));
            const failed = this.state?.failure?.ids.includes(id);
            g.rotation.z = failed ? Math.sin(t * 12) * .13 : 0;
            g.position.y += (isFinite(dt) ? Math.sin(t * 3 + id.length) * .0015 : 0);
            if (this.state && Object.values(this.state.positions).every(b => b === 1) && !this.state.failure)
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
        const pos = this.water.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++)
            pos.setY(i, Math.sin(pos.getX(i) * 3 + t * 1.6 + pos.getZ(i) * 2) * .025);
        pos.needsUpdate = true;
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
        if (!this.metrics.firstFrameMs)
            this.metrics.firstFrameMs = performance.now();
        this.frames++;
        if (now - this.epoch >= 1000) {
            this.metrics.fps = Math.round(this.frames * 1000 / (now - this.epoch));
            this.metrics.drawCalls = this.renderer.info.render.calls;
            this.metrics.triangles = this.renderer.info.render.triangles;
            this.frames = 0;
            this.epoch = now;
        }
    };
}
