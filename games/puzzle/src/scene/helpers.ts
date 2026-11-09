import { CanvasTexture, Sprite, SpriteMaterial, Group, Vector3 } from 'three';
import { part } from './models.ts';
export function badge(text: string, color = '#f9e7bb') {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 80;
    const c = canvas.getContext('2d')!;
    c.fillStyle = '#273f48';
    c.beginPath();
    c.roundRect(2, 2, 124, 76, 24);
    c.fill();
    c.strokeStyle = color;
    c.lineWidth = 5;
    c.stroke();
    c.fillStyle = color;
    c.font = 'bold 44px system-ui';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(text, 64, 42);
    const sprite = new Sprite(new SpriteMaterial({ map: new CanvasTexture(canvas), depthTest: false }));
    sprite.scale.set(.65, .41, 1);
    sprite.renderOrder = 3;
    return sprite;
}
export function rod(g: Group, color: string, a: number[], b: number[], radius = .025) {
    const from = new Vector3(...a as [
        number,
        number,
        number
    ]), to = new Vector3(...b as [
        number,
        number,
        number
    ]), delta = to.clone().sub(from);
    const m = part(g, 'cylinder', color, from.clone().add(to).multiplyScalar(.5).toArray(), [radius, delta.length(), radius]);
    m.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), delta.normalize());
    return m;
}
