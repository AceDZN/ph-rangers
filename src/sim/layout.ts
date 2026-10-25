// Valley layouts: terrain height, creek, pond and landmarks. Pure data + math, shared by the
// simulation (runoff, creek flow) and the renderer (terrain mesh, props).

export type Vec2 = readonly [number, number];

export interface Circle {
  x: number;
  z: number;
  r: number;
}

export interface Rect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

export interface Layout {
  id: 'galilee' | 'night';
  /** World is size × size metres, x east, z south, y up. */
  size: number;
  /** Grid cell edge in metres. */
  cell: number;
  creek: Vec2[];
  road: Vec2[];
  pond: Circle;
  quarry: Circle;
  terraces: Rect;
  blueberry: Rect;
  flats: Array<Circle & { h?: number }>;
  hives: Vec2[];
  houses: Array<{ x: number; z: number; rot: number; w: number; d: number }>;
  school: { x: number; z: number; rot: number };
  trees: Array<{ x: number; z: number; s: number }>;
  walls: Array<[Vec2, Vec2]>;
  /** Overturned tanker position (spill source), if present. */
  truck?: { x: number; z: number; rot: number };
}

export const GALILEE: Layout = {
  id: 'galilee',
  size: 96,
  cell: 3,
  creek: [
    [80, 2],
    [75, 13],
    [66, 24],
    [55, 33],
    [45, 43],
    [37, 54],
    [30, 65],
    [24, 76],
  ],
  road: [
    [94, 90],
    [76, 78],
    [66, 66],
    [60, 52],
    [58, 40],
    [56, 26],
    [44, 16],
    [30, 10],
  ],
  pond: { x: 20, z: 83, r: 8.5 },
  quarry: { x: 13, z: 15, r: 13 },
  terraces: { x0: 28, z0: 14, x1: 52, z1: 34 },
  blueberry: { x0: 68, z0: 46, x1: 79, z1: 56 },
  flats: [
    { x: 76, z: 78, r: 12 },
    { x: 56, z: 86, r: 7 },
    { x: 46, z: 64, r: 6 },
    { x: 74, z: 52, r: 10 },
  ],
  hives: [
    [44, 62],
    [47, 64.5],
    [43.5, 66],
  ],
  houses: [
    { x: 80, z: 72, rot: 0.3, w: 6, d: 5 },
    { x: 86, z: 80, rot: -0.2, w: 5, d: 5 },
    { x: 72, z: 86, rot: 0.1, w: 6, d: 4.5 },
    { x: 84, z: 64, rot: 0.6, w: 5, d: 4 },
  ],
  school: { x: 54, z: 90, rot: 0 },
  trees: [
    // Olive terraces
    ...[16, 21, 26, 31].flatMap((z) => [31, 36, 41, 46, 50].map((x) => ({ x: x + ((z * 7) % 3), z, s: 0.9 + ((x + z) % 4) * 0.08 }))),
    // Scattered
    { x: 62, z: 70, s: 1.1 },
    { x: 88, z: 56, s: 1 },
    { x: 34, z: 74, s: 1.2 },
    { x: 10, z: 64, s: 1.1 },
    { x: 8, z: 44, s: 1 },
    { x: 90, z: 30, s: 1.2 },
    { x: 86, z: 14, s: 1 },
    { x: 66, z: 8, s: 1.1 },
    { x: 30, z: 90, s: 1 },
    { x: 92, z: 46, s: 0.9 },
  ],
  walls: [
    [
      [27, 13],
      [53, 13],
    ],
    [
      [27, 35],
      [53, 35],
    ],
    [
      [65, 45],
      [83, 45],
    ],
    [
      [65, 59],
      [83, 59],
    ],
    [
      [88, 70],
      [88, 88],
    ],
  ],
  truck: { x: 82, z: 6, rot: 0.9 },
};

export const NIGHT: Layout = {
  id: 'night',
  size: 96,
  cell: 3,
  creek: [
    [14, 2],
    [22, 14],
    [34, 22],
    [46, 32],
    [54, 44],
    [62, 56],
    [68, 68],
    [72, 76],
  ],
  road: [
    [4, 92],
    [22, 78],
    [32, 64],
    [36, 50],
    [40, 36],
    [52, 20],
    [70, 12],
  ],
  pond: { x: 76, z: 83, r: 8.5 },
  quarry: { x: 82, z: 18, r: 12 },
  terraces: { x0: 50, z0: 8, x1: 72, z1: 26 },
  blueberry: { x0: 17, z0: 40, x1: 28, z1: 50 },
  flats: [
    { x: 20, z: 80, r: 12 },
    { x: 44, z: 86, r: 7 },
    { x: 44, z: 60, r: 6 },
    { x: 22, z: 46, r: 10 },
  ],
  hives: [
    [44, 58],
    [47, 60],
    [43, 62],
  ],
  houses: [
    { x: 14, z: 74, rot: -0.3, w: 6, d: 5 },
    { x: 10, z: 84, rot: 0.2, w: 5, d: 5 },
    { x: 26, z: 88, rot: -0.1, w: 6, d: 4.5 },
  ],
  school: { x: 42, z: 90, rot: 0.1 },
  trees: [
    ...[10, 15, 20, 25].flatMap((z) => [53, 58, 63, 68].map((x) => ({ x, z, s: 0.95 }))),
    { x: 36, z: 72, s: 1.1 },
    { x: 8, z: 60, s: 1 },
    { x: 86, z: 50, s: 1.1 },
    { x: 90, z: 66, s: 1 },
    { x: 60, z: 80, s: 1.2 },
    { x: 30, z: 30, s: 1 },
  ],
  walls: [
    [
      [13, 39],
      [31, 39],
    ],
    [
      [13, 53],
      [31, 53],
    ],
  ],
};

// ---------- math helpers ----------

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function distToSegment(px: number, pz: number, a: Vec2, b: Vec2): { d: number; t: number } {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len2 = dx * dx + dz * dz;
  let t = len2 > 0 ? ((px - a[0]) * dx + (pz - a[1]) * dz) / len2 : 0;
  t = Math.min(1, Math.max(0, t));
  const cx = a[0] + dx * t;
  const cz = a[1] + dz * t;
  return { d: Math.hypot(px - cx, pz - cz), t };
}

export function distToPolyline(px: number, pz: number, line: Vec2[]): number {
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) best = Math.min(best, distToSegment(px, pz, line[i], line[i + 1]).d);
  return best;
}

export const inRect = (r: Rect, x: number, z: number) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;

/** Raw rolling valley without carved features. */
function baseHeight(L: Layout, x: number, z: number): number {
  const s = L.size;
  const north = L.id === 'galilee' ? 1 - z / s : 1 - z / s;
  let h = 9 * Math.pow(Math.max(0, north), 1.1);
  h += 1.2 * Math.sin(x * 0.07 + (L.id === 'night' ? 2 : 0)) * Math.cos(z * 0.05);
  h += 0.6 * Math.sin(x * 0.13 + z * 0.09);
  // Valley walls rise at the east and west edges.
  h += 5 * smoothstep(s - 12, s, x) + 5 * (1 - smoothstep(0, 12, x));
  h += 3 * (1 - smoothstep(0, 8, z));
  return h;
}

/** Terrain height (metres) at world x, z. */
export function terrainHeight(L: Layout, x: number, z: number): number {
  let h = baseHeight(L, x, z);
  // Flats (village, school yard, hive meadow, farm).
  for (const f of L.flats) {
    const d = Math.hypot(x - f.x, z - f.z);
    if (d < f.r + 4) {
      const target = f.h ?? baseHeight(L, f.x, f.z);
      h += (target - h) * (1 - smoothstep(f.r, f.r + 4, d));
    }
  }
  // Olive terraces: stepped benches.
  const t = L.terraces;
  if (x > t.x0 - 3 && x < t.x1 + 3 && z > t.z0 - 3 && z < t.z1 + 3) {
    const step = 1.3;
    const k = h / step;
    const fl = Math.floor(k);
    const frac = k - fl;
    const stepped = (fl + smoothstep(0.82, 1, frac)) * step;
    const w = smoothstep(0, 3, Math.min(x - t.x0 + 3, t.x1 + 3 - x, z - t.z0 + 3, t.z1 + 3 - z));
    h += (stepped - h) * w;
  }
  // Quarry: a pale benched cut.
  {
    const q = L.quarry;
    const d = Math.hypot(x - q.x, z - q.z);
    if (d < q.r + 3) {
      const depth = 3.2 * (1 - smoothstep(q.r * 0.55, q.r + 3, d));
      const bench = Math.round(depth / 1.1) * 1.1;
      h -= depth * 0.4 + bench * 0.6;
    }
  }
  // Creek channel.
  {
    const d = distToPolyline(x, z, L.creek);
    if (d < 4) h -= 1.3 * (1 - smoothstep(0.4, 3.6, d));
  }
  // Pond bowl.
  {
    const p = L.pond;
    const d = Math.hypot(x - p.x, z - p.z);
    const rim = pondLevel(L) + 0.5;
    if (d < p.r + 5) {
      const bowl = pondLevel(L) - 1.4 * (1 - Math.min(1, (d / p.r) ** 2));
      const w = 1 - smoothstep(p.r - 1, p.r + 5, d);
      const shore = Math.min(h, rim + (d - p.r) * 0.25);
      h = h * (1 - w) + (d < p.r ? bowl : shore) * w;
    }
  }
  return h;
}

/** Water surface height of the pond. */
export function pondLevel(L: Layout): number {
  const p = L.pond;
  return baseHeight(L, p.x, p.z) - 0.6;
}

/** Water surface along the creek at a point (bed + 0.35 m). */
export function creekWaterHeight(L: Layout, x: number, z: number): number {
  return terrainHeight(L, x, z) + 0.35;
}

/** Simple circle colliders for the player (houses, trees, hives, pond). */
export function colliders(L: Layout): Circle[] {
  const out: Circle[] = [];
  for (const hs of L.houses) out.push({ x: hs.x, z: hs.z, r: Math.max(hs.w, hs.d) * 0.55 });
  out.push({ x: L.school.x, z: L.school.z, r: 4.2 });
  for (const t of L.trees) out.push({ x: t.x, z: t.z, r: 0.7 * t.s });
  for (const h of L.hives) out.push({ x: h[0], z: h[1], r: 0.7 });
  out.push({ x: L.pond.x, z: L.pond.z, r: L.pond.r - 1.2 });
  if (L.truck) out.push({ x: L.truck.x, z: L.truck.z, r: 3 });
  return out;
}
