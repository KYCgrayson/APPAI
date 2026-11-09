import { BufferGeometry, Color, Float32BufferAttribute, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, PerspectiveCamera, PlaneGeometry, ShaderMaterial, Vector2, Vector3 } from 'three';
import { bake, part } from './models.ts';

export const horizonColor = (dark: boolean) => dark ? '#686781' : '#e7d7bb';
export interface ScreenRect { minX: number; minY: number; maxX: number; maxY: number }
export const screenRect = (): ScreenRect => ({ minX: 0, minY: 0, maxX: 0, maxY: 0 });
const point = new Vector3();
// Conservative projected AABBs, including depth clipping. Reused output avoids frame allocations.
export function projectBox(camera: PerspectiveCamera, center: Vector3, half: Vector3, out: ScreenRect) {
    out.minX = out.minY = Infinity; out.maxX = out.maxY = -Infinity;
    let valid = true;
    for (let x = -1; x <= 1; x += 2) for (let y = -1; y <= 1; y += 2) for (let z = -1; z <= 1; z += 2) {
        point.set(center.x + x * half.x, center.y + y * half.y, center.z + z * half.z).project(camera);
        valid &&= point.z >= -1 && point.z <= 1;
        out.minX = Math.min(out.minX, point.x); out.maxX = Math.max(out.maxX, point.x);
        out.minY = Math.min(out.minY, point.y); out.maxY = Math.max(out.maxY, point.y);
    }
    return valid;
}
export function clearsBoard(cloud: ScreenRect, board: ScreenRect) {
    const gap = .06;
    return cloud.maxX < board.minX - gap || cloud.minX > board.maxX + gap || cloud.maxY < board.minY - gap || cloud.minY > board.maxY + gap;
}

/** A low painted horizon with separate distant clouds, kept clear of every puzzle board. */
export class Atmosphere extends Group {
    private sky: Mesh<PlaneGeometry, ShaderMaterial>;
    private clouds: Mesh<BufferGeometry, MeshBasicMaterial>[] = [];
    private birds: InstancedMesh;
    private boardRect = screenRect();
    private objectRect = screenRect();
    private boardCenter = new Vector3(0, 1.35, 0);
    private boardHalf = new Vector3(5.6, 2.15, 4.6);
    private flockCenter = new Vector3();
    private flockHalf = new Vector3(4, 1.2, 3.2);
    private birdMatrix = new Matrix4();
    private lowQuality = false;
    private time = 0;
    private reduced = matchMedia('(prefers-reduced-motion: reduce)');
    constructor(dark: boolean) {
        super();
        this.name = 'procedural-atmosphere';
        this.sky = new Mesh(new PlaneGeometry(2, 2), new ShaderMaterial({
            depthTest: false, depthWrite: false, fog: false, toneMapped: false,
            uniforms: {
                time: { value: 0 }, aspect: { value: 1 }, quality: { value: 1 }, night: { value: dark ? 1 : 0 },
                lightPosition: { value: new Vector2(.16, .955) },
                zenith: { value: new Color(dark ? '#152744' : '#77b8df') }, horizon: { value: new Color(horizonColor(dark)) }
            },
            vertexShader: `varying vec2 uvSky;
                void main(){ uvSky=uv; gl_Position=vec4(position.xy,1.0,1.0); }`,
            fragmentShader: `
                varying vec2 uvSky;
                uniform float time, aspect, quality, night;
                uniform vec2 lightPosition;
                uniform vec3 zenith, horizon;
                float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
                float noise(vec2 p){
                    vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
                    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.0),f.x),f.y);
                }
                float fbm(vec2 p){
                    float n=noise(p)*.57+noise(p*2.03+7.0)*.28;
                    if(quality>.5) n+=noise(p*4.11+19.0)*.15;
                    else n/=.85;
                    return n;
                }
                void main(){
                    vec2 p=vec2(uvSky.x*aspect,uvSky.y);
                    vec3 color=mix(horizon,zenith,smoothstep(.22,1.0,uvSky.y));
                    vec2 sun=p-lightPosition*vec2(aspect,1.0);
                    float r=length(sun), radius=mix(.032,.025,night);
                    float disc=1.0-smoothstep(radius*.86,radius*1.1,r);
                    float halo=exp(-r*17.0)*.32+exp(-r*65.0)*.25;
                    vec3 glow=mix(vec3(1.0,.68,.31),vec3(.53,.65,1.0),night);
                    color+=glow*halo;
                    color=mix(color,mix(vec3(1.0,.88,.58),vec3(.88,.93,1.0),night),disc*.94);
                    if(night>.5){
                        vec2 grid=p*115.0, cell=floor(grid);
                        vec2 offset=vec2(hash(cell+4.0),hash(cell+23.0))*.6+.2;
                        float star=1.0-smoothstep(.025,.12,length(fract(grid)-offset));
                        float twinkle=.8;
                        if(quality>.5) twinkle=.75+.25*sin(time*(1.0+hash(cell)*2.0)+hash(cell+8.0)*40.0);
                        color+=vec3(.77,.84,1.0)*star*step(.98,hash(cell))*twinkle*smoothstep(.40,.72,uvSky.y)*(1.0-disc);
                    }
                    vec2 wind=vec2(time*.009,time*.001);
                    vec2 wisps=p*vec2(3.2,16.0)+wind;
                    wisps.x+=noise(wisps*.38)*1.6;
                    float cloud=smoothstep(.48,.83,fbm(wisps))*smoothstep(.28,.58,uvSky.y);
                    vec3 duskCloud=mix(vec3(.52,.37,.45),vec3(.27,.31,.45),smoothstep(.35,.88,uvSky.y));
                    vec3 lit=mix(vec3(1.0,.96,.86),duskCloud,night);
                    color=mix(color,lit,cloud*mix(.47,.28,night));
                    // Three low, irregular blue bands above a flat, fog-soft meadow.
                    for(int i=0;i<3;i++){
                        float f=float(i);
                        float edge=.245-f*.027 + sin(p.x*(5.0+f*2.0)+f)*.009 + noise(vec2(p.x*13.0+f*8.0,2.0))*.022;
                        vec3 band=mix(vec3(.55,.67,.70),vec3(.32,.40,.51),night);
                        band=mix(band,horizon,.62-f*.11);
                        color=mix(color,band,(1.0-smoothstep(edge-.002,edge+.002,uvSky.y))*.75);
                    }
                    vec3 ground=mix(vec3(.72,.77,.66),vec3(.25,.32,.38),night);
                    color=mix(color,ground,(1.0-smoothstep(.02,.20,uvSky.y))*.72);
                    gl_FragColor=vec4(color,1.0);
                    #include <colorspace_fragment>
                }`
        }));
        this.sky.name = 'sky'; this.sky.frustumCulled = false; this.sky.renderOrder = -100;
        this.add(this.sky);

        for (let i = 0; i < 12; i++) {
            const puff = new Group();
            for (let j = 0; j < 4; j++) part(puff, 'sphere', '#ffffff', [(j - 1.5) * .85, j === 1 ? .35 : 0, Math.sin(j) * .2], [.95, .46 + (j % 2) * .18, .65]);
            bake(puff);
            const mesh = puff.children[0] as Mesh<BufferGeometry, MeshBasicMaterial>;
            // Baked normal-based colour gives the puffs volume without another light/shader.
            // At dusk the warm lower hemisphere catches the last light under a cool crown.
            const normals = mesh.geometry.getAttribute('normal'), colors = mesh.geometry.getAttribute('color');
            const lower = new Color(dark ? '#c4a1b2' : '#c8d1d3'), upper = new Color(dark ? '#616e89' : '#fff8e9'), tint = new Color();
            for (let j = 0; j < normals.count; j++) {
                tint.copy(lower).lerp(upper, Math.max(0, Math.min(1, (normals.getY(j) + 1) * .5 + normals.getX(j) * .15)));
                colors.setXYZ(j, tint.r, tint.g, tint.b);
            }
            mesh.material.dispose(); mesh.material = new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
            mesh.scale.setScalar(.9 + i % 3 * .5);
            mesh.geometry.computeBoundingBox();
            mesh.userData.half = mesh.geometry.boundingBox!.getSize(new Vector3()).multiplyScalar(.5).multiply(mesh.scale);
            mesh.userData.centerOffset = mesh.geometry.boundingBox!.getCenter(new Vector3()).multiply(mesh.scale);
            mesh.userData.center = new Vector3();
            mesh.userData.opacity = dark ? .37 : .72;
            mesh.name = 'puff-cloud'; this.clouds.push(mesh); this.add(mesh);
        }
        const wing = new BufferGeometry();
        wing.setAttribute('position', new Float32BufferAttribute([-.7, .12, 0, 0, 0, .18, 0, 0, -.08, 0, 0, -.08, 0, 0, .18, .7, .12, 0], 3));
        this.birds = new InstancedMesh(wing, new MeshBasicMaterial({ color: dark ? '#c5bdcb' : '#617c80', side: 2 }), 5);
        this.birds.name = 'sky-birds'; this.birds.frustumCulled = false;
        this.add(this.birds);
        this.traverse(o => { o.castShadow = false; o.receiveShadow = false; o.raycast = () => {}; });
    }
    lowerQuality() { this.lowQuality = true; }
    update(camera: PerspectiveCamera, dt: number, aspect: number) {
        if (!this.reduced.matches) this.time += dt;
        this.sky.material.uniforms.time.value = this.time;
        this.sky.material.uniforms.aspect.value = aspect;
        // Keep the disc in the open sky above the header, clear of phone view tools.

        this.sky.material.uniforms.lightPosition.value.x = aspect > 1.45 ? .4 : .16;
        // Reduced motion also stops star twinkle, including changes made while playing.
        const shader = this.sky.material;
        shader.uniforms.quality.value = this.reduced.matches || this.lowQuality ? 0 : 1;
        const boardValid = projectBox(camera, this.boardCenter, this.boardHalf, this.boardRect);
        for (let i = 0; i < this.clouds.length; i++) {
            const cloud = this.clouds[i];
            const a = i * Math.PI / 6 + .22 + this.time * .002, radius = 96 + i % 3 * 10;
            cloud.position.set(Math.sin(a) * radius, -30 - i % 3 * 2, Math.cos(a) * radius);
            const center = (cloud.userData.center as Vector3).copy(cloud.position).add(cloud.userData.centerOffset);
            const valid = projectBox(camera, center, cloud.userData.half, this.objectRect);
            const r = this.objectRect;
            const edge = Math.max(0, Math.min(1, (r.minX + 1) / .12, (1 - r.maxX) / .12, (r.minY + 1) / .12, (1 - r.maxY) / .12));
            cloud.visible = boardValid && valid && edge > 0 && clearsBoard(r, this.boardRect);
            cloud.material.opacity = cloud.userData.opacity * edge;
        }
        // A single instanced, loose V passes the distant sky for 18 seconds each 75 seconds.
        const pass = this.time % 75;
        this.flockCenter.set(-50 + pass * 5.5, -32 + Math.sin(pass * .15), -100);
        this.birds.visible = !this.reduced.matches && pass < 18 && boardValid && projectBox(camera, this.flockCenter, this.flockHalf, this.objectRect) && clearsBoard(this.objectRect, this.boardRect);
        if (this.birds.visible) {
            for (let i = 0; i < 5; i++) {
                const side = i % 2 ? 1 : -1, rank = Math.ceil(i / 2);
                this.birdMatrix.makeScale(1, .4 + Math.sin(this.time * 5 + i) * .6, 1);
                this.birdMatrix.setPosition(this.flockCenter.x + side * rank * 1.6, this.flockCenter.y + rank * .2, this.flockCenter.z + rank * 1.4);
                this.birds.setMatrixAt(i, this.birdMatrix);
            }
            this.birds.instanceMatrix.needsUpdate = true;
        }
    }
}
