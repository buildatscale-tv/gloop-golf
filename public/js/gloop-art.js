// Gloop character art: gummy-candy jelly monsters with a gumdrop shape and a goo skirt.
// The body is painted once into a cached sprite. Arms and face are drawn live, so they can move.
import { TAU, clamp } from './util.js';

const INK = '#2a1533';

// [highlight, body, shadow, juice (splats), outline]
export const GLOOP_COLORS = {
  lime: ['#f0ffb8', '#8fe03c', '#3b9a1e', '#9be24a', '#1f5a10'],
  cherry: ['#ffd6e0', '#ff4f7b', '#b0153f', '#ff3355', '#5e0820'],
  grape: ['#f2dcff', '#b066f0', '#5c22a8', '#b05cf0', '#2e0f5a'],
  berry: ['#d8f4ff', '#3fb0ff', '#1259b8', '#4fb8ff', '#0a2c62'],
};

// Look by size: small has one big eye, big has horns, the king has a crown and a mustache.
export const GLOOP_KIND = { s: 'one', m: 'two', l: 'brute', king: 'king' };

function seeded(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// Gumdrop body: dome top, little feet, wavy goo along the bottom. Center (0,0), ground at y = r.
function bodyPath(ctx, r) {
  const w = r;
  ctx.beginPath();
  ctx.moveTo(-w * 1.1, r * 0.97);
  ctx.quadraticCurveTo(-w * 0.9, r * 0.8, -w * 0.94, r * 0.35);
  ctx.bezierCurveTo(-w * 0.99, -r * 0.38, -w * 0.6, -r * 0.94, 0, -r * 0.94);
  ctx.bezierCurveTo(w * 0.6, -r * 0.94, w * 0.99, -r * 0.38, w * 0.94, r * 0.35);
  ctx.quadraticCurveTo(w * 0.9, r * 0.8, w * 1.1, r * 0.97);
  const n = 4;
  for (let i = 1; i <= n; i++) {
    const x1 = w * 1.1 - (i * 2.2 * w) / n;
    const xm = x1 + (1.1 * w) / n;
    ctx.quadraticCurveTo(xm, r * (i % 2 ? 1.05 : 0.99), x1, r * 0.97);
  }
  ctx.closePath();
}

// Jelly fill: gradient, glow from below, a darker core, bubbles, a bright edge band, and gloss.
function jelly(ctx, r, path, colors, seed) {
  const [hi, mid, lo] = colors;
  ctx.save();
  path();
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.42, r * 0.04, 0, r * 0.1, r * 1.3);
  g.addColorStop(0, hi);
  g.addColorStop(0.42, mid);
  g.addColorStop(1, lo);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.clip();
  // Light passing through the jelly pools near the bottom.
  let gg = ctx.createRadialGradient(r * 0.15, r * 0.62, 0, r * 0.15, r * 0.62, r * 0.8);
  gg.addColorStop(0, hexA(hi, 0.6));
  gg.addColorStop(1, hexA(hi, 0));
  ctx.fillStyle = gg;
  ctx.fillRect(-r * 1.5, -r * 1.5, r * 3, r * 3);
  // Darker core.
  ctx.beginPath();
  ctx.ellipse(-r * 0.05, r * 0.22, r * 0.5, r * 0.38, 0, 0, TAU);
  ctx.fillStyle = hexA(lo, 0.22);
  ctx.fill();
  // Bubbles.
  const R = seeded(seed);
  for (let i = 0; i < 6; i++) {
    const a = R() * TAU, d = 0.2 + R() * 0.55;
    const bx = Math.cos(a) * r * d, by = Math.sin(a) * r * d * 0.7 + r * 0.28;
    const br = r * (0.035 + R() * 0.05);
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bx - br * 0.35, by - br * 0.35, br * 0.35, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fill();
  }
  // Bright band along the inside of the edge (gummy candy look).
  path();
  ctx.lineWidth = r * 0.24;
  ctx.strokeStyle = hexA(hi, 0.3);
  ctx.stroke();
  // Contact shade at the bottom.
  gg = ctx.createLinearGradient(0, r * 0.62, 0, r * 1.05);
  gg.addColorStop(0, hexA(lo, 0));
  gg.addColorStop(1, hexA(lo, 0.55));
  ctx.fillStyle = gg;
  ctx.fillRect(-r * 1.5, r * 0.6, r * 3, r * 0.6);
  ctx.restore();
}

function gloss(ctx, r) {
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, -r * 0.02, r * 0.72, Math.PI * 1.12, Math.PI * 1.4);
  ctx.lineWidth = r * 0.13;
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(r * 0.2, -r * 0.7, r * 0.065, 0, TAU);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, r * 0.02, r * 0.8, Math.PI * 0.08, Math.PI * 0.3);
  ctx.lineWidth = r * 0.06;
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.stroke();
}

function outlined(ctx, r, path, colors, lw, seed) {
  path();
  ctx.lineJoin = 'round';
  ctx.lineWidth = lw * 1.4;
  ctx.strokeStyle = colors[4];
  ctx.stroke();
  jelly(ctx, r, path, colors, seed);
}

// Jelly antenna: a bendy stalk with a gummy ball on the tip.
function antenna(ctx, r, x0, x1, y1, ballR, colors, lw) {
  const [hi, mid, , , edge] = colors;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, -r * 0.8);
  ctx.quadraticCurveTo(x0 + (x1 - x0) * 0.2, (y1 - r * 0.8) * 0.55 - r * 0.1, x1, y1);
  ctx.lineWidth = r * 0.1 + lw * 1.4;
  ctx.strokeStyle = edge;
  ctx.stroke();
  ctx.lineWidth = r * 0.1;
  ctx.strokeStyle = mid;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x1, y1, ballR, 0, TAU);
  ctx.lineWidth = lw * 1.3;
  ctx.strokeStyle = edge;
  ctx.stroke();
  const g = ctx.createRadialGradient(x1 - ballR * 0.35, y1 - ballR * 0.4, 0, x1, y1, ballR);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.35, hi);
  g.addColorStop(1, mid);
  ctx.fillStyle = g;
  ctx.fill();
}

function hornPath(ctx, r, sd) {
  ctx.beginPath();
  ctx.moveTo(sd * r * 0.22, -r * 0.8);
  ctx.quadraticCurveTo(sd * r * 0.4, -r * 1.12, sd * r * 0.66, -r * 1.24);
  ctx.quadraticCurveTo(sd * r * 0.62, -r * 0.98, sd * r * 0.66, -r * 0.66);
  ctx.closePath();
}

function helmet(ctx, r, lw) {
  ctx.save();
  ctx.translate(0, -r * 0.7);
  ctx.beginPath();
  ctx.moveTo(-r * 0.7, r * 0.22);
  ctx.lineTo(-r * 0.52, -r * 0.36);
  ctx.quadraticCurveTo(0, -r * 0.46, r * 0.52, -r * 0.36);
  ctx.lineTo(r * 0.7, r * 0.22);
  ctx.quadraticCurveTo(0, r * 0.36, -r * 0.7, r * 0.22);
  ctx.closePath();
  ctx.lineWidth = lw * 1.2;
  ctx.strokeStyle = INK;
  ctx.stroke();
  const hg = ctx.createLinearGradient(-r * 0.7, 0, r * 0.7, 0);
  hg.addColorStop(0, '#6f7888');
  hg.addColorStop(0.35, '#e6ecf5');
  hg.addColorStop(0.6, '#a8b2c2');
  hg.addColorStop(1, '#58606e');
  ctx.fillStyle = hg;
  ctx.fill();
  // A dent and rivets.
  ctx.strokeStyle = 'rgba(40,46,60,0.45)';
  ctx.lineWidth = lw * 0.6;
  ctx.beginPath();
  ctx.arc(r * 0.25, -r * 0.12, r * 0.1, 0.3, 2.6);
  ctx.stroke();
  ctx.fillStyle = '#4a5160';
  for (const x of [-0.46, 0, 0.46]) {
    ctx.beginPath();
    ctx.arc(x * r, r * 0.12, r * 0.045, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function crown(ctx, r, lw) {
  ctx.save();
  ctx.translate(0, -r * 0.9);
  ctx.rotate(-0.12);
  ctx.beginPath();
  ctx.moveTo(-r * 0.48, r * 0.18);
  ctx.lineTo(-r * 0.56, -r * 0.34);
  ctx.lineTo(-r * 0.27, -r * 0.1);
  ctx.lineTo(0, -r * 0.46);
  ctx.lineTo(r * 0.27, -r * 0.1);
  ctx.lineTo(r * 0.56, -r * 0.34);
  ctx.lineTo(r * 0.48, r * 0.18);
  ctx.closePath();
  ctx.lineWidth = lw * 1.2;
  ctx.strokeStyle = INK;
  ctx.stroke();
  const cg = ctx.createLinearGradient(0, -r * 0.46, 0, r * 0.18);
  cg.addColorStop(0, '#fff6b0');
  cg.addColorStop(1, '#e09a00');
  ctx.fillStyle = cg;
  ctx.fill();
  for (const [x, y, c] of [[0, 0.02, '#ff3b6b'], [-0.3, 0.06, '#3fb0ff'], [0.3, 0.06, '#7fe03c']]) {
    ctx.beginPath();
    ctx.arc(x * r, y * r, r * 0.07, 0, TAU);
    ctx.fillStyle = c;
    ctx.fill();
  }
  for (const x of [-0.56, 0, 0.56]) {
    ctx.beginPath();
    ctx.arc(x * r, (x ? -0.34 : -0.46) * r, r * 0.06, 0, TAU);
    ctx.fillStyle = '#fff6b0';
    ctx.fill();
    ctx.lineWidth = lw * 0.6;
    ctx.stroke();
  }
  ctx.restore();
}

// Paints the static body (no face, no arms).
export function paintGloop(ctx, r, colorKey, kind, extra) {
  const colors = GLOOP_COLORS[colorKey];
  const lw = Math.max(1.2, r * 0.07);
  const seed = Math.round(r * 97) + colorKey.length * 13;
  // Soft puddle shadow on the ground.
  ctx.beginPath();
  ctx.ellipse(0, r * 0.98, r * 1.15, r * 0.14, 0, 0, TAU);
  ctx.fillStyle = 'rgba(20,10,30,0.22)';
  ctx.fill();
  if (kind === 'brute') {
    for (const sd of [-1, 1]) outlined(ctx, r, () => hornPath(ctx, r, sd), [colors[0], colors[0], colors[1], colors[3], colors[4]], lw, seed + sd);
  } else if (kind === 'one' && extra !== 'helmet') {
    antenna(ctx, r, 0, r * 0.16, -r * 1.36, r * 0.16, colors, lw);
  } else if (kind === 'two' && extra !== 'helmet') {
    antenna(ctx, r, -r * 0.2, -r * 0.42, -r * 1.26, r * 0.13, colors, lw);
    antenna(ctx, r, r * 0.2, r * 0.46, -r * 1.22, r * 0.13, colors, lw);
  }
  outlined(ctx, r, () => bodyPath(ctx, r), colors, lw, seed);
  gloss(ctx, r);
  if (extra === 'helmet') helmet(ctx, r, lw);
  else if (extra === 'crown' || kind === 'king') crown(ctx, r, lw);
}

// ---------- Live parts ----------

// pose: 'idle' | 'up' (scared) | 'wave' (laughing) | 'punch' (bashing the wall)
export function drawGloopArms(ctx, r, colorKey, pose, t) {
  const colors = GLOOP_COLORS[colorKey];
  const th = r * 0.24, L = r * 0.5;
  for (const sd of [-1, 1]) {
    let a;
    let len = L;
    if (pose === 'up') {
      a = -0.9 + Math.sin(t * 22 + sd) * 0.1;
      len = L * 1.25;
    } else if (pose === 'wave') {
      a = -1.0 + Math.sin(t * 12 + sd * 1.5) * 0.4;
      len = L * 1.25;
    }
    else if (pose === 'punch' && sd < 0) {
      a = -0.05;
      len = L * (1.25 + Math.max(0, Math.sin(t * 16)) * 0.35);
    } else a = 0.65 + Math.sin(t * 3 + sd) * 0.14;
    const ang = sd > 0 ? a : Math.PI - a;
    ctx.save();
    ctx.translate(sd * r * 0.8, r * 0.26);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.roundRect(0, -th / 2, len, th, th / 2);
    ctx.fillStyle = colors[1];
    ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.06);
    ctx.strokeStyle = colors[4];
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(len, 0, th * 0.72, 0, TAU);
    const hg = ctx.createRadialGradient(len - th * 0.25, -th * 0.25, 0, len, 0, th * 0.75);
    hg.addColorStop(0, colors[0]);
    hg.addColorStop(1, colors[1]);
    ctx.fillStyle = hg;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

const EYES = {
  one: [{ x: 0, y: -0.2, r: 0.37 }],
  two: [{ x: -0.31, y: -0.16, r: 0.25 }, { x: 0.3, y: -0.19, r: 0.22 }],
  brute: [{ x: -0.32, y: -0.1, r: 0.2 }, { x: 0.32, y: -0.1, r: 0.2 }],
  king: [{ x: -0.3, y: -0.16, r: 0.23 }, { x: 0.3, y: -0.16, r: 0.23 }],
};

function eye(ctx, e, r, o, colors) {
  const ex = e.x * r, ey = e.y * r;
  const scared = o.mood === 'scared';
  const er = e.r * r * (scared ? 1.12 : 1);
  const lw = Math.max(1, r * 0.05);
  if (o.mood === 'happy') {
    // Laughing: squeezed shut, like ^ ^.
    ctx.beginPath();
    ctx.arc(ex, ey + er * 0.35, er * 0.75, Math.PI * 1.15, Math.PI * 1.85);
    ctx.lineWidth = Math.max(1.5, er * 0.32);
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK;
    ctx.stroke();
    return;
  }
  ctx.save();
  ctx.translate(ex, ey);
  ctx.beginPath();
  ctx.arc(0, 0, er, 0, TAU);
  const sg = ctx.createRadialGradient(-er * 0.3, -er * 0.3, 0, 0, 0, er);
  sg.addColorStop(0, '#ffffff');
  sg.addColorStop(1, '#dfe6ef');
  ctx.fillStyle = sg;
  ctx.fill();
  ctx.save();
  ctx.clip();
  const lx = clamp(o.look.x, -1, 1) * er * 0.34, ly = clamp(o.look.y, -1, 1) * er * 0.34;
  if (o.mood === 'dizzy') {
    // Spiral eyes.
    ctx.beginPath();
    for (let k = 0; k <= 28; k++) {
      const a = k * 0.55 + o.t * 6, d = (k / 28) * er * 0.75;
      const px = Math.cos(a) * d, py = Math.sin(a) * d;
      k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.lineWidth = Math.max(1, er * 0.14);
    ctx.strokeStyle = INK;
    ctx.stroke();
  } else {
    const ir = er * (scared ? 0.42 : 0.62);
    ctx.beginPath();
    ctx.arc(lx, ly, ir, 0, TAU);
    ctx.fillStyle = '#ffc21a';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(lx, ly, ir * 0.55, 0, TAU);
    ctx.fillStyle = INK;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(lx - ir * 0.35, ly - ir * 0.38, ir * 0.24, 0, TAU);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }
  // Eyelid: sly and sour by default, closed on a blink.
  if (o.blink || (!scared && o.mood !== 'dizzy')) {
    // The lid dips toward the middle of the face (a sly look). dir > 0: right end lower.
    const dir = e.x < 0 ? 1 : e.x > 0 ? -1 : 0.4;
    let yA, yB;
    if (o.blink) yA = yB = er * 0.15;
    else {
      const tilt = er * 0.32;
      const base = -er * 0.28;
      yA = base - tilt * dir;
      yB = base + tilt * dir;
    }
    ctx.beginPath();
    ctx.moveTo(-er * 1.2, -er * 1.3);
    ctx.lineTo(er * 1.2, -er * 1.3);
    ctx.lineTo(er * 1.2, yB);
    ctx.lineTo(-er * 1.2, yA);
    ctx.closePath();
    ctx.fillStyle = colors[1];
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-er * 1.2, yA);
    ctx.lineTo(er * 1.2, yB);
    ctx.lineWidth = Math.max(1.2, r * 0.07);
    ctx.strokeStyle = INK;
    ctx.stroke();
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(0, 0, er, 0, TAU);
  ctx.lineWidth = lw;
  ctx.strokeStyle = INK;
  ctx.stroke();
  if (scared) {
    // Raised worried brow.
    ctx.beginPath();
    ctx.arc(0, -er * 0.4, er * 1.05, Math.PI * 1.25, Math.PI * 1.75);
    ctx.lineWidth = Math.max(1.2, r * 0.06);
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  ctx.restore();
}

function mouth(ctx, r, o) {
  const k = o.kind === 'one' ? 0.72 : 1;
  const my = (o.kind === 'one' ? 0.4 : 0.36) * r;
  const lw = Math.max(1.2, r * 0.06);
  ctx.save();
  ctx.translate(0, my);
  ctx.scale(k, k);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = lw / k;
  if (o.mood === 'scared') {
    ctx.beginPath();
    ctx.ellipse(0, r * 0.06, r * 0.14, r * 0.17, 0, 0, TAU);
    ctx.fillStyle = '#3a0f2a';
    ctx.fill();
    ctx.stroke();
  } else if (o.mood === 'happy') {
    ctx.beginPath();
    ctx.moveTo(-r * 0.32, -r * 0.08);
    ctx.quadraticCurveTo(0, r * 0.5, r * 0.32, -r * 0.08);
    ctx.closePath();
    ctx.fillStyle = '#3a0f2a';
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.beginPath();
    ctx.ellipse(r * 0.04, r * 0.2, r * 0.16, r * 0.1, 0, 0, TAU);
    ctx.fillStyle = '#ff6f9a';
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(-r * 0.24, -r * 0.1, r * 0.48, r * 0.07);
    ctx.restore();
    ctx.stroke();
  } else if (o.mood === 'dizzy') {
    ctx.beginPath();
    for (let i = 0; i <= 12; i++) {
      const x = -r * 0.26 + (i / 12) * r * 0.52;
      const y = Math.sin(i * 1.3 + o.t * 8) * r * 0.05;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
  } else {
    // Crooked, cheeky grin.
    ctx.beginPath();
    ctx.moveTo(-r * 0.34, -r * 0.06);
    ctx.quadraticCurveTo(0, r * 0.28, r * 0.38, -r * 0.12);
    ctx.quadraticCurveTo(r * 0.04, r * 0.07, -r * 0.34, -r * 0.06);
    ctx.closePath();
    ctx.fillStyle = '#3a0f2a';
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.lineWidth = Math.max(0.8, lw * 0.6) / k;
    if (o.kind === 'brute') {
      // Two fangs pointing up from the lower lip.
      for (const [x, y] of [[-0.17, 0.07], [0.17, 0.05]]) {
        ctx.beginPath();
        ctx.moveTo((x - 0.06) * r, (y + 0.06) * r);
        ctx.lineTo(x * r, (y - 0.12) * r);
        ctx.lineTo((x + 0.06) * r, (y + 0.05) * r);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    } else {
      // One snaggle tooth.
      ctx.beginPath();
      ctx.moveTo(r * 0.05, -r * 0.005);
      ctx.lineTo(r * 0.17, -r * 0.035);
      ctx.lineTo(r * 0.13, r * 0.09);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
}

function mustache(ctx, r) {
  ctx.save();
  ctx.translate(0, r * 0.2);
  ctx.fillStyle = '#4a2a18';
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, r * 0.04);
  for (const sd of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.02);
    ctx.bezierCurveTo(sd * r * 0.18, -r * 0.14, sd * r * 0.36, -r * 0.08, sd * r * 0.42, -r * 0.2);
    ctx.bezierCurveTo(sd * r * 0.5, -r * 0.1, sd * r * 0.4, r * 0.06, sd * r * 0.22, r * 0.04);
    ctx.quadraticCurveTo(sd * r * 0.08, r * 0.03, 0, r * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

// o: { look: {x, y}, mood: 'sour'|'scared'|'dizzy'|'happy', blink, kind, color, t }
export function drawGloopFace(ctx, r, o) {
  const colors = GLOOP_COLORS[o.color || 'lime'];
  const kind = o.kind || 'two';
  const opts = { look: o.look || { x: 0.3, y: 0 }, mood: o.mood || 'sour', blink: !!o.blink, kind, t: o.t || 0 };
  // Cheeks.
  if (kind !== 'one') {
    ctx.fillStyle = 'rgba(255,120,150,0.3)';
    for (const sd of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(sd * r * 0.56, r * 0.16, r * 0.13, r * 0.08, 0, 0, TAU);
      ctx.fill();
    }
  }
  for (const e of EYES[kind]) eye(ctx, e, r, opts, colors);
  if (kind === 'brute' && opts.mood !== 'happy') {
    // Heavy brow over both eyes.
    ctx.beginPath();
    ctx.moveTo(-r * 0.6, -r * 0.42);
    ctx.quadraticCurveTo(-r * 0.2, -r * 0.22, 0, -r * 0.3);
    ctx.quadraticCurveTo(r * 0.2, -r * 0.22, r * 0.6, -r * 0.42);
    ctx.lineWidth = Math.max(2, r * 0.13);
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK;
    ctx.stroke();
  }
  mouth(ctx, r, opts);
  if (kind === 'king') mustache(ctx, r);
}
