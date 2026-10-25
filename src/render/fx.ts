// Visual effects: the spray stream, splashes, neutralization steam, thrown indicator gadgets,
// litmus markers and the ground reticle. Cosmetic only; the grid decides what happened.

import * as THREE from 'three';
import { litmus, universalRGB } from '../sim/chem';
import type { Game, Gadget } from '../sim/game';
import { terrainHeight, type Layout } from '../sim/layout';

const VALVE_COLOR = { acid: 0xff5a3c, base: 0x3d8bff, water: 0x8ff3ff } as const;
const G = 9.8;

interface Drop {
  p: THREE.Vector3;
  v: THREE.Vector3;
  life: number;
  max: number;
  color: THREE.Color;
  size: number;
}

function softSprite(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(32, 32, 2, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Fx {
  private scene: THREE.Scene;
  private layout: Layout;
  private drops: Drop[] = [];
  private dropMesh: THREE.InstancedMesh;
  private puffs: THREE.Sprite[] = [];
  private puffData: Array<{ v: THREE.Vector3; life: number; max: number; grow: number; fade: number }> = [];
  private rings: Array<{ m: THREE.Mesh; life: number; max: number; to: number }> = [];
  private thrown = new Map<object, THREE.Object3D>();
  private markerObjs = new Map<number, THREE.Group>();
  readonly aimRing: THREE.Mesh;
  private dummy = new THREE.Object3D();
  private tex = softSprite();
  private sprayAcc = 0;
  private jet: THREE.Mesh;
  private impact: THREE.Mesh;
  private impactOn = 0;
  private cellBox: THREE.LineLoop;
  private jetOn = 0;
  reduced = false;

  constructor(scene: THREE.Scene, layout: Layout) {
    this.scene = scene;
    this.layout = layout;
    this.dropMesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.11, 6, 4),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, emissive: 0x222222, transparent: true, opacity: 0.92 }),
      900,
    );
    this.dropMesh.count = 0;
    this.dropMesh.frustumCulled = false;
    this.dropMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.dropMesh);
    for (let i = 0; i < 140; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, transparent: true, depthWrite: false, opacity: 0 }));
      s.visible = false;
      scene.add(s);
      this.puffs.push(s);
      this.puffData.push({ v: new THREE.Vector3(), life: 0, max: 1, grow: 1, fade: 1 });
    }
    // Dashed reticle ring on the ground.
    const ringG = new THREE.RingGeometry(0.9, 1.15, 32, 1, 0, Math.PI * 2);
    const pos = ringG.attributes.position as THREE.BufferAttribute;
    const keep: number[] = [];
    const idx = ringG.index!;
    for (let i = 0; i < idx.count; i += 3) {
      const a = idx.getX(i);
      const ang = Math.atan2(pos.getY(a), pos.getX(a));
      if (Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 12) % 2 === 0) keep.push(idx.getX(i), idx.getX(i + 1), idx.getX(i + 2));
    }
    ringG.setIndex(keep);
    this.aimRing = new THREE.Mesh(ringG, new THREE.MeshBasicMaterial({ color: 0xb8ffd8, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
    this.aimRing.rotation.x = -Math.PI / 2;
    this.aimRing.renderOrder = 5;
    const inner = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.4, 24), this.aimRing.material);
    this.aimRing.add(inner);
    scene.add(this.aimRing);
    this.jet = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshStandardMaterial({ color: 0x3d8bff, transparent: true, opacity: 0.78, roughness: 0.1, emissive: 0x112244 }),
    );
    this.jet.frustumCulled = false;
    this.impact = new THREE.Mesh(
      new THREE.CircleGeometry(0.7, 20),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false, map: this.tex }),
    );
    this.impact.rotation.x = -Math.PI / 2;
    this.impact.visible = false;
    scene.add(this.impact);
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(16 * 3), 3));
    this.cellBox = new THREE.LineLoop(cg, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthTest: false }));
    this.cellBox.renderOrder = 6;
    this.cellBox.frustumCulled = false;
    scene.add(this.cellBox);
    this.jet.visible = false;
    scene.add(this.jet);
  }

  private h(x: number, z: number) {
    return terrainHeight(this.layout, x, z);
  }

  private puff(p: THREE.Vector3, color: number, size: number, life: number, v: THREE.Vector3, grow = 1.5, opacity = 0.8) {
    const i = this.puffData.findIndex((d) => d.life <= 0);
    if (i < 0) return;
    const s = this.puffs[i];
    s.position.copy(p);
    s.scale.setScalar(size);
    (s.material as THREE.SpriteMaterial).color.setHex(color);
    (s.material as THREE.SpriteMaterial).opacity = opacity;
    s.visible = true;
    this.puffData[i] = { v: v.clone(), life: life, max: life, grow, fade: opacity };
  }

  private ring(x: number, z: number, color: number, to: number, life = 0.8) {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1, 48),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, this.h(x, z) + 0.15, z);
    this.scene.add(m);
    this.rings.push({ m, life, max: life, to });
  }

  /** Spray stream from the nozzle toward the aim point, on the same timing as the sim packets. */
  stream(from: THREE.Vector3, tx: number, tz: number, valve: 'acid' | 'base' | 'water', strength: number, dt: number) {
    this.sprayAcc += dt * (strength === 10 ? 90 : 60);
    // Foamy splash where the jet lands.
    this.impact.visible = true;
    this.impactOn = 0.08;
    this.impact.position.set(tx, this.h(tx, tz) + 0.1, tz);
    this.impact.scale.setScalar(0.8 + Math.random() * 0.35);
    (this.impact.material as THREE.MeshBasicMaterial).color.setHex(VALVE_COLOR[valve]).lerp(new THREE.Color(0xffffff), 0.55);
    // The solid jet: a tube along the same ballistic arc the packets fly.
    {
      const end = new THREE.Vector3(tx, this.h(tx, tz) + 0.05, tz);
      const dist = from.distanceTo(end);
      const mid = from.clone().lerp(end, 0.5);
      mid.y += 0.6 + dist * 0.12;
      const curve = new THREE.QuadraticBezierCurve3(from.clone(), mid, end);
      const wob = Math.sin(performance.now() * 0.03) * 0.01;
      const r = (strength === 10 ? 0.1 : 0.075) + wob;
      this.jet.geometry.dispose();
      this.jet.geometry = new THREE.TubeGeometry(curve, 24, r, 6, false);
      const mat = this.jet.material as THREE.MeshStandardMaterial;
      mat.color.setHex(VALVE_COLOR[valve]);
      mat.emissive.setHex(VALVE_COLOR[valve]).multiplyScalar(0.35);
      this.jet.visible = true;
      this.jetOn = 0.06;
    }
    const to = new THREE.Vector3(tx, this.h(tx, tz) + 0.05, tz);
    const d = Math.hypot(tx - from.x, tz - from.z);
    const T = 0.12 + d / 24;
    const col = new THREE.Color(VALVE_COLOR[valve]);
    while (this.sprayAcc >= 1) {
      this.sprayAcc -= 1;
      const jitter = new THREE.Vector3((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.5);
      const target = to.clone().add(jitter);
      const v = target.sub(from).divideScalar(T);
      v.y += 0.5 * G * T;
      this.drops.push({ p: from.clone(), v, life: T, max: T, color: col, size: strength === 10 ? 0.9 : 0.65 });
    }
  }

  handle(game: Game) {
    for (const e of game.fx) {
      if (e.type === 'land') {
        if (Math.random() < 0.35) {
          const y = this.h(e.x, e.z) + 0.1;
          for (let k = 0; k < 2; k++) {
            const v = new THREE.Vector3((Math.random() - 0.5) * 2.5, 1.5 + Math.random() * 2, (Math.random() - 0.5) * 2.5);
            this.drops.push({ p: new THREE.Vector3(e.x, y, e.z), v, life: 0.4, max: 0.4, color: new THREE.Color(VALVE_COLOR[e.valve]), size: 0.6 });
          }
        }
      } else if (e.type === 'fizz') {
        const n = Math.min(3, 1 + Math.floor(e.amount * 2000));
        for (let k = 0; k < n; k++) {
          const p = new THREE.Vector3(e.x + (Math.random() - 0.5) * 1.6, this.h(e.x, e.z) + 0.3, e.z + (Math.random() - 0.5) * 1.6);
          this.puff(p, 0xffffff, 0.5 + Math.random() * 0.4, 1.1, new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.9 + Math.random() * 0.6, (Math.random() - 0.5) * 0.6), 1.4, 0.32);
        }

      } else if (e.type === 'overshoot') {
        this.ring(e.x, e.z, e.dir === 'base' ? 0xa040ff : 0xff3030, 6, 0.9);
      } else if (e.type === 'inband') {
        this.ring(e.x, e.z, 0x5cff7a, 4, 0.7);
        for (let k = 0; k < 6; k++) {
          const p = new THREE.Vector3(e.x + (Math.random() - 0.5) * 2, this.h(e.x, e.z) + 0.4, e.z + (Math.random() - 0.5) * 2);
          this.puff(p, 0xb6ff9a, 0.35, 0.9, new THREE.Vector3(0, 1.8, 0), 0.4, 1);
        }
      } else if (e.type === 'gadget') {
        this.burst(e.kind, e.x, e.z);
      }
    }
  }

  /** A puff of dust under the ranger's feet. */
  dust(x: number, z: number, big: boolean) {
    if (this.reduced) return;
    const p = new THREE.Vector3(x + (Math.random() - 0.5) * 0.4, this.h(x, z) + 0.1, z + (Math.random() - 0.5) * 0.4);
    this.puff(p, 0xd9c9a8, big ? 0.55 : 0.4, 0.6, new THREE.Vector3(0, 0.5, 0), 1.6, 0.45);
  }

  /** Ground back in its band: petals and sparkles pop up, a green ring sweeps out. */
  restoredBurst(x: number, z: number) {
    const y = this.h(x, z) + 0.2;
    const cols = [0xff5252, 0xffffff, 0xffeb3b, 0xf48fb1, 0x81c784, 0xba68c8];
    for (let k = 0; k < 26; k++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1.5 + Math.random() * 2.5;
      const v = new THREE.Vector3(Math.cos(a) * sp, 3.5 + Math.random() * 3, Math.sin(a) * sp);
      this.drops.push({ p: new THREE.Vector3(x, y, z), v, life: 0.9, max: 0.9, color: new THREE.Color(cols[k % cols.length]), size: 0.9 });
    }
    for (let k = 0; k < 8; k++) {
      this.puff(new THREE.Vector3(x + (Math.random() - 0.5) * 2.5, y + 0.4, z + (Math.random() - 0.5) * 2.5), 0xd4ffb0, 0.5, 1.1, new THREE.Vector3(0, 2.4, 0), 0.5, 1);
    }
    this.ring(x, z, 0x76ff03, 5, 0.8);
  }

  private burst(kind: Gadget, x: number, z: number) {
    const y = this.h(x, z);
    if (kind === 'phenol') {
      this.ring(x, z, 0xff4fa8, 7.5, 1.1);
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * Math.PI * 2;
        this.puff(new THREE.Vector3(x, y + 0.6, z), 0xff8fcb, 1.2, 1.4, new THREE.Vector3(Math.cos(a) * 5, 0.6, Math.sin(a) * 5), 2.5, 0.6);
      }
    } else if (kind === 'mist') {
      const cols = [0xe53935, 0xfb8c00, 0xfdd835, 0x43a047, 0x1e88e5, 0x8e24aa];
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * Math.PI * 2;
        const r = Math.random() * 2;
        this.puff(
          new THREE.Vector3(x + Math.cos(a) * r, y + 0.8, z + Math.sin(a) * r),
          cols[k % cols.length],
          1.3,
          1.5,
          new THREE.Vector3(Math.cos(a) * 3.6, 0.25, Math.sin(a) * 3.6),
          2,
          0.45,
        );
      }
      this.ring(x, z, 0xffffff, 7.5, 1.2);
    } else if (kind === 'canister') {
      for (let k = 0; k < 10; k++) {
        this.puff(new THREE.Vector3(x, y + 0.3, z), 0xe3f2fd, 1, 1.5, new THREE.Vector3((Math.random() - 0.5) * 3, 0.8, (Math.random() - 0.5) * 3), 2, 0.8);
      }
    } else {
      this.ring(x, z, 0xffffff, 1.6, 0.5);
    }
  }

  private gadgetMesh(kind: Gadget): THREE.Object3D {
    if (kind === 'litmus') {
      const g = new THREE.Group();
      const a = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.1), new THREE.MeshBasicMaterial({ color: 0xe53935 }));
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.1), new THREE.MeshBasicMaterial({ color: 0x1e6fe0 }));
      b.position.z = 0.12;
      g.add(a, b);
      return g;
    }
    const col = kind === 'phenol' ? 0xff4fa8 : kind === 'mist' ? 0x9ccc65 : 0xeceff1;
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.3, 4, 8), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.4 }));
    return m;
  }

  update(game: Game, dt: number, night: boolean) {
    this.jetOn -= dt;
    if (this.jetOn <= 0) this.jet.visible = false;
    this.impactOn -= dt;
    if (this.impactOn <= 0) this.impact.visible = false;
    // Drops (spray + splashes).
    const keep: Drop[] = [];
    let n = 0;
    for (const d of this.drops) {
      d.life -= dt;
      if (d.life <= 0) continue;
      d.v.y -= G * dt;
      d.p.addScaledVector(d.v, dt);
      keep.push(d);
      if (n < 900) {
        this.dummy.position.copy(d.p);
        this.dummy.scale.setScalar(d.size * (0.6 + 0.4 * (d.life / d.max)));
        this.dummy.updateMatrix();
        this.dropMesh.setMatrixAt(n, this.dummy.matrix);
        this.dropMesh.setColorAt(n, d.color);
        n++;
      }
    }
    this.drops = keep;
    this.dropMesh.count = n;
    this.dropMesh.instanceMatrix.needsUpdate = true;
    if (this.dropMesh.instanceColor) this.dropMesh.instanceColor.needsUpdate = true;

    // Steam from cells still hot from neutralization.
    const g = game.grid;
    for (let c = 0; c < g.count; c++) {
      // Heat is only noticeable while lots of acid or base reacts (same rule as the fizz event).
      if (g.heat[c] > 0.0008 && (g.pH[c] < 4.5 || g.pH[c] > 9.5) && Math.random() < Math.min(0.5, g.heat[c] * 60) * dt * 8) {
        const [x, z] = g.center(c);
        const p = new THREE.Vector3(x + (Math.random() - 0.5) * 2.4, this.h(x, z) + 0.3, z + (Math.random() - 0.5) * 2.4);
        this.puff(p, 0xffffff, 0.6, 1.4, new THREE.Vector3(0, 0.8, 0), 1.3, 0.28);
      }
    }

    // Puffs.
    for (let i = 0; i < this.puffs.length; i++) {
      const d = this.puffData[i];
      if (d.life <= 0) continue;
      d.life -= dt;
      const s = this.puffs[i];
      if (d.life <= 0) {
        s.visible = false;
        continue;
      }
      s.position.addScaledVector(d.v, dt);
      d.v.multiplyScalar(1 - dt * 1.5);
      s.scale.multiplyScalar(1 + d.grow * dt * 0.6);
      (s.material as THREE.SpriteMaterial).opacity = d.fade * (d.life / d.max);
    }

    // Expanding rings.
    this.rings = this.rings.filter((r) => {
      r.life -= dt;
      const k = 1 - r.life / r.max;
      r.m.scale.setScalar(0.5 + k * r.to);
      (r.m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 * (1 - k));
      if (r.life <= 0) {
        this.scene.remove(r.m);
        r.m.geometry.dispose();
        return false;
      }
      return true;
    });

    // Thrown gadgets fly in arcs.
    const live = new Set<object>();
    for (const t of game.throws) {
      live.add(t);
      let o = this.thrown.get(t);
      if (!o) {
        o = this.gadgetMesh(t.kind);
        this.scene.add(o);
        this.thrown.set(t, o);
      }
      const k = Math.min(1, (game.t - t.t0) / (t.tf - t.t0));
      const x = t.fx + (t.tx - t.fx) * k;
      const z = t.fz + (t.tz - t.fz) * k;
      const y0 = this.h(t.fx, t.fz) + 1.4;
      const y1 = this.h(t.tx, t.tz) + 0.1;
      o.position.set(x, y0 + (y1 - y0) * k + Math.sin(k * Math.PI) * 3, z);
      o.rotation.set(k * 9, k * 6, 0);
    }
    for (const [t, o] of this.thrown) {
      if (!live.has(t)) {
        this.scene.remove(o);
        this.thrown.delete(t);
      }
    }

    // Litmus markers: two strips that show the live reading.
    const seen = new Set<number>();
    for (const m of game.markers) {
      seen.add(m.cell);
      let o = this.markerObjs.get(m.cell);
      if (!o) {
        o = new THREE.Group();
        const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1), new THREE.MeshStandardMaterial({ color: 0x8d6e63 }));
        stake.position.y = 0.55;
        const blue = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.5), new THREE.MeshStandardMaterial({ color: 0x1e6fe0, side: THREE.DoubleSide, emissive: 0x000000 }));
        blue.position.set(0.1, 0.85, 0);
        const red = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.5), new THREE.MeshStandardMaterial({ color: 0xe53935, side: THREE.DoubleSide, emissive: 0x000000 }));
        red.position.set(-0.1, 0.85, 0);
        o.add(stake, blue, red);
        o.userData.blue = blue;
        o.userData.red = red;
        o.position.set(m.x, this.h(m.x, m.z), m.z);
        this.scene.add(o);
        this.markerObjs.set(m.cell, o);
      }
      const r = litmus(g.pH[m.cell]);
      // Blue strip turns red in acid; red strip turns blue in base.
      const blueStrip = (o.userData.blue as THREE.Mesh).material as THREE.MeshStandardMaterial;
      const redStrip = (o.userData.red as THREE.Mesh).material as THREE.MeshStandardMaterial;
      blueStrip.color.setHex(r === 'acid' ? 0xe53935 : 0x1e6fe0);
      redStrip.color.setHex(r === 'base' ? 0x1e6fe0 : 0xe53935);
      blueStrip.emissive.copy(blueStrip.color).multiplyScalar(night ? 0.8 : 0.15);
      redStrip.emissive.copy(redStrip.color).multiplyScalar(night ? 0.8 : 0.15);
      o.rotation.y += dt * 0.4;
    }
    for (const [c, o] of this.markerObjs) {
      if (!seen.has(c)) {
        this.scene.remove(o);
        this.markerObjs.delete(c);
      }
    }

    // Outline of the grid cell the spray will land in, coloured by what is known about it.
    {
      const cs = g.cell;
      const ci = game.aim.cell % g.n;
      const cj = Math.floor(game.aim.cell / g.n);
      const x0 = ci * cs + 0.1;
      const z0 = cj * cs + 0.1;
      const x1 = x0 + cs - 0.2;
      const z1 = z0 + cs - 0.2;
      const pts: Array<[number, number]> = [];
      for (let k = 0; k < 4; k++) pts.push([x0 + ((x1 - x0) * k) / 4, z0]);
      for (let k = 0; k < 4; k++) pts.push([x1, z0 + ((z1 - z0) * k) / 4]);
      for (let k = 0; k < 4; k++) pts.push([x1 - ((x1 - x0) * k) / 4, z1]);
      for (let k = 0; k < 4; k++) pts.push([x0, z1 - ((z1 - z0) * k) / 4]);
      const pa = this.cellBox.geometry.attributes.position as THREE.BufferAttribute;
      pts.forEach(([px, pz], i) => pa.setXYZ(i, px, this.h(px, pz) + 0.12, pz));
      pa.needsUpdate = true;
      const r = game.readingRange(game.aim.cell);
      const mat = this.cellBox.material as THREE.LineBasicMaterial;
      if (r?.exact !== undefined) {
        const [cr, cgc, cb] = universalRGB(r.exact);
        mat.color.setRGB(cr, cgc, cb);
      } else mat.color.setHex(r ? 0xffe082 : 0xffffff);
      mat.opacity = 0.6 + Math.sin(game.t * 6) * 0.25;
    }
    // Reticle on the ground at the clamped aim point.
    const ax = game.aim.x;
    const az = game.aim.z;
    this.aimRing.position.set(ax, this.h(ax, az) + 0.12, az);
    const pulse = 1 + Math.sin(game.t * 6) * 0.06;
    this.aimRing.scale.setScalar(pulse);
    this.aimRing.rotation.z += dt * 0.8;
  }

  private pointerObj: THREE.Group | null = null;
  /** A big bouncing arrow in the world pointing at a spot (tutorial guidance). */
  pointer(x: number, z: number, on: boolean, t: number) {
    if (!this.pointerObj) {
      const g = new THREE.Group();
      const m = new THREE.MeshStandardMaterial({ color: 0xffd54f, emissive: 0xffb300, emissiveIntensity: 0.6 });
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.2, 16), m);
      head.rotation.x = Math.PI;
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 1.4, 12), m);
      shaft.position.y = 1.3;
      g.add(head, shaft);
      this.scene.add(g);
      this.pointerObj = g;
    }
    this.pointerObj.visible = on;
    if (!on) return;
    this.pointerObj.position.set(x, this.h(x, z) + 2.6 + Math.abs(Math.sin(t * 3)) * 0.8, z);
    this.pointerObj.rotation.y = t * 1.5;
  }

  /** Hide the aiming aids while menus are up. */
  showAim(on: boolean) {
    this.aimRing.visible = on;
    this.cellBox.visible = on;
  }

  clear() {
    this.drops = [];
    for (const [, o] of this.thrown) this.scene.remove(o);
    this.thrown.clear();
    for (const [, o] of this.markerObjs) this.scene.remove(o);
    this.markerObjs.clear();
    for (const r of this.rings) this.scene.remove(r.m);
    this.rings = [];
    this.puffData.forEach((d, i) => {
      d.life = 0;
      this.puffs[i].visible = false;
    });
  }
}
