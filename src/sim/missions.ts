// Authored missions. Each mission places spills on a fresh grid, names the protected assets
// and their pH bands, and sets the sources (leaks, rain) that keep the pressure on.

import { GALILEE, Layout, NIGHT, Rect } from './layout';
import { Grid, Kind, Rain, Source } from './world';

export type AssetIcon = 'fish' | 'bees' | 'berries' | 'school' | 'olive' | 'puddle' | 'creek';

export interface AssetDef {
  id: string;
  name: string;
  icon: AssetIcon;
  lo: number;
  hi: number;
  /** Health lost per second while out of band (before distance scaling). */
  decay: number;
  cells: (g: Grid) => number[];
  /** World point for the 3D marker. */
  at: [number, number];
}

export interface Loadout {
  litmus: number;
  phenol: number;
  mist: number;
  canister: number;
  acid: number;
  base: number;
  water: number;
}

export type TutorialCheck =
  | 'near-spill'
  | 'litmus-on-spill'
  | 'mist-on-spill'
  | 'spill-rising'
  | 'mist-any'
  | 'phenol-any'
  | 'x10'
  | 'canisters-2'
  | 'restored-any'
  | 'won';

export interface TutorialStep {
  /** Short headline, then one line of what to do. */
  text: string;
  until: TutorialCheck;
  title?: string;
  /** Keys to show as chips. */
  keys?: string[];
  /** HUD element to make glow (CSS selector). */
  focus?: string;
  /** Point an arrow in the world at the spill. */
  pointAtSpill?: boolean;
  /** Point an arrow at a specific spot instead. */
  pointAt?: [number, number];
}

export interface MissionDef {
  id: string;
  num: number;
  title: string;
  tagline: string;
  brief: string[];
  layout: Layout;
  night?: boolean;
  start: { x: number; z: number; yaw: number };
  /** Cells inside this rectangle must end in their band (± tol). */
  area: Rect;
  /** Optional narrower set of graded cells (overrides `area`). */
  watch?: (g: Grid) => number[];
  tol: number;
  /** Earliest time the mission can be won (leaks / storm must be over). */
  minTime: number;
  setup: (g: Grid) => { spill: number[]; decoys?: number[] };
  sources?: (g: Grid) => Source[];
  rain?: (t: number) => Rain | null;
  assets: AssetDef[];
  wagons: Array<[number, number]>;
  loadout: Loadout;
  /** ×10 strength: available from the start, unlocked at a wagon, or not at all. */
  strength10: 'yes' | 'wagon' | 'no';
  hints: string[];
  tutorial?: TutorialStep[];
  noHints?: boolean;
  /** Chemical (mol) a careful ranger needs; used for the efficiency star. */
  idealChem: number;
  winText: string;
  failText: Record<string, string>;
}

const STD: Loadout = { litmus: 6, phenol: 3, mist: 2, canister: 0, acid: 0.5, base: 0.5, water: 30 };

const cellsOfKind = (g: Grid, k: Kind) => {
  const out: number[] = [];
  for (let c = 0; c < g.count; c++) if (g.kind[c] === k) out.push(c);
  return out;
};

const at = (g: Grid, i: number, j: number) => g.idx(i, j);

export const MISSIONS: MissionDef[] = [
  {
    id: 'm1-lemon',
    num: 1,
    title: 'שלולית הלימון',
    tagline: 'ארגז מיץ לימון נשפך על שביל הכפר',
    brief: [
      'עגלת לימונים התהפכה ליד הכפר. השלולית אפורה – אי אפשר לדעת מה יש בה רק לפי המראה.',
      'זרקו נייר לקמוס כדי לגלות אם היא חומצית או בסיסית, ואז ערפל אוניברסלי כדי לראות את המספר.',
      'רססו בדיוק מספיק כדי להגיע לטווח pH 6–8 (צהוב-ירוק-כחלחל).',
      'סייר חותם על אזור רק אחרי מדידה: כל קרקע חשודה (אפורה) צריכה ערפל אוניברסלי לפני שהמשימה נגמרת.',
    ],
    layout: GALILEE,
    start: { x: 74, z: 75, yaw: Math.PI * 1.25 },
    area: { x0: 57, z0: 57, x1: 75, z1: 75 },
    tol: 0,
    minTime: 0,
    setup: (g) => {
      const spill = [at(g, 21, 21), at(g, 22, 22), at(g, 21, 22), at(g, 22, 21)];
      g.setPH(spill[0], 3);
      g.setPH(spill[1], 3);
      g.setPH(spill[2], 3.3);
      g.setPH(spill[3], 3.3);
      return { spill };
    },
    assets: [],
    wagons: [[70, 62]],
    loadout: { ...STD, litmus: 5, phenol: 0, mist: 2 },
    strength10: 'no',
    hints: [
      'לקמוס אדום = חומצי. כדי לנטרל חומצה מרססים בסיס (שסתום 2).',
      'הערפל האוניברסלי צובע את הקרקע לפי ה-pH: אדום-כתום חומצי, ירוק נייטרלי, כחול-סגול בסיסי.',
      'קרוב לסוף – לחיצות קצרות. כל לחיצה מוסיפה מעט, והמספר קופץ מהר ליד 7.',
    ],
    tutorial: [
      { title: 'רוצו לשלולית', text: 'השלולית האפורה מסומנת בחץ. הולכים עם המקשים, מסובבים מצלמה עם קליק ימני (או Q/E).', keys: ['W', 'A', 'S', 'D'], until: 'near-spill', pointAtSpill: true },
      { title: 'חומצי או בסיסי?', text: 'שימו את העכבר על השלולית ולחצו R – נזרוק עליה נייר לקמוס.', keys: ['R'], focus: '.gadget[data-gadget="litmus"]', until: 'litmus-on-spill', pointAtSpill: true },
      { title: 'אדום = חומצי! אבל כמה?', text: 'עכבר על השלולית ולחצו G – ערפל אוניברסלי צובע ומראה מספר.', keys: ['G'], focus: '.gadget[data-gadget="mist"]', until: 'mist-on-spill', pointAtSpill: true },
      { title: 'מרססים בסיס', text: 'חומצה מנטרלים בבסיס. בחרו בסיס (2) והחזיקו קליק שמאלי על השלולית.', keys: ['2', 'קליק'], focus: '.valve.base', until: 'spill-rising' },
      { title: 'עד הירוק!', text: 'הסרגל למטה מראה את ה-pH. עצרו כשהוא במסגרת (6–8) – ליד היעד הזרם נהיה עדין. עברתם? קצת חומצה (1).', keys: ['קליק', '1'], focus: '#ruler', until: 'won' },
    ],
    idealChem: 0.1,
    winText: 'חומצה + בסיס ← מלח + מים. השלולית ירוקה, ונשאר רק קרום מלח דק.',
    failText: {},
  },
  {
    id: 'm2-creek',
    num: 2,
    title: 'חומצה במעלה הנחל',
    tagline: 'מכלית התהפכה – חומצה חזקה זורמת לבריכת הדגים',
    brief: [
      'מכלית התהפכה במעלה הנחל. גל של חומצה חזקה זורם במורד אל בריכת הדגים.',
      'על הגדה יש גם שלולית חומצית פחות. מדדו את שתיהן, נסו את אותו ריסוס על שתיהן – ותראו את ההבדל.',
      'הדגים צריכים pH 6.5–8.5. גם יותר מדי בסיס יפגע בהם.',
    ],
    layout: GALILEE,
    start: { x: 60, z: 33, yaw: Math.PI * 1.15 },
    area: { x0: 0, z0: 0, x1: 96, z1: 96 },
    tol: 0.5,
    minTime: 0,
    setup: (g) => {
      const slug = g.creekCells.slice(26, 29);
      for (const c of slug) g.setPH(c, 2);
      const bank = [at(g, 20, 13), at(g, 21, 13)];
      for (const c of bank) g.setPH(c, 3);
      return { spill: [...slug, ...bank] };
    },
    assets: [
      {
        id: 'pond',
        name: 'בריכת הדגים',
        icon: 'fish',
        lo: 6.5,
        hi: 8.5,
        decay: 6,
        cells: (g) => g.pondCells,
        at: [20, 83],
      },
    ],
    wagons: [[64, 44]],
    loadout: { ...STD, base: 0.6, acid: 0.3, mist: 3 },
    strength10: 'wagon',
    tutorial: [
      { title: 'מה זורם בנחל?', text: 'עכבר על הנחל המסומן ולחצו G – ערפל אוניברסלי.', keys: ['G'], focus: '.gadget[data-gadget="mist"]', until: 'mist-any', pointAtSpill: true },
      { title: 'pH 2 – פי 10 חומצי מ-pH 3!', text: 'צריך פי 10 בסיס. תרכיז ×10 מחכה בעגלת האספקה – עמדו בטבעת הירוקה.', until: 'x10', pointAt: [64, 44] },
      { title: 'עצרו את הגל!', text: 'X מחליף ×1 / ×10. ×10 על הגל החזק, ×1 לגימור עדין. מהרו לפני שהוא מגיע לדגים.', keys: ['X', 'קליק'], focus: '.strength', until: 'restored-any' },
    ],
    hints: [
      'pH 2 חומצי פי 10 מ-pH 3. לכן צריך בערך פי 10 בסיס כדי לנטרל אותו.',
      'בעגלת האספקה יש תרכיז ×10 (מקש X). השתמשו בו על ה-pH 2, ובחוזק ×1 לגימור.',
      'מים רק מדללים: צריך פי 10 מים כדי לעלות יחידת pH אחת – והם מציפים את הגדה.',
    ],
    idealChem: 0.95,
    winText: 'pH 2 דרש בערך פי 10 בסיס מ-pH 3 – כל יחידה בסולם היא פי 10 בריכוז יוני H⁺.',
    failText: {
      'pond-acid': 'החומצה הגיעה לבריכה והדגים נפגעו. גל של pH 2 צריך פי 10 בסיס מ-pH 3 – נסו תרכיז ×10.',
      'pond-base': 'יותר מדי בסיס זרם לבריכה. "עוד בסיס" זה לא תמיד בטוח – גם pH גבוה מזיק לדגים.',
    },
  },
  {
    id: 'm3-quarry',
    num: 3,
    title: 'אבק המחצבה',
    tagline: 'אבק סיד מהמחצבה נחת בין עצי הזית',
    brief: [
      'אבק לבן מהמחצבה כיסה חלקות במטע. חלק ממנו סיד בסיסי (pH 11), וחלק סתם אבק אבן נייטרלי.',
      'פנולפתלאין נצבע ורוד רק בבסיס (מעל pH 8.2). לקמוס יגיד רק "בסיסי" – ורק בנקודה אחת.',
      'נטרלו את הסיד בחומצה – בלי לפגוע בחלקות הנקיות. המחצבה עוד דולפת, ומישהו קרע שק דשן ליד העצים.',
    ],
    layout: GALILEE,
    start: { x: 40, z: 41, yaw: Math.PI },
    area: { x0: 25, z0: 12, x1: 54, z1: 36 },
    tol: 0,
    minTime: 30,
    setup: (g) => {
      const lime = [at(g, 10, 6), at(g, 13, 7), at(g, 15, 9), at(g, 11, 9), at(g, 14, 5)];
      for (const c of lime) g.setPH(c, 11);
      const decoys = [at(g, 12, 6), at(g, 9, 8), at(g, 16, 7), at(g, 12, 10), at(g, 14, 8), at(g, 10, 10)];
      // A torn sack of acidic fertilizer: colourless in phenolphthalein, still harmful.
      const fert = at(g, 13, 9);
      g.setPH(fert, 3.8);
      return { spill: [...lime, fert], decoys };
    },
    sources: (g) => [{ cell: at(g, 9, 6), excessPerSec: -0.0012, waterPerSec: 0, from: 0, to: 30 }],
    assets: [
      {
        id: 'olives',
        name: 'עצי הזית',
        icon: 'olive',
        lo: 6,
        hi: 8.5,
        decay: 1.5,
        cells: (g) => cellsOfKind(g, Kind.Orchard),
        at: [40, 24],
      },
    ],
    wagons: [[58, 27]],
    loadout: { ...STD, litmus: 4, phenol: 3, mist: 3, acid: 0.4, base: 0.2 },
    strength10: 'no',
    tutorial: [
      { title: 'איזה אבק הוא סיד?', text: 'עכבר על המטע ולחצו F – פנולפתלאין צובע בוורוד רק בסיס.', keys: ['F'], focus: '.gadget[data-gadget="phenol"]', until: 'phenol-any', pointAtSpill: true },
      { title: 'ורוד = בסיסי', text: 'בסיס מנטרלים בחומצה (1). ושימו לב: שקוף לא אומר תקין – פנולפתלאין לא מראה חומצות.', keys: ['1', 'קליק'], focus: '.valve.acid', until: 'restored-any' },
    ],
    hints: [
      'זרקו פנולפתלאין (F) למרכז המטע: רק בסיס (מעל pH 8.2) ייצבע ורוד.',
      'בסיס מנטרלים בחומצה (שסתום 1). הוורוד נעלם כשה-pH יורד מתחת ל-8.2.',
      'שקוף בפנולפתלאין לא אומר נייטרלי – פנולפתלאין לא מראה חומצות. את שק הדשן בדקו בלקמוס או באוניברסלי.',
    ],
    idealChem: 0.2,
    winText: 'הפנולפתלאין גילה את הבסיס – אבל שקוף לא אומר תקין: את הדשן החומצי מצאתם רק בלקמוס או באוניברסלי.',
    failText: {
      'olives-base': 'הסיד המשיך להתפזר והזיתים נפגעו. בסיס מנטרלים בחומצה.',
      'olives-acid': 'הקרקע במטע חומצית מדי – אולי מהדשן החומצי, אולי מחומצה שריססתם על אבק נייטרלי או יותר מדי על הסיד.',
    },
  },
  {
    id: 'm4-blueberry',
    num: 4,
    title: 'האוכמניות של רינה',
    tagline: 'לא כל צמח רוצה pH 7',
    brief: [
      'רינה מגדלת אוכמניות. מישהו פיזר סיד על הערוגות "כדי לנטרל" – ועכשיו הן מצהיבות.',
      'אוכמניות צריכות קרקע חומצית: pH 4.5–5.5. הכוורות צריכות 6–8.5, וחצר בית הספר 6–8.5.',
      'בכוורות נשפכה חומצה, ובחצר בית הספר דלף חומר ניקוי. לכל מקום – היעד שלו.',
    ],
    layout: GALILEE,
    start: { x: 64, z: 67, yaw: Math.PI * 0.95 },
    area: { x0: 36, z0: 44, x1: 84, z1: 92 },
    tol: 0.25,
    minTime: 0,
    setup: (g) => {
      const berries = cellsOfKind(g, Kind.Blueberry);
      for (const c of berries) g.setPH(c, 7.4);
      const hive = [at(g, 14, 20), at(g, 15, 20), at(g, 14, 21)];
      for (const c of hive) g.setPH(c, 4);
      const school = [at(g, 17, 27), at(g, 18, 27), at(g, 17, 28)];
      for (const c of school) g.setPH(c, 9.8);
      return { spill: [...berries, ...hive, ...school] };
    },
    assets: [
      {
        id: 'berries',
        name: 'אוכמניות',
        icon: 'berries',
        lo: 4.5,
        hi: 5.5,
        decay: 0.3,
        cells: (g) => cellsOfKind(g, Kind.Blueberry),
        at: [73.5, 51],
      },
      {
        id: 'bees',
        name: 'כוורות',
        icon: 'bees',
        lo: 6,
        hi: 8.5,
        decay: 1.4,
        cells: (g) => cellsOfKind(g, Kind.Hive),
        at: [45, 64],
      },
      {
        id: 'school',
        name: 'חצר בית הספר',
        icon: 'school',
        lo: 6,
        hi: 8.5,
        decay: 1.4,
        cells: (g) => cellsOfKind(g, Kind.School),
        at: [54, 84],
      },
    ],
    wagons: [[62, 58]],
    loadout: { ...STD, litmus: 6, phenol: 2, mist: 5, acid: 0.5, base: 0.3 },
    strength10: 'no',
    tutorial: [
      { title: 'לכל מקום – יעד משלו', text: 'מדדו את הערוגות (G). המסגרת בסרגל מראה את היעד של המקום שאתם מכוונים אליו.', keys: ['G'], focus: '#ruler', until: 'mist-any', pointAt: [73.5, 51] },
      { title: 'אוכמניות אוהבות חומצי', text: 'כאן היעד 4.5–5.5: רססו מעט חומצה (1) עד שהסמן נכנס למסגרת.', keys: ['1', 'קליק'], focus: '.valve.acid', until: 'restored-any' },
    ],
    hints: [
      'האוכמניות ב-pH 7.4 – קרוב לנייטרלי (מעט בסיסי), אבל לא טוב להן. רססו חומצה בעדינות עד 4.5–5.5 (כתום).',
      'בכוורות: חומצה ← רססו בסיס עד ירוק. בחצר: חומר ניקוי בסיסי ← רססו חומצה.',
      'הקרקע בערוגות עשירה בחומר אורגני ולכן "חוצצת" (בופר) ובולמת שינויים – תצטרכו קצת יותר ריסוס שם.',
    ],
    idealChem: 0.2,
    winText: 'היעד תלוי במי שגר שם: אוכמניות בחומצי, דבורים וילדים בסביבה נייטרלית.',
    failText: {
      'berries-base': 'האוכמניות נבלו – pH 7 הוא נייטרלי, אבל הן צריכות קרקע חומצית (4.5–5.5).',
      'berries-acid': 'חומצי מדי גם לאוכמניות (מתחת ל-4.5).',
      'bees-acid': 'החומצה הבריחה את הדבורים.',
      'bees-base': 'יותר מדי בסיס ליד הכוורות.',
      'school-base': 'חצר בית הספר נשארה בסיסית (חומר ניקוי).',
      'school-acid': 'עכשיו החצר חומצית מדי.',
    },
  },
  {
    id: 'm5-storm',
    num: 5,
    title: 'חזית הסערה',
    tagline: 'גשם חומצי חזק חוצה את העמק, והמחצבה דולפת',
    brief: [
      'חזית של גשם חומצי חזק במיוחד (זיהום תעשייתי) חוצה את העמק ממזרח למערב. בזמן הזה המחצבה דולפת סיד אל המטע.',
      'קיבלתם קפסולות נוגד חומצה (בסיס חלש, סידן פחמתי CaCO₃ – אבן גיר): הן מתמוססות לאט, ולא מעלות את ה-pH מעל ~8.5. זרקו אותן לפני שהגשם מגיע!',
      'הגנו על הבריכה, הכוורות ובית הספר עד שהסערה תעבור.',
    ],
    layout: GALILEE,
    start: { x: 52, z: 52, yaw: Math.PI * 0.5 },
    area: { x0: 0, z0: 0, x1: 96, z1: 96 },
    tol: 0.5,
    minTime: 62,
    setup: (g) => {
      const berries = cellsOfKind(g, Kind.Blueberry);
      for (const c of berries) g.setPH(c, 5);
      const lime = [at(g, 12, 9), at(g, 13, 9)];
      for (const c of lime) g.setPH(c, 10.5);
      return { spill: lime };
    },
    sources: (g) => [{ cell: at(g, 12, 9), excessPerSec: -0.0012, waterPerSec: 0, from: 0, to: 30 }],
    // Graded: the quarry leak area and the places to protect, not every acid raindrop in the valley.
    watch: (g) => {
      const [lx, lz] = g.center(at(g, 12, 9));
      const out = new Set(g.cellsInRadius(lx, lz, 9));
      for (const k of [Kind.Hive, Kind.School, Kind.Pond]) for (const c of cellsOfKind(g, k)) out.add(c);
      return [...out];
    },
    rain: (t) => {
      if (t < 4 || t > 60) return null;
      const cx = 104 - (118 * (t - 4)) / 56;
      return { x0: cx - 8, x1: cx + 8, acidPerSec: 0.0002, waterPerSec: 0.3 };
    },
    assets: [
      { id: 'pond', name: 'בריכת הדגים', icon: 'fish', lo: 6.5, hi: 8.5, decay: 5, cells: (g) => g.pondCells, at: [20, 83] },
      { id: 'bees', name: 'כוורות', icon: 'bees', lo: 6, hi: 8.5, decay: 3, cells: (g) => cellsOfKind(g, Kind.Hive), at: [45, 64] },
      { id: 'school', name: 'חצר בית הספר', icon: 'school', lo: 6, hi: 8.5, decay: 3, cells: (g) => cellsOfKind(g, Kind.School), at: [54, 84] },
    ],
    wagons: [
      [62, 56],
      [30, 46],
    ],
    loadout: { ...STD, canister: 4, mist: 3, phenol: 2, acid: 0.4, base: 0.3 },
    strength10: 'yes',
    tutorial: [
      { title: 'הסערה בדרך!', text: 'זרקו קפסולת נוגד חומצה (T) על הכוורות ועל חצר בית הספר – לפני שהגשם מגיע.', keys: ['T'], focus: '.gadget[data-gadget="canister"]', until: 'canisters-2', pointAt: [45, 64] },
    ],
    hints: [
      'זרקו קפסולת נוגד חומצה (T) על הכוורות ועל חצר בית הספר לפני שהגשם מגיע – היא לא תעבור את 8.5.',
      'הסיד מהמחצבה בסיסי: חומצה בחוזק ×1, בלחיצות.',
      'אדמה רגילה "חוצצת" חלק מהגשם החומצי – התמקדו במה שצריך הגנה.',
    ],
    idealChem: 0.25,
    winText: 'בסיס חלש עובד לאט ולא "עובר" את הנייטרלי בהרבה – מושלם להגנה מראש.',
    failText: {
      'pond-acid': 'הגשם החומצי והנגר הורידו את ה-pH של הבריכה.',
      'pond-base': 'יותר מדי בסיס בבריכה.',
      'bees-acid': 'הגשם החומצי פגע בכוורות.',
      'bees-base': 'יותר מדי בסיס בכוורות.',
      'school-acid': 'הגשם החומצי פגע בחצר בית הספר.',
      'school-base': 'יותר מדי בסיס בחצר.',
    },
  },
  {
    id: 'm6-night',
    num: 6,
    title: 'דליפה בלילה',
    tagline: 'משימת מבחן – בלי רמזים',
    brief: [
      'עמק אחר, באמצע הלילה. דווח על כמה דליפות – לא ידוע מה דלף ואיפה בדיוק.',
      'האור היחיד: הזוהר של האינדיקטורים. אין רמזים במשימה הזו.',
      'הגנו על הבריכה, הכוורות, בית הספר והאוכמניות.',
    ],
    layout: NIGHT,
    night: true,
    start: { x: 36, z: 54, yaw: Math.PI * 0.6 },
    area: { x0: 0, z0: 0, x1: 96, z1: 96 },
    tol: 0.5,
    minTime: 0,
    setup: (g) => {
      const base = g.creekCells.slice(22, 25);
      for (const c of base) g.setPH(c, 11.3);
      const acid = [at(g, 17, 19), at(g, 17, 20)];
      for (const c of acid) g.setPH(c, 2.6);
      // Someone limed the half of the blueberry bed nearest the road.
      const berries = cellsOfKind(g, Kind.Blueberry).filter((c) => g.center(c)[0] > 22);
      for (const c of berries) g.setPH(c, 6.2);
      for (const c of g.pondCells) g.setPH(c, 8.3);
      return { spill: [...base, ...acid, ...berries] };
    },
    assets: [
      { id: 'pond', name: 'בריכה', icon: 'fish', lo: 6.5, hi: 8.5, decay: 4, cells: (g) => g.pondCells, at: [76, 83] },
      { id: 'bees', name: 'כוורות', icon: 'bees', lo: 6, hi: 8.5, decay: 2.5, cells: (g) => cellsOfKind(g, Kind.Hive), at: [45, 60] },
      { id: 'school', name: 'בית הספר', icon: 'school', lo: 6, hi: 8.5, decay: 2.5, cells: (g) => cellsOfKind(g, Kind.School), at: [42, 84] },
      { id: 'berries', name: 'אוכמניות', icon: 'berries', lo: 4.5, hi: 5.5, decay: 0.3, cells: (g) => cellsOfKind(g, Kind.Blueberry), at: [22.5, 45] },
    ],
    wagons: [
      [34, 46],
      [58, 74],
    ],
    loadout: { ...STD, litmus: 6, phenol: 3, mist: 5, canister: 2, acid: 0.5, base: 0.5 },
    strength10: 'yes',
    hints: [],
    noHints: true,
    idealChem: 0.36,
    winText: 'בלי רמזים: מדדתם, בחרתם חומר, וריססתם בדיוק לפי היעד של כל מקום.',
    failText: {
      'pond-base': 'הבסיס מהנחל הגיע לבריכה שכבר הייתה מעט בסיסית (8.3).',
      'pond-acid': 'יותר מדי חומצה בבריכה.',
      'bees-acid': 'החומצה ליד הכוורות התפשטה.',
      'bees-base': 'יותר מדי בסיס בכוורות.',
      'school-acid': 'בית הספר נפגע מחומצה.',
      'school-base': 'בית הספר נפגע מבסיס.',
      'berries-base': 'האוכמניות צריכות קרקע חומצית (4.5–5.5) – והן לא היו שם.',
      'berries-acid': 'חומצי מדי לאוכמניות.',
    },
  },
];

export function missionById(id: string): MissionDef | undefined {
  return MISSIONS.find((m) => m.id === id);
}
