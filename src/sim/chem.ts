// Authoritative acid/base chemistry for pH Rangers. Pure TypeScript, no rendering imports.
//
// Each patch of ground holds water (volume in litres) and a signed "excess":
// E > 0 is unreacted H⁺ from acid, E < 0 is unreacted OH⁻ from base (moles-like units).
// Acid and base that meet react at once (acid + base → salt + water), so a patch only
// ever stores the excess of one of them. pH comes from that excess and the volume with the
// log10 rule (Workbook's strong-acid / strong-base model), plus a small soil buffer that
// only acts between pH 4 and 9 (real soil and pond water resist small changes near neutral;
// without it no hand-held sprayer could ever land inside a 6–8 band).

export const PH_MIN = 0;
export const PH_MAX = 14;
export const NEUTRAL = 7;

/** Lower and upper edge of the range where the soil buffer acts. */
export const BUFFER_LO = 4;
export const BUFFER_HI = 9;

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** Amount (mol) the soil buffer has soaked up when the patch sits at this pH. */
export function bufferTerm(pH: number, beta: number): number {
  return beta * (NEUTRAL - clamp(pH, BUFFER_LO, BUFFER_HI));
}

/**
 * Net excess (mol, + acid / − base) a patch of `volume` litres and buffer `beta` must hold to
 * sit at this pH. Strictly decreasing in pH, so it can be inverted.
 */
export function netForPH(pH: number, volume: number, beta = 0): number {
  const h = Math.pow(10, -pH);
  const oh = Math.pow(10, pH - 14);
  return volume * (h - oh) + bufferTerm(pH, beta);
}

/** pH of a patch from its signed excess, volume and buffer, clamped to 0–14. */
export function phFromNet(net: number, volume: number, beta = 0): number {
  if (volume <= 0) return NEUTRAL;
  if (net >= netForPH(PH_MIN, volume, beta)) return PH_MIN;
  if (net <= netForPH(PH_MAX, volume, beta)) return PH_MAX;
  if (beta === 0) {
    // Closed form of the strong acid/base formula including water's own ions.
    const c = net / volume;
    const h = (c + Math.sqrt(c * c + 4e-14)) / 2;
    return clamp(-Math.log10(h), PH_MIN, PH_MAX);
  }
  let lo = PH_MIN;
  let hi = PH_MAX;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (netForPH(mid, volume, beta) > net) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** H⁺ concentration ratio between two pH values: every unit is ×10. */
export function hydrogenRatio(pHa: number, pHb: number): number {
  return Math.pow(10, pHb - pHa);
}

/**
 * Result of mixing `added` (signed mol) into a patch holding `existing`.
 * Returns the new excess and how much reacted (formed salt + water, released heat).
 */
export function react(existing: number, added: number): { net: number; reacted: number } {
  const net = existing + added;
  const reacted = existing * added < 0 ? Math.min(Math.abs(existing), Math.abs(added)) : 0;
  return { net, reacted };
}

// ---------- Indicators (Workbook grade 8, chapter 10, "indicators") ----------

export type LitmusReading = 'acid' | 'base' | 'unclear';

/**
 * A litmus pair (blue strip + red strip). Blue turns red in acid, red turns blue in base.
 * Litmus changes across a wide band (pH 4.5–8.2), so in between neither strip clearly
 * changes. It never gives a number.
 */
export function litmus(pH: number): LitmusReading {
  if (pH < 4.5) return 'acid';
  if (pH > 8.2) return 'base';
  return 'unclear';
}

export type PhenolReading = 'colorless' | 'pale-pink' | 'pink';

/** Phenolphthalein: colourless below 8.2, pale pink 8.2–10, strong pink above 10. Never shows acids. */
export function phenolphthalein(pH: number): PhenolReading {
  if (pH < 8.2) return 'colorless';
  if (pH <= 10) return 'pale-pink';
  return 'pink';
}

export type UniversalColor = 'red' | 'orange' | 'yellow' | 'green' | 'blue-green' | 'blue' | 'purple';

/** Universal indicator colour per Workbook's table (rounded to the nearest whole pH). */
export function universal(pH: number): UniversalColor {
  const r = Math.round(clamp(pH, PH_MIN, PH_MAX));
  if (r <= 3) return 'red';
  if (r <= 5) return 'orange';
  if (r === 6) return 'yellow';
  if (r === 7) return 'green';
  if (r === 8) return 'blue-green';
  if (r <= 10) return 'blue';
  return 'purple';
}

/** Display colours keyed at each whole pH (0–14), following the Workbook table. */
export const UNIVERSAL_RGB: ReadonlyArray<readonly [number, number, number]> = [
  [0.86, 0.12, 0.14], // 0 red
  [0.89, 0.16, 0.16], // 1
  [0.92, 0.22, 0.18], // 2
  [0.95, 0.3, 0.18], // 3 red-orange
  [0.98, 0.52, 0.12], // 4 orange
  [0.99, 0.65, 0.12], // 5 orange
  [0.99, 0.86, 0.2], // 6 yellow
  [0.3, 0.75, 0.3], // 7 green
  [0.15, 0.68, 0.62], // 8 blue-green
  [0.2, 0.52, 0.9], // 9 blue
  [0.24, 0.4, 0.88], // 10 blue
  [0.5, 0.26, 0.78], // 11 purple
  [0.56, 0.2, 0.72], // 12
  [0.6, 0.16, 0.66], // 13
  [0.62, 0.12, 0.6], // 14
];

export function universalRGB(pH: number): [number, number, number] {
  const p = clamp(pH, PH_MIN, PH_MAX);
  const i = Math.min(13, Math.floor(p));
  const t = p - i;
  const a = UNIVERSAL_RGB[i];
  const b = UNIVERSAL_RGB[i + 1];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export type PhClass = 'acid' | 'neutral' | 'base';

/** Workbook wording: below 7 acidic, 7 neutral, above 7 basic (shown with ±0.25 tolerance). */
export function phClass(pH: number): PhClass {
  if (pH < 6.75) return 'acid';
  if (pH > 7.25) return 'base';
  return 'neutral';
}

// ---------- Sprayer recipes ----------

export type Valve = 'acid' | 'base' | 'water';
export type Strength = 1 | 10;

/** Concentration (mol/L) of the sprayed liquid. ×1 is 0.01 (pH 2 / 12), ×10 is 0.1 (pH 1 / 13). */
export function sprayConcentration(valve: Valve, strength: Strength): number {
  if (valve === 'water') return 0;
  return strength === 10 ? 0.1 : 0.01;
}

/** Signed excess carried by `litres` of spray. */
export function sprayExcess(valve: Valve, strength: Strength, litres: number): number {
  const c = sprayConcentration(valve, strength) * litres;
  return valve === 'acid' ? c : valve === 'base' ? -c : 0;
}

/** pH of the liquid currently selected in the tank (shown on the tank gauge). */
export function sprayPH(valve: Valve, strength: Strength): number {
  return phFromNet(sprayExcess(valve, strength, 1), 1, 0);
}
