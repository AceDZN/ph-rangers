import '@fontsource/rubik/400.css';
import '@fontsource/rubik/500.css';
import '@fontsource/rubik/700.css';
import '@fontsource/rubik/800.css';
import './style.css';
import * as THREE from 'three';
import { Game, Input, NO_INPUT } from './sim/game';
import { MISSIONS } from './sim/missions';
import { terrainHeight } from './sim/layout';
import { Audio } from './render/audio';
import { Fx } from './render/fx';
import { Hud } from './render/hud';
import { Models, RangerModel } from './render/models';
import { World } from './render/world';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const STEP = 1 / 60;

type Mode = 'loading' | 'title' | 'brief' | 'play' | 'paused' | 'result';

// ---------- persistence (local only) ----------
const store = {
  get<T>(k: string, d: T): T {
    try {
      const v = localStorage.getItem(k);
      return v ? (JSON.parse(v) as T) : d;
    } catch {
      return d;
    }
  },
  set(k: string, v: unknown) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* storage may be blocked */
    }
  },
};

const canvas = $<HTMLCanvasElement>('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 800);
const models = new Models();
const audio = new Audio();
const hud = new Hud();
let game = new Game(MISSIONS[0].id);
let world: World | null = null;
let fx: Fx | null = null;
let ranger: RangerModel | null = null;
let headlamp: THREE.PointLight | null = null;
let mode: Mode = 'loading';
const progress = store.get<Record<string, number>>('phr-progress', {});
const settings = store.get('phr-settings', { reduced: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false, muted: false });

// Camera / aim state.
let camYaw = 0;
let camPitch = 0.45; // 0 = look far, 1 = look near
let shake = 0;
let pointerLocked = false;
let mouseFree = { x: 0, y: 0, active: false };
const keys = new Set<string>();
let mouseDown = false;
const touch = { stickId: -1, sx: 0, sy: 0, mx: 0, mz: 0, lookId: -1, lx: 0, ly: 0, spray: false, used: false };

function applySettings() {
  document.body.classList.toggle('reduced', settings.reduced);
  audio.setMuted(settings.muted);
  if (fx) fx.reduced = settings.reduced;
  for (const id of ['opt-motion', 'opt-motion2']) $<HTMLInputElement>(id).checked = settings.reduced;
  for (const id of ['opt-mute', 'opt-mute2']) $<HTMLInputElement>(id).checked = settings.muted;
  store.set('phr-settings', settings);
}

// ---------- world building ----------

function buildWorld() {
  const m = game.mission;
  const needNew = !world || world.layout !== m.layout || world.night !== !!m.night;
  if (needNew) {
    world?.dispose();
    world = new World(m.layout, !!m.night, models);
    fx = new Fx(world.scene, m.layout);
    fx.reduced = settings.reduced;
    ranger = models.ranger();
    world.scene.add(ranger.root);
    if (ranger.clips.idle) ranger.clips.idle.play();
    headlamp = null;
    if (m.night) {
      headlamp = new THREE.PointLight(0xfff0d0, 30, 22, 1.6);
      world.scene.add(headlamp);
    }
  } else fx!.clear();
  world!.setMission(game, models);
  camYaw = m.start.yaw;
  camPitch = 0.45;
}

// ---------- input ----------

function cameraBasis() {
  const fx = Math.sin(camYaw);
  const fz = Math.cos(camYaw);
  return { fx, fz, rx: -fz, rz: fx };
}

const ray = new THREE.Raycaster();
function groundHit(ndcX: number, ndcY: number): THREE.Vector3 | null {
  ray.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
  const o = ray.ray.origin;
  const d = ray.ray.direction;
  const L = game.mission.layout;
  let prev = 0;
  for (let t = 0.5; t < 60; t += 0.4) {
    const x = o.x + d.x * t;
    const z = o.z + d.z * t;
    const y = o.y + d.y * t;
    if (y <= terrainHeight(L, x, z)) {
      // Refine.
      let a = prev;
      let b = t;
      for (let i = 0; i < 12; i++) {
        const mid = (a + b) / 2;
        const mx = o.x + d.x * mid;
        const mz = o.z + d.z * mid;
        if (o.y + d.y * mid <= terrainHeight(L, mx, mz)) b = mid;
        else a = mid;
      }
      return new THREE.Vector3(o.x + d.x * b, 0, o.z + d.z * b);
    }
    prev = t;
  }
  return null;
}

function readInput(): Input {
  const inp: Input = { ...NO_INPUT, yaw: camYaw };
  let mx = 0;
  let mz = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) mz += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) mz -= 1;
  if (keys.has('KeyD')) mx += 1;
  if (keys.has('KeyA')) mx -= 1;
  if (touch.stickId >= 0) {
    mx += touch.mx;
    mz += touch.mz;
  }
  inp.moveX = mx;
  inp.moveZ = mz;
  inp.sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
  inp.spray = mouseDown || keys.has('Space') || touch.spray;
  // Aim: screen centre when pointer-locked or on touch, else the mouse cursor.
  let nx = 0;
  let ny = -0.24;
  if (!pointerLocked && mouseFree.active && touch.lookId < 0 && !touch.used) {
    nx = mouseFree.x;
    ny = mouseFree.y;
  }
  const hit = groundHit(nx, ny);
  if (hit) {
    inp.aimX = hit.x;
    inp.aimZ = hit.z;
  } else {
    const { fx: f, fz } = cameraBasis();
    inp.aimX = game.player.x + f * 14;
    inp.aimZ = game.player.z + fz * 14;
  }
  return inp;
}

function onKey(e: KeyboardEvent, down: boolean) {
  if (down) audio.unlock();
  if (mode === 'play') {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  }
  if (down) keys.add(e.code);
  else keys.delete(e.code);
  if (!down) return;
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (mode === 'play') setMode('paused');
    else if (mode === 'paused') setMode('play');
    return;
  }
  if (e.code === 'KeyM') {
    settings.muted = !settings.muted;
    applySettings();
    return;
  }
  if (e.code === 'Enter') {
    if (mode === 'brief') startPlay();
    else if (mode === 'result') (game.status === 'won' ? $('rnext') : $('rretry')).click();
    return;
  }
  if (mode !== 'play' || e.repeat) return;
  switch (e.code) {
    case 'Digit1':
      game.selectValve('acid');
      break;
    case 'Digit2':
      game.selectValve('base');
      break;
    case 'Digit3':
      game.selectValve('water');
      break;
    case 'KeyQ':
      game.cycleValve(-1);
      break;
    case 'KeyE':
      game.cycleValve(1);
      break;
    case 'KeyX':
      game.toggleStrength();
      break;
    case 'KeyR':
      throwG('litmus');
      break;
    case 'KeyF':
      throwG('phenol');
      break;
    case 'KeyG':
      throwG('mist');
      break;
    case 'KeyT':
      throwG('canister');
      break;
    case 'KeyH':
      game.useHint();
      break;
  }
}

function throwG(k: 'litmus' | 'phenol' | 'mist' | 'canister') {
  if (game.throwGadget(k)) hud.flashGadget(k);
}

window.addEventListener('keydown', (e) => onKey(e, true));
window.addEventListener('keyup', (e) => onKey(e, false));
window.addEventListener('blur', () => {
  keys.clear();
  mouseDown = false;
});
const autoPause = new URLSearchParams(location.search).get('autopause') !== '0';
document.addEventListener('visibilitychange', () => {
  if (autoPause && document.hidden && mode === 'play') setMode('paused');
});

canvas.addEventListener('mousedown', (e) => {
  audio.unlock();
  if (mode !== 'play') return;
  if (e.button === 0) mouseDown = true;
  if (!pointerLocked && e.button === 2) canvas.requestPointerLock?.();
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 0) mouseDown = false;
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('dblclick', () => {
  if (mode === 'play' && !pointerLocked) canvas.requestPointerLock?.();
});
document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === canvas;
});
window.addEventListener('mousemove', (e) => {
  if (pointerLocked) {
    camYaw -= e.movementX * 0.0026;
    camPitch = Math.min(1, Math.max(0, camPitch + e.movementY * 0.0022));
  } else {
    const r = canvas.getBoundingClientRect();
    mouseFree = { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1, active: true };
  }
});
canvas.addEventListener(
  'wheel',
  (e) => {
    if (mode === 'play') game.cycleValve(e.deltaY > 0 ? 1 : -1);
  },
  { passive: true },
);

// Touch: left stick, right-half drag to look, spray button.
canvas.addEventListener('touchstart', (e) => {
  audio.unlock();
  touch.used = true;
  $('touch').hidden = mode !== 'play';
  for (const t of Array.from(e.changedTouches)) {
    if (t.clientX > window.innerWidth * 0.45 && touch.lookId < 0) {
      touch.lookId = t.identifier;
      touch.lx = t.clientX;
      touch.ly = t.clientY;
    }
  }
});
const stick = $('stick');
stick.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const t = e.changedTouches[0];
  const r = stick.getBoundingClientRect();
  touch.stickId = t.identifier;
  touch.sx = r.left + r.width / 2;
  touch.sy = r.top + r.height / 2;
});
window.addEventListener(
  'touchmove',
  (e) => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === touch.stickId) {
        const dx = (t.clientX - touch.sx) / 55;
        const dy = (t.clientY - touch.sy) / 55;
        const l = Math.hypot(dx, dy);
        const k = l > 1 ? 1 / l : 1;
        touch.mx = dx * k;
        touch.mz = -dy * k;
        (stick.firstElementChild as HTMLElement).style.transform = `translate(${touch.mx * 40}px, ${-touch.mz * 40}px)`;
      } else if (t.identifier === touch.lookId) {
        camYaw -= (t.clientX - touch.lx) * 0.006;
        camPitch = Math.min(1, Math.max(0, camPitch + (t.clientY - touch.ly) * 0.004));
        touch.lx = t.clientX;
        touch.ly = t.clientY;
      }
    }
  },
  { passive: true },
);
window.addEventListener('touchend', (e) => {
  for (const t of Array.from(e.changedTouches)) {
    if (t.identifier === touch.stickId) {
      touch.stickId = -1;
      touch.mx = touch.mz = 0;
      (stick.firstElementChild as HTMLElement).style.transform = '';
    }
    if (t.identifier === touch.lookId) touch.lookId = -1;
  }
});
const tspray = $('tspray');
tspray.addEventListener('touchstart', (e) => {
  e.preventDefault();
  touch.spray = true;
});
tspray.addEventListener('touchend', () => (touch.spray = false));

// HUD buttons.
document.querySelectorAll<HTMLButtonElement>('.valve').forEach((b) =>
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    game.selectValve(b.dataset.valve as 'acid' | 'base' | 'water');
  }),
);
document.querySelectorAll<HTMLButtonElement>('.gadget').forEach((b) =>
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    throwG(b.dataset.gadget as 'litmus' | 'phenol' | 'mist' | 'canister');
  }),
);
$('strength').addEventListener('click', () => game.toggleStrength());
$('btn-hint').addEventListener('click', () => game.useHint());
$('btn-pause').addEventListener('click', () => setMode('paused'));
$('presume').addEventListener('click', () => setMode('play'));
$('prestart').addEventListener('click', () => {
  game.restart();
  buildWorld();
  setMode('brief');
});
$('pmenu').addEventListener('click', () => setMode('title'));
$('bgo').addEventListener('click', () => startPlay());
$('rretry').addEventListener('click', () => {
  game.restart();
  buildWorld();
  setMode('brief');
});
$('rnext').addEventListener('click', () => {
  if (game.nextMission()) {
    buildWorld();
    setMode('brief');
  } else setMode('title');
});
$('rmenu').addEventListener('click', () => setMode('title'));
for (const id of ['opt-motion', 'opt-motion2'])
  $<HTMLInputElement>(id).addEventListener('change', (e) => {
    settings.reduced = (e.target as HTMLInputElement).checked;
    applySettings();
  });
for (const id of ['opt-mute', 'opt-mute2'])
  $<HTMLInputElement>(id).addEventListener('change', (e) => {
    settings.muted = (e.target as HTMLInputElement).checked;
    applySettings();
  });

// ---------- screens ----------

function setMode(m: Mode) {
  mode = m;
  $('title').hidden = m !== 'title';
  $('brief').hidden = m !== 'brief';
  $('result').hidden = m !== 'result';
  $('pause').hidden = m !== 'paused';
  $('loading').hidden = m !== 'loading';
  hud.show(m === 'play' || m === 'paused' || m === 'result');
  $('touch').hidden = !(m === 'play' && touch.used);
  if (m !== 'play') {
    mouseDown = false;
    keys.clear();
    if (document.pointerLockElement) document.exitPointerLock?.();
  }
  if (m === 'title') renderTitle();
  if (m === 'brief') renderBrief();
}

function unlocked(i: number) {
  return i === 0 || progress[MISSIONS[i - 1].id] > 0 || new URLSearchParams(location.search).has('all');
}

function renderTitle() {
  const list = $('missionlist');
  list.innerHTML = '';
  MISSIONS.forEach((m, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    const stars = progress[m.id] ?? 0;
    b.innerHTML = `<span class="st">${'★'.repeat(stars)}</span><b>${m.num}. ${m.title}</b><span>${m.tagline}</span>`;
    b.disabled = !unlocked(i);
    b.addEventListener('click', () => {
      audio.unlock();
      game.load(m.id);
      buildWorld();
      setMode('brief');
    });
    list.appendChild(b);
  });
}

function renderBrief() {
  const m = game.mission;
  $('bkicker').textContent = m.noHints ? `משימה ${m.num} · משימת מבחן` : `משימה ${m.num}`;
  $('btitle').textContent = m.title;
  $('btag').textContent = m.tagline;
  $('blist').innerHTML = m.brief.map((s) => `<li>${s}</li>`).join('');
  $('bassets').innerHTML = m.assets.map((a) => `<span>${a.name}: <bdi dir="ltr">pH ${a.lo}–${a.hi}</bdi></span>`).join('');
}

function startPlay() {
  audio.unlock();
  setMode('play');
}

function showResult() {
  const won = game.status === 'won';
  const m = game.mission;
  $('rtitle').textContent = won ? 'העמק נושם שוב!' : 'אוי, לא הפעם';
  $('rstars').innerHTML = won ? [1, 2, 3].map((i) => `<span class="${i <= game.stars ? '' : 'off'}">★</span>`).join('') : '';
  $('rtext').textContent = won ? m.winText : (m.failText[game.failReason] ?? 'אחד האזורים המוגנים יצא מהטווח שלו.');
  const firstLine = won
    ? 'כל פעם שחומצה ובסיס נפגשו נוצרו מלח ומים, והשתחרר חום (האדים).'
    : 'טעות היא חלק מהסיור: מדדו שוב עם אינדיקטור, בחרו שסתום לפי התוצאה, ורססו בלחיצות קצרות ליד היעד.';
  $('rexplain').textContent = firstLine;
  $('rstats').innerHTML = `זמן: <bdi dir="ltr">${game.t.toFixed(0)}s</bdi> · חומר שרוסס: <bdi dir="ltr">${game.stats.chem.toFixed(2)} mol</bdi> · מים: <bdi dir="ltr">${game.stats.water.toFixed(0)} L</bdi>${game.hintsUsed ? ` · רמזים: ${game.hintsUsed}` : ''}`;
  const hasNext = MISSIONS.findIndex((x) => x.id === m.id) < MISSIONS.length - 1;
  $('rnext').style.display = won && hasNext ? '' : 'none';
  if (won) {
    progress[m.id] = Math.max(progress[m.id] ?? 0, game.stars);
    store.set('phr-progress', progress);
  }
  const ev = store.get<unknown[]>('phr-events', []);
  ev.push(...game.events.splice(0));
  store.set('phr-events', ev.slice(-3000));
  setMode('result');
}

// ---------- per-frame ----------

function handleFx() {
  for (const e of game.fx) {
    if (e.type === 'fizz') audio.fizz(e.amount);
    else if (e.type === 'overshoot') {
      audio.boing();
      hud.toast(e.pH > 7 ? 'יותר מדי בסיס!' : 'יותר מדי חומצה!', e.pH > 7 ? 'pinkish' : 'bad');
      if (!settings.reduced) shake = 0.35;
    } else if (e.type === 'inband') {
      audio.chime();
      hud.toast('בטווח! ✓', 'good');
    } else if (e.type === 'throw') audio.throwSfx();
    else if (e.type === 'gadget') audio.pop(e.kind);
    else if (e.type === 'refill') {
      audio.refill();
      hud.toast('מילוי מהעגלה');
    } else if (e.type === 'unlock') hud.toast('תרכיז ×10 נטען! (X)', 'good');
    else if (e.type === 'empty') {
      audio.empty();
      hud.toast('המיכל ריק – לעגלת האספקה', 'bad');
    } else if (e.type === 'toast') hud.toast(e.text);
    else if (e.type === 'asset-hurt') {
      hud.hurt(e.id);
      audio.hurt();
    } else if (e.type === 'won') audio.win();
    else if (e.type === 'failed') audio.fail();
  }
  fx?.handle(game);
  game.fx.length = 0;
}

let animT = 0;
let birdT = 4;
const tmpV = new THREE.Vector3();

function updateRanger(dt: number) {
  if (!ranger) return;
  const p = game.player;
  ranger.root.position.set(p.x, p.y, p.z);
  ranger.root.rotation.y = p.yaw;
  const moving = p.speed > 0.6;
  if (ranger.mixer) {
    const want = p.spraying && ranger.clips.spray ? 'spray' : moving && (ranger.clips.run || ranger.clips.walk) ? (ranger.clips.run ? 'run' : 'walk') : 'idle';
    for (const [k, a] of Object.entries(ranger.clips)) {
      const on = k === want;
      if (on && !a.isRunning()) a.reset().fadeIn(0.2).play();
      if (!on && a.isRunning() && a.getEffectiveWeight() > 0) a.fadeOut(0.2);
      if (on && k === 'run') a.timeScale = Math.max(0.6, p.speed / 5.6);
    }
    ranger.mixer.update(dt);
    if (!(want in ranger.clips) && ranger.clips.idle && !ranger.clips.idle.isRunning()) ranger.clips.idle.play();
  } else {
    const limbs = ranger.root.userData.limbs as THREE.Object3D[];
    const sw = moving ? Math.sin(animT * 11) * Math.min(1, p.speed / 5) * 0.8 : Math.sin(animT * 2) * 0.04;
    limbs[0].rotation.x = sw;
    limbs[2].rotation.x = -sw;
    limbs[1].rotation.x = p.spraying ? -1.3 : -sw * 0.7;
    limbs[3].rotation.x = p.spraying ? -1.2 : sw * 0.7;
    ranger.root.position.y += moving ? Math.abs(Math.sin(animT * 11)) * 0.06 : 0;
  }
}

function updateCamera(dt: number) {
  const p = game.player;
  const { fx: f, fz, rx, rz } = cameraBasis();
  // Over-the-shoulder chase camera like the mockups: ranger lower-left, valley ahead.
  const dist = 4.8 + camPitch * 0.8;
  const height = 2.0 + camPitch * 2.4;
  const side = 1.2;
  const target = new THREE.Vector3(p.x - f * dist + rx * side, p.y + height, p.z - fz * dist + rz * side);
  const L = game.mission.layout;
  target.y = Math.max(target.y, terrainHeight(L, target.x, target.z) + 1.2);
  camera.position.lerp(target, Math.min(1, dt * 10));
  const down = 0.04 + camPitch * 0.42;
  tmpV.set(camera.position.x + f * Math.cos(down) * 10, camera.position.y - Math.sin(down) * 10, camera.position.z + fz * Math.cos(down) * 10);
  if (shake > 0) {
    shake -= dt;
    tmpV.x += (Math.random() - 0.5) * shake * 0.6;
    tmpV.y += (Math.random() - 0.5) * shake * 0.6;
  }
  camera.lookAt(tmpV);
}

function stepSim(dt: number) {
  const inp = readInput();
  game.update(dt, inp);
  handleFx();
  if (game.status !== 'play' && mode === 'play') {
    // Let the moment land before the result card.
    setTimeout(() => {
      if (mode === 'play' && game.status !== 'play') showResult();
    }, 900);
  }
}

function render(dt: number) {
  if (!world || !fx) return;
  animT += dt;
  // Keyboard camera turn.
  if (mode === 'play') {
    if (keys.has('ArrowLeft')) camYaw += dt * 2.2;
    if (keys.has('ArrowRight')) camYaw -= dt * 2.2;
    if (keys.has('PageUp')) camPitch = Math.max(0, camPitch - dt);
    if (keys.has('PageDown')) camPitch = Math.min(1, camPitch + dt);
  }
  updateRanger(dt);
  updateCamera(dt);
  world.update(game, animT, dt);
  world.followSun(game.player.x, game.player.y, game.player.z);
  if (headlamp) headlamp.position.set(game.player.x, game.player.y + 3, game.player.z);
  // Spray stream from the nozzle.
  if (ranger && game.player.spraying && mode === 'play') {
    const valve = game.tank.valve;
    const has = valve === 'water' ? game.tank.water > 0.04 : game.tank[valve] > 0.0003;
    if (has) {
      ranger.nozzle.getWorldPosition(tmpV);
      fx.stream(tmpV.clone(), game.aim.x, game.aim.z, valve, game.tank.strength, dt);
    }
    audio.spraying(has, valve, game.tank.strength);
  } else audio.spraying(false, 'base', 1);
  fx.update(game, dt, !!game.mission.night);
  if (mode === 'play' || mode === 'paused' || mode === 'result') hud.update(game, camera, window.innerWidth, window.innerHeight, dt);
  if (!game.mission.night) {
    birdT -= dt;
    if (birdT < 0) {
      birdT = 3 + Math.random() * 6;
      if (mode === 'play') audio.bird();
    }
  }
  renderer.render(world.scene, camera);
}

let last = performance.now();
let acc = 0;
let manual = false;
let manualAt = 0;
const fps = { frames: 0, t: 0, value: 0 };
function frame(now: number) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  fps.frames++;
  fps.t += dt;
  if (fps.t >= 1) {
    fps.value = fps.frames / fps.t;
    fps.frames = 0;
    fps.t = 0;
  }
  if (manual && now - manualAt > 1500) manual = false;
  if (mode === 'play' && !manual) {
    acc += dt;
    while (acc >= STEP) {
      acc -= STEP;
      stepSim(STEP);
    }
  }
  render(dt);
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w < h ? 70 : 55;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  $('glerror').hidden = false;
  if (mode === 'play') setMode('paused');
});

// ---------- test hooks ----------
declare global {
  interface Window {
    render_game_to_text: () => string;
    advanceTime: (ms: number) => void;
    __phr: unknown;
  }
}
window.render_game_to_text = () => {
  const s = JSON.parse(game.renderGameToText());
  s.screen = mode;
  s.camera = { yaw: +camYaw.toFixed(2), pitch: +camPitch.toFixed(2) };
  s.fps = Math.round(fps.value);
  s.tripoModels = models.loaded;
  s.rangerTripo = ranger?.tripo ?? false;
  return JSON.stringify(s);
};
window.advanceTime = (ms: number) => {
  manual = true;
  manualAt = performance.now();
  const steps = Math.max(1, Math.round(ms / (1000 * STEP)));
  for (let i = 0; i < steps; i++) {
    if (mode === 'play') stepSim(STEP);
    render(STEP);
  }
};
window.__phr = {
  game: () => game,
  setCam: (yaw: number, pitch: number) => {
    camYaw = yaw;
    camPitch = pitch;
  },
  keys,
  setMode,
  aimWorld: (x: number, z: number) => {
    const v = new THREE.Vector3(x, terrainHeight(game.mission.layout, x, z), z).project(camera);
    mouseFree = { x: v.x, y: v.y, active: true };
  },
  startMission: (id: string) => {
    game.load(id);
    buildWorld();
    setMode('play');
  },
};

// ---------- boot ----------
(async () => {
  resize();
  applySettings();
  await models.load();
  buildWorld();
  setMode('title');
  requestAnimationFrame(frame);
})();
