// Synthesized sound (WebAudio). Starts only after the first user gesture.

export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private sprayGain: GainNode | null = null;
  private sprayFilter: BiquadFilterNode | null = null;
  private ambience: GainNode | null = null;
  muted = false;
  private lastFizz = 0;

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.6;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 2;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // Continuous spray hiss, gated by gain.
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    this.sprayFilter = this.ctx.createBiquadFilter();
    this.sprayFilter.type = 'bandpass';
    this.sprayFilter.frequency.value = 2400;
    this.sprayFilter.Q.value = 0.7;
    this.sprayGain = this.ctx.createGain();
    this.sprayGain.gain.value = 0;
    src.connect(this.sprayFilter).connect(this.sprayGain).connect(this.master);
    src.start();
    // Soft countryside ambience: filtered wind + occasional bird chirps.
    const wind = this.ctx.createBufferSource();
    wind.buffer = this.noise;
    wind.loop = true;
    const wf = this.ctx.createBiquadFilter();
    wf.type = 'lowpass';
    wf.frequency.value = 400;
    this.ambience = this.ctx.createGain();
    this.ambience.gain.value = 0.05;
    wind.connect(wf).connect(this.ambience).connect(this.master);
    wind.start();
    if (this.musicOn) this.startMusic();
  }

  // ---------- music: a small procedural darbuka + oud-ish pluck loop ----------
  private musicGain: GainNode | null = null;
  private musicOn = true;
  private nextNote = 0;
  private step = 0;
  private musicTimer: number | null = null;
  musicMood: 'day' | 'night' | 'menu' = 'menu';

  setMusic(on: boolean) {
    this.musicOn = on;
    if (!this.ctx) return;
    if (on) this.startMusic();
    else if (this.musicGain) this.musicGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
  }

  private startMusic() {
    if (!this.ctx || !this.master || !this.musicOn) return;
    if (!this.musicGain) {
      this.musicGain = this.ctx.createGain();
      this.musicGain.connect(this.master);
    }
    this.musicGain.gain.setTargetAtTime(0.5, this.ctx.currentTime, 0.5);
    if (this.musicTimer !== null) return;
    this.nextNote = this.ctx.currentTime + 0.1;
    this.musicTimer = window.setInterval(() => this.schedule(), 50);
  }

  private schedule() {
    if (!this.ctx || !this.musicGain) return;
    const night = this.musicMood === 'night';
    const spb = 60 / (night ? 84 : 104) / 2; // eighth notes
    // Major-pentatonic by day, a Hijaz-flavoured scale at night (D E♭ F♯ G A B♭ C).
    const day = [293.7, 329.6, 370, 440, 493.9, 587.3, 659.3];
    const nightScale = [293.7, 311.1, 370, 392, 440, 466.2, 523.3];
    const scale = night ? nightScale : day;
    const melody = night ? [0, 2, 3, 2, 1, 0, 4, 3, 2, 3, 4, 5, 4, 3, 2, 1] : [0, 2, 4, 2, 3, 4, 6, 4, 5, 4, 2, 3, 1, 2, 0, 2];
    while (this.nextNote < this.ctx.currentTime + 0.25) {
      const t = this.nextNote;
      const s = this.step % 16;
      // Darbuka: dum on 0 and 6, tek on 4, 10, 12, 14, soft taks between.
      if (s === 0 || s === 6) this.drum(t, 'dum');
      else if (s === 4 || s === 10 || s === 12 || s === 14) this.drum(t, 'tek');
      else if (s % 2 === 1 && !night) this.drum(t, 'tak');
      // Bass on the bar and the half bar.
      if (s === 0 || s === 8) this.note(t, scale[0] / 4, spb * 3.5, 'triangle', 0.16);
      if (s === 6 && !night) this.note(t, scale[3] / 4, spb * 1.5, 'triangle', 0.12);
      // Plucked melody, sparse at night.
      if (!night || s % 2 === 0) {
        const n = melody[(s + Math.floor(this.step / 16) * 3) % 16];
        this.note(t, scale[n], spb * 0.9, 'sawtooth', 0.035, true);
      }
      this.nextNote += spb;
      this.step++;
    }
  }

  private note(t: number, f: number, dur: number, type: OscillatorType, vol: number, pluck = false) {
    if (!this.ctx || !this.musicGain) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    let out: AudioNode = g;
    if (pluck) {
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(3200, t);
      lp.frequency.exponentialRampToValueAtTime(600, t + dur);
      g.connect(lp);
      out = lp;
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    out.connect(this.musicGain);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private drum(t: number, kind: 'dum' | 'tek' | 'tak') {
    if (!this.ctx || !this.musicGain || !this.noise) return;
    if (kind === 'dum') {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(60, t + 0.18);
      g.gain.setValueAtTime(0.32, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      o.connect(g).connect(this.musicGain);
      o.start(t);
      o.stop(t + 0.3);
      return;
    }
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = kind === 'tek' ? 3500 : 5000;
    f.Q.value = 1.5;
    const g = this.ctx.createGain();
    const v = kind === 'tek' ? 0.22 : 0.07;
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'tek' ? 0.07 : 0.04));
    s.connect(f).connect(g).connect(this.musicGain);
    s.start(t, Math.random());
    s.stop(t + 0.1);
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.6, this.ctx.currentTime, 0.05);
  }

  spraying(on: boolean, valve: string, strength: number) {
    if (!this.ctx || !this.sprayGain || !this.sprayFilter) return;
    const t = this.ctx.currentTime;
    this.sprayGain.gain.setTargetAtTime(on ? (strength === 10 ? 0.22 : 0.15) : 0, t, 0.03);
    this.sprayFilter.frequency.setTargetAtTime(valve === 'water' ? 1600 : valve === 'acid' ? 2900 : 2300, t, 0.05);
  }

  private tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.2, slideTo?: number, delay = 0) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private burst(dur: number, freq: number, vol: number, type: BiquadFilterType = 'highpass') {
    if (!this.ctx || !this.master || !this.noise) return;
    const t = this.ctx.currentTime;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random());
    s.stop(t + dur + 0.05);
  }

  fizz(amount: number) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastFizz < 0.07) return;
    this.lastFizz = now;
    this.burst(0.25, 5000, Math.min(0.25, 0.05 + amount * 60));
    if (Math.random() < 0.4) this.tone(1800 + Math.random() * 1500, 0.04, 'sine', 0.05);
  }

  chime() {
    [784, 988, 1175].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.12, undefined, i * 0.07));
  }

  /** Ground restored: a rising pentatonic run that climbs with the combo. */
  restored(combo: number) {
    const scale = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568];
    const start = Math.min(4, combo - 1);
    for (let i = 0; i < 4; i++) this.tone(scale[start + i], 0.18, 'triangle', 0.11, undefined, i * 0.055);
    this.tone(scale[start + 4] * 2, 0.4, 'sine', 0.05, undefined, 0.22);
  }

  private rainGain: GainNode | null = null;
  private waterGain: GainNode | null = null;

  /** Continuous beds: rain (0..1) and nearby running water (0..1). */
  beds(rain: number, water: number) {
    if (!this.ctx || !this.master || !this.noise) return;
    if (!this.rainGain) {
      const mk = (freq: number, type: BiquadFilterType, q: number) => {
        const src = this.ctx!.createBufferSource();
        src.buffer = this.noise;
        src.loop = true;
        const f = this.ctx!.createBiquadFilter();
        f.type = type;
        f.frequency.value = freq;
        f.Q.value = q;
        const g = this.ctx!.createGain();
        g.gain.value = 0;
        src.connect(f).connect(g).connect(this.master!);
        src.start(0, Math.random());
        return g;
      };
      this.rainGain = mk(6000, 'highpass', 0.3);
      this.waterGain = mk(900, 'bandpass', 0.6);
    }
    const t = this.ctx.currentTime;
    this.rainGain.gain.setTargetAtTime(rain * 0.12, t, 0.3);
    this.waterGain!.gain.setTargetAtTime(water * 0.05, t, 0.3);
  }

  thunder() {
    if (!this.ctx || !this.master || !this.noise) return;
    const t = this.ctx.currentTime;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(80, t + 2.5);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random());
    s.stop(t + 3);
  }

  go() {
    [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.22, 'square', 0.06, undefined, i * 0.09));
    this.tone(1046, 0.5, 'triangle', 0.1, undefined, 0.36);
  }

  boing() {
    this.tone(220, 0.45, 'sine', 0.3, 520);
    this.tone(330, 0.3, 'square', 0.05, 160, 0.1);
  }

  throwSfx() {
    this.burst(0.18, 900, 0.12, 'bandpass');
  }

  pop(kind: string) {
    if (kind === 'mist') {
      this.burst(0.6, 1200, 0.18, 'lowpass');
      [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.2, 'sine', 0.06, undefined, i * 0.05));
    } else if (kind === 'phenol') {
      this.tone(600, 0.15, 'square', 0.08, 1200);
      this.burst(0.4, 2500, 0.15);
    } else this.tone(900, 0.08, 'triangle', 0.1);
  }

  refill() {
    [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.15, 'triangle', 0.1, undefined, i * 0.06));
  }

  empty() {
    this.tone(180, 0.15, 'square', 0.08, 120);
  }

  hurt() {
    this.tone(300, 0.2, 'sawtooth', 0.05, 200);
  }

  win() {
    [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.14, undefined, i * 0.1));
  }

  fail() {
    [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.35, 'sine', 0.14, undefined, i * 0.14));
  }

  bird() {
    if (!this.ctx) return;
    const base = 2200 + Math.random() * 1200;
    for (let i = 0; i < 3; i++) this.tone(base + i * 150, 0.07, 'sine', 0.03, base * 1.3, i * 0.09);
  }
}
