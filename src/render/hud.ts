// DOM HUD (Hebrew, RTL) laid out like the gameplay mockups, plus world-anchored pH badges.

import * as THREE from 'three';
import { litmus, phClass, phenolphthalein, universalRGB } from '../sim/chem';
import type { Game } from '../sim/game';
import { terrainHeight } from '../sim/layout';
import { KNOW_LITMUS, KNOW_PHENOL, KNOW_UNIVERSAL } from '../sim/world';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const ICONS: Record<string, string> = {
  fish: `<svg viewBox="0 0 48 36"><path d="M6 18c6-9 18-12 28-6l8-6v24l-8-6C24 30 12 27 6 18z" fill="#4fc3f7" stroke="#0d47a1" stroke-width="2"/><circle cx="14" cy="16" r="2.5" fill="#0d47a1"/></svg>`,
  bees: `<svg viewBox="0 0 48 36"><ellipse cx="24" cy="21" rx="13" ry="10" fill="#ffca28" stroke="#5d4037" stroke-width="2"/><path d="M19 12v18M27 12v18" stroke="#3e2723" stroke-width="4"/><ellipse cx="18" cy="9" rx="7" ry="5" fill="#e3f2fd" opacity=".9"/><ellipse cx="30" cy="9" rx="7" ry="5" fill="#e3f2fd" opacity=".9"/></svg>`,
  berries: `<svg viewBox="0 0 48 36"><circle cx="17" cy="21" r="9" fill="#3949ab"/><circle cx="31" cy="20" r="9" fill="#283593"/><circle cx="24" cy="27" r="7" fill="#5c6bc0"/><path d="M24 12c4-8 12-8 14-6-4 2-8 6-14 6z" fill="#43a047"/></svg>`,
  school: `<svg viewBox="0 0 48 36"><rect x="8" y="14" width="32" height="20" fill="#ffe0b2" stroke="#8d6e63" stroke-width="2"/><path d="M5 15L24 4l19 11z" fill="#e53935"/><rect x="21" y="22" width="6" height="12" fill="#6d4c41"/><path d="M24 4V-2" stroke="#999"/></svg>`,
  olive: `<svg viewBox="0 0 48 36"><path d="M22 34c0-8 2-12 2-18" stroke="#6d4c41" stroke-width="4"/><ellipse cx="16" cy="12" rx="10" ry="7" fill="#9ccc65"/><ellipse cx="30" cy="11" rx="11" ry="8" fill="#8bc34a"/><ellipse cx="24" cy="6" rx="8" ry="5" fill="#aed581"/></svg>`,
};

function bandText(lo: number, hi: number) {
  return `pH ${lo}–${hi}`;
}

interface BadgeEl {
  el: HTMLDivElement;
  used: boolean;
}

export class Hud {
  private assetsBuilt = '';
  private badges: BadgeEl[] = [];
  private badgeData: Array<{ x: number; y: number; z: number; html: string; cls: string; bg: string }> = [];
  private badgeT = 0;
  private toastT = 0;
  private v = new THREE.Vector3();

  show(on: boolean) {
    $('hud').hidden = !on;
    $('badges').style.display = on ? '' : 'none';
  }

  toast(text: string, cls = '') {
    const t = $('toast');
    t.textContent = text;
    t.className = `toast ${cls}`;
    t.hidden = false;
    // Restart the pop animation.
    void t.offsetWidth;
    this.toastT = 1.6;
  }

  hurt(id: string) {
    const el = document.querySelector(`.asset[data-id="${id}"]`);
    if (!el) return;
    el.classList.remove('hurt');
    void (el as HTMLElement).offsetWidth;
    el.classList.add('hurt');
  }

  flashGadget(kind: string) {
    const el = document.querySelector(`.gadget[data-gadget="${kind}"]`);
    if (!el) return;
    el.classList.remove('flash');
    void (el as HTMLElement).offsetWidth;
    el.classList.add('flash');
  }

  update(game: Game, camera: THREE.Camera, w: number, h: number, dt: number) {
    const m = game.mission;
    // Timer: a labelled storm countdown when the mission has one, otherwise elapsed time.
    const storm = m.minTime > 0;
    const remaining = storm ? Math.max(0, m.minTime - game.t) : game.t;
    const mm = Math.floor(remaining / 60);
    const ss = Math.floor(remaining % 60);
    $('time').textContent = `${mm}:${String(ss).padStart(2, '0')}`;
    const minH = game.assets.length ? Math.min(...game.assets.map((a) => a.health)) : 100;
    const timer = document.querySelector<HTMLElement>('.timer')!;
    timer.classList.toggle('urgent', minH < 40);
    timer.classList.toggle('storm', storm);
    $('timelabel').textContent = storm ? (remaining > 0 ? (m.rain ? 'הסערה עוברת בעוד' : 'הדליפה נעצרת בעוד') : 'עבר! סיימו לנקות') : 'זמן';
    $('timebar').style.width = `${storm ? Math.max(0, Math.min(100, (remaining / m.minTime) * 100)) : 0}%`;

    // Assets panel.
    const key = m.id + game.assets.length;
    const box = $('assets');
    if (key !== this.assetsBuilt) {
      this.assetsBuilt = key;
      box.innerHTML = game.assets
        .map(
          (a) => `<div class="asset" data-id="${a.id}"><span class="ic">${ICONS[a.icon] ?? ''}</span>
          <div class="row1"><span class="nm">${a.name}</span><bdi class="chip ${a.hi < 7 ? 'acidic' : ''}" dir="ltr">${bandText(a.lo, a.hi)}</bdi></div>
          <div class="row1"><bdi class="now" dir="ltr">pH ?</bdi><div class="hp" style="flex:1"><i></i></div></div></div>`,
        )
        .join('');
    }
    game.assets.forEach((a, i) => {
      const el = box.children[i] as HTMLElement | undefined;
      if (!el) return;
      const known = a.cells.some((c) => game.grid.know[c] & KNOW_UNIVERSAL);
      const hurting = a.health < 100 && (a.pH < a.lo || a.pH > a.hi);
      const now = el.querySelector('.now') as HTMLElement;
      now.textContent = known ? `pH ${a.pH.toFixed(1)}` : hurting ? '⚠ נפגע – מדדו!' : 'pH ?';
      now.classList.toggle('alert', hurting);
      (el.querySelector('.hp i') as HTMLElement).style.width = `${a.health}%`;
      el.classList.toggle('low', a.health < 40);
    });

    // Mission + objective + tutorial.
    $('mtitle').textContent = `משימה ${m.num}: ${m.title}`;
    const oi = game.objectiveInfo();
    $('mobj').textContent = oi.main;
    $('mchips').innerHTML =
      game.status === 'play'
        ? `<span class="${oi.bad ? 'bad' : ''}">מחוץ לטווח <bdi dir="ltr">${oi.bad}</bdi></span><span class="${oi.unknown ? 'unk' : ''}">לא נמדדו <bdi dir="ltr">${oi.unknown}</bdi></span>`
        : '';
    const tut = game.tutorialText();
    const tutEl = $('tutorial');
    tutEl.hidden = !tut;
    if (tut) tutEl.textContent = tut;
    const hintEl = $('hintbox');
    hintEl.hidden = !game.hint;
    if (game.hint) hintEl.textContent = '💡 ' + game.hint;
    ($('btn-hint') as HTMLButtonElement).disabled = !!m.noHints;
    $('btn-hint').style.display = m.noHints ? 'none' : '';

    // Tank.
    const T = game.tank;
    const L = game.loadout;
    const tank = $('tank');
    tank.className = `tank panel ${T.valve}`;
    $('tankph').textContent = game.tankPH().toFixed(0);
    const frac = T.valve === 'water' ? T.water / L.water : T[T.valve] / (L[T.valve] || 1);
    $('tankfill').style.height = `${Math.max(0, Math.min(1, frac)) * 100}%`;
    const low = frac < 0.2;
    tank.classList.toggle('low', low);
    $('tanklow').hidden = !low;
    if (frac < 0.15 && !this.lowWarned) {
      this.lowWarned = true;
      this.onLowTank?.();
    } else if (frac > 0.3) this.lowWarned = false;
    const sb = $('strength');
    sb.querySelector('bdi')!.textContent = `×${T.strength}`;
    sb.classList.toggle('x10', T.strength === 10);
    sb.classList.toggle('locked', !T.strength10);
    sb.style.display = T.valve === 'water' ? 'none' : '';
    document.querySelectorAll<HTMLElement>('.valve').forEach((b) => {
      const v = b.dataset.valve as 'acid' | 'base' | 'water';
      b.classList.toggle('on', v === T.valve);
      const f = v === 'water' ? T.water / L.water : T[v] / (L[v] || 1);
      (b.querySelector('.lvl i') as HTMLElement).style.width = `${Math.max(0, Math.min(1, f)) * 100}%`;
    });
    document.querySelectorAll<HTMLElement>('.gadget').forEach((b) => {
      const k = b.dataset.gadget as 'litmus' | 'phenol' | 'mist' | 'canister';
      const n = game.gadgets[k];
      b.querySelector('.cnt')!.textContent = `×${n}`;
      b.classList.toggle('empty', n <= 0);
      b.classList.toggle('hidden', L[k] <= 0);
    });

    // Reticle + reading at the aim point.
    const ax = game.aim.x;
    const az = game.aim.z;
    this.v.set(ax, terrainHeight(m.layout, ax, az) + 0.3, az).project(camera);
    const ret = $('reticle');
    ret.style.left = `${((this.v.x + 1) / 2) * w}px`;
    ret.style.top = `${((1 - this.v.y) / 2) * h}px`;
    const r = game.readingAt(game.aim.cell);
    const ro = $('readout');
    if (r.kind === 'none') ro.textContent = '';
    else {
      ro.textContent = r.text;
      const p = game.grid.pH[game.aim.cell];
      ro.style.background = r.kind === 'universal' ? rgbCss(universalRGB(p), 0.92) : 'rgba(16,32,48,0.85)';
      ro.style.color = r.kind === 'universal' && p > 5.5 && p < 8.5 && p < 7.6 && p > 5.6 ? '#111' : '#fff';
    }

    // Toast fade.
    if (this.toastT > 0) {
      this.toastT -= dt;
      if (this.toastT <= 0) $('toast').hidden = true;
    }

    // World badges (recomputed a few times per second, repositioned every frame).
    this.badgeT -= dt;
    if (this.badgeT <= 0) {
      this.badgeT = 0.2;
      this.computeBadges(game);
    }
    this.placeBadges(camera, w, h);
    this.updateScore(game);
    this.updateRuler(game);
    this.updateArrows(game, camera, w, h, dt);
    this.updateVignette(game, dt);
    const mistBtn = document.querySelector<HTMLElement>('.gadget[data-gadget="mist"]');
    if (mistBtn) mistBtn.style.setProperty('--charge', String(game.mistCharge));
  }

  // ---------- score / combo ----------
  private shownScore = 0;
  private updateScore(game: Game) {
    const target = game.score;
    if (this.shownScore !== target) {
      this.shownScore += Math.max(1, Math.ceil((target - this.shownScore) * 0.15));
      if (this.shownScore > target) this.shownScore = target;
      $('score').textContent = this.shownScore.toLocaleString('en-US');
    }
    const c = $('combo');
    if (game.combo >= 2) {
      const txt = `רצף ×${game.combo}`;
      if (c.textContent !== txt) {
        c.textContent = txt;
        c.hidden = false;
        c.style.animation = 'none';
        void c.offsetWidth;
        c.style.animation = '';
      }
    } else c.hidden = true;
  }

  bumpScore() {
    const el = $('scorebox');
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }

  // ---------- pH ruler: what the indicators say about the aimed ground ----------
  lowWarned = false;
  onLowTank: (() => void) | null = null;

  private updateRuler(game: Game) {
    const c = game.aim.cell;
    const g = game.grid;
    const band = g.band(c);
    const pct = (v: number) => `${(v / 14) * 100}%`;
    const rb = $('rband');
    rb.style.display = 'block';
    rb.style.left = pct(band.lo);
    rb.style.width = `${((band.hi - band.lo) / 14) * 100}%`;
    const r = game.readingRange(c);
    const rr = $('rrange');
    const rm = $('rmark');
    const label = $('rulerlabel');
    const known = game.readingAt(c);
    const target = `יעד pH ${band.lo}–${band.hi}`;
    if (!r) {
      rr.style.display = 'none';
      rm.style.display = 'none';
      label.textContent = `${target} · עוד לא נמדד`;
      return;
    }
    const ghost = $('rghost');
    const next = game.nextPuffPH();
    if (next !== null && r && r.exact !== undefined && Math.abs(next - r.exact) > 0.02) {
      ghost.style.display = 'block';
      ghost.style.left = pct(next);
    } else ghost.style.display = 'none';
    if (r.exact !== undefined) {
      rr.style.display = 'none';
      rm.style.display = 'block';
      rm.style.left = pct(r.exact);
      $('rval').textContent = r.exact.toFixed(1);
      const inb = r.exact >= band.lo && r.exact <= band.hi;
      // No advice on what to spray in the no-hint transfer mission.
      const advice = game.mission.noHints ? 'מחוץ לטווח' : r.exact < band.lo ? 'חומצי מדי – רססו בסיס' : 'בסיסי מדי – רססו חומצה';
      label.textContent = `${target} · ${inb ? 'בטווח ✓' : advice}`;
    } else {
      rm.style.display = 'none';
      rr.style.display = 'block';
      rr.style.left = pct(r.lo);
      rr.style.width = `${((r.hi - r.lo) / 14) * 100}%`;
      label.textContent = `${target} · ${known.kind === 'litmus' ? 'לקמוס' : 'פנולפתלאין'}: רק טווח`;
    }
  }

  // ---------- off-screen guidance ----------
  private arrowT = 0;
  private arrowTargets: Array<{ x: number; z: number; cls: string; icon: string; label: string }> = [];
  private arrowEls: HTMLDivElement[] = [];
  private updateArrows(game: Game, camera: THREE.Camera, w: number, h: number, dt: number) {
    this.arrowT -= dt;
    if (this.arrowT <= 0) {
      this.arrowT = 0.3;
      this.arrowTargets = this.findTargets(game);
    }
    const host = $('arrows');
    while (this.arrowEls.length < this.arrowTargets.length) {
      const el = document.createElement('div');
      el.className = 'arrow';
      el.innerHTML = '<span></span><small></small>';
      host.appendChild(el);
      this.arrowEls.push(el);
    }
    const L = game.mission.layout;
    this.arrowEls.forEach((el, i) => {
      const t = this.arrowTargets[i];
      if (!t) {
        el.style.display = 'none';
        return;
      }
      this.v.set(t.x, terrainHeight(L, t.x, t.z) + 1, t.z).project(camera);
      let x = this.v.x;
      let y = this.v.y;
      const behind = this.v.z > 1;
      if (behind) {
        x = -x;
        y = -y;
      }
      const onScreen = !behind && Math.abs(x) < 0.92 && Math.abs(y) < 0.86;
      if (onScreen) {
        el.style.display = 'none';
        return;
      }
      // Clamp to an ellipse just inside the screen edge and point outward.
      const ang = Math.atan2(y, x);
      const ex = Math.cos(ang) * 0.86;
      // Keep arrows clear of the bottom HUD (ruler, tank, gadgets).
      const ey = Math.max(-0.5, Math.sin(ang) * 0.8);
      el.style.display = '';
      el.className = `arrow ${t.cls}`;
      el.style.left = `${((ex + 1) / 2) * w}px`;
      el.style.top = `${((1 - ey) / 2) * h}px`;
      // The tail corner of the bubble points toward the target.
      el.style.setProperty('--rot', `${-ang * (180 / Math.PI) + 135 + 90}deg`);
      (el.firstChild as HTMLElement).textContent = t.icon;
      (el.lastChild as HTMLElement).textContent = t.label;
    });
  }

  private findTargets(game: Game) {
    const g = game.grid;
    const p = game.player;
    const out: Array<{ x: number; z: number; cls: string; icon: string; label: string }> = [];
    // Assets in danger first.
    for (const a of game.assets) {
      if (a.health < 99 && (a.pH < a.lo || a.pH > a.hi)) out.push({ x: a.at[0], z: a.at[1], cls: 'danger', icon: '⚠', label: a.name });
    }
    // Nearest measured patch that is still out of its band.
    {
      let bb = -1;
      let bdd = Infinity;
      for (let c = 0; c < g.count; c++) {
        if (!(g.know[c] & KNOW_UNIVERSAL) || g.inBand(c, game.mission.tol)) continue;
        const [x, z] = g.center(c);
        const d = Math.hypot(x - p.x, z - p.z);
        if (d < bdd) {
          bdd = d;
          bb = c;
        }
      }
      if (bb >= 0) {
        const [x, z] = g.center(bb);
        const acid = g.pH[bb] < g.band(bb).lo;
        out.push({ x, z, cls: acid ? 'acidic' : 'basic', icon: acid ? '💧' : '🫧', label: `pH ${g.pH[bb].toFixed(1)}` });
      }
    }
    // Nearest unmeasured suspect patch.
    let best = -1;
    let bd = Infinity;
    for (let c = 0; c < g.count; c++) {
      if (!g.suspect[c] || g.know[c] & KNOW_UNIVERSAL) continue;
      const [x, z] = g.center(c);
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    if (best >= 0) {
      const [x, z] = g.center(best);
      out.push({ x, z, cls: '', icon: '?', label: 'לא נמדד' });
    }
    // Wagon when the tank or the mist runs low.
    const L = game.loadout;
    const low = game.tank.acid < L.acid * 0.15 || game.tank.base < L.base * 0.15 || (game.gadgets.mist === 0 && L.mist > 0);
    if (low && game.mission.wagons.length) {
      let w = game.mission.wagons[0];
      let wd = Infinity;
      for (const ww of game.mission.wagons) {
        const d = Math.hypot(ww[0] - p.x, ww[1] - p.z);
        if (d < wd) {
          wd = d;
          w = ww;
        }
      }
      out.push({ x: w[0], z: w[1], cls: 'wagon', icon: '⛽', label: 'עגלת אספקה' });
    }
    return out.slice(0, 4);
  }

  // ---------- danger vignette ----------
  private lastHealth = new Map<string, number>();
  private vig = 0;
  private updateVignette(game: Game, dt: number) {
    let falling = false;
    for (const a of game.assets) {
      const prev = this.lastHealth.get(a.id) ?? a.health;
      if (a.health < prev - 1e-6 && a.health < 70) falling = true;
      this.lastHealth.set(a.id, a.health);
    }
    this.vig += ((falling ? 0.55 : 0) - this.vig) * Math.min(1, dt * 4);
    $('vignette').style.opacity = String(this.vig);
  }

  /** Floating "+points" text at a world point. */
  floater(camera: THREE.Camera, w: number, h: number, x: number, y: number, z: number, text: string, cls = '') {
    this.v.set(x, y, z).project(camera);
    if (this.v.z > 1) return;
    const el = document.createElement('div');
    el.className = `floater ${cls}`;
    el.textContent = text;
    el.style.left = `${((this.v.x + 1) / 2) * w}px`;
    el.style.top = `${((1 - this.v.y) / 2) * h}px`;
    $('floaters').appendChild(el);
    setTimeout(() => el.remove(), 1400);
  }

  private computeBadges(game: Game) {
    const g = game.grid;
    const L = game.mission.layout;
    // Only ground the ranger has reason to look at; never keyed to the true pH.
    const interesting = (c: number) => g.suspect[c] === 1;
    const seen = new Uint8Array(g.count);
    const out: typeof this.badgeData = [];
    const p = game.player;
    for (let c = 0; c < g.count; c++) {
      if (seen[c] || !interesting(c)) continue;
      // Flood fill a patch of interesting cells with the same knowledge level.
      const lvl = knowLevel(g.know[c]);
      const stack = [c];
      const cells: number[] = [];
      seen[c] = 1;
      while (stack.length) {
        const k = stack.pop()!;
        cells.push(k);
        for (const nb of g.neighbours(k)) {
          if (!seen[nb] && interesting(nb) && knowLevel(g.know[nb]) === lvl) {
            seen[nb] = 1;
            stack.push(nb);
          }
        }
      }
      let x = 0;
      let z = 0;
      for (const k of cells) {
        const [cx, cz] = g.center(k);
        x += cx;
        z += cz;
      }
      x /= cells.length;
      z /= cells.length;
      if (Math.hypot(x - p.x, z - p.z) > 45) continue;
      const y = terrainHeight(L, x, z) + 1.6;
      if (lvl === 3) {
        // Show the most extreme value so a patch never hides its worst cell.
        let worst = cells[0];
        for (const k of cells) if (Math.abs(g.pH[k] - 7) > Math.abs(g.pH[worst] - 7)) worst = k;
        const v = g.pH[worst];
        const cls = phClass(v);
        const icon = cls === 'acid' ? 'acid' : cls === 'base' ? 'base' : 'neutral';
        out.push({ x, y, z, html: `<span class="bi ${icon}"></span>${v.toFixed(1)}`, cls: '', bg: rgbCss(universalRGB(v), 0.95) });
      } else if (lvl === 2) {
        const pink = cells.some((k) => phenolphthalein(g.pH[k]) !== 'colorless');
        out.push(
          pink
            ? { x, y, z, html: `<span class="bi base"></span>ורוד: בסיסי`, cls: 'small', bg: 'rgba(230,60,150,0.95)' }
            : { x, y, z, html: `<span class="bi unknown"></span>שקוף: מתחת ל-8.2`, cls: 'small', bg: 'rgba(40,50,70,0.9)' },
        );
      } else if (!cells.some((k) => g.know[k] & KNOW_LITMUS)) {
        out.push({ x, y, z, html: `<span class="bi unknown"></span>pH ?`, cls: '', bg: 'rgba(20,30,45,0.85)' });
      }
    }
    // Litmus markers carry their own small label.
    for (const mk of game.markers) {
      const r = litmus(g.pH[mk.cell]);
      const text = r === 'acid' ? 'לקמוס: חומצי' : r === 'base' ? 'לקמוס: בסיסי' : 'לקמוס: לא ברור';
      const bg = r === 'acid' ? 'rgba(229,57,53,0.95)' : r === 'base' ? 'rgba(30,111,224,0.95)' : 'rgba(110,90,140,0.95)';
      out.push({ x: mk.x, y: terrainHeight(L, mk.x, mk.z) + 1.5, z: mk.z, html: text, cls: 'small', bg });
    }
    out.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
    // Keep the screen readable: a few unknown markers, nearest first.
    let unknown = 0;
    this.badgeData = out
      .filter((b) => {
        if (!b.html.includes('pH ?')) return true;
        unknown++;
        return unknown <= 3 && Math.hypot(b.x - p.x, b.z - p.z) < 30;
      })
      .slice(0, 8);
  }

  private placeBadges(camera: THREE.Camera, w: number, h: number) {
    const placed: Array<[number, number]> = [];
    const host = $('badges');
    while (this.badges.length < this.badgeData.length) {
      const el = document.createElement('div');
      el.className = 'badge';
      host.appendChild(el);
      this.badges.push({ el, used: false });
    }
    this.badges.forEach((b, i) => {
      const d = this.badgeData[i];
      if (!d) {
        b.el.style.display = 'none';
        return;
      }
      this.v.set(d.x, d.y, d.z).project(camera);
      if (this.v.z > 1 || Math.abs(this.v.x) > 1.1 || Math.abs(this.v.y) > 1.1) {
        b.el.style.display = 'none';
        return;
      }
      const sx = ((this.v.x + 1) / 2) * w;
      const sy = ((1 - this.v.y) / 2) * h;
      if (placed.some(([px, py]) => Math.abs(px - sx) < 110 && Math.abs(py - sy) < 34)) {
        b.el.style.display = 'none';
        return;
      }
      placed.push([sx, sy]);
      b.el.style.display = '';
      if (b.el.dataset.html !== d.html) {
        b.el.innerHTML = d.html;
        b.el.dataset.html = d.html;
      }
      b.el.className = `badge ${d.cls}`;
      b.el.style.background = d.bg;
      b.el.style.borderColor = '#fff';
      b.el.style.left = `${((this.v.x + 1) / 2) * w}px`;
      b.el.style.top = `${((1 - this.v.y) / 2) * h}px`;
    });
  }
}

/** Litmus is shown by its own marker, so patches group universal / phenolphthalein / nothing. */
function knowLevel(k: number) {
  return k & KNOW_UNIVERSAL ? 3 : k & KNOW_PHENOL ? 2 : 0;
}

function rgbCss(c: [number, number, number], a = 1) {
  return `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`;
}
