import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, InstancedMesh, MathUtils, Matrix4, Mesh, MeshBasicMaterial, PerspectiveCamera, PlaneGeometry, ShaderMaterial, Vector2, Vector3 } from 'three';
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

/** A pitch-aware painted sky with separate distant clouds, kept clear of every puzzle board. */
export class Atmosphere extends Group {
    readonly horizonTint: Color;
    fireStrength = 0;
    private baseHorizon: Color;
    private baseZenith: Color;
    private fireTint = new Color('#c45b38');
    private fireZenith = new Color('#682c3e');
    private sky: Mesh<PlaneGeometry, ShaderMaterial>;
    private clouds: Mesh<BufferGeometry, MeshBasicMaterial>[] = [];
    private birds: InstancedMesh<BufferGeometry, MeshBasicMaterial>;
    private boardRect = screenRect();
    private objectRect = screenRect();
    private boardCenter = new Vector3(0, 1.35, 0);
    private boardHalf = new Vector3(5.6, 2.15, 4.6);
    private flockCenter = new Vector3();
    private flockHalf = new Vector3(4, 1.2, 3.2);
    private birdMatrix = new Matrix4();
    private viewDirection = new Vector3();
    private lowQuality = false;
    private time = 0;
    private reduced = matchMedia('(prefers-reduced-motion: reduce)');
    constructor(dark: boolean) {
        super();
        this.baseHorizon = new Color(horizonColor(dark));
        this.baseZenith = new Color(dark ? '#152744' : '#77b8df');
        this.horizonTint = this.baseHorizon.clone();
        this.name = 'procedural-atmosphere';
        this.sky = new Mesh(new PlaneGeometry(2, 2), new ShaderMaterial({
            depthTest: false, depthWrite: false, fog: false, toneMapped: false,
            uniforms: {
                time: { value: 0 }, quality: { value: 1 }, night: { value: dark ? 1 : 0 },
                fire: { value: 0 }, fireStrength: { value: 0 },
                inverseProjection: { value: new Matrix4() }, cameraWorld: { value: new Matrix4() },
                skyBlend: { value: 1 }, skyHorizon: { value: .58 }, aspect: { value: 1 },
                lightPosition: { value: new Vector2(.19, .70) }, lightRadius: { value: .026 },
                zenith: { value: new Color(dark ? '#152744' : '#77b8df') }, horizon: { value: new Color(horizonColor(dark)) }
            },
            vertexShader: `varying vec3 worldRay;
                varying vec2 screenUV;
                uniform mat4 inverseProjection, cameraWorld;
                void main(){
                    vec4 ray=inverseProjection*vec4(position.xy,1.0,1.0);
                    worldRay=mat3(cameraWorld)*ray.xyz;
                    screenUV=position.xy*.5+.5;
                    gl_Position=vec4(position.xy,1.0,1.0);
                }`,
            fragmentShader: `
                varying vec3 worldRay;
                varying vec2 screenUV;
                uniform float time, quality, night, skyBlend, skyHorizon, aspect, lightRadius, fireStrength;
                uniform vec2 lightPosition;
                uniform vec3 zenith, horizon;
                // Hoskins hash12: no large sin arguments on mobile GPUs.
                float hash(vec2 p){
                    vec3 p3=fract(vec3(p.xyx)*.1031);
                    p3+=dot(p3,p3.yzx+33.33);
                    return fract((p3.x+p3.y)*p3.z);
                }
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
                    vec3 direction=normalize(worldRay);
                    // Reveal the sky above a downward-facing board camera. At low orbits,
                    // return continuously to world altitude; hills and clouds share this mapping.
                    float screenAltitude=(screenUV.y-skyHorizon)*.8/(1.0-skyHorizon);
                    float altitude=mix(direction.y,screenAltitude,skyBlend), azimuth=atan(direction.x,-direction.z);
                    vec2 p=vec2(azimuth/6.2831853+.5,asin(clamp(altitude,-1.0,1.0))/3.1415927+.5);
                    vec3 color=mix(horizon,zenith,smoothstep(-.12,.8,altitude));
                    // Compose the disc in a clear HUD gap, with a circular, aspect-correct halo.
                    float r=length((screenUV-lightPosition)*vec2(aspect,1.0))*.032/lightRadius, radius=mix(.032,.025,night);
                    float disc=1.0-smoothstep(radius*.86,radius*1.1,r);
                    float halo=exp(-r*17.0)*.32+exp(-r*65.0)*.25;
                    disc*=smoothstep(-.02,.03,altitude);
                    halo*=smoothstep(-.1,.05,altitude);
                    vec3 glow=mix(vec3(1.0,.68,.31),vec3(.53,.65,1.0),night);
                    color+=glow*halo;
                    color=mix(color,mix(vec3(1.0,.88,.58),vec3(.88,.93,1.0),night),disc*.94);
                    if(night>.5){
                        vec2 grid=p*vec2(288.0,144.0), cell=mod(floor(grid),289.0);
                        vec2 offset=vec2(hash(cell+4.0),hash(cell+23.0))*.6+.2;
                        float star=1.0-smoothstep(.025,.12,length(fract(grid)-offset));
                        float twinkle=.8;
                        if(quality>.5) twinkle=.75+.25*sin(time*(1.0+hash(cell)*2.0)+hash(cell+8.0)*40.0);
                        color+=vec3(.77,.84,1.0)*star*step(.98,hash(cell))*twinkle*smoothstep(.02,.4,altitude)*(1.0-disc);
                    }
                    vec2 wind=vec2(time*.009,time*.001);
                    vec2 wisps=direction.xz/max(.12,altitude+.2)*vec2(3.2,8.0)+wind;
                    wisps.x+=noise(wisps*.38)*1.6;
                    float cloud=smoothstep(.45,.76,fbm(wisps))*smoothstep(.0,.22,altitude);
                    vec3 duskCloud=mix(vec3(.38,.43,.57),vec3(.24,.31,.47),smoothstep(.0,.7,altitude));
                    vec3 lit=mix(vec3(1.0,.96,.86),duskCloud,night);
                    color=mix(color,lit,cloud*mix(.60,.32,night));
                    // Three low, irregular blue bands above a flat, fog-soft meadow.
                    for(int i=0;i<3;i++){
                        float f=float(i);
                        float edge=-.055-f*.035 + sin(azimuth*(5.0+f*2.0)+f)*.009 + noise(direction.xz*13.0+f*8.0)*.022;
                        vec3 band=mix(vec3(.38,.55,.60),vec3(.10,.17,.28),night);
                        band=mix(band,horizon,.42-f*.12);
                        color=mix(color,band,(1.0-smoothstep(edge-.002,edge+.002,altitude))*.75);
                        if(i==2){
                            float row=azimuth*75.0;
                            float treeHeight=.012+hash(vec2(floor(row),7.0))*.022;
                            float treeEdge=edge+treeHeight*(1.0-abs(fract(row)-.5)*2.0);
                            vec3 forest=mix(vec3(.22,.36,.33),vec3(.06,.12,.20),night);
                            color=mix(color,forest,(1.0-smoothstep(treeEdge-.001,treeEdge+.001,altitude))*.46);
                        }
                    }
                    vec3 ground=mix(vec3(.72,.77,.66),vec3(.25,.32,.38),night);
                    color=mix(color,ground,(1.0-smoothstep(-.65,-.20,altitude))*.72);
                    // Fire follows the negative-X start bank as the camera orbits.
                    float startSide=pow(max(0.0,-direction.x),2.0);
                    float fireGlow=exp(-abs(altitude+.03)*3.5)*startSide*fireStrength;
                    color=mix(color,vec3(1.0,.27,.055),fireGlow*.85);
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
        this.birds = new InstancedMesh(wing, new MeshBasicMaterial({ color: dark ? '#c5bdcb' : '#617c80', side: DoubleSide, toneMapped: false, transparent: true, depthWrite: false, forceSinglePass: true }), 5);
        this.birds.name = 'sky-birds'; this.birds.frustumCulled = false;
        this.add(this.birds);
        this.traverse(o => { o.castShadow = false; o.receiveShadow = false; o.raycast = () => {}; });
    }
    setFireProgress(progress: number, active = true, relaxed = false) {
        const danger = MathUtils.clamp(progress, 0, 1);
        this.fireStrength = active ? (.14 + .86 * Math.pow(danger, .7)) * (relaxed ? .45 : 1) : 0;
        this.sky.material.uniforms.fire.value = danger;
        this.sky.material.uniforms.fireStrength.value = this.fireStrength;
        this.horizonTint.copy(this.baseHorizon).lerp(this.fireTint, this.fireStrength * .83);
        this.sky.material.uniforms.horizon.value.copy(this.horizonTint);
        this.sky.material.uniforms.zenith.value.copy(this.baseZenith).lerp(this.fireZenith, this.fireStrength * .62);
    }
    lowerQuality() { this.lowQuality = true; }
    update(camera: PerspectiveCamera, dt: number, aspect: number) {
        if (!this.reduced.matches) this.time += dt;
        this.sky.material.uniforms.time.value = this.time;
        this.sky.material.uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse);
        this.sky.material.uniforms.cameraWorld.value.copy(camera.matrixWorld);
        const shader = this.sky.material;
        camera.getWorldDirection(this.viewDirection);
        const pitch = Math.asin(MathUtils.clamp(-this.viewDirection.y, -1, 1));
        // Puffs and birds sit below world altitude zero; fade out before low orbits
        // reveal them over the painted hills and meadow.
        const fade = MathUtils.smoothstep(pitch, .45, .6);
        shader.uniforms.skyBlend.value = MathUtils.smoothstep(pitch, .26, .65);
        // Default elevation is 43 degrees: horizon at 42% from the top. Compress
        // to 30% near top-down, retaining blue, clouds and stars even at maximum zoom.
        shader.uniforms.skyHorizon.value = .58 + .12 * MathUtils.smoothstep(pitch, .85, 1.42);
        shader.uniforms.aspect.value = aspect;
        shader.uniforms.lightRadius.value = .026 * Math.min(1, aspect);
        const view = camera.view;
        const width = view?.enabled ? view.width : 1440;
        const height = view?.enabled ? view.height : width / aspect;
        const top = view?.enabled ? -view.offsetY : 0;
        // Home's menu leaves the top-left strip open. During play use the space
        // below the portrait heading, above the tablet heading, or the desktop gap.
        const lightX = top === 0 ? .10 : width <= 650 ? .19 : width <= 1100 ? .22 : .62;
        const lightY = top === 0 ? .05 : width <= 650
            ? Math.min(.33, Math.max(.28, (top + 32) / height)) : width <= 1100 ? .07 : .21;
        shader.uniforms.lightPosition.value.set(lightX, 1 - lightY);
        // Reduced motion also stops star twinkle, including changes made while playing.
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
            cloud.visible = fade > 0 && boardValid && valid && edge > 0 && clearsBoard(r, this.boardRect);
            cloud.material.opacity = cloud.userData.opacity * edge * fade;
        }
        // A single instanced, loose V passes the distant sky for 18 seconds each 75 seconds.
        const pass = this.time % 75;
        this.flockCenter.set(-50 + pass * 5.5, -32 + Math.sin(pass * .15), -100);
        this.birds.material.opacity = fade;
        this.birds.visible = fade > 0 && !this.reduced.matches && pass < 18 && boardValid && projectBox(camera, this.flockCenter, this.flockHalf, this.objectRect) && clearsBoard(this.objectRect, this.boardRect);
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
