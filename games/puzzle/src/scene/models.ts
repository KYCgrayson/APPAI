import { BoxGeometry, CapsuleGeometry, ConeGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry } from 'three';
import type { Kind } from '../logic/index.ts';
const sphere = new SphereGeometry(1, 8, 6), box = new BoxGeometry(1, 1, 1), cone = new ConeGeometry(1, 1, 6);
const capsule = new CapsuleGeometry(.18, .25, 3, 6);
const mats = new Map<string, MeshStandardMaterial>();
export function material(color: string) { if (!mats.has(color))
    mats.set(color, new MeshStandardMaterial({ color, flatShading: true, roughness: .9 })); return mats.get(color)!; }
export function part(g: Group, shape: 'sphere' | 'box' | 'cone', color: string, pos: number[], size: number[]) { const mesh = new Mesh({ sphere, box, cone }[shape], material(color)); mesh.position.set(...pos as [
    number,
    number,
    number
]); mesh.scale.set(...size as [
    number,
    number,
    number
]); g.add(mesh); return mesh; }
export function character(kind: Kind, captain = false): Group {
    const g = new Group();
    const color = { farmer: '#d8a466', wolf: '#7c8995', goat: '#f3efdf', cabbage: '#77a74c', rabbit: '#e6cfb5', fox: '#d97d43' }[kind];
    part(g, 'sphere', color, [0, .32, 0], [.23, .28, .21]);
    if (kind === 'cabbage') {
        for (let i = 0; i < 3; i++)
            part(g, 'sphere', i % 2 ? '#a2c66c' : '#528d52', [Math.sin(i * 2.1) * .12, .32, Math.cos(i * 2.1) * .12], [.18, .23, .18]);
        g.traverse(o => { if (o instanceof Mesh) o.material = (o.material as MeshStandardMaterial).clone(); });
        return g;
    }
    part(g, 'sphere', color, [0, .66, 0], [.22, .20, .20]);
    if (kind === 'farmer') {
        const body = new Mesh(capsule, material('#4b746d'));
        body.position.y = .35;
        g.add(body);
        part(g, 'sphere', '#efb893', [0, .67, 0], [.21, .21, .2]);
        part(g, 'box', '#b47742', [0, .88, 0], [.64, .07, .5]);
        part(g, 'box', '#b47742', [0, .96, 0], [.34, .16, .32]);
    }
    else {
        for (const x of [-.13, .13])
            part(g, kind === 'rabbit' ? 'sphere' : 'cone', color, [x, kind === 'rabbit' ? 1 : .89, 0], kind === 'rabbit' ? [.065, .26, .07] : [.12, .23, .10]);
        if (kind === 'goat')
            for (const x of [-.12, .12])
                part(g, 'cone', '#a8997f', [x, 1.02, -.02], [.045, .24, .045]);
        if (kind === 'wolf' || kind === 'fox') {
            part(g, 'sphere', color, [0, .61, .24], [.12, .11, .23]);
            const tail = part(g, 'sphere', color, [.13, .35, -.29], [.13, .13, kind === 'fox' ? .36 : .23]);
            tail.rotation.x = .4;
        }
    }
    if (captain) {
        // Original peaked captain hat: broad brim, raised crown, and front badge.
        part(g, 'box', '#243b52', [0, .88, .09], [.58, .07, .43]);
        part(g, 'box', '#fff5df', [0, .99, .02], [.42, .19, .30]);
        part(g, 'sphere', '#dca442', [0, .99, .18], [.055, .06, .025]);
    }
    for (const x of [-.09, .09])
        part(g, 'sphere', '#31393b', [x, .7, .18], [.025, .03, .025]);
    g.traverse(o => { if (o instanceof Mesh) o.material = (o.material as MeshStandardMaterial).clone(); });
    return g;
}
