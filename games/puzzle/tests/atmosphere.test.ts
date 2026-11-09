import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DoubleSide, Mesh, PerspectiveCamera, ShaderMaterial, Spherical, Vector2, Vector3 } from 'three';
import { Atmosphere, clearsBoard, projectBox, screenRect } from '../src/scene/atmosphere.ts';

const motion = { matches: false };
globalThis.matchMedia = (() => motion) as typeof matchMedia;
const frames = [
    { w: 375, h: 812, top: 217, bottom: 584, distance: 19.941 },
    { w: 390, h: 844, top: 217, bottom: 616, distance: 20.642 },
    { w: 768, h: 1024, top: 160, bottom: 820, distance: 18.058 },
    { w: 1440, h: 900, top: 100, bottom: 692, distance: 16.940 }
];

test('projection rejects clipped/behind-camera clouds and retains a clearance margin', () => {
    const camera = new PerspectiveCamera(38, 1, .1, 360), rect = screenRect();
    camera.updateMatrixWorld();
    assert.equal(projectBox(camera, new Vector3(0, 0, -5), new Vector3(1, 1, 1), rect), true);
    assert.equal(projectBox(camera, new Vector3(0, 0, 5), new Vector3(1, 1, 1), rect), false);
    assert.equal(projectBox(camera, new Vector3(0, 0, -.1), new Vector3(.1, .1, .1), rect), false);
    const board = { minX: -.5, minY: -.5, maxX: .5, maxY: .5 };
    assert.equal(clearsBoard({ minX: -.1, maxX: .1, minY: .54, maxY: .7 }, board), false);
    assert.equal(clearsBoard({ minX: -.1, maxX: .1, minY: .57, maxY: .7 }, board), true);
});

for (const dark of [false, true]) test(`${dark ? 'night' : 'day'}: visible puff geometry clears toys throughout orbit and zoom`, () => {
    const atmosphere = new Atmosphere(dark);
    const clouds = atmosphere.getObjectsByProperty('name', 'puff-cloud') as Mesh[];
    const board = screenRect(), vertex = new Vector3();
    let visible = 0;
    for (const frame of frames) {
        const camera = new PerspectiveCamera(38, frame.w / (frame.bottom - frame.top), .1, 360);
        camera.setViewOffset(frame.w, frame.bottom - frame.top, 0, -frame.top, frame.w, frame.h);
        for (const zoom of [.6, 1, 1.6]) for (const polar of [.15, .45, 47 * Math.PI / 180, 1.05, 1.30]) for (let a = 0; a < 48; a++) {
            camera.position.setFromSpherical(new Spherical(frame.distance * zoom, polar, a * Math.PI / 24)).add(new Vector3(0, .4, 0));
            camera.lookAt(0, .4, 0); camera.updateMatrixWorld();
            atmosphere.update(camera, 0, frame.w / frame.h);
            projectBox(camera, new Vector3(0, 1.35, 0), new Vector3(5.6, 2.15, 4.6), board);
            let count = 0;
            for (const cloud of clouds) if (cloud.visible) {
                count++; visible++;
                cloud.updateWorldMatrix(true, false);
                const positions = cloud.geometry.getAttribute('position'), actual = screenRect();
                actual.minX = actual.minY = Infinity; actual.maxX = actual.maxY = -Infinity;
                // Check the actual rendered vertices, independently of the culling box.
                for (let i = 0; i < positions.count; i++) {
                    vertex.fromBufferAttribute(positions, i).applyMatrix4(cloud.matrixWorld).project(camera);
                    assert.ok(vertex.z >= -1 && vertex.z <= 1);
                    actual.minX = Math.min(actual.minX, vertex.x); actual.maxX = Math.max(actual.maxX, vertex.x);
                    actual.minY = Math.min(actual.minY, vertex.y); actual.maxY = Math.max(actual.maxY, vertex.y);
                }
                assert.ok(actual.maxX < board.minX || actual.minX > board.maxX || actual.maxY < board.minY || actual.minY > board.maxY);
            }
            if (zoom === 1 && polar === 47 * Math.PI / 180 && a === 0) assert.ok(count > 0, `${frame.w}: default view has puff clouds`);
        }
    }
    assert.ok(visible > 100);
    let meshes = 0;
    atmosphere.traverse(o => { assert.equal(o.castShadow, false); if (o instanceof Mesh) meshes++; });
    assert.ok(meshes <= 18, 'sky, twelve puffs and one instanced flock');
});

test('reduced motion freezes drift and twinkle; FPS fallback removes the third octave and twinkle', () => {
    const atmosphere = new Atmosphere(true), camera = new PerspectiveCamera(38, 1, .1, 360);
    camera.position.set(0, 14, 15); camera.lookAt(0, .4, 0); camera.updateMatrixWorld();
    const sky = atmosphere.getObjectByName('sky') as Mesh<import('three').PlaneGeometry, ShaderMaterial>;
    atmosphere.update(camera, 1, 1);
    const time = sky.material.uniforms.time.value;
    const cloud = atmosphere.getObjectByName('puff-cloud')!, position = cloud.position.clone();
    motion.matches = true;
    atmosphere.update(camera, 10, 1);
    assert.equal(sky.material.uniforms.time.value, time);
    assert.deepEqual(cloud.position, position);
    assert.equal(sky.material.uniforms.quality.value, 0);
    motion.matches = false;
    atmosphere.update(camera, 1, 1);
    assert.equal(sky.material.uniforms.quality.value, 1);
    assert.ok(sky.material.uniforms.time.value > time);
    atmosphere.lowerQuality(); atmosphere.update(camera, 1, 1);
    assert.equal(sky.material.uniforms.quality.value, 0);
});

test('sky rays track world direction and pitch including view offset; birds bypass tone mapping', () => {
    const atmosphere = new Atmosphere(false);
    const sky = atmosphere.getObjectByName('sky') as Mesh<import('three').PlaneGeometry, ShaderMaterial>;
    const camera = new PerspectiveCamera(38, 1.2, .1, 360);
    camera.setViewOffset(390, 399, 0, -217, 390, 844);
    for (const polar of [.15, .8, 1.30]) for (const azimuth of [0, 1, 3, 5]) {
        camera.position.setFromSpherical(new Spherical(20, polar, azimuth));
        camera.lookAt(0, .4, 0); camera.updateMatrixWorld();
        atmosphere.update(camera, 0, 390 / 844);
        for (const [x, y] of [[0, 0], [-1, -1], [1, 1]]) {
            const ray = new Vector3(x, y, 1).applyMatrix4(sky.material.uniforms.inverseProjection.value).transformDirection(sky.material.uniforms.cameraWorld.value);
            const expected = new Vector3(x, y, 1).unproject(camera).sub(camera.position).normalize();
            assert.ok(ray.distanceTo(expected) < 1e-10);
        }
    }
    camera.clearViewOffset(); camera.aspect = 1; camera.updateProjectionMatrix();
    camera.position.set(0, 20, .01); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(); atmosphere.update(camera, 0, 1);
    for (const x of [-1, 1]) for (const y of [-1, 1]) {
        const ray = new Vector3(x, y, 1).applyMatrix4(sky.material.uniforms.inverseProjection.value).transformDirection(sky.material.uniforms.cameraWorld.value);
        assert.ok(ray.y < -.85, 'top-down rays sample ground rather than a screen-bottom horizon');
    }
    assert.ok(sky.material.fragmentShader.includes('altitude=direction.y'));
    const hash = sky.material.fragmentShader.split('float hash(vec2 p)')[1].split('float noise')[0];
    assert.ok(!hash.includes('sin('));
    const birds = atmosphere.getObjectByName('sky-birds') as Mesh;
    assert.equal((birds.material as any).toneMapped, false); assert.equal((birds.material as any).side, DoubleSide);
});
