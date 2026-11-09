import { ACESFilmicToneMapping, PCFSoftShadowMap, DirectionalLight, Fog, HemisphereLight, MathUtils, Mesh, Object3D, PerspectiveCamera, Raycaster, SRGBColorSpace, Scene, Spherical, Vector2, Vector3 } from 'three';
import { Atmosphere, horizonColor } from './atmosphere.ts';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { WebGLRenderer } from 'three';
import type { PuzzleScene } from '../puzzles/types.ts';
import { disposeRoot } from './models.ts';
export interface Metrics {
    firstFrameMs: number;
    fps: number;
    drawCalls: number;
    triangles: number;
}
export class Stage {
    renderer: WebGLRenderer;
    scene = new Scene();
    camera = new PerspectiveCamera(38, 1, .1, 360);
    controls: OrbitControls;
    current?: PuzzleScene<any>;
    night: boolean;
    readonly themeDark: boolean;
    menu = true;
    private ray = new Raycaster();
    private pointer = new Vector2();
    private hover = '';
    private down = { x: 0, y: 0 };
    private dragged = false;
    private activePointer = -1;
    private pointers = new Set<number>();
    private emptyTap = { time: 0, x: 0, y: 0 };
    private atmosphere: Atmosphere;
    private sun: DirectionalLight;
    private hemi: HemisphereLight;
    private qualityChecked = false;
    private qualityStart = 0;
    private qualityFrames = 0;
    private cloudPoint = new Vector3();
    private defaultPosition = new Vector3();
    private defaultTarget = new Vector3(0, .4, 0);
    private returning = false;
    private idleOrbit = true;
    private returnOrbit = new Spherical();
    private defaultOrbit = new Spherical();
    private viewport = '';
    private last = 0;
    private frames = 0;
    private epoch = performance.now();
    private raf = 0;
    metrics: Metrics = { firstFrameMs: 0, fps: 0, drawCalls: 0, triangles: 0 };
    private pick: (id: string) => void;
    constructor(canvas: HTMLCanvasElement, dark: boolean, pick: (id: string) => void) {
        this.pick = pick;
        this.night = dark;
        this.themeDark = dark;
        this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
        this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        this.renderer.setClearColor('#000000', 0);
        this.scene.fog = new Fog(horizonColor(dark), 70, 260);
        this.atmosphere = new Atmosphere(dark);
        this.scene.add(this.atmosphere);
        this.renderer.outputColorSpace = SRGBColorSpace;
        this.renderer.toneMapping = ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = dark ? .85 : 1.1;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = PCFSoftShadowMap;
        this.renderer.info.autoReset = true;
        this.scene.add(this.hemi = new HemisphereLight(dark ? '#a5afd7' : '#d9e9f5', dark ? '#716675' : '#a79b7b', dark ? 1.4 : 2));
        const sun = this.sun = new DirectionalLight(dark ? '#d6b4ce' : '#ffdeb0', dark ? 1.8 : 3);
        sun.castShadow = true;
        sun.shadow.mapSize.set(512, 512);
        Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 5, bottom: -5, near: 1, far: 20 });
        sun.shadow.bias = -.001;
        sun.shadow.normalBias = .025;
        sun.position.set(-3, 9, 6);
        this.scene.add(sun);
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
        canvas.addEventListener('pointerdown', e => { this.pointers.add(e.pointerId); if (this.pointers.size > 1) {
            this.dragged = true;
            this.emptyTap.time = 0;
            return;
        } this.down = { x: e.clientX, y: e.clientY }; this.dragged = false; this.activePointer = e.pointerId; });
        canvas.addEventListener('pointerup', e => {
            if (e.pointerId === this.activePointer && !this.dragged && Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) <= 8) {
                const id = this.intersect(e);
                if (id) {
                    this.emptyTap.time = 0;
                    this.pick(id);
                }
                else {
                    const now = performance.now();
                    if (this.emptyTap.time > 0 && now - this.emptyTap.time < 350 && Math.hypot(e.clientX - this.emptyTap.x, e.clientY - this.emptyTap.y) < 24) {
                        this.resetView(true);
                        this.emptyTap.time = 0;
                    }
                    else
                        this.emptyTap = { time: now, x: e.clientX, y: e.clientY };
                }
            }
            this.pointers.delete(e.pointerId);
            if (!this.pointers.size)
                this.activePointer = -1;
        });
        canvas.addEventListener('pointercancel', e => { this.pointers.delete(e.pointerId); this.activePointer = -1; this.dragged = true; this.emptyTap.time = 0; });
        canvas.addEventListener('pointermove', e => { if (e.pointerId === this.activePointer && Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 8) {
            this.dragged = true;
            this.emptyTap.time = 0;
        } this.hover = this.intersect(e); canvas.style.cursor = this.hover ? 'pointer' : 'grab'; });
        window.addEventListener('resize', () => this.resize());
        window.addEventListener('orientationchange', () => requestAnimationFrame(() => this.resize()));
        document.addEventListener('visibilitychange', () => {
            if (document.hidden)
                cancelAnimationFrame(this.raf);
            else {
                this.last = performance.now();
                this.epoch = this.last;
                this.frames = 0;
                this.qualityStart = 0;
                this.qualityFrames = 0;
                this.loop();
            }
        });
        this.resize();
        this.loop();
    }
    mount(scene: PuzzleScene<any>, night: boolean) {
        if (this.current) {
            this.scene.remove(this.current.root);
            this.current.dispose();
        }
        this.current = scene;
        this.scene.add(scene.root);
        if (this.night !== night) {
            this.night = night;
            this.scene.remove(this.atmosphere);
            disposeRoot(this.atmosphere);
            this.atmosphere = new Atmosphere(night);
            this.scene.add(this.atmosphere);
            this.scene.fog = new Fog(horizonColor(night), 70, 260);
            this.hemi.color.set(night ? '#a5afd7' : '#d9e9f5');
            this.hemi.groundColor.set(night ? '#716675' : '#a79b7b');
            this.hemi.intensity = night ? 1.4 : 2;
            this.sun.color.set(night ? '#d6b4ce' : '#ffdeb0');
            this.sun.intensity = night ? 1.8 : 3;
            this.renderer.toneMappingExposure = night ? .85 : 1.1;
        }
        this.renderer.toneMappingExposure = night ? .85 : 1.1;
        this.idleOrbit = true;
        this.viewport = '';
        this.resetView();
        this.idleOrbit = true;
    }
    private intersect(e: PointerEvent) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1);
        this.scene.updateMatrixWorld(true);
        this.ray.setFromCamera(this.pointer, this.camera);
        const candidates = new Map<string, number>();
        for (const hit of this.ray.intersectObjects(this.current?.hit ?? [], true)) {
            let o: Object3D | null = hit.object;
            while (o && !o.userData.id)
                o = o.parent;
            if (!o)
                continue;
            const center = o.localToWorld(new Vector3(0, o.userData.pickHeight ?? .6, 0)).project(this.camera);
            const distance = Math.hypot((center.x - this.pointer.x) * rect.width, (center.y - this.pointer.y) * rect.height);
            candidates.set(String(o.userData.id), distance);
        }
        const pieces = [...candidates].filter(([id]) => !this.current?.secondaryIds?.includes(id));
        return (pieces.length ? pieces : [...candidates]).sort((a, b) => a[1] - b[1])[0]?.[0] ?? '';
    }
    snapshot(): HTMLCanvasElement {
        // Capture only the diorama, regardless of menu state or orbit angle.
        const atmosphere = [this.atmosphere, ...(this.current?.root.getObjectsByProperty('name', 'snapshot-hidden') ?? [])];
        const visibility = atmosphere.map(o => o.visible);
        try {
            atmosphere.forEach(o => { o.visible = false; });
            this.renderer.render(this.scene, this.camera);
            const copy = document.createElement('canvas');
            copy.width = this.renderer.domElement.width;
            copy.height = this.renderer.domElement.height;
            copy.getContext('2d')!.drawImage(this.renderer.domElement, 0, 0);
            return copy;
        }
        finally {
            atmosphere.forEach((o, i) => { o.visible = visibility[i]; });
            this.renderer.render(this.scene, this.camera);
        }
    }
    startIdleOrbit() { this.idleOrbit = true; }
    resetView(animate = false) {
        const position = this.camera.position.clone(), target = this.controls.target.clone();
        this.controls.autoRotate = false;
        this.idleOrbit = false;
        this.returning = false;
        this.controls.enableDamping = false;
        this.controls.update();
        this.controls.enableDamping = true;
        this.viewport = '';
        this.resize();
        this.controls.reset(); // Clear residual damping and zoom momentum.
        this.camera.zoom = 1;
        this.camera.position.copy(this.defaultPosition);
        this.controls.target.copy(this.defaultTarget);
        this.controls.update();
        if (animate) {
            this.camera.position.copy(position);
            this.controls.target.copy(target);
            this.returning = true;
        }
    }
    resize() {
        const top = document.querySelector('.topbar')?.getBoundingClientRect().bottom ?? 0;
        const bottom = document.querySelector('.bottom')?.getBoundingClientRect().top ?? innerHeight;
        const h = Math.max(180, bottom - top), w = innerWidth;
        const viewport = `${w}:${h}:${top}`;
        if (viewport === this.viewport)
            return;
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
        for (const x of [-(this.current?.bounds.x ?? 5), this.current?.bounds.x ?? 5])
            for (const z of [-(this.current?.bounds.z ?? 4), this.current?.bounds.z ?? 4])
                for (const y of (this.current?.bounds.y ?? [-.7, 2.3])) {
                    const depth = y * Math.sin(elevation) + z * Math.cos(elevation);
                    const up = y * Math.cos(elevation) - z * Math.sin(elevation);
                    distance = Math.max(distance, depth + Math.abs(x) / (Math.tan(vertical) * this.camera.aspect * widthFraction), depth + Math.abs(up) / (Math.tan(vertical) * heightFraction));
                }
        this.controls.target.set(0, .4, 0);
        this.camera.position.set(0, .4 + distance * Math.sin(elevation), distance * Math.cos(elevation));
        this.controls.minDistance = distance * .6;
        this.controls.maxDistance = distance * 1.6;
        this.defaultPosition.copy(this.camera.position);
        this.defaultOrbit.setFromVector3(this.camera.position.clone().sub(this.defaultTarget));
        this.camera.updateProjectionMatrix();
        this.controls.update();
        this.controls.saveState();
    }
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
        this.current?.update(t, dt, this.hover);
        if (this.returning) {
            const a = 1 - Math.exp(-dt * 8);
            this.returnOrbit.setFromVector3(this.cloudPoint.copy(this.camera.position).sub(this.controls.target));
            const turn = Math.atan2(Math.sin(this.defaultOrbit.theta - this.returnOrbit.theta), Math.cos(this.defaultOrbit.theta - this.returnOrbit.theta));
            this.returnOrbit.theta += turn * a;
            this.returnOrbit.phi = MathUtils.lerp(this.returnOrbit.phi, this.defaultOrbit.phi, a);
            this.returnOrbit.radius = MathUtils.lerp(this.returnOrbit.radius, this.defaultOrbit.radius, a);
            this.controls.target.lerp(this.defaultTarget, a);
            this.camera.position.setFromSpherical(this.returnOrbit).add(this.controls.target);
            if (this.camera.position.distanceToSquared(this.defaultPosition) < .00001) {
                this.camera.position.copy(this.defaultPosition);
                this.controls.target.copy(this.defaultTarget);
                this.returning = false;
            }
        }
        this.controls.update();
        this.camera.updateMatrixWorld();
        this.atmosphere.update(this.camera, dt, innerWidth / innerHeight);
        this.renderer.render(this.scene, this.camera);
        if (!this.metrics.firstFrameMs && this.current)
            this.metrics.firstFrameMs = performance.now();
        this.frames++;
        if (!this.qualityStart) {
            this.qualityStart = performance.now();
            this.qualityFrames = 0;
        }
        else
            this.qualityFrames++;
        if (!this.qualityChecked && now - this.qualityStart >= 2000) {
            this.qualityChecked = true;
            if (this.qualityFrames * 1000 / (now - this.qualityStart) < 45) {
                this.atmosphere.lowerQuality();
                this.sun.castShadow = false;
                this.renderer.shadowMap.enabled = false;
                this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
                this.viewport = '';
                this.resize();
            }
        }
        if (now - this.epoch >= 1000) {
            this.metrics.fps = Math.round(this.frames * 1000 / (now - this.epoch));
            this.metrics.drawCalls = this.renderer.info.render.calls;
            this.metrics.triangles = this.renderer.info.render.triangles;
            this.frames = 0;
            this.epoch = now;
        }
    };
}
