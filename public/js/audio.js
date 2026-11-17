// Synthesized sound effects and music. No audio files.
import { bakeAll } from './baked.js';

const pickOne = (a) => a[Math.floor(Math.random() * a.length)];

export class Sfx {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.baked = null;
    this.last = {};
    this.needsRebuild = false;
    this.rebuilds = 0;
    this.lastT = -1;
    this.stuck = 0;
    this.resumeAt = 0;
  }

  // Builds the audio context and the mix buses. Sound buffers survive a rebuild.
  build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.7;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp);
    comp.connect(this.ctx.destination);
    this.musicFilter = this.ctx.createBiquadFilter();
    this.musicFilter.type = 'lowpass';
    this.musicFilter.frequency.value = 16000;
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0;
    this.musicFilter.connect(this.musicGain);
    this.musicGain.connect(comp);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.silent = this.ctx.createBuffer(1, 1, 22050);
    const ctx = this.ctx;
    ctx.onstatechange = () => this.onState && this.ctx === ctx && this.onState(ctx.state);
    this.lastT = -1;
    this.stuck = 0;
    this.resumeAt = 0;
    return true;
  }

  // Must run inside a user gesture (iOS needs this).
  unlock() {
    if (!this.ctx) {
      if (!this.build()) return;
      bakeAll()
        .then((b) => (this.baked = b))
        .catch((e) => console.warn('Sound bake failed, using simple sounds', e));
    } else if (this.needsRebuild) {
      // iOS Safari can leave a context stuck after a lock or app switch. A new one fixes it.
      const old = this.ctx;
      try {
        const p = old.close();
        if (p && p.catch) p.catch(() => {});
      } catch {
        // Already closed.
      }
      this.needsRebuild = false;
      this.rebuilds++;
      this.build();
      if (this.onRebuild) this.onRebuild();
    }
    // Safari uses 'suspended' and also 'interrupted' (after a lock or app switch).
    if (this.ctx.state !== 'running' && this.ctx.state !== 'closed') {
      if (!this.resumeAt) this.resumeAt = performance.now();
      try {
        const s = this.ctx.createBufferSource();
        s.buffer = this.silent;
        s.connect(this.ctx.destination);
        s.start(0);
      } catch {
        // resume() below still runs.
      }
      const p = this.ctx.resume();
      if (p && p.catch) p.catch(() => {});
    }
  }

  get running() {
    return !!this.ctx && this.ctx.state === 'running' && !this.needsRebuild;
  }

  // Called about twice a second. Marks the context for a rebuild on the next tap when
  // its clock is frozen while it says "running", or when a tap did not wake it up.
  watch() {
    const c = this.ctx;
    if (!c || document.hidden) {
      this.stuck = 0;
      return;
    }
    if (c.state === 'running') {
      this.resumeAt = 0;
      this.stuck = c.currentTime === this.lastT ? this.stuck + 1 : 0;
      if (this.stuck >= 3) this.needsRebuild = true;
    } else if (this.resumeAt && performance.now() - this.resumeAt > 1500) {
      this.needsRebuild = true;
    }
    this.lastT = c.currentTime;
  }

  get ok() {
    return this.enabled && this.ctx && this.ctx.state === 'running';
  }

  // Limits how often one kind of sound can play.
  gate(name, ms) {
    const now = performance.now();
    if (now - (this.last[name] || 0) < ms) return false;
    this.last[name] = now;
    return true;
  }

  env(g, t, peak, attack, release) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
  }

  noise({ dur = 0.2, type = 'bandpass', f0 = 1000, f1 = f0, q = 1, gain = 0.4, attack = 0.005, delay = 0 }) {
    if (!this.ok) return;
    const c = this.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain();
    this.env(g, t, gain, attack, dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + attack + 0.05);
  }

  tone({ f0 = 440, f1 = f0, dur = 0.15, type = 'sine', gain = 0.3, attack = 0.005, delay = 0 }) {
    if (!this.ok) return;
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain();
    this.env(g, t, gain, attack, dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + attack + 0.05);
  }

  playBuf(buf, rate = 1, gain = 1, delay = 0) {
    if (!this.ok || !buf) return;
    const c = this.ctx;
    const s = c.createBufferSource();
    s.buffer = buf;
    s.playbackRate.value = rate;
    const g = c.createGain();
    g.gain.value = gain;
    s.connect(g).connect(this.master);
    s.start(c.currentTime + delay);
  }

  // ---------- Golf sounds ----------
  // Club on the jelly ball: a soft tock, a little thump, and a squish. k: 0..1 power.
  putt(k = 0.5) {
    if (!this.ok) return;
    if (this.baked) this.playBuf(this.baked.putt, 0.9 + k * 0.3, 0.5 + k * 0.6);
    else {
      this.noise({ dur: 0.03, type: 'highpass', f0: 2500, gain: 0.3 });
      this.tone({ f0: 220, f1: 110, dur: 0.07, gain: 0.4 });
    }
  }

  // The ball hits a rail or a block: a wooden knock, higher for small hits.
  knock(k) {
    if (!this.ok || k < 0.05 || !this.gate('knock', 50)) return;
    const g = Math.min(1, 0.2 + k);
    this.tone({ f0: 320 + (1 - k) * 160, f1: 180, dur: 0.07, type: 'triangle', gain: 0.32 * g });
    this.noise({ dur: 0.05, f0: 900, f1: 600, q: 3, gain: 0.3 * g });
  }

  // Jelly bumper: a springy boing.
  boing(k) {
    if (!this.ok || !this.gate('boing', 60)) return;
    const g = Math.min(1, 0.35 + k);
    this.tone({ f0: 180, f1: 520, dur: 0.12, gain: 0.3 * g });
    this.tone({ f0: 520, f1: 260, dur: 0.16, gain: 0.22 * g, delay: 0.1 });
    this.tone({ f0: 760, f1: 900, dur: 0.06, type: 'triangle', gain: 0.06 * g });
  }

  // A windmill sail or a sliding wall bats the ball away.
  thwack(k) {
    if (!this.ok || !this.gate('thwack', 80)) return;
    this.noise({ dur: 0.08, type: 'highpass', f0: 1400, f1: 900, gain: 0.35 });
    this.tone({ f0: 200, f1: 90, dur: 0.12, type: 'triangle', gain: 0.35 * Math.min(1, 0.4 + k) });
  }

  splash() {
    if (this.baked) return this.playBuf(this.baked.splash, 0.95 + Math.random() * 0.1, 1);
    this.noise({ dur: 0.5, type: 'lowpass', f0: 1800, f1: 200, gain: 0.5 });
  }

  // Into the cup: a hollow plop and a little rattle.
  plop() {
    if (this.baked) return this.playBuf(this.baked.plop, 1, 1);
    this.tone({ f0: 520, f1: 240, dur: 0.18, gain: 0.4 });
  }

  // Too fast: the ball skims over the cup.
  lip() {
    this.tone({ f0: 1400, f1: 1100, dur: 0.05, type: 'triangle', gain: 0.12 });
    this.tone({ f0: 1700, f1: 1500, dur: 0.05, type: 'triangle', gain: 0.08, delay: 0.06 });
  }

  sand() {
    if (!this.gate('sand', 140)) return;
    this.noise({ dur: 0.12, type: 'bandpass', f0: 2500, f1: 1800, q: 0.8, gain: 0.06 });
  }

  // Celebration by result: 3 hole in one, 2 under par, 1 par, 0 over.
  cheer(level) {
    if (level >= 3) {
      [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => this.tone({ f0: f, f1: f, dur: 0.2, type: 'triangle', gain: 0.2, delay: i * 0.08 }));
      this.tone({ f0: 2093, f1: 2100, dur: 0.6, type: 'triangle', gain: 0.16, delay: 0.5 });
      this.noise({ dur: 0.9, type: 'highpass', f0: 3000, f1: 5000, gain: 0.08, delay: 0.2, attack: 0.2 });
    } else if (level === 2) {
      [659, 784, 1046, 1318].forEach((f, i) => this.tone({ f0: f, f1: f, dur: 0.18, type: 'triangle', gain: 0.18, delay: i * 0.08 }));
    } else if (level === 1) {
      [784, 1046].forEach((f, i) => this.tone({ f0: f, f1: f, dur: 0.2, type: 'triangle', gain: 0.16, delay: i * 0.1 }));
    } else {
      this.tone({ f0: 440, f1: 392, dur: 0.25, type: 'triangle', gain: 0.12 });
    }
  }

  // Trophy: a bright little fanfare with a sparkle on top.
  trophy() {
    if (!this.ok) return;
    [784, 988, 1175, 1568].forEach((f, i) => this.tone({ f0: f, f1: f, dur: 0.14, type: 'triangle', gain: 0.16, delay: i * 0.07 }));
    this.tone({ f0: 2093, f1: 2093, dur: 0.35, type: 'sine', gain: 0.1, delay: 0.3 });
    this.noise({ dur: 0.4, type: 'highpass', f0: 5000, f1: 7000, gain: 0.05, delay: 0.28 });
  }

  // Portal: a quick rising shimmer.
  warp() {
    if (!this.ok || !this.gate('warp', 120)) return;
    this.tone({ f0: 300, f1: 1400, dur: 0.22, gain: 0.22 });
    this.tone({ f0: 450, f1: 2100, dur: 0.22, type: 'triangle', gain: 0.1, delay: 0.03 });
    [1568, 2093, 2637].forEach((f, i) => this.tone({ f0: f, f1: f, dur: 0.08, type: 'triangle', gain: 0.07, delay: 0.16 + i * 0.05 }));
  }

  // Boost pad: a whoosh that rises.
  boost() {
    if (!this.ok || !this.gate('boost', 150)) return;
    this.noise({ dur: 0.3, type: 'bandpass', f0: 600, f1: 3200, q: 1.2, gain: 0.3 });
    this.tone({ f0: 180, f1: 620, dur: 0.25, type: 'triangle', gain: 0.18 });
  }

  turn() {
    this.tone({ f0: 660, f1: 880, dur: 0.1, type: 'triangle', gain: 0.12 });
  }

  win() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone({ f0: f, f1: f, dur: 0.18, type: 'triangle', gain: 0.2, delay: i * 0.1 }));
    this.tone({ f0: 1318, f1: 1320, dur: 0.5, type: 'triangle', gain: 0.2, delay: 0.42 });
  }

  ui() {
    this.tone({ f0: 660, f1: 880, dur: 0.06, type: 'triangle', gain: 0.12 });
  }
}

// Small generative music loop. intensity: 0 = menu, 1 = play.
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16];
const CHORDS = [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]]; // C G Am F
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class Music {
  constructor(sfx) {
    this.sfx = sfx;
    this.enabled = true;
    this.intensity = 0;
    this.step = 0;
    this.nextTime = 0;
    this.bpm = 96;
    this.timer = null;
  }

  start() {
    const s = this.sfx;
    if (!s.ctx || this.timer) return;
    this.nextTime = s.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 40);
    this.fade();
  }

  fade() {
    const s = this.sfx;
    if (!s.ctx) return;
    const on = this.enabled && s.enabled;
    const g = s.musicGain.gain;
    g.cancelScheduledValues(s.ctx.currentTime);
    g.setTargetAtTime(on ? 0.26 : 0, s.ctx.currentTime, 0.4);
  }

  duck(on) {
    const s = this.sfx;
    if (!s.ctx) return;
    if (on) s.musicGain.gain.setTargetAtTime(0.05 * (this.enabled && s.enabled ? 1 : 0), s.ctx.currentTime, 0.2);
    else this.fade();
  }

  schedule() {
    const c = this.sfx.ctx;
    if (!c || c.state !== 'running') return;
    if (!(this.enabled && this.sfx.enabled)) return;
    const stepDur = 60 / this.bpm / 4;
    while (this.nextTime < c.currentTime + 0.15) {
      this.playStep(this.step, this.nextTime);
      this.nextTime += stepDur;
      this.step = (this.step + 1) % 64;
    }
  }

  voice(t, freq, dur, type, gain, f1 = freq) {
    const c = this.sfx.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (f1 !== freq) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.sfx.musicFilter);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  hat(t, gain) {
    const c = this.sfx.ctx;
    const s = c.createBufferSource();
    s.buffer = this.sfx.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    s.connect(f).connect(g).connect(this.sfx.musicFilter);
    s.start(t, Math.random() * 0.5);
    s.stop(t + 0.05);
  }

  playStep(step, t) {
    const bar = Math.floor(step / 16) % 4;
    const s = step % 16;
    const chord = CHORDS[bar];
    const I = this.intensity;
    // Bouncy bass.
    if ([0, 4, 8, 12].includes(s)) this.voice(t, midi(chord[s % 8 === 0 ? 0 : 2] - 24), 0.2, 'triangle', 0.42);
    if (I > 0 && (s === 0 || s === 8)) this.voice(t, 120, 0.16, 'sine', 0.45, 45);
    if (I > 0 && s % 4 === 2) this.hat(t, 0.05);
    if (s === 0) for (const n of chord) this.voice(t, midi(n), 1.6, 'sine', 0.05);
    // Plucky tune (major pentatonic).
    if (s % 2 === 0 && Math.random() < (I ? 0.4 : 0.28)) {
      const n = 72 + SCALE[Math.floor(Math.random() * SCALE.length)];
      this.voice(t, midi(n), 0.18, 'triangle', 0.1);
    }
  }
}
