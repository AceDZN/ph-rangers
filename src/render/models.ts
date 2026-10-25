// Loads the Tripo GLB models (bundled in public/models) and hands out normalized clones.
// Every model has a procedural fallback so the game still runs if a file is missing.

import * as THREE from 'three';
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

const BASE = import.meta.env.BASE_URL;

/** Scale a model so its height is `h`, put its feet at y=0 and centre it. */
function normalize(obj: THREE.Object3D, h: number): THREE.Group {
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const s = h / Math.max(0.001, size.y);
  obj.scale.multiplyScalar(s);
  const box2 = new THREE.Box3().setFromObject(obj);
  const c = box2.getCenter(new THREE.Vector3());
  obj.position.x -= c.x;
  obj.position.z -= c.z;
  obj.position.y -= box2.min.y;
  const g = new THREE.Group();
  g.add(obj);
  return g;
}

function shadows(o: THREE.Object3D) {
  o.traverse((m) => {
    const mesh = m as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });
  return o;
}

export interface RangerModel {
  root: THREE.Group;
  mixer: THREE.AnimationMixer | null;
  clips: Record<string, THREE.AnimationAction>;
  /** Nozzle tip in model space (approximate). */
  nozzle: THREE.Object3D;
  tripo: boolean;
}

export class Models {
  private gltf: Record<string, GLTF | null> = {};
  loaded: string[] = [];

  async load(onProgress?: (p: number) => void) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const names = ['ranger', 'olive', 'beehive', 'truck', 'wagon', 'house', 'farmer', 'wall', 'rocks', 'school', 'bush', 'cypress', 'fish'];
    let done = 0;
    await Promise.all(
      names.map(async (n) => {
        try {
          this.gltf[n] = await loader.loadAsync(`${BASE}models/${n}.glb`);
          this.loaded.push(n);
        } catch {
          this.gltf[n] = null;
        }
        done++;
        onProgress?.(done / names.length);
      }),
    );
  }

  private clone(name: string, h: number, rollX = 0): THREE.Group | null {
    const g = this.gltf[name];
    if (!g) return null;
    const sc = g.scene.clone(true);
    if (rollX) {
      // Wrap so the roll happens before normalizing (feet back on the ground).
      const w = new THREE.Group();
      sc.rotation.x = rollX;
      w.add(sc);
      w.updateMatrixWorld(true);
      return shadows(normalize(w, h)) as THREE.Group;
    }
    return shadows(normalize(sc, h)) as THREE.Group;
  }

  has(name: string) {
    return !!this.gltf[name];
  }

  /**
   * One mesh of a model with its transform baked in, scaled to height `h`, feet at y = 0 and
   * centred — ready for an InstancedMesh. Returns the footprint length along x too.
   */
  meshOf(name: string, h: number): { geometry: THREE.BufferGeometry; material: THREE.Material; length: number } | null {
    const g = this.gltf[name];
    if (!g) return null;
    g.scene.updateMatrixWorld(true);
    let found: THREE.Mesh | null = null;
    g.scene.traverse((o) => {
      if (!found && (o as THREE.Mesh).isMesh) found = o as THREE.Mesh;
    });
    if (!found) return null;
    const mesh = found as THREE.Mesh;
    const geo = mesh.geometry.clone();
    geo.applyMatrix4(mesh.matrixWorld);
    geo.computeBoundingBox();
    const b = geo.boundingBox!;
    const sz = b.getSize(new THREE.Vector3());
    const sc = h / Math.max(1e-3, sz.y);
    const c = b.getCenter(new THREE.Vector3());
    geo.translate(-c.x, -b.min.y, -c.z);
    geo.scale(sc, sc, sc);
    return { geometry: geo, material: mesh.material as THREE.Material, length: sz.x * sc };
  }

  /** Animated character (farmer) with its clips, or null. */
  character(name: string, h: number): { root: THREE.Group; mixer: THREE.AnimationMixer; clips: Record<string, THREE.AnimationAction> } | null {
    const g = this.gltf[name];
    if (!g || !g.animations.length) return null;
    const scene = SkeletonUtils.clone(g.scene);
    const root = shadows(normalize(scene, h)) as THREE.Group;
    const mixer = new THREE.AnimationMixer(scene);
    const clips: Record<string, THREE.AnimationAction> = {};
    for (const clip of g.animations) clips[clip.name.toLowerCase()] = mixer.clipAction(clip);
    return { root, mixer, clips };
  }

  school(): THREE.Object3D | null {
    return this.clone('school', 5);
  }

  fish(): THREE.Object3D | null {
    return this.clone('fish', 0.35);
  }

  olive(): THREE.Object3D {
    const m = this.clone('olive', 3.6);
    if (m) {
      // Tripo's baked albedo is dark under our sun; lift it toward the mockups' sage green.
      m.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) {
          const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
          mat.color.setRGB(1.7, 1.75, 1.5);
          mesh.material = mat;
        }
      });
      return m;
    }
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, 1.8, 7), new THREE.MeshStandardMaterial({ color: 0x6d5a45, roughness: 1 }));
    trunk.position.y = 0.9;
    trunk.rotation.z = 0.12;
    g.add(trunk);
    const leaf = new THREE.MeshStandardMaterial({ color: 0x8a9f5b, roughness: 1, flatShading: true });
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9 + (i % 2) * 0.3, 0), leaf);
      b.position.set(Math.cos(i * 1.7) * 0.7, 2.2 + (i % 2) * 0.5, Math.sin(i * 1.7) * 0.7);
      g.add(b);
    }
    return shadows(g);
  }

  hive(): THREE.Object3D {
    const m = this.clone('beehive', 1.25);
    if (m) return m;
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.9, 0.7), new THREE.MeshStandardMaterial({ color: 0xf2c14e }));
    box.position.y = 0.6;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.12, 0.85), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    roof.position.y = 1.1;
    g.add(box, roof);
    return shadows(g);
  }

  truck(): THREE.Object3D {
    // Tripo made it upright; the story needs it overturned on its side.
    const m = this.clone('truck', 2.2, Math.PI / 2);
    if (m) return m;
    const g = new THREE.Group();
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 5, 16), new THREE.MeshStandardMaterial({ color: 0xdddddd }));
    tank.rotation.z = Math.PI / 2;
    tank.position.y = 1;
    g.add(tank);
    return shadows(g);
  }

  wagon(): THREE.Object3D {
    const m = this.clone('wagon', 2.1);
    if (m) return m;
    const g = new THREE.Group();
    const bed = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 1.4), new THREE.MeshStandardMaterial({ color: 0x8d6e63 }));
    bed.position.y = 0.8;
    g.add(bed);
    const cols = [0xe53935, 0x1e6fe0, 0x1fb5c4];
    cols.forEach((c, i) => {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 12), new THREE.MeshStandardMaterial({ color: c }));
      t.position.set(-0.7 + i * 0.7, 1.5, 0);
      g.add(t);
    });
    return shadows(g);
  }

  house(): THREE.Object3D | null {
    return this.clone('house', 4.2);
  }

  /** Rina the farmer: Tripo model if present, otherwise a simple procedural figure. */
  farmer(): THREE.Object3D {
    const ch = this.character('farmer', 1.65);
    if (ch) {
      const want = Object.keys(ch.clips).find((k) => k.includes('wave')) ?? Object.keys(ch.clips).find((k) => k.includes('idle')) ?? Object.keys(ch.clips)[0];
      ch.clips[want]?.play();
      ch.root.userData.mixer = ch.mixer;
      return ch.root;
    }
    const still = this.clone('farmer', 1.65);
    if (still) return still;
    const g = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: 0xc68a63 });
    const shirt = new THREE.MeshStandardMaterial({ color: 0x7e57c2 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x5d4037 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.6, 4, 8), shirt);
    body.position.y = 1.05;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), skin);
    head.position.y = 1.65;
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.06, 16), new THREE.MeshStandardMaterial({ color: 0xe8c66a }));
    hat.position.y = 1.83;
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.18, 12), hat.material);
    crown.position.y = 1.92;
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.5, 4, 6), pants);
      leg.position.set(s * 0.13, 0.38, 0);
      g.add(leg);
    }
    g.add(body, head, hat, crown);
    return shadows(g);
  }

  ranger(): RangerModel {
    const g = this.gltf.ranger;
    if (g) {
      const scene = SkeletonUtils.clone(g.scene);
      const root = shadows(normalize(scene, 1.7)) as THREE.Group;
      const mixer = new THREE.AnimationMixer(scene);
      const clips: Record<string, THREE.AnimationAction> = {};
      for (const clip of g.animations) {
        const name = clip.name.toLowerCase();
        const key = name.includes('idle')
          ? 'idle'
          : name.includes('run')
            ? 'run'
            : name.includes('walk')
              ? 'walk'
              : name.includes('spray') || name.includes('aim') || name.includes('shoot')
                ? 'spray'
                : name.includes('jump') || name.includes('cheer') || name.includes('dance')
                  ? 'celebrate'
                  : name;
        if (!clips[key]) clips[key] = mixer.clipAction(clip);
      }
      const nozzle = new THREE.Object3D();
      nozzle.position.set(0.35, 1.05, 0.55);
      root.add(nozzle);
      const bone = (n: string) => scene.getObjectByName(`mixamorig:${n}`) ?? scene.getObjectByName(`mixamorig${n}`) ?? null;
      root.userData.bones = {
        rArm: bone('RightArm'),
        rFore: bone('RightForeArm'),
        rHand: bone('RightHand'),
        lArm: bone('LeftArm'),
        lFore: bone('LeftForeArm'),
        lHand: bone('LeftHand'),
        spine: bone('Spine2'),
      };
      // Spray wand held in the right hand (positioned every frame).
      const wand = new THREE.Group();
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.62, 8), new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.4 }));
      tube.rotation.x = Math.PI / 2;
      tube.position.z = 0.31;
      const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.08, 10), new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.6, roughness: 0.3 }));
      tip.rotation.x = Math.PI / 2;
      tip.position.z = 0.64;
      wand.add(tube, tip);
      shadows(wand);
      root.userData.wand = wand;
      return { root, mixer, clips, nozzle, tripo: true };
    }
    return proceduralRanger();
  }
}

/** Fallback ranger with simple limb animation (used only when ranger.glb is missing). */
function proceduralRanger(): RangerModel {
  const root = new THREE.Group();
  const olive = new THREE.MeshStandardMaterial({ color: 0x5b6b3a, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xd9a27a });
  const cap = new THREE.MeshStandardMaterial({ color: 0xf26b1d });
  const yellow = new THREE.MeshStandardMaterial({ color: 0xf6c21c, roughness: 0.5 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.45, 4, 10), olive);
  torso.position.y = 1.05;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 12), skin);
  head.position.y = 1.58;
  const capM = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), cap);
  capM.position.y = 1.62;
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.22), cap);
  brim.position.set(0, 1.63, 0.2);
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.3), yellow);
  pack.position.set(0, 1.1, -0.3);
  root.add(torso, head, capM, brim, pack);
  [0xe53935, 0x1e6fe0, 0x1fb5c4].forEach((c, i) => {
    const k = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.06, 10), new THREE.MeshStandardMaterial({ color: c }));
    k.rotation.x = Math.PI / 2;
    k.position.set(-0.15 + i * 0.15, 0.95, -0.47);
    root.add(k);
  });
  const limbs: THREE.Object3D[] = [];
  for (const s of [-1, 1]) {
    const legP = new THREE.Group();
    legP.position.set(s * 0.12, 0.72, 0);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.5, 4, 6), olive);
    leg.position.y = -0.33;
    legP.add(leg);
    root.add(legP);
    limbs.push(legP);
    const armP = new THREE.Group();
    armP.position.set(s * 0.32, 1.3, 0);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.42, 4, 6), olive);
    arm.position.y = -0.28;
    armP.add(arm);
    root.add(armP);
    limbs.push(armP);
  }
  const wand = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 6), new THREE.MeshStandardMaterial({ color: 0x333333 }));
  wand.rotation.x = Math.PI / 2;
  wand.position.set(0.3, 1.0, 0.45);
  root.add(wand);
  const nozzle = new THREE.Object3D();
  nozzle.position.set(0.3, 1.0, 0.82);
  root.add(nozzle);
  root.userData.limbs = limbs;
  shadows(root);
  return { root, mixer: null, clips: {}, nozzle, tripo: false };
}
