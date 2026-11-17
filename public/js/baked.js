// Pre-rendered sound effects, built once with an OfflineAudioContext from many layers.
const SR = 44100;
const rand = (a, b) => a + Math.random() * (b - a);

function offline(dur) {
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  return new OAC(1, Math.ceil(SR * dur), SR);
}

function render(ctx) {
  return new Promise((resolve, reject) => {
    ctx.oncomplete = (e) => resolve(e.renderedBuffer);
    const p = ctx.startRendering();
    if (p && p.then) p.then(resolve, reject);
  });
}

function whiteNoise(ctx, dur = 2) {
  const b = ctx.createBuffer(1, Math.ceil(SR * dur), SR);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

function brownNoise(ctx, dur = 4) {
  const b = ctx.createBuffer(1, Math.ceil(SR * dur), SR);
  const d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    d[i] = last * 3.5;
  }
  return b;
}

function src(ctx, buf, t, dur, rate = 1) {
  const s = ctx.createBufferSource();
  s.buffer = buf;
  s.playbackRate.value = rate;
  const maxOff = Math.max(0, buf.duration - dur * rate - 0.01);
  s.start(t, Math.random() * maxOff);
  s.stop(t + dur);
  return s;
}

function filt(ctx, type, freq, q = 0.7) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

function env(ctx, t, peak, attack, decay) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  return g;
}

function flutter(ctx, t, dur, peak, steps = 48, power = 2) {
  const g = ctx.createGain();
  const curve = new Float32Array(steps);
  for (let k = 0; k < steps; k++) curve[k] = Math.pow(1 - k / steps, power) * (0.5 + 0.5 * Math.random()) * peak;
  curve[steps - 1] = 0;
  g.gain.setValueAtTime(0, 0);
  g.gain.setValueCurveAtTime(curve, t, dur);
  return g;
}

function chain(...nodes) {
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
  return nodes[nodes.length - 1];
}

function softClip(ctx, k) {
  const ws = ctx.createWaveShaper();
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(k * x) / Math.tanh(k);
  }
  ws.curve = curve;
  return ws;
}

function osc(ctx, type, f0, f1, t, dur, peak, attack = 0.003) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = env(ctx, t, peak, attack, dur);
  o.connect(g);
  o.start(t);
  o.stop(t + attack + dur + 0.02);
  return g;
}

// Wet jelly splat for a Gloop pop: squelch, juicy grains, splash body, a squeak.
async function splat() {
  const ctx = offline(0.6);
  const out = ctx.createGain();
  out.gain.value = 0.9;
  out.connect(ctx.destination);
  const w = whiteNoise(ctx, 1.5);
  // Low squelch: a falling, wobbly tone.
  {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(260, 0);
    o.frequency.exponentialRampToValueAtTime(70, 0.18);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 38;
    const lg = ctx.createGain();
    lg.gain.value = 30;
    lfo.connect(lg).connect(o.frequency);
    chain(o, env(ctx, 0, 0.55, 0.004, 0.2), out);
    o.start(0);
    lfo.start(0);
    o.stop(0.3);
    lfo.stop(0.3);
  }
  for (let i = 0; i < 30; i++) {
    const t = 0.005 + Math.pow(Math.random(), 1.6) * 0.25;
    const d = rand(0.006, 0.026);
    const peak = rand(0.1, 0.32) * Math.max(0.15, 1 - t / 0.3);
    chain(src(ctx, w, t, d + 0.012, rand(0.7, 1.3)), filt(ctx, 'bandpass', rand(400, 2400), rand(2, 6)), env(ctx, t, peak, 0.0008, d), out);
  }
  {
    const lp = filt(ctx, 'lowpass', 1400, 0.5);
    lp.frequency.setValueAtTime(1500, 0.01);
    lp.frequency.exponentialRampToValueAtTime(220, 0.4);
    chain(src(ctx, w, 0.01, 0.42), lp, flutter(ctx, 0.01, 0.4, 0.4), out);
  }
  // Squeak: a little "eep" upward glide.
  chain(osc(ctx, 'triangle', 700, 1500, 0.03, 0.1, 0.12), out);
  return render(ctx);
}

// Wood break: a sharp crack, then splinters and a hollow knock.
async function crack() {
  const ctx = offline(0.5);
  const out = ctx.createGain();
  out.connect(ctx.destination);
  const w = whiteNoise(ctx, 1);
  chain(src(ctx, w, 0, 0.06), filt(ctx, 'highpass', 1500), env(ctx, 0, 0.9, 0.0006, 0.04), out);
  chain(osc(ctx, 'triangle', 320, 140, 0, 0.12, 0.5), filt(ctx, 'lowpass', 1200), out);
  chain(src(ctx, w, 0.002, 0.18), filt(ctx, 'bandpass', 700, 3), env(ctx, 0.002, 0.5, 0.002, 0.12), out);
  for (let i = 0; i < 18; i++) {
    const t = 0.02 + Math.pow(Math.random(), 1.4) * 0.3;
    const d = rand(0.004, 0.014);
    chain(src(ctx, w, t, d + 0.01), filt(ctx, 'bandpass', rand(1500, 5000), rand(3, 7)), env(ctx, t, rand(0.08, 0.3) * (1 - t / 0.4), 0.0005, d), out);
  }
  return render(ctx);
}

// Stone break: deep thud and a crumble of grit.
async function crumble() {
  const ctx = offline(0.8);
  const out = ctx.createGain();
  out.connect(ctx.destination);
  const w = whiteNoise(ctx, 1.5);
  const br = brownNoise(ctx, 1.5);
  chain(osc(ctx, 'sine', 140, 50, 0, 0.25, 0.8), out);
  chain(src(ctx, w, 0, 0.05), filt(ctx, 'highpass', 900), env(ctx, 0, 0.7, 0.0006, 0.035), out);
  chain(src(ctx, br, 0.01, 0.6), filt(ctx, 'lowpass', 600), flutter(ctx, 0.01, 0.55, 1.2, 40, 2), out);
  for (let i = 0; i < 40; i++) {
    const t = 0.03 + Math.pow(Math.random(), 1.3) * 0.55;
    const d = rand(0.003, 0.012);
    chain(src(ctx, w, t, d + 0.01), filt(ctx, 'bandpass', rand(800, 3500), rand(2, 5)), env(ctx, t, rand(0.06, 0.22) * (1 - t / 0.7), 0.0005, d), out);
  }
  return render(ctx);
}

// Ice break: bright shatter with many glassy pings.
async function shatter() {
  const ctx = offline(0.7);
  const out = ctx.createGain();
  out.connect(ctx.destination);
  const w = whiteNoise(ctx, 1.5);
  chain(src(ctx, w, 0, 0.3), filt(ctx, 'highpass', 3500), env(ctx, 0, 0.6, 0.001, 0.22), out);
  for (let i = 0; i < 22; i++) {
    const t = Math.pow(Math.random(), 1.6) * 0.45;
    const f = rand(2200, 6500);
    chain(osc(ctx, 'sine', f, f * rand(0.98, 1.02), t, rand(0.04, 0.16), rand(0.03, 0.09), 0.001), out);
  }
  for (let i = 0; i < 25; i++) {
    const t = 0.01 + Math.random() * 0.4;
    const d = rand(0.003, 0.01);
    chain(src(ctx, w, t, d + 0.01), filt(ctx, 'bandpass', rand(4000, 9000), 4), env(ctx, t, rand(0.08, 0.25) * (1 - t / 0.5), 0.0005, d), out);
  }
  return render(ctx);
}

// Catapult release: rope thwack, wood creak and an air whoosh.
async function launch() {
  const ctx = offline(0.5);
  const out = ctx.createGain();
  out.connect(ctx.destination);
  const w = whiteNoise(ctx, 1);
  chain(osc(ctx, 'sine', 160, 55, 0, 0.18, 0.8), out);
  chain(src(ctx, w, 0, 0.04), filt(ctx, 'bandpass', 1800, 2), env(ctx, 0, 0.6, 0.0008, 0.03), out);
  {
    const bp = filt(ctx, 'bandpass', 600, 1.1);
    bp.frequency.setValueAtTime(400, 0.02);
    bp.frequency.exponentialRampToValueAtTime(2600, 0.2);
    bp.frequency.exponentialRampToValueAtTime(1200, 0.4);
    chain(src(ctx, w, 0.02, 0.42), bp, env(ctx, 0.02, 0.5, 0.06, 0.3), out);
  }
  chain(osc(ctx, 'sawtooth', 95, 80, 0.01, 0.12, 0.08), filt(ctx, 'lowpass', 500), out);
  return render(ctx);
}

// Explosion: crack, distorted sub boom, blast, rumble, debris, short echo.
async function bomb() {
  const dur = 1.4;
  const ctx = offline(dur);
  const mix = ctx.createGain();
  const clip = softClip(ctx, 2.8);
  const tone = filt(ctx, 'lowpass', 9000);
  const master = ctx.createGain();
  master.gain.value = 0.95;
  chain(mix, clip, tone, master, ctx.destination);
  const delay = ctx.createDelay(1);
  delay.delayTime.value = 0.07;
  const fb = ctx.createGain();
  fb.gain.value = 0.08;
  const dl = filt(ctx, 'lowpass', 1400);
  chain(master, delay, dl, fb, delay);
  const wet = ctx.createGain();
  wet.gain.value = 0.12;
  chain(dl, wet, ctx.destination);
  const w = whiteNoise(ctx, 2);
  const br = brownNoise(ctx, dur + 0.5);
  chain(src(ctx, w, 0, 0.12), filt(ctx, 'highpass', 700), env(ctx, 0, 1.0, 0.0008, 0.06), mix);
  {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(90, 0);
    o.frequency.exponentialRampToValueAtTime(28, 0.6);
    chain(o, env(ctx, 0, 1.1, 0.004, 0.7), mix);
    o.start(0);
    o.stop(dur);
  }
  {
    const lp = filt(ctx, 'lowpass', 5000, 0.6);
    lp.frequency.setValueAtTime(5000, 0.002);
    lp.frequency.exponentialRampToValueAtTime(260, 0.75);
    chain(src(ctx, w, 0.002, 0.8), lp, env(ctx, 0.002, 0.95, 0.002, 0.55), mix);
  }
  chain(src(ctx, br, 0.02, dur - 0.05), filt(ctx, 'lowpass', 230), flutter(ctx, 0.02, dur - 0.1, 1.1, 64, 2.6), mix);
  for (let i = 0; i < 40; i++) {
    const t = 0.08 + Math.pow(Math.random(), 1.5) * dur * 0.35;
    const d = rand(0.003, 0.014);
    chain(src(ctx, w, t, d + 0.01), filt(ctx, 'bandpass', rand(1200, 6500), rand(2, 5)), env(ctx, t, rand(0.08, 0.28) * (1 - t / dur), 0.0005, d), mix);
  }
  return render(ctx);
}

function fadeTail(buf, sec) {
  const d = buf.getChannelData(0);
  const n = Math.min(d.length, Math.floor(SR * sec));
  for (let i = 0; i < n; i++) d[d.length - n + i] *= Math.pow(1 - i / n, 2);
  return buf;
}

function normalize(buf, target) {
  const d = buf.getChannelData(0);
  let peak = 0;
  for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
  if (peak > 0) {
    const k = target / peak;
    for (let i = 0; i < d.length; i++) d[i] *= k;
  }
  return buf;
}

// The club: a crisp tock with a soft jelly squish under it.
async function putt() {
  const ctx = offline(0.3);
  const out = ctx.createGain();
  out.connect(ctx.destination);
  const w = whiteNoise(ctx, 1);
  chain(src(ctx, w, 0, 0.03), filt(ctx, 'highpass', 2200), env(ctx, 0, 0.7, 0.0006, 0.02), out);
  chain(osc(ctx, 'sine', 900, 600, 0, 0.05, 0.3), out);
  chain(osc(ctx, 'sine', 210, 90, 0, 0.12, 0.6), out);
  chain(src(ctx, w, 0.01, 0.12), filt(ctx, 'lowpass', 900, 2), env(ctx, 0.01, 0.25, 0.005, 0.09), out);
  return render(ctx);
}

// The cup: a hollow plop, then a short rattle.
async function plop() {
  const ctx = offline(0.6);
  const out = ctx.createGain();
  out.connect(ctx.destination);
  const w = whiteNoise(ctx, 1);
  chain(osc(ctx, 'sine', 620, 240, 0, 0.2, 0.7), filt(ctx, 'bandpass', 500, 2), out);
  chain(osc(ctx, 'sine', 310, 160, 0, 0.25, 0.5), out);
  for (let i = 0; i < 7; i++) {
    const t = 0.08 + i * 0.045 + Math.random() * 0.02;
    chain(src(ctx, w, t, 0.02), filt(ctx, 'bandpass', 2400 + Math.random() * 1200, 5), env(ctx, t, 0.25 * (1 - i / 8), 0.001, 0.015), out);
  }
  return render(ctx);
}

export async function bakeAll() {
  const [sp, pu, pl] = await Promise.all([splat(), putt(), plop()]);
  return {
    splash: fadeTail(normalize(sp, 0.8), 0.12),
    putt: fadeTail(normalize(pu, 0.75), 0.05),
    plop: fadeTail(normalize(pl, 0.8), 0.1),
  };
}
