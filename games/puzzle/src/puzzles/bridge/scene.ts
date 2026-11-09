import { Group, Mesh, InstancedMesh, BoxGeometry, MeshStandardMaterial, MeshBasicMaterial, SphereGeometry, PointLight, RingGeometry, DoubleSide, Object3D, Vector3, MathUtils } from 'three';
import type { Stage } from '../../scene/stage.ts';
import type { LevelId, PuzzleScene } from '../types.ts';
import { initial, ids, isWin, levels, type State } from './logic.ts';
import { part, bake, person, disposeRoot } from '../../scene/models.ts';
import { badge, rod } from '../../scene/helpers.ts';
import { registry } from '../registry.ts';
const sag = (x: number) => -.34 * (1 - (x / 2.25) ** 2);
class BridgeScene implements PuzzleScene<State> {
    root = new Group();
    hit: Object3D[] = [];
    secondaryIds = ['bridge', 'lantern'];
    bounds = { x: 5.23, y: [-1.63, 2.9] as [
            number,
            number
        ], z: 3.2 };
    busy = false;
    private state: State;
    private actors = new Map<string, Group>();
    private rings = new Map<string, Mesh>();
    private homes = new Map<string, Vector3>();
    private lantern = new Group();
    private flame: Mesh;
    private lamp: PointLight;
    private planks: InstancedMesh;
    private matrix = new Object3D();
    private motes: InstancedMesh;
    private animation?: {
        from: State;
        to: State;
        start: number;
        duration: number;
        done: () => void;
        origins: Map<string, Vector3>;
    };
    constructor(stage: Stage, level: LevelId) {
        this.state = initial(level);
        const land = new Group();
        for (const side of [-1, 1]) {
            for (let layer = 0; layer < 4; layer++)
                part(land, 'box', ['#4d5660', '#63717a', '#83918b', '#77926d'][layer], [side * 3.55, -.85 + layer * .25, 0], [3.35 - layer * .07, .3, 6.2 - layer * .05]);
            // inset top and narrow rim form a bevelled silhouette
            part(land, 'box', '#8d9d72', [side * 3.55, .05, 0], [3.12, .15, 5.9]);
            for (const z of [-.64, .64]) {
                part(land, 'cylinder', '#8f7557', [side * 2.25, .52, z], [.09, 1.12, .09]);
                part(land, 'sphere', '#b79b69', [side * 2.25, 1.10, z], [.12, .08, .12]);
            }
            for (let i = 0; i < 3; i++) {
                const x = side * (3 + i * .65), z = -2.65, h = 1.0 + (i % 2) * .35;
                part(land, 'cylinder', '#796a59', [x, h * .25, z], [.08, h * .5, .08]);
                part(land, 'cone', '#426b67', [x, h * .65, z], [.42, h, .42]);
                part(land, 'cone', '#5c7d70', [x, h * .95, z], [.3, h * .65, .3]);
            }
            part(land, 'cylinder', '#806950', [side * 4.6, .55, 2.55], [.06, 1.1, .06]);
            part(land, 'box', '#b69b6b', [side * 4.6, 1, 2.55], [.65, .3, .09]);
        }
        for (const z of [-.65, .65])
            for (let i = 0; i < 24; i++) {
                const x = -2.25 + i * 4.5 / 24, n = x + 4.5 / 24;
                rod(land, '#b5ab87', [x, .84 + sag(x), z], [n, .84 + sag(n), z], .035);
                if (i % 3 === 0)
                    rod(land, '#a59b7c', [x, sag(x), z], [x, .84 + sag(x), z], .018);
            }
        bake(land);
        this.root.add(land);
        const water = part(this.root, 'box', '#263d4b', [0, -1.55, 0], [10.4, .16, 6.4]);
        water.receiveShadow = true;
        this.planks = new InstancedMesh(new BoxGeometry(.21, .10, 1.24), new MeshStandardMaterial({ color: '#a28d68', roughness: .9 }), 22);
        this.planks.castShadow = true;
        this.planks.receiveShadow = true;
        this.planks.userData.id = 'bridge';
        this.hit.push(this.planks);
        this.root.add(this.planks);
        this.setPlanks();
        const cage = new Group();
        for (const y of [0, .48])
            part(cage, 'cylinder', '#7b6950', [0, y, 0], [.17, .06, .17]);
        for (const x of [-.12, .12])
            for (const z of [-.12, .12])
                part(cage, 'cylinder', '#7b6950', [x, .24, z], [.018, .48, .018]);
        part(cage, 'cone', '#8d7854', [0, .55, 0], [.21, .14, .21]);
        rod(cage, '#8d7854', [-.1, .6, 0], [0, .75, 0]);
        rod(cage, '#8d7854', [0, .75, 0], [.1, .6, 0]);
        bake(cage);
        this.lantern.add(cage);
        this.flame = new Mesh(new SphereGeometry(.12, 8, 6), new MeshBasicMaterial({ color: '#ffcd67' }));
        this.flame.position.y = .24;
        this.flame.scale.y = 1.4;
        this.lantern.add(this.flame);
        this.lamp = stage.lamps[0];
        this.lamp.color.set('#ffbc64'); this.lamp.distance = 8; this.lamp.decay = 1.5;
        this.lantern.userData.id = 'lantern';
        this.root.add(this.lantern);
        this.hit.push(this.lantern);
        for (const id of ids(level)) {
            const actor = person(Number(id));
            actor.userData.id = id;
            const label = badge(id);
            label.position.y = 1.5;
            actor.add(label);
            this.actors.set(id, actor);
            this.root.add(actor);
            this.hit.push(actor);
            const ring = new Mesh(new RingGeometry(.32, .39, 24), new MeshBasicMaterial({ color: '#ffda85', side: DoubleSide, transparent: true, opacity: .85 }));
            ring.rotation.x = -Math.PI / 2;
            this.rings.set(id, ring);
            this.root.add(ring);
        }
        this.motes = new InstancedMesh(new SphereGeometry(.025, 5, 4), new MeshBasicMaterial({ color: '#ffdca0' }), 16);
        this.root.add(this.motes);
        this.sync(this.state);
    }
    private setPlanks(walkerX?: number) { for (let i = 0; i < 22; i++) {
        const x = -2.2 + i * 4.4 / 21;
        this.matrix.position.set(x, sag(x) - (walkerX === undefined ? 0 : .045 * Math.exp(-(((walkerX - x) * 3) ** 2))), 0);
        this.matrix.rotation.set(0, Math.sin(i * 31) * .035, 0);
        this.matrix.scale.set(1, 1, 1);
        this.matrix.updateMatrix();
        this.planks.setMatrixAt(i, this.matrix.matrix);
    } this.planks.instanceMatrix.needsUpdate = true; }
    private slot(id: string, side: number) { const i = ids(this.state.level).indexOf(id); return new Vector3((side ? 1 : -1) * (2.95 + Math.floor(i / 3) * 1.12), .14, -1.7 + (i % 3) * 1.6); }
    sync(s: State) { this.state = s; for (const [id, g] of this.actors) {
        const pos = this.slot(id, s.side[id]);
        g.position.copy(pos);
        this.homes.set(id, pos);
    } this.lantern.position.set(s.lantern ? 2.25 : -2.25, 1.15, .64); this.lantern.rotation.z = 0; this.lamp.position.copy(this.lantern.position).y += .3; }
    animate(from: State, to: State, done: () => void) { this.busy = true; this.animation = { from, to, start: performance.now(), duration: Math.min(1800, 1100 + 60 * (to.minutes - from.minutes)), done, origins: new Map([...this.actors].map(([id, g]) => [id, g.position.clone()])) }; }
    update(t: number, _dt: number, hover: string) {
        const a = this.animation;
        let progress = 0;
        if (a) {
            progress = Math.min(1, (t * 1000 - a.start) / a.duration);
            const ease = progress * progress * (3 - 2 * progress), dir = a.from.lantern ? -1 : 1;
            let x = 0;
            a.from.selected.forEach((id, i) => {
                const g = this.actors.get(id)!, start = a.origins.get(id)!, end = this.slot(id, a.to.side[id]);
                if (progress < .18)
                    g.position.lerpVectors(start, new Vector3(-dir * 2.2, .14, i ? .25 : -.25), progress / .18);
                else if (progress > .82)
                    g.position.lerpVectors(new Vector3(dir * 2.2, .14, i ? .25 : -.25), end, (progress - .82) / .18);
                else {
                    const p = (progress - .18) / .64;
                    x = MathUtils.lerp(-dir * 2.2, dir * 2.2, p);
                    g.position.set(x, .14 + sag(x) + Math.abs(Math.sin(progress * 30 + i)) * .07, i ? .25 : -.25);
                }
                g.rotation.z = Math.sin(progress * 30 + i) * .04;
            });
            const lead = this.actors.get(a.from.selected[0])!;
            this.lantern.position.copy(lead.position).add(new Vector3(dir * .3, .5, .45));
            this.lantern.rotation.z = Math.sin(progress * 20) * .16;
            this.setPlanks(x);
            const minutes = a.from.minutes + Math.floor((a.to.minutes - a.from.minutes) * ease), node = document.querySelector('[data-minutes]'), remaining = document.querySelector('[data-remaining]'), gauge = document.querySelector<HTMLElement>('[data-gauge]');
            if (node)
                node.textContent = String(minutes);
            if (remaining)
                remaining.textContent = registry.bridge.strings.remaining.replace('{n}', String(Math.max(0, levels[a.to.level].limit - minutes)));
            if (gauge)
                gauge.style.width = `${Math.max(0, 1 - minutes / levels[a.to.level].limit) * 100}%`;
            if (progress === 1) {
                this.animation = undefined;
                this.busy = false;
                this.sync(a.to);
                this.setPlanks();
                a.done();
            }
        }
        for (const [id, g] of this.actors) {
            const selected = this.state.selected.includes(id);
            g.userData.eyes.scale.y = (t + Number(id)) % 4 < .12 ? .12 : 1;
            if (!this.busy) {
                g.position.y = this.homes.get(id)!.y + Math.sin(t * 2 + Number(id)) * .015 + (isWin(this.state) ? Math.abs(Math.sin(t * 5 + Number(id))) * .25 : 0);
                g.rotation.z = Math.sin(t * 1.7 + Number(id)) * .025;
            }
            g.scale.setScalar(1.35 * g.userData.height * (selected ? 1.08 : hover === id ? 1.04 : 1));
            const ring = this.rings.get(id)!;
            ring.visible = selected || hover === id;
            ring.position.set(g.position.x, .18, g.position.z);
        }
        const fuel = Math.max(.05, 1 - this.state.minutes / levels[this.state.level].limit), flare = isWin(this.state) ? 1.6 : 1;
        this.flame.scale.setScalar((this.state.failure ? .12 : .55 + fuel * .55) * (1 + Math.sin(t * 13) * .07) * flare);
        this.lamp.position.copy(this.lantern.position).y += .3;
        this.lamp.intensity = (this.state.failure ? .15 : 3 + fuel * 4) * flare;
        for (let i = 0; i < 16; i++) {
            this.matrix.position.set(Math.sin(t * .3 + i * 2.4) * 4.8, .6 + (i % 4) * .3 + Math.sin(t + i) * .15, Math.cos(t * .2 + i) * 2.8);
            this.matrix.scale.setScalar(.5 + .5 * Math.sin(t * 2 + i) ** 2);
            this.matrix.rotation.set(0, 0, 0);
            this.matrix.updateMatrix();
            this.motes.setMatrixAt(i, this.matrix.matrix);
        }
        this.motes.instanceMatrix.needsUpdate = true;
    }
    dispose() { disposeRoot(this.root); }
}
export const create = (stage: Stage, level: LevelId) => new BridgeScene(stage, level);
