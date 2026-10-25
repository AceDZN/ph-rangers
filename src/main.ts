import '@fontsource/rubik/400.css';
import '@fontsource/rubik/500.css';
import '@fontsource/rubik/700.css';
import '@fontsource/rubik/800.css';
import './style.css';
import * as THREE from 'three';
import { Game, Input, NO_INPUT } from './sim/game';
import { MISSIONS } from './sim/missions';
import { universalRGB } from './sim/chem';
import { terrainHeight } from './sim/layout';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
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
// Soft bloom on the brightest things (jet, sparkles, night glow). Dropped automatically if slow.
let composer: EffectComposer | null = null;
let renderPass: RenderPass | null = null;
let bloom: UnrealBloomPass | null = null;
let bloomOn = new URLSearchParams(location.search).get('bloom') !== '0';
let slowFrames = 0;
function setupComposer(scene: THREE.Scene, night: boolean) {
  if (!bloomOn) return;
  if (!composer) {
    const rt = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, { type: THREE.HalfFloatType, samples: 4 });
    composer = new EffectComposer(renderer, rt);
    renderPass = new RenderPass(scene, camera);
    bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2), 0.35, 0.45, 0.86);
    composer.addPass(renderPass);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    composer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    composer.setSize(window.innerWidth, window.innerHeight);
  }
  renderPass!.scene = scene;
  bloom!.strength = night ? 0.45 : 0.3;
  bloom!.threshold = night ? 0.82 : 0.88;
}
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
const best = store.get<Record<string, number>>('phr-best', {});
const settings = {
  reduced: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  muted: false,
  music: true,
  ...store.get<Partial<{ reduced: boolean; muted: boolean; music: boolean }>>('phr-settings', {}),
};

// Camera / aim state.
let camYaw = 0;
let camPitch = 0.45; // 0 = look far, 1 = look near
let shake = 0;
let pointerLocked = false;
/** Pointer lock refused or unavailable: the cursor aims and right-drag turns the camera. */
let freeMode = false;
const testMode = new URLSearchParams(location.search).get('autopause') === '0';
const finePointer = window.matchMedia?.('(pointer: fine)').matches ?? true;
let mouseFree = { x: 0, y: 0, active: false };
const keys = new Set<string>();
let mouseDown = false;
const touch = { stickId: -1, sx: 0, sy: 0, mx: 0, mz: 0, lookId: -1, lx: 0, ly: 0, spray: false, used: false };

function applySettings() {
  document.body.classList.toggle('reduced', settings.reduced);
  audio.setMuted(settings.muted);
  if (fx) fx.reduced = settings.reduced;
  for (const id of ['opt-motion', 'opt-motion2']) $<HTMLInputElement>(id).checked = settings.reduced;
  $<HTMLInputElement>('opt-music').addEventListener('change', (e) => {
  settings.music = (e.target as HTMLInputElement).checked;
  audio.unlock();
  applySettings();
});
for (const id of ['opt-mute', 'opt-mute2']) $<HTMLInputElement>(id).checked = settings.muted;
  $<HTMLInputElement>('opt-music').checked = settings.music;
  audio.setMusic(settings.music);
  store.set('phr-settings', settings);
}

// ---------- world building ----------

function buildWorld() {
  const m = game.mission;
  const needNew = !world || world.layout !== m.layout || world.night !== !!m.night;
  if (needNew) {
    world?.dispose();
    world = new World(m.layout, !!m.night, models);
    setupComposer(world.scene, !!m.night);
    fx = new Fx(world.scene, m.layout);
    fx.reduced = settings.reduced;
    ranger = models.ranger();
    world.scene.add(ranger.root);
    if (ranger.root.userData.wand) world.scene.add(ranger.root.userData.wand);
    if (ranger.clips.idle) ranger.clips.idle.play();
    headlamp = null;
    if (m.night) {
      headlamp = new THREE.PointLight(0xcfe0ff, 9, 14, 1.4);
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

function wantsLock() {
  return finePointer && !testMode && !touch.used && !freeMode;
}

function requestLock() {
  if (!wantsLock() || pointerLocked) return;
  try {
    const r = canvas.requestPointerLock?.() as unknown as Promise<void> | undefined;
    if (r && typeof r.catch === 'function') r.catch(() => (freeMode = true));
  } catch {
    freeMode = true;
  }
}

canvas.addEventListener('mousedown', (e) => {
  audio.unlock();
  if (mode !== 'play') return;
  if (wantsLock() && !pointerLocked) {
    requestLock();
    return;
  }
  if (e.button === 0) mouseDown = true;
});
$('lockhint').addEventListener('click', () => {
  audio.unlock();
  requestLock();
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 0) mouseDown = false;
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('pointerlockchange', () => {
  const was = pointerLocked;
  pointerLocked = document.pointerLockElement === canvas;
  // Esc releases the mouse: treat it as pause, like any 3D action game.
  if (was && !pointerLocked && mode === 'play') setMode('paused');
});
document.addEventListener('pointerlockerror', () => {
  freeMode = true;
});
window.addEventListener('mousemove', (e) => {
  if (pointerLocked || (freeMode && e.buttons & 2)) {
    camYaw -= e.movementX * 0.0026;
    camPitch = Math.min(1, Math.max(0, camPitch + e.movementY * 0.0022));
  }
  if (!pointerLocked) {
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
$('presume').addEventListener('click', () => {
  setMode('play');
  requestLock();
});
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
$('rhint').addEventListener('click', () => {
  game.restart();
  buildWorld();
  game.useHint();
  setMode('brief');
});
hud.onLowTank = () => audio.empty();
for (const id of ['opt-motion', 'opt-motion2'])
  $<HTMLInputElement>(id).addEventListener('change', (e) => {
    settings.reduced = (e.target as HTMLInputElement).checked;
    applySettings();
  });
$<HTMLInputElement>('opt-music').addEventListener('change', (e) => {
  settings.music = (e.target as HTMLInputElement).checked;
  audio.unlock();
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
  document.body.classList.toggle('result-open', m === 'result');
  audio.musicMood = m === 'play' ? (game.mission.night ? 'night' : 'day') : 'menu';
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
    $('lockhint').hidden = true;
    if (document.pointerLockElement) document.exitPointerLock?.();
  }
  if (m === 'title') renderTitle();
  if (m === 'brief') renderBrief();
}

function unlocked(i: number) {
  return i === 0 || progress[MISSIONS[i - 1].id] > 0 || new URLSearchParams(location.search).has('all');
}

const MISSION_ICON: Record<string, string> = {
  'm1-lemon': '🍋',
  'm2-creek': '🐟',
  'm3-quarry': '🫒',
  'm4-blueberry': '🫐',
  'm5-storm': '⛈️',
  'm6-night': '🌙',
};

function nextMissionIndex() {
  const i = MISSIONS.findIndex((m) => !(progress[m.id] > 0));
  return i < 0 ? 0 : i;
}

function renderTitle() {
  const list = $('missionlist');
  list.innerHTML = '';
  MISSIONS.forEach((m, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    const stars = progress[m.id] ?? 0;
    const open = unlocked(i);
    const starHtml = [1, 2, 3].map((k) => `<span class="${k <= stars ? '' : 'off'}">★</span>`).join('');
    b.innerHTML = `<span class="mi">${MISSION_ICON[m.id] ?? '•'}</span><span class="mt"><b>${m.num}. ${m.title}</b><br /><span>${m.tagline}</span></span><span class="st">${open ? starHtml : '<span class="lock">🔒</span>'}</span>`;
    b.disabled = !open;
    b.addEventListener('click', () => {
      audio.unlock();
      game.load(m.id);
      buildWorld();
      setMode('brief');
    });
    list.appendChild(b);
  });
}

$('playbtn').addEventListener('click', () => {
  audio.unlock();
  game.load(MISSIONS[nextMissionIndex()].id);
  buildWorld();
  setMode('brief');
});

function renderBrief() {
  const m = game.mission;
  $('bicon').textContent = MISSION_ICON[m.id] ?? '';
  const L = m.loadout;
  const tools: string[] = [];
  if (L.litmus) tools.push(`🟥🟦 לקמוס ×${L.litmus}`);
  if (L.phenol) tools.push(`🩷 פנולפתלאין ×${L.phenol}`);
  if (L.mist) tools.push(`🌈 ערפל אוניברסלי ×${L.mist} (נטען לבד)`);
  if (L.canister) tools.push(`⚪ נוגד חומצה ×${L.canister}`);
  if (m.strength10 !== 'no') tools.push(m.strength10 === 'yes' ? '×10 תרכיז' : '×10 בעגלה');
  $('btools').innerHTML = tools.map((t) => `<span>${t}</span>`).join('');
  $('bkicker').textContent = m.noHints ? `משימה ${m.num} · משימת מבחן` : `משימה ${m.num}`;
  $('btitle').textContent = m.title;
  $('btag').textContent = m.tagline;
  $('blist').innerHTML = m.brief.map((s) => `<li>${s}</li>`).join('');
  $('bassets').innerHTML = m.assets.map((a) => `<span>${a.name}: <bdi dir="ltr">pH ${a.lo}–${a.hi}</bdi></span>`).join('');
}

function startPlay() {
  audio.unlock();
  sadT = 0;
  celebrateT = 0;
  setMode('play');
  requestLock();
  const b = $('banner');
  $('bannerk').textContent = `משימה ${game.mission.num}`;
  $('bannert').textContent = game.mission.title;
  b.hidden = true;
  void b.offsetWidth;
  b.hidden = false;
  setTimeout(() => (b.hidden = true), 2700);
  audio.go();
}

function showResult() {
  const won = game.status === 'won';
  const m = game.mission;
  $('rtitle').textContent = won ? 'העמק נושם שוב!' : 'אוי, לא הפעם';
  $('rstars').innerHTML = won ? [1, 2, 3].map((i) => `<span class="${i <= game.stars ? '' : 'off'}">★</span>`).join('') : '';
  // Before → after for each spill patch, coloured with the universal indicator.
  const css = (v: number) => {
    const [r, g2, b] = universalRGB(v);
    return `rgb(${Math.round(r * 255)},${Math.round(g2 * 255)},${Math.round(b * 255)})`;
  };
  const seenPairs = new Set<string>();
  const lost = game.assets.find((a) => a.health <= 0);
  $('rchanges').innerHTML = !won && lost
    ? `<span style="background:${css(lost.pH)}">${lost.name}: pH ${lost.pH.toFixed(1)} · היעד ${lost.lo}–${lost.hi}</span>`
    : game.spill
    .map((c, i) => {
      const a = game.startPH[i];
      const b = game.grid.pH[c];
      const key = `${a.toFixed(1)}-${b.toFixed(1)}`;
      if (seenPairs.has(key)) return '';
      seenPairs.add(key);
      return `<span style="background:linear-gradient(90deg,${css(a)},${css(b)})">pH ${a.toFixed(1)} → ${b.toFixed(1)}</span>`;
    })
    .filter(Boolean)
    .slice(0, 6)
    .join('');
  $('rscore').textContent = won ? `★ ${game.score.toLocaleString('en-US')}${game.bestCombo >= 3 ? `  ·  רצף ×${game.bestCombo}` : ''}` : '';
  if (won) {
    best[m.id] = Math.max(best[m.id] ?? 0, game.score);
    store.set('phr-best', best);
  }
  $('rtext').textContent = won ? m.winText : (m.failText[game.failReason] ?? 'אחד האזורים המוגנים יצא מהטווח שלו.');
  $('rhint').style.display = won || m.noHints ? 'none' : '';
  const firstLine = won
    ? 'כל פעם שחומצה ובסיס נפגשו נוצרו מלח ומים, והשתחרר חום (האדים).'
    : 'טעות היא חלק מהסיור: מדדו שוב עם אינדיקטור, בחרו שסתום לפי התוצאה, ורססו בלחיצות קצרות ליד היעד.';
  const salt = game.grid.ledger.salt;
  $('rexplain').textContent = salt > 0 ? `${firstLine} שימו לב: החומצה והבסיס לא "נעלמו" – נוצרו מלח ומים, והמלח נשאר כקרום לבן דק על האדמה.` : firstLine;
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
      hud.floater(camera, window.innerWidth, window.innerHeight, e.x, terrainHeight(game.mission.layout, e.x, e.z) + 1.4, e.z, 'BOING!', 'warn');
      hud.toast(e.dir === 'base' ? 'יותר מדי בסיס – בסיסי מדי כאן!' : 'יותר מדי חומצה – חומצי מדי כאן!', e.dir === 'base' ? 'pinkish' : 'bad');
      if (!settings.reduced) shake = 0.35;
    } else if (e.type === 'inband') {
      audio.chime();
    } else if (e.type === 'restored') {
      audio.restored(e.combo);
      // Life comes back: a bird answers.
      if (!game.mission.night) setTimeout(() => audio.bird(), 450);
      hud.bumpScore();
      const y = terrainHeight(game.mission.layout, e.x, e.z) + 1.2;
      hud.floater(camera, window.innerWidth, window.innerHeight, e.x, y, e.z, e.combo >= 2 ? `+${e.points} ×${e.combo}` : `+${e.points}`, e.combo >= 3 ? 'big' : '');
      fx?.restoredBurst(e.x, e.z);
      if (ranger) celebrateT = 1.2;
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
    } else if (e.type === 'won') {
      audio.win();
      celebrateT = 4;
    }
    else if (e.type === 'failed') audio.fail();
  }
  fx?.handle(game);
  game.fx.length = 0;
}

let animT = 0;
let celebrateT = 0;
let sadT = 0;
let stepY = 0;

/** Low dry-stone walls are hopped over: lift the ranger while standing on one. */
function wallStep(x: number, z: number) {
  let on = 0;
  for (const [a, b] of game.mission.layout.walls) {
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
    const d = Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t));
    if (d < 0.7) on = Math.max(on, 0.8 * (1 - d / 0.7) + 0.25);
  }
  stepY += (on - stepY) * 0.35;
  return stepY;
}
let stuckT = 0;
let lastScore = 0;
let aimW = 0;
const qA = new THREE.Quaternion();
const qB = new THREE.Quaternion();
const vA = new THREE.Vector3();
const vB = new THREE.Vector3();

/** Rotate `bone` (in world space) so the direction to `child` points along `dir`, blended by w. */
function aimBone(bone: THREE.Object3D | null, child: THREE.Object3D | null, dir: THREE.Vector3, w: number) {
  if (!bone || !child || !bone.parent || w <= 0) return;
  bone.updateWorldMatrix(true, true);
  bone.getWorldPosition(vA);
  child.getWorldPosition(vB);
  const cur = vB.sub(vA).normalize();
  qA.setFromUnitVectors(cur, dir.clone().normalize());
  bone.getWorldQuaternion(qB);
  const target = qA.multiply(qB);
  const parentQ = new THREE.Quaternion();
  bone.parent.getWorldQuaternion(parentQ);
  const local = parentQ.invert().multiply(target);
  bone.quaternion.slerp(local, w);
}
let birdT = 4;
const tmpV = new THREE.Vector3();

function updateRanger(dt: number) {
  if (!ranger) return;
  const p = game.player;
  ranger.root.position.set(p.x, p.y + wallStep(p.x, p.z), p.z);
  ranger.root.rotation.y = p.yaw;
  const moving = p.speed > 0.6;
  if (ranger.mixer) {
    const cheering = celebrateT > 0 && !!ranger.clips.celebrate && !p.spraying && !moving;
    const sad = sadT > 0 && !!ranger.clips.kneel;
    if (sadT > 0) sadT -= dt;
    const want = sad
      ? 'kneel'
      : cheering
      ? 'celebrate'
      : p.spraying && ranger.clips.spray
        ? 'spray'
        : moving && (ranger.clips.run || ranger.clips.walk)
          ? p.speed < 3.2 && ranger.clips.walk
            ? 'walk'
            : ranger.clips.run
              ? 'run'
              : 'walk'
          : 'idle';
    for (const [k, a] of Object.entries(ranger.clips)) {
      const on = k === want;
      if (on && !a.isRunning()) a.reset().fadeIn(0.2).play();
      if (!on && a.isRunning() && a.getEffectiveWeight() > 0) a.fadeOut(0.2);
      if (on && k === 'run') a.timeScale = Math.max(0.6, p.speed / 6.6);
    }
    ranger.mixer.update(dt);
    // A little victory hop when ground is restored (and the celebrate clip if Tripo gave us one).
    if (celebrateT > 0) {
      celebrateT -= dt;
      if (!ranger.clips.celebrate && !p.spraying && !moving) ranger.root.position.y += Math.max(0, Math.sin((1.2 - celebrateT) * Math.PI * 2.5)) * 0.35;
    }
    if (!(want in ranger.clips) && ranger.clips.idle && !ranger.clips.idle.isRunning()) ranger.clips.idle.play();
    // Procedural aim pose: both arms reach forward toward the spray target.
    const B = ranger.root.userData.bones as Record<string, THREE.Object3D | null>;
    const wantAim = p.spraying || game.throws.length > 0 ? 1 : 0;
    aimW += (wantAim - aimW) * Math.min(1, dt * 12);
    const fwd = new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw));
    const right = new THREE.Vector3(-Math.cos(p.yaw), 0, Math.sin(p.yaw));
    const ax = game.aim.x - p.x;
    const az = game.aim.z - p.z;
    const pitch = -Math.atan2(1.1, Math.max(2, Math.hypot(ax, az))) + 0.04;
    const dir = fwd.clone().multiplyScalar(Math.cos(pitch)).add(new THREE.Vector3(0, Math.sin(pitch), 0));
    // With Tripo's two-hand spray clip the arms are already forward; only nudge them toward the target.
    const aw = ranger.clips.spray ? aimW * 0.5 : aimW;
    if (aw > 0.01 && B) {
      aimBone(B.rArm, B.rFore, dir.clone().add(right.clone().multiplyScalar(-0.15)), aw);
      aimBone(B.rFore, B.rHand, dir, aw);
      aimBone(B.lArm, B.lFore, dir.clone().add(right.clone().multiplyScalar(0.45)), aw);
      aimBone(B.lFore, B.lHand, dir.clone().add(right.clone().multiplyScalar(0.25)), aw);
    }
    const wand = ranger.root.userData.wand as THREE.Object3D | undefined;
    if (wand && B?.rHand) {
      B.rHand.updateWorldMatrix(true, false);
      B.rHand.getWorldPosition(wand.position);
      const wd = aimW > 0.5 ? dir : fwd.clone().multiplyScalar(0.6).add(new THREE.Vector3(0, -0.8, 0)).normalize();
      wand.lookAt(wand.position.clone().add(wd));
      ranger.nozzle.position.copy(ranger.root.worldToLocal(wand.position.clone().add(wd.clone().multiplyScalar(0.68))));
    }
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

let stepT = 0;
function footsteps(dt: number) {
  const p = game.player;
  if (p.speed < 3 || mode !== 'play') return;
  stepT -= dt * (p.speed / 5.6);
  if (stepT <= 0) {
    stepT = 0.32;
    fx?.dust(p.x, p.z, p.speed > 7);
  }
}

function updateCamera(dt: number) {
  const p = game.player;
  if (mode === 'title' || mode === 'brief' || mode === 'result' || mode === 'loading') {
    // Composed menu shots with a gentle sway: over the shoulder across the valley on the title,
    // a front view of the ranger on the brief and result cards.
    const L0 = game.mission.layout;
    const sway = Math.sin(animT * 0.25) * 0.18;
    const yaw = game.mission.start.yaw + sway;
    const fx2 = Math.sin(yaw);
    const fz2 = Math.cos(yaw);
    const front = mode !== 'title';
    const dist = front ? -4.6 : 7;
    // Try a few side offsets and keep the first with a clear view of the ranger.
    let side = front ? 1.4 : 2.2;
    for (const sd of front ? [1.4, -1.4, 2.6, -2.6, 0] : [2.2, -2.2, 0, 3.5]) {
      const cx = p.x - fx2 * dist - fz2 * sd;
      const cz = p.z - fz2 * dist + fx2 * sd;
      if (world?.clearView(new THREE.Vector3(cx, p.y + 1.8, cz), new THREE.Vector3(p.x, p.y + 1, p.z))) {
        side = sd;
        break;
      }
    }
    const tx = p.x - fx2 * dist - fz2 * side;
    const tz = p.z - fz2 * dist + fx2 * side;
    const ty = Math.max(terrainHeight(L0, tx, tz) + 1.4, p.y + (front ? 1.7 : 3.4));
    tmpV.set(tx, ty, tz);
    if (camera.position.distanceTo(tmpV) > 25) camera.position.copy(tmpV);
    else camera.position.lerp(tmpV, Math.min(1, dt * 2.5));
    if (front) camera.lookAt(p.x - fz2 * 0.9, p.y + 1.1, p.z + fx2 * 0.9);
    else camera.lookAt(p.x + fx2 * 14, p.y + 0.6, p.z + fz2 * 14);
    return;
  }
  const { fx: f, fz, rx, rz } = cameraBasis();
  // Over-the-shoulder chase camera like the mockups: ranger lower-left, valley ahead.
  const portrait = window.innerWidth < window.innerHeight;
  const dist = (portrait ? 5.6 : 4.8) + camPitch * 0.8;
  const height = 2.0 + camPitch * 2.4;
  const side = portrait ? 0.35 : 1.2;
  const target = new THREE.Vector3(p.x - f * dist + rx * side, p.y + height, p.z - fz * dist + rz * side);
  const L = game.mission.layout;
  target.y = Math.max(target.y, terrainHeight(L, target.x, target.z) + 1.2);
  if (camera.position.distanceTo(target) > 25) camera.position.copy(target);
  else camera.position.lerp(target, Math.min(1, dt * 10));
  // Sprint widens the view a touch; spraying pulls it in for focus.
  const fovBase = window.innerWidth < window.innerHeight ? 70 : 55;
  const fovWant = fovBase + (p.speed > 7 ? 6 : 0) - (p.spraying ? 3 : 0);
  if (!settings.reduced && Math.abs(camera.fov - fovWant) > 0.05) {
    camera.fov += (fovWant - camera.fov) * Math.min(1, dt * 5);
    camera.updateProjectionMatrix();
  }
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
    // Free-mouse mode: pushing the cursor toward a screen edge turns the camera.
    if (freeMode && !pointerLocked && mouseFree.active && !manual && !touch.used) {
      const ex = Math.abs(mouseFree.x);
      if (ex > 0.85) camYaw -= Math.sign(mouseFree.x) * (ex - 0.85) * 6 * dt;
    }
    $('lockhint').hidden = !(wantsLock() && !pointerLocked);
    if (game.score !== lastScore) {
      lastScore = game.score;
      stuckT = 0;
    } else stuckT += dt;
    $('btn-hint').classList.toggle('nudge', stuckT > 30 && !game.mission.noHints && !game.hint);
  }
  updateRanger(dt);
  footsteps(dt);
  updateCamera(dt);
  if (mode === 'play') {
    const L = game.mission.layout;
    const pp = game.player;
    world.updateOcclusion(
      camera.position,
      [
        new THREE.Vector3(pp.x, pp.y + 1, pp.z),
        new THREE.Vector3(game.aim.x, terrainHeight(L, game.aim.x, game.aim.z) + 0.3, game.aim.z),
      ],
      dt,
    );
  } else world.updateOcclusion(camera.position, [new THREE.Vector3(game.player.x, game.player.y + 1, game.player.z)], dt);
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
  fx.showAim(mode === 'play');
  // Ambient beds: rain under the storm, running water near the creek or pond.
  {
    const L = game.mission.layout;
    const p = game.player;
    let dw = Math.hypot(p.x - L.pond.x, p.z - L.pond.z) - L.pond.r;
    for (let k = 0; k < L.creek.length - 1; k++) {
      const a = L.creek[k];
      const b = L.creek[k + 1];
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((p.x - a[0]) * dx + (p.z - a[1]) * dz) / (dx * dx + dz * dz)));
      dw = Math.min(dw, Math.hypot(p.x - (a[0] + dx * t), p.z - (a[1] + dz * t)));
    }
    audio.beds(mode === 'play' ? world.stormHere : 0, mode === 'play' ? Math.max(0, 1 - dw / 14) : 0);
    if (world.lightning) audio.thunder();
  }
  if (mode === 'play' || mode === 'paused' || mode === 'result') hud.update(game, camera, window.innerWidth, window.innerHeight, dt);
  if (!game.mission.night) {
    birdT -= dt;
    if (birdT < 0) {
      birdT = 3 + Math.random() * 6;
      if (mode === 'play') audio.bird();
    }
  }
  if (composer && bloomOn) composer.render(dt);
  else renderer.render(world.scene, camera);
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
    // Drop bloom if the machine cannot keep up.
    if (bloomOn && mode === 'play' && fps.value < 38) {
      if (++slowFrames >= 3) bloomOn = false;
    } else slowFrames = 0;
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
  composer?.setSize(w, h);
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
  armDebug: () => {
    const B = ranger?.root.userData.bones as Record<string, THREE.Object3D | null> | undefined;
    if (!B?.rArm || !B.rHand) return null;
    const a = new THREE.Vector3();
    const h = new THREE.Vector3();
    B.rArm.getWorldPosition(a);
    B.rHand.getWorldPosition(h);
    return { arm: a.toArray().map((x) => +x.toFixed(2)), hand: h.toArray().map((x) => +x.toFixed(2)), aimW };
  },
  setCam: (yaw: number, pitch: number) => {
    camYaw = yaw;
    camPitch = pitch;
  },
  keys,
  setMode,
  project: (x: number, z: number) => {
    const v = new THREE.Vector3(x, terrainHeight(game.mission.layout, x, z), z).project(camera);
    const r = canvas.getBoundingClientRect();
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
  },
  aimWorld: (x: number, z: number) => {
    const v = new THREE.Vector3(x, terrainHeight(game.mission.layout, x, z), z).project(camera);
    mouseFree = { x: v.x, y: v.y, active: true };
  },
  startMission: (id: string) => {
    keys.clear();
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
