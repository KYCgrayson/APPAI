import { Group, Mesh, MeshStandardMaterial, MeshBasicMaterial, CylinderGeometry, TorusGeometry, CircleGeometry, DoubleSide, InstancedMesh, SphereGeometry, Object3D, Vector3, MathUtils } from 'three';
import type { Stage } from '../../scene/stage.ts';
import type { LevelId, PuzzleScene } from '../types.ts';
import { initial, isWin, type State } from './logic.ts';
import { part, bake, disposeRoot } from '../../scene/models.ts';
import { badge, rod } from '../../scene/helpers.ts';
interface Jug {
    root: Group;
    water: Mesh;
    surface: Mesh;
    ring: Mesh;
    label: Object3D;
    height: number;
    radius: number;
    home: Vector3;
}
class WaterScene implements PuzzleScene<State> {
    root = new Group();
    hit: Object3D[] = [];
    secondaryIds = ['pump', 'flowers'];
    bounds = { x: 4.2, y: [-1, 2.5] as [
            number,
            number
        ], z: 2.95 };
    busy = false;
    private state: State;
    private jugs: Jug[] = [];
    private stream: Mesh;
    private pumpHandle = new Group();
    private flowers: InstancedMesh;
    private matrix = new Object3D();
    private butterfly = new Group();
    private sparkles: InstancedMesh;
    private watered = 0;
    private animation?: {
        from: State;
        to: State;
        start: number;
        duration: number;
        done: () => void;
        kind: 'pour' | 'fill' | 'empty';
        source: number;
        target: number;
    };
    constructor(_stage: Stage, level: LevelId) {
        this.state = initial(level);
        this.bounds.y[1] = level === 'hard' ? 2.5 : 2.4;
        const table = new Group();
        part(table, 'box', '#ae865e', [0, -.20, 0], [8.4, .4, 5.9]);
        for (const x of [-3.5, 3.5])
            for (const z of [-2.2, 2.2])
                part(table, 'box', '#8d6d51', [x, -.65, z], [.35, .65, .35]);
        for (let i = 0; i < 9; i++)
            part(table, 'box', i % 2 ? '#c5a075' : '#bb9569', [-3.73 + i * .93, 0, 0], [.91, .08, 5.8]);
        part(table, 'box', '#e7d7af', [0, .07, 0], [7.5, .04, 2.6]);
        for (const z of [-1.2, 1.2])
            part(table, 'box', '#92a48c', [0, .095, z], [7.5, .015, .08]);
        for (let i = 0; i < 3; i++) {
            const x = -3.4 + i * 1.1;
            part(table, 'cone', '#a97855', [x, .3, -2.2], [.27, .42, .27]);
            for (let j = 0; j < 4; j++)
                part(table, 'sphere', '#6f9262', [x + Math.sin(j * 2.3) * .18, .62 + j * .08, -2.2 + Math.cos(j * 2.3) * .15], [.1, .25, .08]);
        }
        if (this.state.taps) {
            part(table, 'cylinder', '#b5b4a0', [2.45, .23, -2], [.73, .3, .58]);
            part(table, 'cylinder', '#6f8b89', [2.45, .40, -2], [.56, .06, .42]);
        }
        else {
            for (let i = 0; i < 12; i++) {
                const a = i * Math.PI / 6;
                const stone = part(table, 'box', i % 2 ? '#939e94' : '#b8b7a1', [2.45 + Math.sin(a) * .65, .38, -2.05 + Math.cos(a) * .65], [.35, .55, .35]);
                stone.rotation.y = a;
            }
            part(table, 'cylinder', '#648a8b', [2.45, .14, -2.05], [.54, .025, .54]);
            for (const x of [1.6, 3.3])
                part(table, 'cylinder', '#806e51', [x, 1, -2.05], [.05, 1.4, .05]);
            rod(table, '#806e51', [1.6, 1.7, -2.05], [3.3, 1.7, -2.05], .06);
        }
        part(table, 'box', '#8d7052', [0, .13, 2.35], [7.5, .25, .85]);
        part(table, 'box', '#605b44', [0, .28, 2.35], [7.25, .12, .65]);
        for (let i = 0; i < 24; i++) {
            const h = .12 + (i % 3) * .09;
            part(table, 'cylinder', '#7d985e', [-3.35 + i % 12 * .61, .34 + h / 2, 2.2 + Math.floor(i / 12) * .3], [.025, h, .025]);
        }
        bake(table);
        this.root.add(table);
        const bed = new Mesh(new BoxGeometryCompat(7.5, .65, .9), new MeshBasicMaterial({ visible: false }));
        bed.position.set(0, .4, 2.35);
        bed.userData.id = 'flowers';
        if (this.state.taps)
            this.hit.push(bed);
        this.root.add(bed);
        this.flowers = new InstancedMesh(new SphereGeometry(.13, 6, 4), new MeshStandardMaterial({ color: '#e5b783' }), 24);
        this.root.add(this.flowers);
        if (this.state.taps) {
            const pump = new Group();
            part(pump, 'cylinder', '#ae965b', [0, .55, 0], [.16, 1.1, .16]);
            part(pump, 'sphere', '#c1ad6c', [0, 1.08, 0], [.23, .20, .23]);
            rod(pump, '#ae965b', [0, 1.1, 0], [.5, 1.1, 0], .08);
            rod(pump, '#ae965b', [.5, 1.1, 0], [.5, .86, 0], .08);
            bake(pump);
            pump.position.set(2, .45, -2);
            pump.userData.id = 'pump';
            this.root.add(pump);
            this.hit.push(pump);
            rod(this.pumpHandle, '#7b7551', [0, 0, 0], [-.6, .2, 0], .045);
            bake(this.pumpHandle);
            this.pumpHandle.position.set(2, 1.6, -2);
            this.root.add(this.pumpHandle);
        }
        const glass = new MeshStandardMaterial({ color: '#bfe0db', transparent: true, opacity: .23, roughness: .16, metalness: .05, side: DoubleSide, depthWrite: false });
        const waterMat = new MeshStandardMaterial({ color: '#58afc2', transparent: true, opacity: .8, roughness: .23 });
        this.state.caps.forEach((cap, i) => {
            const root = new Group(), height = .9 + Math.sqrt(cap) * .20, radius = .60 + Math.sqrt(cap) * .045;
            const shell = new Mesh(new CylinderGeometry(radius, radius * .88, height, 20, 1, true), glass);
            shell.position.y = height / 2;
            root.add(shell);
            const bottom = new Mesh(new CylinderGeometry(radius * .88, radius * .88, .05, 20), glass);
            bottom.position.y = .025;
            root.add(bottom);
            const handle = new Mesh(new TorusGeometry(radius * .6, .055, 6, 16, Math.PI * 1.7), glass);
            handle.position.set(radius + .12, height * .58, 0);
            handle.rotation.z = -Math.PI * .85;
            root.add(handle);
            const rim = new Mesh(new TorusGeometry(radius, .035, 5, 20), new MeshStandardMaterial({ color: '#d4e4d2', roughness: .3 }));
            rim.position.y = height;
            rim.rotation.x = Math.PI / 2;
            root.add(rim);
            const water = new Mesh(new CylinderGeometry(radius * .92, radius * .81, 1, 20), waterMat);
            root.add(water);
            const surface = new Mesh(new CircleGeometry(radius * .92, 20), new MeshStandardMaterial({ color: '#9cdeea', transparent: true, opacity: .75, side: DoubleSide, roughness: .18 }));
            surface.rotation.x = -Math.PI / 2;
            root.add(surface);
            const ring = new Mesh(new TorusGeometry(radius + .13, .045, 5, 24), new MeshBasicMaterial({ color: '#f7ce79' }));
            ring.rotation.x = Math.PI / 2;
            ring.position.y = .04;
            root.add(ring);
            const label = badge(`${cap} L`);
            label.scale.set(.9, .56, 1);
            label.position.y = height + .26;
            root.add(label);
            const home = new Vector3((i - (this.state.caps.length - 1) / 2) * 2.5, .14, .25);
            root.position.copy(home);
            root.userData.id = `jug${i}`;
            this.root.add(root);
            this.hit.push(root);
            this.jugs.push({ root, water, surface, ring, label, height, radius, home });
        });
        this.stream = new Mesh(new CylinderGeometry(.035, .028, 1, 7), new MeshBasicMaterial({ color: '#94d9e5', transparent: true, opacity: .85 }));
        this.stream.visible = false;
        this.root.add(this.stream);
        for (const side of [-1, 1]) {
            const wing = part(this.butterfly, 'sphere', '#e2ba7e', [side * .13, 0, 0], [.16, .025, .1]);
            wing.rotation.z = side * .3;
        }
        bake(this.butterfly);
        this.root.add(this.butterfly);
        this.sparkles = new InstancedMesh(new SphereGeometry(.035, 5, 4), new MeshBasicMaterial({ color: '#fff0ab' }), 16);
        this.root.add(this.sparkles);
        this.sync(this.state);
    }
    private amount(i: number, value: number) { const g = this.jugs[i], h = Math.max(.005, value / this.state.caps[i] * (g.height - .08)); g.water.visible = value > .001; g.surface.visible = value > .001; g.water.scale.y = h; g.water.position.y = h / 2 + .025; g.surface.position.y = h + .03; }
    sync(s: State) { this.state = s; this.jugs.forEach((g, i) => { g.root.position.copy(g.home); g.root.rotation.set(0, 0, 0); this.amount(i, s.jugs[i]); }); this.stream.visible = false; }
    animate(from: State, to: State, done: () => void) { const changed = from.jugs.map((v, i) => to.jugs[i] - v), source = changed.findIndex(v => v < 0), target = changed.findIndex(v => v > 0), kind = source < 0 ? 'fill' : target < 0 ? 'empty' : 'pour'; this.animation = { from, to, start: performance.now(), duration: kind === 'pour' ? 750 : 650, done, kind, source: source < 0 ? target : source, target }; this.busy = true; }
    update(t: number, _dt: number, hover: string) {
        const a = this.animation;
        if (a) {
            const p = Math.min(1, (t * 1000 - a.start) / a.duration), lift = Math.sin(p * Math.PI), flow = MathUtils.clamp((p - .2) / .6, 0, 1), g = this.jugs[a.source], to = a.kind === 'pour' ? this.jugs[a.target].home : a.kind === 'fill' ? new Vector3(2.45, .14, -1.65) : new Vector3(g.home.x, .14, 2.25), dir = to.x >= g.home.x ? 1 : -1;
            g.root.position.lerpVectors(g.home, to, lift * .68);
            g.root.position.y += lift * .85;
            if (a.kind === 'empty')
                g.root.rotation.x = 55 * Math.PI / 180 * lift;
            else if (a.kind === 'pour')
                g.root.rotation.z = -dir * 55 * Math.PI / 180 * lift;
            this.jugs.forEach((_, i) => this.amount(i, MathUtils.lerp(a.from.jugs[i], a.to.jugs[i], flow)));
            const source = a.kind === 'fill' ? new Vector3(2.5, 1.4, -2) : g.root.localToWorld(a.kind === 'empty' ? new Vector3(0, g.height, g.radius) : new Vector3(dir * g.radius, g.height, 0));
            const end = a.kind === 'pour' ? this.jugs[a.target].root.localToWorld(new Vector3(0, this.jugs[a.target].height * .7, 0)) : a.kind === 'fill' ? g.root.localToWorld(new Vector3(0, g.height * .6, 0)) : new Vector3(g.root.position.x, .5, 2.25);
            this.stream.visible = p > .2 && p < .8;
            this.stream.position.copy(source).add(end).multiplyScalar(.5);
            this.stream.scale.set(1, source.distanceTo(end), 1);
            this.stream.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), end.clone().sub(source).normalize());
            this.pumpHandle.rotation.z = a.kind === 'fill' ? Math.sin(p * 10) * .2 : 0;
            if (a.kind === 'empty')
                this.watered = lift;
            if (p === 1) {
                this.animation = undefined;
                this.busy = false;
                this.watered = 0;
                this.pumpHandle.rotation.z = 0;
                this.sync(a.to);
                a.done();
            }
        }
        this.jugs.forEach((g, i) => { const selected = this.state.selected === i; g.ring.visible = selected || hover === `jug${i}`; if (!this.busy) {
            g.root.position.y = g.home.y + (selected ? .18 : 0) + (isWin(this.state) && this.state.jugs[i] === (this.state.level === 'hard' ? 6 : 4) ? Math.abs(Math.sin(t * 5 + i)) * .17 : 0);
        } g.label.position.y = g.height + .26; });
        for (let i = 0; i < 24; i++) {
            this.matrix.position.set(-3.35 + i % 12 * .61, .47 + (i % 3) * .09, 2.2 + Math.floor(i / 12) * .3);
            this.matrix.scale.setScalar(.7 + this.watered * .7);
            this.matrix.rotation.set(0, 0, 0);
            this.matrix.updateMatrix();
            this.flowers.setMatrixAt(i, this.matrix.matrix);
        }
        this.flowers.instanceMatrix.needsUpdate = true;
        this.butterfly.position.set(Math.sin(t * .4) * 3, 2.1 + Math.sin(t * .8) * .2, -1.8 + Math.cos(t * .4) * .8);
        this.butterfly.rotation.z = Math.sin(t * 9) * .3;
        this.sparkles.visible = isWin(this.state);
        if (this.sparkles.visible) {
            for (let i = 0; i < 16; i++) {
                this.matrix.position.set(Math.sin(t + i * 2) * 3, .4 + (t * .7 + i * .21) % 2.8, Math.cos(t + i) * 1.3);
                this.matrix.scale.setScalar(.5 + Math.sin(t * 4 + i) ** 2 * .5);
                this.matrix.updateMatrix();
                this.sparkles.setMatrixAt(i, this.matrix.matrix);
            }
            this.sparkles.instanceMatrix.needsUpdate = true;
        }
    }
    dispose() { disposeRoot(this.root); }
}
// Kept local to the lazy scene chunk.
import { BoxGeometry as BoxGeometryCompat } from 'three';
export const create = (stage: Stage, level: LevelId) => new WaterScene(stage, level);
