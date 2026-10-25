// The 3D valley: terrain (with the indicator wash driven by the authoritative grid),
// creek and pond water, olive terraces, stone walls, village, hives, sky and lights.

import * as THREE from 'three';
import { phenolphthalein, litmus, universalRGB } from '../sim/chem';
import type { Game } from '../sim/game';
import { Layout, distToPolyline, inRect, pondLevel, terrainHeight } from '../sim/layout';
import { Grid, KNOW_LITMUS, KNOW_PHENOL, KNOW_UNIVERSAL, Kind } from '../sim/world';
import { Models } from './models';

/** Merge two non-indexed copies of geometries into one (positions + normals only). */
function mergeGeos(a: THREE.BufferGeometry, b: THREE.BufferGeometry): THREE.BufferGeometry {
  const A = a.toNonIndexed();
  const B = b.toNonIndexed();
  const pos = new Float32Array([...(A.attributes.position.array as Float32Array), ...(B.attributes.position.array as Float32Array)]);
  const nor = new Float32Array([...(A.attributes.normal.array as Float32Array), ...(B.attributes.normal.array as Float32Array)]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return g;
}

const rand = (s: number) => {
  const x = Math.sin(s * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Injects the grid overlay into a standard material (wash colour, grey unknown, salt, glow). */
function overlayMaterial(base: THREE.MeshStandardMaterial, uniforms: Record<string, THREE.IUniform>) {
  base.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vWPos;
uniform sampler2D uOverlay;
uniform sampler2D uState;
uniform float uSize;
uniform float uGlow;
uniform float uTime;
vec4 ovC;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  vec2 wob = vec2(sin(vWPos.z * 0.9 + vWPos.x * 0.35), cos(vWPos.x * 0.8 - vWPos.z * 0.45)) * 0.0045;
  vec2 uv = vWPos.xz / uSize + wob;
  ovC = texture2D(uOverlay, uv);
  vec4 st = texture2D(uState, uv);
  float g = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(g) * vec3(0.62, 0.62, 0.6), st.r * 0.9);
  diffuseColor.rgb = mix(diffuseColor.rgb, ovC.rgb, ovC.a);
  float n = fract(sin(dot(floor(vWPos.xz * 11.0), vec2(12.9898, 78.233))) * 43758.5453);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.97, 0.97, 0.94), step(0.84, n) * st.g * 0.8);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.55, 0.62, 0.75), st.a * 0.8);
  float rip = 0.5 + 0.5 * sin(uTime * 3.0 + vWPos.x * 1.7 + vWPos.z * 1.3);
  diffuseColor.rgb += st.b * rip * vec3(0.25, 0.2, 0.1);
}`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
totalEmissiveRadiance += ovC.rgb * ovC.a * uGlow;`,
      );
  };
  return base;
}

export class World {
  readonly scene = new THREE.Scene();
  readonly layout: Layout;
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  readonly terrain: THREE.Mesh;
  readonly uniforms: Record<string, THREE.IUniform>;
  private overlay: THREE.DataTexture;
  private state: THREE.DataTexture;
  private flowers: THREE.InstancedMesh;
  private flowerCells: number[] = [];
  private flowerColors: THREE.Color[] = [];
  private flowers2: THREE.InstancedMesh | null = null;
  private realFlowers = false;
  private bushes: THREE.InstancedMesh | null = null;
  private bushCells: number[] = [];
  private fish: THREE.Group[] = [];
  private bees: THREE.Points;
  private beeBase: Float32Array;
  private hiveCenters: THREE.Vector3[] = [];
  private dummy = new THREE.Object3D();
  private propGroup = new THREE.Group();
  private fireflies: THREE.Points | null = null;
  private bushModel = false;
  private mixers: THREE.AnimationMixer[] = [];
  /** Big props that fade out when they block the view of the ranger or the aim point. */
  private occluders: Array<{ obj: THREE.Object3D; c: THREE.Vector3; r: number; mats: THREE.Material[]; fade: number }> = [];
  private ticks: Array<(dt: number) => void> = [];
  private clouds: THREE.Sprite[] = [];
  private rain: THREE.InstancedMesh | null = null;
  private rainData: Float32Array | null = null;
  private stormCloud: THREE.Mesh | null = null;
  private curtain: THREE.Mesh | null = null;
  private skyBase = new THREE.Color();
  private sunBase = 0;
  private hemiBase = 0;
  /** 0..1 how much the ranger is under the storm (for sound and light). */
  stormHere = 0;
  /** Set when lightning should flash this frame. */
  lightning = false;
  private flashT = 0;
  private waterNormal: THREE.Texture | null = null;
  private creekNormal: THREE.Texture | null = null;
  private missionProps = new THREE.Group();
  private wagons: THREE.Object3D[] = [];
  night: boolean;

  private models: Models;

  constructor(layout: Layout, night: boolean, models: Models) {
    this.layout = layout;
    this.models = models;
    this.night = night;
    const n = Math.round(layout.size / layout.cell);
    const mk = () => {
      const t = new THREE.DataTexture(new Uint8Array(n * n * 4), n, n, THREE.RGBAFormat);
      t.magFilter = THREE.LinearFilter;
      t.minFilter = THREE.LinearFilter;
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      t.needsUpdate = true;
      return t;
    };
    this.overlay = mk();
    this.overlay.colorSpace = THREE.SRGBColorSpace;
    this.state = mk();
    this.uniforms = {
      uOverlay: { value: this.overlay },
      uState: { value: this.state },
      uSize: { value: layout.size },
      uGlow: { value: night ? 1.0 : 0.12 },
      uTime: { value: 0 },
    };

    // Sky, fog, lights.
    const sky = night ? new THREE.Color(0x0b1430) : new THREE.Color(0x9fd2f2);
    this.scene.background = sky;
    this.scene.fog = new THREE.Fog(night ? 0x0b1430 : 0xb9dcef, night ? 30 : 70, night ? 120 : 210);
    this.hemi = new THREE.HemisphereLight(night ? 0x4060a0 : 0xc4e2ff, night ? 0x101820 : 0x6a5634, night ? 0.4 : 1.0);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(night ? 0x9fb4ff : 0xffe6bf, night ? 0.45 : 2.3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -34;
    sc.right = 34;
    sc.top = 34;
    sc.bottom = -34;
    sc.near = 1;
    sc.far = 140;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);
    this.sunBase = this.sun.intensity;
    this.hemiBase = this.hemi.intensity;
    this.addSkyDome(night);

    this.terrain = this.buildTerrain();
    this.scene.add(this.terrain);
    this.buildWater();
    this.scene.add(this.propGroup, this.missionProps);
    this.buildProps(models);
    this.buildBackdrop();
    this.buildGrass();

    // Flowers that bloom on restored cells.
    // A bloom = a small flat flower head on a stem.
    const head = new THREE.CylinderGeometry(0.13, 0.1, 0.03, 7);
    head.translate(0, 0.32, 0);
    const stem = new THREE.CylinderGeometry(0.012, 0.012, 0.32, 3);
    stem.translate(0, 0.16, 0);
    const perCell = 7;
    // Tripo red anemones (כלניות) and daisies when available, simple stems otherwise.
    const anemone = models.meshOf('anemone', 0.3);
    const daisy = models.meshOf('poppy-daisy', 0.28);
    this.realFlowers = !!anemone;
    const fg = anemone ? anemone.geometry : mergeGeos(head, stem);
    const fm = anemone ? anemone.material : new THREE.MeshStandardMaterial({ roughness: 0.7 });
    this.flowers = new THREE.InstancedMesh(fg, fm, n * n * perCell);
    if (daisy) {
      this.flowers2 = new THREE.InstancedMesh(daisy.geometry, daisy.material, n * n * perCell);
      this.flowers2.count = 0;
      this.flowers2.frustumCulled = false;
      this.flowers2.castShadow = false;
      this.scene.add(this.flowers2);
    }
    this.flowers.count = 0;
    this.flowers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.flowers.frustumCulled = false;
    const palette = [0xe53935, 0xffffff, 0xffd54f, 0xf06292, 0xffffff, 0xba68c8, 0xe53935];
    const col = new THREE.Color();
    for (let c = 0; c < n * n; c++) {
      for (let k = 0; k < perCell; k++) {
        this.flowerCells.push(c);
        col.setHex(this.realFlowers ? 0xffffff : palette[(c * 7 + k) % palette.length]);
        this.flowerColors.push(col.clone());
        this.flowers.setColorAt(this.flowerCells.length - 1, col);
      }
    }
    this.flowers.count = this.flowerCells.length;
    this.scene.add(this.flowers);

    // Fireflies at night.
    if (night) {
      const fp = new Float32Array(260 * 3);
      for (let i = 0; i < 260; i++) {
        const x = rand(i * 3.1) * layout.size;
        const z = rand(i * 5.7) * layout.size;
        fp[i * 3] = x;
        fp[i * 3 + 1] = terrainHeight(layout, x, z) + 0.5 + rand(i) * 2;
        fp[i * 3 + 2] = z;
      }
      const fgeo = new THREE.BufferGeometry();
      fgeo.setAttribute('position', new THREE.BufferAttribute(fp, 3));
      this.fireflies = new THREE.Points(fgeo, new THREE.PointsMaterial({ color: 0xfff176, size: 0.14, transparent: true, opacity: 0.9 }));
      this.scene.add(this.fireflies);
    }
    // Bees.
    const beeCount = 90;
    const bp = new Float32Array(beeCount * 3);
    this.beeBase = new Float32Array(beeCount * 4);
    for (const h of layout.hives) this.hiveCenters.push(new THREE.Vector3(h[0], terrainHeight(layout, h[0], h[1]) + 1, h[1]));
    for (let i = 0; i < beeCount; i++) {
      this.beeBase[i * 4] = i % this.hiveCenters.length;
      this.beeBase[i * 4 + 1] = rand(i) * Math.PI * 2;
      this.beeBase[i * 4 + 2] = 0.6 + rand(i + 9) * 2.4;
      this.beeBase[i * 4 + 3] = 0.8 + rand(i + 19) * 1.6;
    }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(bp, 3));
    this.bees = new THREE.Points(bg, new THREE.PointsMaterial({ color: 0xffd000, size: 0.16, sizeAttenuation: true }));
    this.bees.frustumCulled = false;
    this.scene.add(this.bees);
  }

  private addSkyDome(night: boolean) {
    const g = new THREE.SphereGeometry(400, 32, 16);
    const m = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color(night ? 0x050a1e : 0x4f9fe0) },
        bottom: { value: new THREE.Color(night ? 0x1b2a52 : 0xd8eef8) },
      },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader:
        'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(normalize(vP).y * 1.6 + 0.15, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, h), 1.0); }',
    });
    const dome = new THREE.Mesh(g, m);
    dome.position.set(48, 0, 48);
    this.scene.add(dome);
    if (night) {
      const sp = new Float32Array(900 * 3);
      for (let i = 0; i < 900; i++) {
        const th = rand(i) * Math.PI * 2;
        const ph = 0.08 + rand(i + 3) * 1.3;
        sp[i * 3] = 48 + Math.cos(th) * Math.cos(ph) * 380;
        sp[i * 3 + 1] = Math.sin(ph) * 380;
        sp[i * 3 + 2] = 48 + Math.sin(th) * Math.cos(ph) * 380;
      }
      const sg = new THREE.BufferGeometry();
      sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
      this.scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false })));
      const moon = new THREE.Mesh(new THREE.SphereGeometry(9, 24, 12), new THREE.MeshBasicMaterial({ color: 0xfff6d8, fog: false }));
      moon.position.set(-120, 160, -200);
      this.scene.add(moon);
    }
  }

  private groundColor(x: number, z: number): THREE.Color {
    const L = this.layout;
    const c = new THREE.Color();
    const n1 = rand(Math.floor(x * 0.7) * 31 + Math.floor(z * 0.7) * 17);
    const n2 = 0.5 + 0.5 * Math.sin(x * 0.21) * Math.cos(z * 0.17);
    // Base: Galilee grass, greener near the creek and in hollows.
    const creekD = distToPolyline(x, z, L.creek);
    const lush = Math.max(0, 1 - creekD / 14);
    c.setRGB(0.34 + n2 * 0.22 - lush * 0.12, 0.5 + n2 * 0.05 + lush * 0.05, 0.14 - n2 * 0.03);
    c.offsetHSL(0, 0, (n1 - 0.5) * 0.05);
    const mix = (r: number, g: number, b: number, t: number) => c.lerp(new THREE.Color(r, g, b), Math.min(1, Math.max(0, t)));
    if (inRect(L.terraces, x, z)) mix(0.62, 0.44, 0.3, 0.55 + n1 * 0.2);
    if (inRect(L.blueberry, x, z)) {
      const row = Math.abs(((z - L.blueberry.z0) % 3) - 1.5) < 0.6;
      mix(0.3, 0.22, 0.16, row ? 0.9 : 0.6);
    }
    const q = L.quarry;
    const qd = Math.hypot(x - q.x, z - q.z);
    if (qd < q.r + 3) mix(0.9, 0.88, 0.82, 1 - Math.max(0, (qd - q.r) / 3));
    const rd = distToPolyline(x, z, L.road);
    if (rd < 2.2) mix(0.66, 0.48, 0.32, 1 - Math.max(0, (rd - 1.2) / 1));
    if (creekD < 1.8) mix(0.48, 0.44, 0.38, 1 - creekD / 1.8);
    const sd = Math.hypot(x - L.school.x, z - (L.school.z - 6));
    if (sd < 5.5) mix(0.82, 0.74, 0.56, 1 - Math.max(0, (sd - 4.5) / 1));
    const pd = Math.hypot(x - L.pond.x, z - L.pond.z);
    if (pd < L.pond.r + 2.5) mix(0.45, 0.4, 0.3, 1 - Math.max(0, (pd - L.pond.r) / 2.5));
    return c;
  }

  private buildTerrain(): THREE.Mesh {
    const L = this.layout;
    const pad = 60;
    const S = L.size + pad * 2;
    const seg = 220;
    const geo = new THREE.PlaneGeometry(S, S, seg, seg);
    geo.rotateX(-Math.PI / 2);
    geo.translate(L.size / 2, 0, L.size / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const inside = x >= 0 && x <= L.size && z >= 0 && z <= L.size;
      const cx = Math.min(L.size, Math.max(0, x));
      const cz = Math.min(L.size, Math.max(0, z));
      let h = terrainHeight(L, cx, cz);
      if (!inside) {
        const d = Math.max(-x, x - L.size, -z, z - L.size, 0);
        h += d * 0.35 + Math.sin(x * 0.08) * Math.cos(z * 0.07) * d * 0.08;
      }
      pos.setY(i, h);
      const col = this.groundColor(cx, cz);
      if (!inside) col.lerp(new THREE.Color(0.6, 0.62, 0.36), 0.5);
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = overlayMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }), this.uniforms);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    return mesh;
  }

  /** Tiling ripple normal map, drawn once on a canvas. */
  private rippleNormals(): THREE.Texture {
    const N = 128;
    const h = new Float32Array(N * N);
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const u = (x / N) * Math.PI * 2;
        const v = (y / N) * Math.PI * 2;
        h[y * N + x] = Math.sin(u * 3 + Math.sin(v * 2) * 1.5) * 0.5 + Math.sin(v * 5 + u * 2) * 0.3 + Math.sin(u * 7 - v * 4) * 0.2;
      }
    const cv = document.createElement('canvas');
    cv.width = cv.height = N;
    const ctx = cv.getContext('2d')!;
    const img = ctx.createImageData(N, N);
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const dx = h[y * N + ((x + 1) % N)] - h[y * N + ((x + N - 1) % N)];
        const dy = h[((y + 1) % N) * N + x] - h[((y + N - 1) % N) * N + x];
        const nx = -dx * 1.4;
        const ny = -dy * 1.4;
        const l = Math.hypot(nx, ny, 1);
        const i = (y * N + x) * 4;
        img.data[i] = ((nx / l) * 0.5 + 0.5) * 255;
        img.data[i + 1] = ((ny / l) * 0.5 + 0.5) * 255;
        img.data[i + 2] = ((1 / l) * 0.5 + 0.5) * 255;
        img.data[i + 3] = 255;
      }
    ctx.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(0.25, 0.25);
    return t;
  }

  private buildWater() {
    const L = this.layout;
    this.waterNormal = this.rippleNormals();
    const mat = overlayMaterial(
      new THREE.MeshStandardMaterial({
        color: this.night ? 0x1a3a5a : 0x3f9fd4,
        roughness: 0.08,
        metalness: 0.15,
        transparent: true,
        opacity: 0.88,
        normalMap: this.waterNormal,
        normalScale: new THREE.Vector2(0.6, 0.6),
      }),
      this.uniforms,
    );
    // Creek ribbon: its own material so the ripples can flow downstream, foam at the edges.
    this.creekNormal = this.waterNormal.clone();
    this.creekNormal.wrapS = this.creekNormal.wrapT = THREE.RepeatWrapping;
    this.creekNormal.repeat.set(1, 1);
    const creekMat = overlayMaterial(
      new THREE.MeshStandardMaterial({
        color: this.night ? 0x5a7fa0 : 0xffffff,
        vertexColors: true,
        roughness: 0.06,
        metalness: 0.1,
        transparent: true,
        opacity: 0.9,
        normalMap: this.creekNormal,
        normalScale: new THREE.Vector2(0.9, 0.9),
      }),
      this.uniforms,
    );
    const pts: THREE.Vector3[] = [];
    for (let s = 0; s < L.creek.length - 1; s++) {
      const a = L.creek[s];
      const b = L.creek[s + 1];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const steps = Math.ceil(len);
      for (let k = 0; k < steps; k++) {
        const t = k / steps;
        const x = a[0] + (b[0] - a[0]) * t;
        const z = a[1] + (b[1] - a[1]) * t;
        pts.push(new THREE.Vector3(x, 0, z));
      }
    }
    pts.push(new THREE.Vector3(L.creek[L.creek.length - 1][0], 0, L.creek[L.creek.length - 1][1]));
    const verts: number[] = [];
    const uvs: number[] = [];
    const cols: number[] = [];
    const idx: number[] = [];
    let along = 0;
    const bankStones: Array<[number, number]> = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const q = pts[Math.min(pts.length - 1, i + 1)];
      const r = pts[Math.max(0, i - 1)];
      const dx = q.x - r.x;
      const dz = q.z - r.z;
      const d = Math.hypot(dx, dz) || 1;
      const nx = -dz / d;
      const nz = dx / d;
      if (i > 0) along += p.distanceTo(pts[i - 1]);
      // Three strips across: foamy edge, deep middle, foamy edge. Edges hug the bank.
      const y = terrainHeight(L, p.x, p.z) + 0.85;
      const offs = [1.8, 0.7, -0.7, -1.8];
      for (const o of offs) {
        const ex = p.x + nx * o;
        const ez = p.z + nz * o;
        const ey = Math.abs(o) > 1 ? Math.min(y, terrainHeight(L, ex, ez) + 0.06) : y;
        verts.push(ex, ey, ez);
        uvs.push((o + 1.8) / 3.6, along / 4);
        if (this.night) cols.push(0.6, 0.7, 0.85);
        else if (Math.abs(o) > 1) cols.push(0.82, 0.93, 1.0);
        else cols.push(0.3, 0.62, 0.86);
      }
      if (i < pts.length - 1) {
        const k = i * 4;
        for (let c = 0; c < 3; c++) idx.push(k + c, k + c + 1, k + c + 4, k + c + 1, k + c + 5, k + c + 4);
      }
      if (i % 3 === 0) {
        bankStones.push([p.x + nx * (2.1 + rand(i) * 0.4), p.z + nz * (2.1 + rand(i) * 0.4)]);
        bankStones.push([p.x - nx * (2.1 + rand(i + 1) * 0.4), p.z - nz * (2.1 + rand(i + 1) * 0.4)]);
      }
    }
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    cg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    cg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    cg.setIndex(idx);
    cg.computeVertexNormals();
    const creek = new THREE.Mesh(cg, creekMat);
    // Stones lining both banks.
    const stone = this.models.meshOf('rocks', 0.45);
    if (stone) {
      const sm = new THREE.InstancedMesh(stone.geometry, stone.material, bankStones.length);
      bankStones.forEach(([x, z], i) => {
        this.dummy.position.set(x, terrainHeight(L, x, z) - 0.08, z);
        this.dummy.rotation.set(0, rand(i * 5) * 6, 0);
        this.dummy.scale.setScalar(0.7 + rand(i * 3) * 0.8);
        this.dummy.updateMatrix();
        sm.setMatrixAt(i, this.dummy.matrix);
      });
      sm.castShadow = true;
      this.scene.add(sm);
    }
    creek.receiveShadow = true;
    this.scene.add(creek);
    // Pond.
    const pond = new THREE.Mesh(new THREE.CircleGeometry(L.pond.r + 1.2, 48), mat);
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(L.pond.x, pondLevel(L), L.pond.z);
    pond.receiveShadow = true;
    this.scene.add(pond);
    // Reeds around the pond.
    const reedG = new THREE.ConeGeometry(0.06, 1.4, 4);
    reedG.translate(0, 0.7, 0);
    const reeds = new THREE.InstancedMesh(reedG, new THREE.MeshStandardMaterial({ color: 0x6b8f3a }), 70);
    for (let i = 0; i < 70; i++) {
      const a = rand(i * 3) * Math.PI * 2;
      const r = L.pond.r + 0.6 + rand(i * 5) * 1.6;
      const x = L.pond.x + Math.cos(a) * r;
      const z = L.pond.z + Math.sin(a) * r;
      this.dummy.position.set(x, terrainHeight(L, x, z) - 0.1, z);
      this.dummy.rotation.set((rand(i) - 0.5) * 0.3, 0, (rand(i + 1) - 0.5) * 0.3);
      this.dummy.scale.setScalar(0.7 + rand(i + 2) * 0.6);
      this.dummy.updateMatrix();
      reeds.setMatrixAt(i, this.dummy.matrix);
    }
    this.scene.add(reeds);
    // Fish.
    const fishMat = new THREE.MeshStandardMaterial({ color: 0xff8f3a, roughness: 0.5 });
    for (let i = 0; i < 6; i++) {
      const fm = this.models.fish();
      if (fm) {
        // The Tripo fish's head points +x, which is what the swim code expects.
        const f = new THREE.Group();
        f.add(fm);
        f.userData.phase = rand(i + 40) * 10;
        this.fish.push(f);
        this.scene.add(f);
        continue;
      }
      const f = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 6), fishMat);
      body.scale.set(1.8, 0.8, 0.6);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 4), fishMat);
      tail.rotation.z = Math.PI / 2;
      tail.position.x = -0.48;
      f.add(body, tail);
      f.userData.phase = rand(i + 40) * 10;
      this.fish.push(f);
      this.scene.add(f);
    }
  }

  private buildProps(models: Models) {
    const L = this.layout;
    const g = this.propGroup;
    // Olive trees (Tripo model when available, otherwise procedural).
    for (const t of L.trees) {
      const tree = models.olive();
      tree.scale.multiplyScalar(t.s);
      tree.position.set(t.x, terrainHeight(L, t.x, t.z) - 0.05, t.z);
      tree.rotation.y = rand(t.x * 13 + t.z) * Math.PI * 2;
      g.add(tree);
      this.addOccluder(tree);
    }
    // Stone walls.
    const stoneG = new THREE.DodecahedronGeometry(0.42, 0);
    const walls: THREE.Matrix4[] = [];
    const addWall = (a: readonly [number, number], b: readonly [number, number], rows = 2, sc = 1) => {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let k = 0; k < len / (0.62 * sc); k++) {
        const t = k / (len / (0.62 * sc));
        for (let row = 0; row < rows; row++) {
          const x = a[0] + (b[0] - a[0]) * t + (rand(k + row * 7) - 0.5) * 0.2;
          const z = a[1] + (b[1] - a[1]) * t + (rand(k * 3 + row) - 0.5) * 0.2;
          this.dummy.position.set(x, terrainHeight(L, x, z) + 0.3 + row * 0.5, z);
          this.dummy.rotation.set(rand(k), rand(k + 1) * 3, rand(k + 2));
          this.dummy.scale.set((1 + rand(k + 5) * 0.4) * sc, 0.75 * sc, 0.9 * sc);
          this.dummy.updateMatrix();
          walls.push(this.dummy.matrix.clone());
        }
      }
    };
    const T = L.terraces;
    const wallModel = models.meshOf('wall', 0.85);
    if (wallModel) {
      // Tripo dry-stone wall segments laid end to end along every wall and terrace edge.
      const segs: THREE.Matrix4[] = [];
      const lay = (a: readonly [number, number], b: readonly [number, number], sc: number) => {
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const step = wallModel.length * sc * 0.96;
        const ang = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
        for (let d = step / 2; d < len; d += step) {
          const t = d / len;
          const x = a[0] + (b[0] - a[0]) * t;
          const z = a[1] + (b[1] - a[1]) * t;
          this.dummy.position.set(x, terrainHeight(L, x, z) - 0.05, z);
          this.dummy.rotation.set(0, ang + (rand(d * 7) - 0.5) * 0.06, 0);
          this.dummy.scale.set(sc, sc * (0.9 + rand(d) * 0.2), sc);
          this.dummy.updateMatrix();
          segs.push(this.dummy.matrix.clone());
        }
      };
      for (const w of L.walls) lay(w[0], w[1], 1);
      for (let z = T.z0 + 4; z < T.z1; z += 5) lay([T.x0, z], [T.x1, z], 0.75);
      // Tint the slightly yellow Tripo stone toward the mockups' grey-cream limestone.
      const wmat = (wallModel.material as THREE.MeshStandardMaterial).clone();
      wmat.color.setRGB(0.95, 0.94, 1.0);
      const wm = new THREE.InstancedMesh(wallModel.geometry, wmat, segs.length);
      segs.forEach((m, i) => wm.setMatrixAt(i, m));
      wm.castShadow = true;
      wm.receiveShadow = true;
      g.add(wm);
    } else {
      for (const w of L.walls) addWall(w[0], w[1], 1, 0.8);
      // Terrace retaining walls along each bench row.
      for (let z = T.z0 + 4; z < T.z1; z += 5) addWall([T.x0, z], [T.x1, z], 1, 0.55);
      const wallMesh = new THREE.InstancedMesh(stoneG, new THREE.MeshStandardMaterial({ color: 0xcbbfa6, roughness: 1, flatShading: true }), walls.length);
      walls.forEach((m, i) => wallMesh.setMatrixAt(i, m));
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
      g.add(wallMesh);
    }
    // Scattered rocks.
    const rocks: THREE.Matrix4[] = [];
    for (let i = 0; i < 160; i++) {
      const x = rand(i * 11) * L.size;
      const z = rand(i * 17 + 3) * L.size;
      if (distToPolyline(x, z, L.road) < 2.5 || Math.hypot(x - L.pond.x, z - L.pond.z) < L.pond.r + 1) continue;
      this.dummy.position.set(x, terrainHeight(L, x, z) + 0.1, z);
      this.dummy.rotation.set(rand(i), rand(i + 1) * 6, rand(i + 2));
      this.dummy.scale.setScalar(0.4 + rand(i + 3) * 1.1);
      this.dummy.updateMatrix();
      rocks.push(this.dummy.matrix.clone());
    }
    const rockModel = models.meshOf('rocks', 0.9);
    const rockMesh = rockModel
      ? new THREE.InstancedMesh(rockModel.geometry, rockModel.material, rocks.length)
      : new THREE.InstancedMesh(stoneG, new THREE.MeshStandardMaterial({ color: 0xd8d0bf, roughness: 1, flatShading: true }), rocks.length);
    if (rockModel) {
      // Rocks sit upright, only spun around y.
      rocks.forEach((m, i) => {
        const p = new THREE.Vector3().setFromMatrixPosition(m);
        this.dummy.position.copy(p).setY(p.y - 0.15);
        this.dummy.rotation.set(0, rand(i * 3) * 6, 0);
        this.dummy.scale.setScalar(0.5 + rand(i + 3) * 1.2);
        this.dummy.updateMatrix();
        m.copy(this.dummy.matrix);
      });
    }
    rocks.forEach((m, i) => rockMesh.setMatrixAt(i, m));
    rockMesh.castShadow = true;
    g.add(rockMesh);
    // Quarry blocks.
    const q = L.quarry;
    const blockMat = new THREE.MeshStandardMaterial({ color: 0xf1ede2, roughness: 0.9, flatShading: true });
    for (let i = 0; i < 14; i++) {
      const a = rand(i + 70) * Math.PI * 2;
      const r = q.r * (0.5 + rand(i + 80) * 0.6);
      const x = q.x + Math.cos(a) * r;
      const z = q.z + Math.sin(a) * r;
      const b = new THREE.Mesh(new THREE.BoxGeometry(1 + rand(i) * 2, 0.8 + rand(i + 1) * 1.5, 1 + rand(i + 2) * 2), blockMat);
      b.position.set(x, terrainHeight(L, x, z) + 0.4, z);
      b.rotation.y = rand(i + 3) * 3;
      b.castShadow = true;
      g.add(b);
    }
    // Houses + school.
    const wallM = new THREE.MeshStandardMaterial({ color: 0xe9dcc3, roughness: 0.95 });
    const roofM = new THREE.MeshStandardMaterial({ color: 0xc9b89a, roughness: 0.95 });
    const winM = new THREE.MeshStandardMaterial({ color: this.night ? 0xffd27a : 0x4a6b8a, emissive: this.night ? 0xffb347 : 0x000000, emissiveIntensity: this.night ? 1.2 : 0 });
    const house = (x: number, z: number, rot: number, w: number, d: number, h: number) => {
      const grp = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallM);
      body.position.y = h / 2;
      const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.3, d + 0.4), roofM);
      roof.position.y = h + 0.15;
      grp.add(body, roof);
      for (let k = -1; k <= 1; k += 2) {
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.9, 0.05), winM);
        win.position.set(k * w * 0.25, h * 0.6, d / 2 + 0.03);
        grp.add(win);
      }
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.6, 0.05), new THREE.MeshStandardMaterial({ color: 0x3f7fa3 }));
      door.position.set(0, 0.8, d / 2 + 0.03);
      grp.add(door);
      grp.position.set(x, terrainHeight(L, x, z) - 0.1, z);
      grp.rotation.y = rot;
      grp.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      g.add(grp);
      return grp;
    };
    for (const hs of L.houses) {
      const tm = models.house();
      if (tm) {
        tm.position.set(hs.x, terrainHeight(L, hs.x, hs.z) - 0.1, hs.z);
        tm.rotation.y = hs.rot;
        tm.scale.multiplyScalar(Math.max(hs.w, hs.d) / 5.5);
        g.add(tm);
        this.addOccluder(tm);
      } else house(hs.x, hs.z, hs.rot, hs.w, hs.d, 3.2);
    }
    const schoolModel = models.school();
    let school: THREE.Object3D;
    if (schoolModel) {
      schoolModel.position.set(L.school.x, terrainHeight(L, L.school.x, L.school.z) - 0.1, L.school.z);
      schoolModel.rotation.y = L.school.rot + Math.PI;
      g.add(schoolModel);
      this.addOccluder(schoolModel);
      school = new THREE.Group();
      school.position.copy(schoolModel.position);
      school.rotation.y = L.school.rot;
      g.add(school);
    } else school = house(L.school.x, L.school.z, L.school.rot, 9, 5, 4);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 4.5), new THREE.MeshStandardMaterial({ color: 0xcccccc }));
    pole.position.set(5.2, 2.25, 2);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8), new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
    flag.position.set(5.8, 4, 2);
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.12), new THREE.MeshStandardMaterial({ color: 0x1e5bd8, side: THREE.DoubleSide }));
    stripe.position.set(5.8, 4.25, 2.01);
    if (!schoolModel) school.add(pole, flag, stripe);
    // Swing in the yard.
    const sw = new THREE.Group();
    const barM = new THREE.MeshStandardMaterial({ color: 0xd84315 });
    for (const sx of [-1.2, 1.2]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4), barM);
      leg.position.set(sx, 1.2, 0);
      sw.add(leg);
    }
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6), barM);
    top.rotation.z = Math.PI / 2;
    top.position.y = 2.4;
    sw.add(top);
    const sx = L.school.x + 3;
    const szz = L.school.z - 7;
    sw.position.set(sx, terrainHeight(L, sx, szz), szz);
    g.add(sw);
    // Beehives.
    for (const h of L.hives) {
      const hive = models.hive();
      hive.position.set(h[0], terrainHeight(L, h[0], h[1]), h[1]);
      hive.rotation.y = rand(h[0]) * 0.6;
      g.add(hive);
    }
    // Blueberry bushes.
    const B = L.blueberry;
    const cells: Array<[number, number]> = [];
    for (let z = B.z0 + 1; z < B.z1; z += 3) for (let x = B.x0 + 0.8; x < B.x1; x += 1.4) cells.push([x, z]);
    const bushModel = models.meshOf('bush', 1.0);
    const bushG = bushModel ? bushModel.geometry : new THREE.IcosahedronGeometry(0.62, 1);
    const bushMat = bushModel ? (bushModel.material as THREE.MeshStandardMaterial).clone() : new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true });
    if (bushModel) bushMat.color.setRGB(1.5, 1.5, 1.5);
    this.bushModel = !!bushModel;
    this.bushes = new THREE.InstancedMesh(bushG, bushMat, cells.length);
    const grid = new Grid(L);
    cells.forEach(([x, z], i) => {
      this.dummy.position.set(x, terrainHeight(L, x, z) + (this.bushModel ? -0.15 : 0.45), z);
      this.dummy.scale.set(1, this.bushModel ? 0.9 + rand(i) * 0.3 : 0.85, 1);
      this.dummy.rotation.y = rand(i) * 3;
      this.dummy.updateMatrix();
      this.bushes!.setMatrixAt(i, this.dummy.matrix);
      this.bushCells.push(grid.cellAt(x, z));
    });
    this.bushes.castShadow = true;
    g.add(this.bushes);
    // Spilled tanker.
    if (L.truck) {
      const tr = models.truck();
      tr.position.set(L.truck.x, terrainHeight(L, L.truck.x, L.truck.z), L.truck.z);
      tr.rotation.y = L.truck.rot;
      g.add(tr);
    }
  }

  /** Grass tufts and wildflowers so the meadow reads as alive from the chase camera. */
  private buildGrass() {
    const L = this.layout;
    // A tuft = five thin blades fanned around the centre.
    const bv: number[] = [];
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      const lean = 0.12;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const w = 0.045;
      bv.push(-sa * w, 0, ca * w, sa * w, 0, -ca * w, ca * lean, 0.36 + (k % 2) * 0.12, sa * lean);
    }
    const tuftG = new THREE.BufferGeometry();
    tuftG.setAttribute('position', new THREE.Float32BufferAttribute(bv, 3));
    tuftG.computeVertexNormals();
    const N = 14000;
    const tufts = new THREE.InstancedMesh(tuftG, new THREE.MeshStandardMaterial({ roughness: 1, side: THREE.DoubleSide }), N);
    const fh = new THREE.CylinderGeometry(0.07, 0.05, 0.02, 6);
    fh.translate(0, 0.26, 0);
    const fs = new THREE.CylinderGeometry(0.008, 0.008, 0.26, 3);
    fs.translate(0, 0.13, 0);
    const flowerG = mergeGeos(fh, fs);
    const flowers = new THREE.InstancedMesh(flowerG, new THREE.MeshStandardMaterial({ roughness: 0.8 }), 1500);
    const col = new THREE.Color();
    const fcols = [0xffffff, 0xffe066, 0xe53935, 0xf8bbd0];
    let n = 0;
    let fn = 0;
    for (let i = 0; i < N * 1.6 && n < N; i++) {
      const x = rand(i * 1.37 + 0.1) * L.size;
      const z = rand(i * 2.71 + 0.7) * L.size;
      if (distToPolyline(x, z, L.road) < 2 || distToPolyline(x, z, L.creek) < 1.6) continue;
      if (Math.hypot(x - L.pond.x, z - L.pond.z) < L.pond.r + 0.5) continue;
      if (Math.hypot(x - L.quarry.x, z - L.quarry.z) < L.quarry.r) continue;
      if (inRect(L.blueberry, x, z) || Math.hypot(x - L.school.x, z - (L.school.z - 6)) < 5.5) continue;
      const base = this.groundColor(x, z);
      this.dummy.position.set(x, terrainHeight(L, x, z) - 0.02, z);
      this.dummy.rotation.set((rand(i) - 0.5) * 0.5, rand(i + 3) * 6, (rand(i + 5) - 0.5) * 0.5);
      this.dummy.scale.setScalar(0.6 + rand(i + 7) * 0.9);
      this.dummy.updateMatrix();
      tufts.setMatrixAt(n, this.dummy.matrix);
      col.copy(base).offsetHSL(0.01, 0.1, 0.02 + rand(i + 9) * 0.08);
      tufts.setColorAt(n, col);
      n++;
      if (fn < 1500 && rand(i + 11) < 0.13) {
        this.dummy.rotation.set(0, 0, 0);
        this.dummy.scale.setScalar(0.8 + rand(i + 13) * 0.6);
        this.dummy.updateMatrix();
        flowers.setMatrixAt(fn, this.dummy.matrix);
        flowers.setColorAt(fn, col.setHex(fcols[fn % fcols.length]));
        fn++;
      }
    }
    tufts.count = n;
    flowers.count = fn;
    tufts.receiveShadow = true;
    this.scene.add(tufts, flowers);
  }

  /** Distant hills with hilltop villages, like the mockups' backdrop. */
  private buildBackdrop() {
    const L = this.layout;
    const night = this.night;
    const cx = L.size / 2;
    const cz = L.size / 2;
    // Rolling Galilee hills: an annulus of terrain beyond the play area, rising outward.
    const rings = 40;
    const segs = 160;
    const r0 = 66;
    const r1 = 300;
    const pos: number[] = [];
    const col: number[] = [];
    const idx: number[] = [];
    const c = new THREE.Color();
    const hillH = (x: number, z: number, r: number) => {
      const t = (r - r0) / (r1 - r0);
      const n =
        Math.sin(x * 0.021 + 1.3) * Math.cos(z * 0.017) * 0.5 +
        Math.sin(x * 0.047 - z * 0.031) * 0.3 +
        Math.cos(z * 0.06 + x * 0.013) * 0.2;
      return 4 + Math.pow(t, 0.7) * (34 + n * 26) + n * 4;
    };
    for (let i = 0; i <= rings; i++) {
      const r = r0 + ((r1 - r0) * i) / rings;
      for (let j = 0; j < segs; j++) {
        const a = (j / segs) * Math.PI * 2;
        const x = cx + Math.cos(a) * r;
        const z = cz + Math.sin(a) * r;
        const h = hillH(x, z, r);
        pos.push(x, h, z);
        const band = Math.sin(h * 1.1) > 0.6; // terrace stripes
        const n = rand(i * 977 + j);
        if (night) c.setRGB(0.07, 0.1, 0.12);
        else {
          c.setRGB(0.5 + n * 0.08, 0.56 + n * 0.06, 0.28);
          if (h > 28) c.lerp(new THREE.Color(0.78, 0.7, 0.46), Math.min(1, (h - 28) / 18));
          if (band) c.multiplyScalar(0.86);
        }
        col.push(c.r, c.g, c.b);
        if (i < rings) {
          const k = i * segs + j;
          const k2 = i * segs + ((j + 1) % segs);
          idx.push(k, k + segs, k2, k2, k + segs, k2 + segs);
        }
      }
    }
    const hg = new THREE.BufferGeometry();
    hg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    hg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    hg.setIndex(idx);
    hg.computeVertexNormals();
    const hills = new THREE.Mesh(hg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
    hills.receiveShadow = false;
    this.scene.add(hills);

    // Olive groves and cypress dots on the hills, and white villages on a few crests.
    const blobG = new THREE.IcosahedronGeometry(1.6, 0);
    const blobs = new THREE.InstancedMesh(blobG, new THREE.MeshStandardMaterial({ color: night ? 0x0d1a12 : 0x5f7a3a, roughness: 1, flatShading: true }), 900);
    const cypModel = this.models.meshOf('cypress', 7);
    let cypG: THREE.BufferGeometry;
    let cypMat: THREE.Material;
    if (cypModel) {
      cypG = cypModel.geometry;
      cypMat = cypModel.material;
    } else {
      cypG = new THREE.ConeGeometry(0.9, 7, 6);
      cypG.translate(0, 3.5, 0);
      cypMat = new THREE.MeshStandardMaterial({ color: night ? 0x0a140d : 0x2f5a2a, roughness: 1, flatShading: true });
    }
    const cyps = new THREE.InstancedMesh(cypG, cypMat, 260);
    let nb = 0;
    let nc = 0;
    for (let i = 0; i < 2400 && (nb < 900 || nc < 260); i++) {
      const a = rand(i * 3.3) * Math.PI * 2;
      const r = r0 + 6 + rand(i * 7.1) * 150;
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r;
      const h = hillH(x, z, r);
      if (rand(i * 5.9) < 0.78 && nb < 900) {
        this.dummy.position.set(x, h - 0.5, z);
        this.dummy.scale.set(1 + rand(i) * 0.8, 0.8 + rand(i + 1) * 0.5, 1 + rand(i + 2) * 0.8);
        this.dummy.rotation.set(0, rand(i) * 6, 0);
        this.dummy.updateMatrix();
        blobs.setMatrixAt(nb++, this.dummy.matrix);
      } else if (nc < 260) {
        this.dummy.position.set(x, h - 0.3, z);
        this.dummy.scale.setScalar(0.7 + rand(i + 4) * 0.7);
        this.dummy.rotation.set(0, 0, 0);
        this.dummy.updateMatrix();
        cyps.setMatrixAt(nc++, this.dummy.matrix);
      }
    }
    blobs.count = nb;
    cyps.count = nc;
    this.scene.add(blobs, cyps);
    const houseM = new THREE.MeshStandardMaterial({ color: night ? 0x3a4250 : 0xf1e8d6, roughness: 1 });
    const winM = new THREE.MeshBasicMaterial({ color: 0xffc766 });
    for (let v = 0; v < 6; v++) {
      const a = (v / 6) * Math.PI * 2 + 0.4;
      const r = 150 + rand(v * 13) * 60;
      const vx = cx + Math.cos(a) * r;
      const vz = cz + Math.sin(a) * r;
      for (let k = 0; k < 16; k++) {
        const hx = vx + (rand(v * 31 + k) - 0.5) * 34;
        const hz = vz + (rand(v * 17 + k) - 0.5) * 22;
        const hh = hillH(hx, hz, Math.hypot(hx - cx, hz - cz));
        const w = 3 + rand(k) * 3;
        const box = new THREE.Mesh(new THREE.BoxGeometry(w, 2.6 + rand(k + 1) * 2, w * (0.7 + rand(k + 2) * 0.5)), houseM);
        box.position.set(hx, hh + 1.2, hz);
        box.rotation.y = rand(k + v) * 3;
        this.scene.add(box);
        if (night && rand(k * 3 + v) < 0.5) {
          const win = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), winM);
          win.position.set(hx, hh + 2, hz);
          win.lookAt(cx, hh + 2, cz);
          win.translateZ(w / 2 + 0.05);
          this.scene.add(win);
        }
      }
    }

    // Soft clouds by day.
    if (!night) {
      const cc = document.createElement('canvas');
      cc.width = 128;
      cc.height = 64;
      const x2 = cc.getContext('2d')!;
      for (let k = 0; k < 9; k++) {
        const gx = 20 + rand(k) * 88;
        const gy = 26 + rand(k + 3) * 16;
        const gr = 14 + rand(k + 6) * 16;
        const gg = x2.createRadialGradient(gx, gy, 1, gx, gy, gr);
        gg.addColorStop(0, 'rgba(255,255,255,0.95)');
        gg.addColorStop(1, 'rgba(255,255,255,0)');
        x2.fillStyle = gg;
        x2.fillRect(0, 0, 128, 64);
      }
      const ct = new THREE.CanvasTexture(cc);
      ct.colorSpace = THREE.SRGBColorSpace;
      for (let k = 0; k < 14; k++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ct, transparent: true, depthWrite: false, fog: false, opacity: 0.85 }));
        const a = rand(k * 9) * Math.PI * 2;
        const r = 120 + rand(k * 4) * 140;
        sp.position.set(cx + Math.cos(a) * r, 70 + rand(k * 2) * 40, cz + Math.sin(a) * r);
        sp.scale.set(70 + rand(k) * 50, 28 + rand(k + 1) * 14, 1);
        sp.userData.drift = 0.6 + rand(k + 7);
        this.clouds.push(sp);
        this.scene.add(sp);
      }
    }
  }

  /** Props that belong to one mission (wagons, lemons, lime dust, soap bottles). */
  setMission(game: Game, models: Models) {
    this.occluders = this.occluders.filter((o) => !this.wagons.includes(o.obj));
    this.missionProps.clear();
    this.mixers = [];
    this.ticks = [];
    this.wagons = [];
    const L = this.layout;
    for (const [x, z] of game.mission.wagons) {
      const w = models.wagon();
      w.position.set(x, terrainHeight(L, x, z), z);
      w.rotation.y = rand(x + z) * Math.PI * 2;
      this.missionProps.add(w);
      this.wagons.push(w);
      this.addOccluder(w);
      // A glowing refill ring.
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(3.2, 3.6, 40),
        new THREE.MeshBasicMaterial({ color: 0x7cfc9a, transparent: true, opacity: 0.55, depthWrite: false }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, terrainHeight(L, x, z) + 0.08, z);
      ring.userData.pulse = true;
      this.missionProps.add(ring);
    }
    const g = game.grid;
    const id = game.mission.id;
    const soft = this.softDecal();
    const puddle = (cells: number[], color: number, opacity: number) => {
      const m = overlayMaterial(
        new THREE.MeshStandardMaterial({ color, transparent: true, opacity, roughness: 0.08, metalness: 0.1, depthWrite: false, alphaMap: soft }),
        this.uniforms,
      );
      for (const c of cells) {
        const [x, z] = g.center(c);
        for (let k = 0; k < 3; k++) {
          const dx = x + (rand(c + k * 3) - 0.5) * 1.4;
          const dz = z + (rand(c * 7 + k) - 0.5) * 1.4;
          const d = new THREE.Mesh(new THREE.CircleGeometry(1.5 + rand(c + k) * 0.8, 20), m);
          d.rotation.x = -Math.PI / 2;
          d.scale.set(1, 0.7 + rand(k + c * 3) * 0.5, 1);
          d.position.set(dx, terrainHeight(L, dx, dz) + 0.07 + k * 0.004, dz);
          d.renderOrder = 2;
          this.missionProps.add(d);
        }
      }
    };
    const soilSpills = game.spill.filter((c) => g.kind[c] !== Kind.Creek && g.kind[c] !== Kind.Blueberry && g.kind[c] !== Kind.Pond);
    if (id === 'm1-lemon') puddle(soilSpills, 0xf5d000, 0.72);
    else if (id === 'm2-creek' || id === 'm6-night') puddle(soilSpills, 0xc8d36a, 0.45);
    else if (id === 'm4-blueberry') puddle(soilSpills.filter((c) => g.kind[c] === Kind.School), 0xb3e5fc, 0.5);
    if (id === 'm1-lemon') {
      const [x, z] = g.center(game.spill[2]);
      const tcrate = models.lemonCrate();
      if (tcrate) {
        // Tipped crate with its open side spilling toward the puddle.
        tcrate.scale.multiplyScalar(1.6);
        tcrate.position.set(x - 2.2, terrainHeight(L, x - 2.2, z - 1.6), z - 1.6);
        tcrate.rotation.y = Math.atan2(2.2, 1.6);
        this.missionProps.add(tcrate);
      } else {
        const crate = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 0.8), new THREE.MeshStandardMaterial({ color: 0x9c6b3a }));
        crate.position.set(x - 1.2, terrainHeight(L, x - 1.2, z - 1) + 0.25, z - 1);
        crate.rotation.set(0.4, 0.5, 0.9);
        crate.castShadow = true;
        this.missionProps.add(crate);
      }
      const lemonM = new THREE.MeshStandardMaterial({ color: 0xffea00, roughness: 0.45, emissive: 0x6b5a00, emissiveIntensity: 0.35 });
      for (let i = 0; i < 9; i++) {
        const lx = x + (rand(i) - 0.5) * 4;
        const lz = z + (rand(i + 5) - 0.5) * 4;
        const tl = models.lemon();
        if (tl) {
          tl.scale.multiplyScalar(1.6);
          tl.position.set(lx, terrainHeight(L, lx, lz) - 0.01, lz);
          tl.rotation.y = rand(i * 7) * 6;
          this.missionProps.add(tl);
          continue;
        }
        const lemon = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), lemonM);
        lemon.scale.set(1.25, 1, 1);
        lemon.position.set(lx, terrainHeight(L, lx, lz) + 0.17, lz);
        lemon.castShadow = true;
        this.missionProps.add(lemon);
      }
    }
    if (id === 'm3-quarry') {
      const dustM = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, transparent: true, opacity: 0.9, roughness: 1, depthWrite: false, alphaMap: soft });
      for (const c of [...game.spill, ...game.decoys]) {
        const [x, z] = g.center(c);
        for (let k = 0; k < 4; k++) {
          const dx = x + (rand(c + k) - 0.5) * 2;
          const dz = z + (rand(c * 3 + k) - 0.5) * 2;
          const d = new THREE.Mesh(new THREE.CircleGeometry(1.1 + rand(k + c) * 0.7, 18), dustM);
          d.rotation.x = -Math.PI / 2;
          d.position.set(dx, terrainHeight(L, dx, dz) + 0.06, dz);
          this.missionProps.add(d);
        }
      }
    }
    if (id === 'm3-quarry') {
      const fert = game.spill.find((c) => g.pH[c] < 5);
      if (fert !== undefined) {
        const [x, z] = g.center(fert);
        const sack = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 0.6), new THREE.MeshStandardMaterial({ color: 0xd7ccc8, roughness: 1 }));
        sack.position.set(x + 0.8, terrainHeight(L, x + 0.8, z) + 0.17, z - 0.5);
        sack.rotation.set(0.1, 0.6, 0.25);
        sack.castShadow = true;
        const label = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.2), new THREE.MeshStandardMaterial({ color: 0x2e7d32 }));
        label.position.set(0, 0.18, 0.01);
        label.rotation.x = -Math.PI / 2;
        sack.add(label);
        this.missionProps.add(sack);
        puddle([fert], 0xd9e7a0, 0.55);
      }
    }
    if (id === 'm4-blueberry') {
      const bottleM = new THREE.MeshStandardMaterial({ color: 0x29b6f6 });
      const [x, z] = g.center(game.spill[game.spill.length - 1]);
      for (let i = 0; i < 3; i++) {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.55, 10), bottleM);
        b.position.set(x + i * 0.5, terrainHeight(L, x, z) + 0.15, z + i * 0.3);
        b.rotation.z = Math.PI / 2;
        this.missionProps.add(b);
      }
      // Rina, the farmer.
      const rina = models.farmer();
      rina.position.set(L.blueberry.x1 + 2, terrainHeight(L, L.blueberry.x1 + 2, L.blueberry.z0 + 2), L.blueberry.z0 + 2);
      rina.rotation.y = -Math.PI / 2;
      this.missionProps.add(rina);
      if (rina.userData.mixer) this.mixers.push(rina.userData.mixer as THREE.AnimationMixer);
      if (rina.userData.tick) this.ticks.push(rina.userData.tick as (dt: number) => void);
    }
  }

  /** Push the grid's state into the overlay textures and animate living things. */
  update(game: Game, t: number, dt: number) {
    const g = game.grid;
    const ov = this.overlay.image.data as Uint8Array;
    const st = this.state.image.data as Uint8Array;
    for (let c = 0; c < g.count; c++) {
      const k = g.know[c];
      const p = g.pH[c];
      let r = 0;
      let gg = 0;
      let b = 0;
      let a = 0;
      if (k & KNOW_UNIVERSAL) {
        [r, gg, b] = universalRGB(p);
        // At night only problems glow brightly; healthy ground keeps a soft tint.
        a = this.night && g.inBand(c) ? 0.38 : 0.8;
      } else if (k & KNOW_PHENOL && phenolphthalein(p) !== 'colorless') {
        r = 1;
        gg = 0.3;
        b = 0.68;
        a = phenolphthalein(p) === 'pink' ? 0.78 : 0.5;
      } else if (k & KNOW_LITMUS) {
        const l = litmus(p);
        if (l === 'acid') [r, gg, b, a] = [0.9, 0.2, 0.2, 0.35];
        else if (l === 'base') [r, gg, b, a] = [0.15, 0.4, 0.95, 0.35];
      }
      const i4 = c * 4;
      ov[i4] = r * 255;
      ov[i4 + 1] = gg * 255;
      ov[i4 + 2] = b * 255;
      ov[i4 + 3] = a * 255;
      // Grey wash: stressed (out of band) or dust-covered ground nobody has measured exactly yet.
      const suspicious = g.suspect[c] === 1;
      const unknown = suspicious && !(k & KNOW_UNIVERSAL) ? (k & KNOW_PHENOL ? 0.55 : 0.85) : 0;
      st[i4] = unknown * 255;
      st[i4 + 1] = Math.min(1, g.S[c] * 30) * 255;
      st[i4 + 2] = Math.min(1, g.heat[c] * 60) * 255;
      // Wet ground from sprayed or flooding water: darker and bluer.
      st[i4 + 3] = Math.min(1, Math.max(0, g.V[c] - g.V0[c]) / 6) * 255;
    }
    this.overlay.needsUpdate = true;
    this.state.needsUpdate = true;
    this.uniforms.uTime.value = t;

    // Flowers bloom on restored cells.
    const L = this.layout;
    let fi = 0;
    let fj = 0;
    for (let i = 0; i < this.flowerCells.length; i++) {
      const c = this.flowerCells[i];
      const bl = g.bloom[c];
      if (bl < 0.05) continue;
      const kind = g.kind[c];
      if (kind === Kind.Creek || kind === Kind.Pond) continue;
      const [cx, cz] = g.center(c);
      const x = cx + (rand(i * 1.7) - 0.5) * 2.8;
      const z = cz + (rand(i * 2.3) - 0.5) * 2.8;
      this.dummy.position.set(x, terrainHeight(L, x, z) - 0.02, z);
      this.dummy.scale.setScalar(bl * (0.8 + rand(i) * 0.5));
      this.dummy.rotation.set(Math.sin(t * 1.5 + i) * 0.08, 0, Math.cos(t * 1.3 + i) * 0.08);
      this.dummy.rotation.y = rand(i * 3.1) * 6;
      this.dummy.updateMatrix();
      if (this.flowers2 && i % 3 === 1) {
        this.flowers2.setMatrixAt(fj++, this.dummy.matrix);
        continue;
      }
      this.flowers.setMatrixAt(fi, this.dummy.matrix);
      this.flowers.setColorAt(fi, this.flowerColors[i]);
      fi++;
    }
    if (this.flowers2) {
      this.flowers2.count = fj;
      this.flowers2.instanceMatrix.needsUpdate = true;
    }
    this.flowers.count = fi;
    this.flowers.instanceMatrix.needsUpdate = true;
    if (this.flowers.instanceColor) this.flowers.instanceColor.needsUpdate = true;

    // Blueberry bushes: healthy green with berries in band, yellowing outside.
    if (this.bushes) {
      const col = new THREE.Color();
      // Bushes show the blueberry asset's health (slow, aggregate), not each cell's pH.
      const berryAsset = game.assets.find((a) => a.icon === 'berries');
      const sick = berryAsset ? (100 - berryAsset.health) / 100 : 0;
      this.bushCells.forEach((_c, i) => {
        const off = sick * 2;
        if (this.bushModel) {
          col.setRGB(1, 1 - Math.min(0.35, off * 0.2), 1 - Math.min(0.75, off * 0.45));
          this.bushes!.setColorAt(i, col);
          return;
        }
        col.setRGB(0.18 + Math.min(0.55, off * 0.3), 0.42 + Math.min(0.2, off * 0.1), 0.2 - Math.min(0.12, off * 0.06));
        this.bushes!.setColorAt(i, col);
      });
      if (this.bushes.instanceColor) this.bushes.instanceColor.needsUpdate = true;
    }

    // Fish: jump when the pond is healthy, float when it is not.
    const pond = game.assets.find((a) => a.icon === 'fish');
    const pondOk = pond ? pond.pH >= pond.lo && pond.pH <= pond.hi : true;
    const lvl = pondLevel(L);
    this.fish.forEach((f, i) => {
      const ph = f.userData.phase as number;
      const a = t * 0.3 + i * 1.05;
      const rr = L.pond.r * (0.3 + 0.12 * i);
      f.position.x = L.pond.x + Math.cos(a) * rr;
      f.position.z = L.pond.z + Math.sin(a) * rr;
      if (pondOk) {
        const cyc = (t + ph) % 5;
        const jump = cyc < 0.8 ? Math.sin((cyc / 0.8) * Math.PI) * 1.1 : -0.3;
        f.position.y = lvl + jump;
        f.rotation.set(0, -a, cyc < 0.8 ? (0.5 - cyc / 0.8) * 1.6 : 0);
        f.visible = cyc < 0.8;
      } else {
        f.visible = true;
        f.position.y = lvl + 0.05 + Math.sin(t * 2 + i) * 0.03;
        f.rotation.set(Math.PI, -a, 0);
      }
    });

    // Bees orbit hives while the hive zone is in band; they leave when it is not.
    const hive = game.assets.find((a) => a.icon === 'bees');
    const beeOk = hive ? hive.pH >= hive.lo && hive.pH <= hive.hi : true;
    const bp = this.bees.geometry.attributes.position as THREE.BufferAttribute;
    const n = bp.count;
    for (let i = 0; i < n; i++) {
      const h = this.hiveCenters[this.beeBase[i * 4] | 0];
      const ph = this.beeBase[i * 4 + 1];
      const r = this.beeBase[i * 4 + 2] * (beeOk ? 1 : 3 + t * 0);
      const sp = this.beeBase[i * 4 + 3];
      const away = beeOk ? 0 : 6;
      bp.setXYZ(i, h.x + Math.cos(t * sp + ph) * r + away, h.y + Math.sin(t * sp * 1.7 + ph) * 0.5 + 0.3 + away * 0.8, h.z + Math.sin(t * sp + ph) * r);
    }
    bp.needsUpdate = true;
    (this.bees.material as THREE.PointsMaterial).opacity = beeOk ? 1 : 0.3;

    for (const cl of this.clouds) cl.position.x += (cl.userData.drift as number) * dt;
    this.updateStorm(game, dt);
    for (const mx of this.mixers) mx.update(dt);
    for (const tk of this.ticks) tk(dt);
    if (this.waterNormal) {
      this.waterNormal.offset.x = t * 0.02;
      this.waterNormal.offset.y = t * 0.013;
    }
    // Ripples run downstream (uv.y grows along the creek).
    if (this.creekNormal) this.creekNormal.offset.y = -t * 0.35;
    if (this.fireflies) {
      this.fireflies.position.y = Math.sin(t * 0.7) * 0.25;
      (this.fireflies.material as THREE.PointsMaterial).opacity = 0.6 + Math.sin(t * 3) * 0.3;
    }
    // Pulse wagon refill rings.
    this.missionProps.children.forEach((o) => {
      if (o.userData.pulse) {
        const s = 1 + Math.sin(t * 3) * 0.05;
        o.scale.setScalar(s);
      }
    });

  }

  private addOccluder(obj: THREE.Object3D) {
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const mats: THREE.Material[] = [];
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const arr = Array.isArray(m.material) ? m.material : [m.material];
      const cl = arr.map((mm) => {
        const c = mm.clone();
        mats.push(c);
        return c;
      });
      m.material = Array.isArray(m.material) ? cl : cl[0];
    });
    this.occluders.push({ obj, c: sphere.center, r: sphere.radius * 0.75, mats, fade: 1 });
  }

  private softTex: THREE.Texture | null = null;
  /** Round alpha mask with a soft, slightly ragged edge for puddles and dust. */
  private softDecal(): THREE.Texture {
    if (this.softTex) return this.softTex;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d')!;
    x.fillStyle = '#000';
    x.fillRect(0, 0, 128, 128);
    for (let k = 0; k < 7; k++) {
      const gx = 64 + (rand(k) - 0.5) * 34;
      const gy = 64 + (rand(k + 9) - 0.5) * 34;
      const r = 26 + rand(k + 4) * 24;
      const g = x.createRadialGradient(gx, gy, r * 0.3, gx, gy, r);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g;
      x.fillRect(0, 0, 128, 128);
    }
    this.softTex = new THREE.CanvasTexture(c);
    return this.softTex;
  }

  /** Fade props whose bounds cross the sight line from the camera to any of the targets. */
  updateOcclusion(cam: THREE.Vector3, targets: THREE.Vector3[], dt: number) {
    const seg = new THREE.Vector3();
    const toC = new THREE.Vector3();
    for (const o of this.occluders) {
      let block = false;
      for (const t of targets) {
        seg.subVectors(t, cam);
        const len = seg.length();
        seg.divideScalar(len);
        toC.subVectors(o.c, cam);
        const along = toC.dot(seg);
        if (along < 0 || along > len - 0.5) continue;
        const dist = toC.addScaledVector(seg, -along).length();
        if (dist < o.r) {
          block = true;
          break;
        }
      }
      const want = block ? 0.22 : 1;
      if (Math.abs(o.fade - want) < 0.01) continue;
      o.fade += (want - o.fade) * Math.min(1, dt * 8);
      for (const m of o.mats) {
        m.transparent = o.fade < 0.99;
        m.opacity = o.fade;
        m.depthWrite = o.fade > 0.9;
      }
    }
  }

  /** Is the straight line from a to b clear of big props? (for menu camera shots) */
  clearView(a: THREE.Vector3, b: THREE.Vector3): boolean {
    const seg = new THREE.Vector3().subVectors(b, a);
    const len = seg.length();
    seg.divideScalar(len);
    for (const o of this.occluders) {
      const toC = new THREE.Vector3().subVectors(o.c, a);
      const along = toC.dot(seg);
      if (along < 0 || along > len) continue;
      if (toC.addScaledVector(seg, -along).length() < o.r + 0.3) return false;
    }
    return true;
  }

  /** Rain curtain and a dark cloud band that follow the simulated acid-rain front. */
  private updateStorm(game: Game, dt: number) {
    const band = game.mission.rain ? game.mission.rain(game.t) : null;
    const L = this.layout;
    if (game.mission.rain && !this.rain) {
      const N = 2600;
      const geo = new THREE.BoxGeometry(0.03, 0.9, 0.03);
      this.rain = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xa9c4e8, transparent: true, opacity: 0.75, depthWrite: false }), N);
      this.rain.frustumCulled = false;
      this.rainData = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        this.rainData[i * 3] = rand(i * 1.3);
        this.rainData[i * 3 + 1] = rand(i * 2.7) * L.size;
        this.rainData[i * 3 + 2] = rand(i * 4.1) * 25;
      }
      this.scene.add(this.rain);
      const cg = document.createElement('canvas');
      cg.width = 64;
      cg.height = 256;
      const cx = cg.getContext('2d')!;
      const gr = cx.createLinearGradient(0, 0, 64, 0);
      gr.addColorStop(0, 'rgba(40,48,60,0)');
      gr.addColorStop(0.25, 'rgba(40,48,60,0.92)');
      gr.addColorStop(0.75, 'rgba(40,48,60,0.92)');
      gr.addColorStop(1, 'rgba(40,48,60,0)');
      cx.fillStyle = gr;
      cx.fillRect(0, 0, 64, 256);
      const tex = new THREE.CanvasTexture(cg);
      this.stormCloud = new THREE.Mesh(
        new THREE.PlaneGeometry(1, L.size + 80),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false }),
      );
      this.stormCloud.rotation.x = Math.PI / 2;
      this.scene.add(this.stormCloud);
      // A grey veil of rain you can see coming from across the valley.
      this.curtain = new THREE.Mesh(
        new THREE.BoxGeometry(1, 34, L.size + 60),
        new THREE.MeshBasicMaterial({ color: 0x7d8a99, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
      );
      this.scene.add(this.curtain);
    }
    if (!this.rain || !this.rainData || !this.stormCloud) return;
    this.rain.visible = !!band;
    this.stormCloud.visible = !!band;
    if (this.curtain) this.curtain.visible = !!band;
    let here = 0;
    if (band) {
      const w = band.x1 - band.x0;
      const N = this.rain.count;
      for (let i = 0; i < N; i++) {
        let y = this.rainData[i * 3 + 2] - dt * 22;
        if (y < 0) y += 25;
        this.rainData[i * 3 + 2] = y;
        const x = band.x0 + this.rainData[i * 3] * w;
        const z = this.rainData[i * 3 + 1];
        this.dummy.position.set(x, terrainHeight(L, x, z) + y, z);
        this.dummy.rotation.set(0, 0, 0.12);
        this.dummy.scale.setScalar(1);
        this.dummy.updateMatrix();
        this.rain.setMatrixAt(i, this.dummy.matrix);
      }
      this.rain.instanceMatrix.needsUpdate = true;
      this.stormCloud.position.set((band.x0 + band.x1) / 2, 30, L.size / 2);
      this.stormCloud.scale.set(w * 2.4, 1, 1);
      if (this.curtain) {
        this.curtain.position.set((band.x0 + band.x1) / 2, 14, L.size / 2);
        this.curtain.scale.set(w, 1, 1);
      }
      const px = game.player.x;
      here = px > band.x0 - 10 && px < band.x1 + 10 ? 1 - Math.min(1, Math.max(0, Math.max(band.x0 - px, px - band.x1)) / 10) : 0;
      // Occasional lightning when close.
      this.flashT -= dt;
      this.lightning = false;
      if (here > 0.3 && this.flashT <= 0 && rand(game.t * 13.7) < 0.02) {
        this.flashT = 2.5;
        this.lightning = true;
      }
    }
    this.stormHere += (here - this.stormHere) * Math.min(1, dt * 2);
    const flash = this.flashT > 2.35 ? 1.8 : 0;
    this.sun.intensity = this.sunBase * (1 - this.stormHere * 0.65) + flash;
    if (this.scene.background instanceof THREE.Color) {
      if (this.skyBase.getHex() === 0) this.skyBase.copy(this.scene.background);
      this.scene.background.copy(this.skyBase).lerp(new THREE.Color(0x6b7785), this.stormHere * 0.7);
    }
    this.hemi.intensity = this.hemiBase * (1 - this.stormHere * 0.4) + flash * 0.4;
  }

  /** Sun follows the player so shadows stay sharp near the action. */
  followSun(x: number, y: number, z: number) {
    const off = this.night ? new THREE.Vector3(-30, 60, -20) : new THREE.Vector3(-26, 48, -32);
    this.sun.position.set(x + off.x, y + off.y, z + off.z);
    this.sun.target.position.set(x, y, z);
  }

  dispose() {
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
    this.overlay.dispose();
    this.state.dispose();
  }
}
