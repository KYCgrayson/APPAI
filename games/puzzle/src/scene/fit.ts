export interface BoardBounds { x: number; y: readonly [number, number]; z: number }

/** Fit all eight corners in camera space, including perspective depth and target height. */
export function fitBoard(bounds: BoardBounds, aspect: number, fov = 38) {
    const elevation = 43 * Math.PI / 180, sin = Math.sin(elevation), cos = Math.cos(elevation);
    let upMin = Infinity, upMax = -Infinity;
    for (const y of bounds.y) for (const z of [-bounds.z, bounds.z]) {
        const up = (y - .4) * cos - z * sin;
        upMin = Math.min(upMin, up); upMax = Math.max(upMax, up);
    }
    // Translate along camera-up, leaving camera depth unchanged.
    const shift = (upMin + upMax) / 2;
    const target = { x: 0, y: .4 + shift * cos, z: -shift * sin };
    const tangent = Math.tan(fov * Math.PI / 360), widthFraction = .9, heightFraction = .94;
    let distance = 0;
    for (const y of bounds.y) for (const z of [-bounds.z, bounds.z]) {
        const depth = (y - target.y) * sin + (z - target.z) * cos;
        const up = (y - target.y) * cos - (z - target.z) * sin;
        distance = Math.max(distance, depth + bounds.x / (tangent * aspect * widthFraction), depth + Math.abs(up) / (tangent * heightFraction));
    }
    return { distance, target, position: { x: 0, y: target.y + distance * sin, z: target.z + distance * cos } };
}
