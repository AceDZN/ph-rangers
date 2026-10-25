import { describe, expect, it } from 'vitest';
import {
  hydrogenRatio,
  litmus,
  netForPH,
  phenolphthalein,
  phFromNet,
  phFromNetNear,
  react,
  sprayPH,
  universal,
} from '../src/sim/chem';

describe('pH from amounts (strong acid / strong base, log10 rule)', () => {
  it('is 7 when acid and base are equal', () => {
    expect(phFromNet(0, 20)).toBeCloseTo(7, 6);
    expect(phFromNet(0, 20, 0.0015)).toBeCloseTo(7, 6);
  });

  it('gives pH 3 for 0.001 mol/L of excess H⁺ and pH 11 for 0.001 mol/L OH⁻', () => {
    expect(phFromNet(0.02, 20)).toBeCloseTo(3, 3);
    expect(phFromNet(-0.02, 20)).toBeCloseTo(11, 3);
  });

  it('each pH unit is ×10 in H⁺', () => {
    expect(hydrogenRatio(3, 4)).toBeCloseTo(10);
    expect(hydrogenRatio(2, 4)).toBeCloseTo(100);
    expect(netForPH(2, 20) / netForPH(3, 20)).toBeCloseTo(10, 1);
  });

  it('round-trips through netForPH, also with a soil buffer', () => {
    for (const p of [0.5, 2, 3.3, 4.5, 5, 6.2, 7, 7.9, 8.5, 9.4, 11, 13.5]) {
      expect(phFromNet(netForPH(p, 20, 0.0015), 20, 0.0015)).toBeCloseTo(p, 4);
    }
  });

  it('the warm-started solver agrees with bisection', () => {
    for (const p of [0.2, 1.5, 2.9, 4.01, 5.5, 6.99, 7.2, 8.9, 9.3, 12.7]) {
      for (const guess of [7, 0.5, 13.5, p + 0.3]) {
        const net = netForPH(p, 20, 0.0015);
        expect(phFromNetNear(net, 20, 0.0015, guess)).toBeCloseTo(phFromNet(net, 20, 0.0015), 5);
      }
    }
  });

  it('clamps to 0–14', () => {
    expect(phFromNet(1e3, 1)).toBe(0);
    expect(phFromNet(-1e3, 1)).toBe(14);
  });

  it('dilution moves pH toward 7 but never crosses it, ~10× water per unit at strong values', () => {
    const acid = 0.02; // pH 3 in 20 L
    let prev = phFromNet(acid, 20, 0.0015);
    for (const v of [40, 200, 2000, 20000, 2e6]) {
      const p = phFromNet(acid, v, 0.0015);
      expect(p).toBeGreaterThan(prev);
      expect(p).toBeLessThan(7);
      prev = p;
    }
    expect(phFromNet(acid, 200)).toBeCloseTo(4, 1);
    const base = -0.02;
    expect(phFromNet(base, 2e6, 0.0015)).toBeGreaterThan(7);
  });

  it('a pH 2 patch needs about ten times the base of a pH 3 patch, even with the soil buffer', () => {
    const beta = 0.0015;
    const need3 = netForPH(3, 20, beta) - netForPH(7, 20, beta);
    const need2 = netForPH(2, 20, beta) - netForPH(7, 20, beta);
    expect(need2 / need3).toBeGreaterThan(8);
    expect(need2 / need3).toBeLessThan(10.5);
  });

  it('neutralization: acid + base react, the excess of one remains', () => {
    expect(react(0.02, -0.005)).toEqual({ net: 0.015, reacted: 0.005 });
    expect(react(-0.01, 0.03).reacted).toBeCloseTo(0.01);
    expect(react(0.01, 0.01).reacted).toBe(0);
  });
});

describe('indicators per Workbook', () => {
  it('litmus only says acid / base (no number), unclear in its 4.5–8.2 change range', () => {
    expect(litmus(1)).toBe('acid');
    expect(litmus(4)).toBe('acid');
    expect(litmus(6)).toBe('unclear');
    expect(litmus(7)).toBe('unclear');
    expect(litmus(9)).toBe('base');
    expect(litmus(13)).toBe('base');
  });

  it('phenolphthalein is colourless below 8.2 (all acids too), pink above', () => {
    expect(phenolphthalein(1)).toBe('colorless');
    expect(phenolphthalein(7)).toBe('colorless');
    expect(phenolphthalein(8.1)).toBe('colorless');
    expect(phenolphthalein(9)).toBe('pale-pink');
    expect(phenolphthalein(11)).toBe('pink');
  });

  it('universal indicator follows the Workbook colour table', () => {
    expect(universal(1)).toBe('red');
    expect(universal(3)).toBe('red');
    expect(universal(4)).toBe('orange');
    expect(universal(5)).toBe('orange');
    expect(universal(6)).toBe('yellow');
    expect(universal(7)).toBe('green');
    expect(universal(8)).toBe('blue-green');
    expect(universal(9)).toBe('blue');
    expect(universal(10)).toBe('blue');
    expect(universal(11)).toBe('purple');
    expect(universal(14)).toBe('purple');
  });
});

describe('sprayer liquids', () => {
  it('×1 is 0.01 mol/L (pH 2 / 12), ×10 is ten times stronger (pH 1 / 13)', () => {
    expect(sprayPH('acid', 1)).toBeCloseTo(2, 3);
    expect(sprayPH('base', 1)).toBeCloseTo(12, 3);
    expect(sprayPH('acid', 10)).toBeCloseTo(1, 3);
    expect(sprayPH('base', 10)).toBeCloseTo(13, 3);
    expect(sprayPH('water', 1)).toBeCloseTo(7, 6);
  });
});
