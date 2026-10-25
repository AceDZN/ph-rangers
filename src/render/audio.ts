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
