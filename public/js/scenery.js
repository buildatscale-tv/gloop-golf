// Theme art and the new obstacles: background decorations (beach, candy, frost), boost
// pads, portals, conveyor belts, posts, styled bumpers, and spinners. Each function takes
// the View (v) for the camera: v.P(x, y, z) to screen, v.s px per meter, v.k and v.hz the
// cos and sin of the tilt.
import { TAU } from './util.js';
import { BOOST_W, BOOST_H, PORTAL_R, BALL_R } from './golf.js';
import { PORTAL_COLORS } from './themes.js';

const INK = '#2a1533';
const SHADOW = 'rgba(16,40,8,0.3)';

export function seeded(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function bbox(poly) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of poly) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  return [x0, y0, x1, y1];
}

function blob(ctx, x, y, rx, ry, fill) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fillStyle = fill;
  ctx.fill();
}

// An upright cylinder (or cone piece) on the ground: the side facing the camera, then the
// top. r0 at z0 and r1 at z1.
export function cylinder(v, ctx, x, y, r0, r1, z0, z1, side, top, stroke = true) {
  const s = v.s, k = v.k;
  const [bx, by] = v.P(x, y, z0), [tx, ty] = v.P(x, y, z1);
  ctx.beginPath();
  ctx.ellipse(bx, by, r0 * s, r0 * s * k, 0, 0, Math.PI);
  ctx.lineTo(tx - r1 * s, ty);
  ctx.ellipse(tx, ty, r1 * s, r1 * s * k, 0, Math.PI, 0, true);
  ctx.closePath();
  ctx.fillStyle = side;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }
  if (top) {
    ctx.beginPath();
    ctx.ellipse(tx, ty, r1 * s, r1 * s * k, 0, 0, TAU);
    ctx.fillStyle = top;
    ctx.fill();
    if (stroke) ctx.stroke();
  }
}

// ---------- Backgrounds ----------

export function decorate(v, ctx, W, H, hole, T, away) {
  const R = seeded(11);
  if (T.decor === 'beach') beachDecor(v, ctx, W, H, T, R, away);
  else if (T.decor === 'candy') candyDecor(v, ctx, W, H, T, R, away);
  else if (T.decor === 'frost') frostDecor(v, ctx, W, H, T, R, away);
}

function scatter(R, W, H, n, away, m) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const x = R() * W, y = R() * H;
    if (away(x, y, m)) out.push({ x, y, r: R() });
  }
  return out;
}

function beachDecor(v, ctx, W, H, T, R, away) {
  const s = v.s;
  // Sand grain.
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = R() < 0.5 ? 'rgba(160,110,40,0.18)' : 'rgba(255,255,255,0.35)';
    ctx.fillRect(R() * W, R() * H, 2, 2);
  }
  // The sea along the top, with foam.
  const seaH = Math.min(H * 0.14, 90);
  const g = ctx.createLinearGradient(0, 0, 0, seaH);
  g.addColorStop(0, '#1d8fd6');
  g.addColorStop(1, '#5fd4f5');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(W, 0);
  ctx.lineTo(W, seaH);
  for (let x = W; x >= 0; x -= 20) ctx.lineTo(x, seaH + Math.sin(x * 0.05) * 6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 20) ctx.lineTo(x, seaH + Math.sin(x * 0.05) * 6);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 14; i++) {
    const x = R() * W, y = R() * seaH * 0.8;
    ctx.beginPath();
    ctx.moveTo(x - 12, y);
    ctx.quadraticCurveTo(x, y - 5, x + 12, y);
    ctx.stroke();
  }
  // Shells and starfish.
  for (const p of scatter(R, W, H, 70, away, 10)) {
    if (p.y < seaH + 10) continue;
    if (p.r < 0.5) starfish(ctx, p.x, p.y, 9 + p.r * 12, p.r < 0.25 ? '#ff8a5c' : '#ff6f91', R() * TAU);
    else shell(ctx, p.x, p.y, 8 + (p.r - 0.5) * 12, R() * TAU);
  }
  // Palm trees.
  const palms = [];
  for (let i = 0; i < 60; i++) {
    const x = (R() * 1.1 - 0.05) * W, y = seaH + s * 0.6 + R() * (H - seaH);
    if (away(x, y, s * 0.9)) palms.push({ x, y, r: R() });
  }
  palms.sort((a, b) => a.y - b.y);
  for (const p of palms.slice(0, 9)) palm(v, ctx, p.x, p.y, s * (0.9 + p.r * 0.5), R);
}

function starfish(ctx, x, y, r, col, a) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r, t = a + (i / 10) * TAU;
    ctx.lineTo(x + Math.cos(t) * rr, y + Math.sin(t) * rr * 0.75);
  }
  ctx.closePath();
  ctx.fillStyle = col;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(120,40,20,0.5)';
  ctx.stroke();
}

function shell(ctx, x, y, r, a) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.beginPath();
  ctx.moveTo(0, r * 0.6);
  ctx.arc(0, 0, r, Math.PI * 1.05, Math.PI * 1.95);
  ctx.closePath();
  ctx.fillStyle = '#fff3e6';
  ctx.fill();
  ctx.strokeStyle = 'rgba(200,120,90,0.7)';
  ctx.lineWidth = 1;
  ctx.stroke();
  for (let i = 1; i < 5; i++) {
    const t = Math.PI * (1.05 + i * 0.18);
    ctx.beginPath();
    ctx.moveTo(0, r * 0.6);
    ctx.lineTo(Math.cos(t) * r, Math.sin(t) * r);
    ctx.stroke();
  }
  ctx.restore();
}

function palm(v, ctx, x, y, r, R) {
  const lift = r * 2.2 * (v.tilt ? 1 : 0.2);
  const lean = (R() - 0.5) * r * 0.8;
  const cx = x + lean, cy = y - lift;
  const angles = Array.from({ length: 7 }, (_, i) => (i / 7) * TAU + R() * 0.4);
  const fronds = (ox, oy, fill, line) => {
    angles.forEach((a, i) => {
      const bx = cx + ox, by = cy + oy;
      const ex = bx + Math.cos(a) * r * 1.15, ey = by + Math.sin(a) * r * 0.7 + r * 0.25;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + Math.cos(a) * r * 0.6, by + Math.sin(a) * r * 0.35 - r * 0.35, ex, ey);
      ctx.quadraticCurveTo(bx + Math.cos(a) * r * 0.5, by + Math.sin(a) * r * 0.3 - r * 0.05, bx, by);
      ctx.fillStyle = fill(i);
      ctx.fill();
      if (line) {
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = line;
        ctx.stroke();
      }
    });
  };
  // Shadow: the trunk and the crown thrown down and to the right.
  const sx = lift * 0.55, sy = lift * 0.95;
  ctx.strokeStyle = 'rgba(80,50,10,0.16)';
  ctx.lineWidth = r * 0.22;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(cx + sx, cy + sy);
  ctx.stroke();
  fronds(sx, sy, () => 'rgba(80,50,10,0.14)', null);
  // Trunk: one tapered, curved stem with rings.
  const at = (t) => [x + lean * t * t, y - lift * t];
  for (let i = 0; i < 10; i++) {
    const [ax, ay] = at(i / 10), [bx, by] = at((i + 1) / 10);
    ctx.strokeStyle = i % 2 ? '#a77a4a' : '#916639';
    ctx.lineWidth = r * 0.3 * (1 - (i / 10) * 0.35);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  }
  fronds(0, 0, (i) => (i % 2 ? '#3fae4a' : '#2f9440'), 'rgba(20,60,20,0.6)');
  for (let i = 0; i < 3; i++) blob(ctx, cx + (i - 1) * r * 0.14, cy + r * 0.12, r * 0.11, r * 0.11, '#7a4a22');
}

function candyDecor(v, ctx, W, H, T, R, away) {
  const s = v.s;
  // Sprinkles everywhere.
  const cols = ['#ff5c8a', '#ffcf24', '#3fd99a', '#8a7dff', '#4fc3ff', '#ffffff'];
  ctx.lineCap = 'round';
  ctx.lineWidth = 3;
  for (const p of scatter(R, W, H, 320, away, 6)) {
    const a = R() * TAU;
    ctx.strokeStyle = cols[Math.floor(R() * cols.length)];
    ctx.beginPath();
    ctx.moveTo(p.x - Math.cos(a) * 4, p.y - Math.sin(a) * 4);
    ctx.lineTo(p.x + Math.cos(a) * 4, p.y + Math.sin(a) * 4);
    ctx.stroke();
  }
  // Wrapped candies and gumdrops on the ground, lollipops standing up.
  const items = scatter(R, W, H, 60, away, s * 1.4);
  items.sort((a, b) => a.y - b.y);
  let n = 0;
  for (const p of items) {
    if (n++ > 16) break;
    const kind = Math.floor(p.r * 3);
    if (kind === 0) wrapped(ctx, p.x, p.y, s * 0.45, cols[n % 5], R() * TAU);
    else if (kind === 1) gumdrop(ctx, p.x, p.y, s * 0.4, T.gumdrops[n % 5]);
    else lollipop(v, ctx, p.x, p.y, s * (0.55 + R() * 0.3), cols[n % 5]);
  }
}

function wrapped(ctx, x, y, r, col, a) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.fillStyle = col;
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(sx * r * 0.8, 0);
    ctx.lineTo(sx * r * 1.5, -r * 0.45);
    ctx.lineTo(sx * r * 1.5, r * 0.45);
    ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.62, 0, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = r * 0.18;
  ctx.beginPath();
  ctx.moveTo(-r * 0.4, -r * 0.5);
  ctx.lineTo(r * 0.1, r * 0.55);
  ctx.stroke();
  ctx.restore();
}

function gumdrop(ctx, x, y, r, col) {
  blob(ctx, x + r * 0.3, y + r * 0.3, r, r * 0.55, SHADOW);
  ctx.beginPath();
  ctx.moveTo(x - r, y);
  ctx.quadraticCurveTo(x - r, y - r * 1.4, x, y - r * 1.4);
  ctx.quadraticCurveTo(x + r, y - r * 1.4, x + r, y);
  ctx.ellipse(x, y, r, r * 0.45, 0, 0, Math.PI);
  const g = ctx.createLinearGradient(x - r, y - r, x + r, y);
  g.addColorStop(0, col[0]);
  g.addColorStop(0.5, col[1]);
  g.addColorStop(1, col[2]);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (let i = 0; i < 6; i++) ctx.fillRect(x - r * 0.6 + ((i * 37) % 10) * r * 0.12, y - r * 1.1 + ((i * 53) % 9) * r * 0.11, 2, 2);
}

function lollipop(v, ctx, x, y, r, col) {
  const lift = r * 1.6 * (v.tilt ? 1 : 0.3);
  blob(ctx, x + r * 0.7, y + r * 0.2, r * 0.8, r * 0.35, SHADOW);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = Math.max(2, r * 0.14);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - lift);
  ctx.stroke();
  swirlDisc(ctx, x, y - lift - r * 0.55, r * 0.6, col);
}

export function swirlDisc(ctx, x, y, r, col) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = col;
  ctx.lineWidth = r * 0.28;
  ctx.beginPath();
  for (let t = 0; t < TAU * 2.6; t += 0.2) {
    const rr = (t / (TAU * 2.6)) * r;
    ctx.lineTo(x + Math.cos(t) * rr, y + Math.sin(t) * rr);
  }
  ctx.stroke();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x - r * 0.35, y - r * 0.4, r * 0.25, r * 0.13, -0.6, 0, TAU);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fill();
}

function frostDecor(v, ctx, W, H, T, R, away) {
  const s = v.s;
  // Soft snow drifts and sparkles.
  for (let i = 0; i < 18; i++) blob(ctx, R() * W, R() * H, s * (1 + R() * 2), s * (0.4 + R() * 0.6), 'rgba(170,205,235,0.18)');
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = R() < 0.6 ? 'rgba(255,255,255,0.9)' : 'rgba(140,190,230,0.45)';
    ctx.fillRect(R() * W, R() * H, 2, 2);
  }
  const trees = scatter(R, W, H, 50, away, s * 1.3);
  trees.sort((a, b) => a.y - b.y);
  let n = 0;
  for (const p of trees) {
    if (n++ > 14) break;
    if (p.r < 0.2) snowRock(ctx, p.x, p.y, s * 0.5);
    else pine(v, ctx, p.x, p.y, s * (0.7 + p.r * 0.6));
  }
}

function pine(v, ctx, x, y, r) {
  const lift = v.tilt ? 1 : 0.35;
  blob(ctx, x + r * 0.8, y + r * 0.25, r * 1.1, r * 0.4, 'rgba(40,80,120,0.25)');
  ctx.fillStyle = '#6d4a2e';
  ctx.fillRect(x - r * 0.1, y - r * 0.5 * lift, r * 0.2, r * 0.5 * lift);
  for (let i = 0; i < 3; i++) {
    const w = r * (0.95 - i * 0.24), base = y - r * (0.35 + i * 0.6) * lift, top = base - r * 0.95 * lift;
    ctx.beginPath();
    ctx.moveTo(x - w, base);
    ctx.lineTo(x, top);
    ctx.lineTo(x + w, base);
    ctx.closePath();
    ctx.fillStyle = i % 2 ? '#2f8f5e' : '#24774d';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = INK;
    ctx.stroke();
    // Snow on the branches.
    ctx.beginPath();
    ctx.moveTo(x - w * 0.55, base - (base - top) * 0.45);
    ctx.lineTo(x, top);
    ctx.lineTo(x + w * 0.55, base - (base - top) * 0.45);
    ctx.quadraticCurveTo(x, base - (base - top) * 0.3, x - w * 0.55, base - (base - top) * 0.45);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }
}

function snowRock(ctx, x, y, r) {
  blob(ctx, x + r * 0.3, y + r * 0.2, r, r * 0.45, 'rgba(40,80,120,0.25)');
  blob(ctx, x, y, r, r * 0.6, '#8d97a6');
  blob(ctx, x, y - r * 0.2, r * 0.85, r * 0.4, '#ffffff');
}

// ---------- Ground obstacles ----------

// Conveyor belt: dark rubber with ribs and arrows that move with the belt.
export function belt(v, ctx, b, time) {
  const [x0, y0, x1, y1] = bbox(b.poly);
  const alongX = Math.abs(b.dir[0]) > 0.5, sgn = alongX ? Math.sign(b.dir[0]) : Math.sign(b.dir[1]);
  const [a0, a1, c0, c1] = alongX ? [x0, x1, y0, y1] : [y0, y1, x0, x1];
  const W = (a, c, z = 0) => (alongX ? v.P(a, c, z) : v.P(c, a, z));
  v.path(ctx, b.poly);
  ctx.fillStyle = '#45414f';
  ctx.fill();
  ctx.save();
  ctx.clip();
  const off = (((time * b.speed * sgn) % 0.5) + 0.5) % 0.5;
  ctx.strokeStyle = 'rgba(255,255,255,0.13)';
  ctx.lineWidth = Math.max(1.5, v.s * 0.06);
  for (let a = a0 - 0.5 + off; a < a1 + 0.5; a += 0.5) {
    ctx.beginPath();
    ctx.moveTo(...W(a, c0));
    ctx.lineTo(...W(a, c1));
    ctx.stroke();
  }
  const offA = (((time * b.speed * sgn) % 1.3) + 1.3) % 1.3;
  ctx.strokeStyle = 'rgba(255,214,90,0.9)';
  ctx.lineWidth = Math.max(2.5, v.s * 0.11);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const w = Math.min(0.55, (c1 - c0) * 0.25);
  for (let row = 0; row < Math.max(1, Math.round((c1 - c0) / 2.2)); row++) {
    const n = Math.max(1, Math.round((c1 - c0) / 2.2));
    const c = c0 + ((row + 0.5) / n) * (c1 - c0);
    for (let a = a0 - 1.3 + offA; a < a1 + 1.3; a += 1.3) {
      ctx.beginPath();
      ctx.moveTo(...W(a - 0.3 * sgn, c - w));
      ctx.lineTo(...W(a, c));
      ctx.lineTo(...W(a - 0.3 * sgn, c + w));
      ctx.stroke();
    }
  }
  ctx.restore();
  // Metal side rails, and rollers at the ends.
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#d6dae3';
  ctx.lineWidth = Math.max(2, v.s * 0.09);
  for (const c of [c0, c1]) {
    ctx.beginPath();
    ctx.moveTo(...W(a0, c));
    ctx.lineTo(...W(a1, c));
    ctx.stroke();
  }
  ctx.strokeStyle = '#8c91a2';
  ctx.lineWidth = Math.max(3, v.s * 0.14);
  for (const a of [a0, a1]) {
    ctx.beginPath();
    ctx.moveTo(...W(a, c0));
    ctx.lineTo(...W(a, c1));
    ctx.stroke();
  }
}

// Boost pad: a glowing plate with arrows that light up one after another.
export function boost(v, ctx, [x, y, deg], time) {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  const at = (lx, ly) => v.P(x + c * lx - s * ly, y + s * lx + c * ly);
  const hw = BOOST_W / 2, hh = BOOST_H / 2, rr = 0.18;
  ctx.beginPath();
  const pts = [];
  for (const [cx, cy, a0] of [[hw - rr, -hh + rr, -Math.PI / 2], [hw - rr, hh - rr, 0], [-hw + rr, hh - rr, Math.PI / 2], [-hw + rr, -hh + rr, Math.PI]]) {
    for (let t = 0; t <= 4; t++) {
      const q = a0 + (t / 4) * (Math.PI / 2);
      pts.push(at(cx + Math.cos(q) * rr, cy + Math.sin(q) * rr));
    }
  }
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.closePath();
  const [g0x, g0y] = at(-hw, 0), [g1x, g1y] = at(hw, 0);
  const g = ctx.createLinearGradient(g0x, g0y, g1x, g1y);
  g.addColorStop(0, '#ff7a1a');
  g.addColorStop(1, '#ffd23f');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#fff6d8';
  ctx.stroke();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2.5, v.s * 0.1);
  const phase = (time * 2.2) % 1;
  for (let i = 0; i < 3; i++) {
    const lx = -0.45 + i * 0.42;
    const lit = (phase * 3 - i + 3) % 3;
    ctx.strokeStyle = `rgba(255,255,255,${lit < 1 ? 1 : 0.45})`;
    ctx.beginPath();
    ctx.moveTo(...at(lx - 0.18, -0.3));
    ctx.lineTo(...at(lx + 0.12, 0));
    ctx.lineTo(...at(lx - 0.18, 0.3));
    ctx.stroke();
  }
}

// Portal: a swirling ring on the ground. Both ends of a pair have the same color.
export function portal(v, ctx, x, y, pair, time, side) {
  const [light, deep] = PORTAL_COLORS[pair % PORTAL_COLORS.length];
  const [cx, cy] = v.P(x, y);
  const R = PORTAL_R * v.s, k = v.k;
  // Soft glow around the ring, pulsing.
  const pulse = 1.45 + 0.12 * Math.sin(time * 4 + side * 2);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, k);
  const halo = ctx.createRadialGradient(0, 0, R * 0.9, 0, 0, R * pulse);
  halo.addColorStop(0, light);
  halo.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.globalAlpha = 0.65;
  ctx.beginPath();
  ctx.arc(0, 0, R * pulse, 0, TAU);
  ctx.fillStyle = halo;
  ctx.fill();
  ctx.restore();
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
  g.addColorStop(0, '#1a0d33');
  g.addColorStop(0.6, deep);
  g.addColorStop(1, light);
  ctx.beginPath();
  ctx.ellipse(cx, cy, R, R * k, 0, 0, TAU);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = Math.max(3, v.s * 0.1);
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.lineWidth = Math.max(1.5, v.s * 0.04);
  ctx.strokeStyle = deep;
  ctx.beginPath();
  ctx.ellipse(cx, cy, R * 1.08, R * 1.08 * k, 0, 0, TAU);
  ctx.stroke();
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1.5, v.s * 0.05);
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  const spin = time * (side ? -2.4 : 2.4);
  for (let i = 0; i < 3; i++) {
    const rr = R * (0.35 + i * 0.18);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rr, rr * k, 0, spin + i * 2.1, spin + i * 2.1 + 1.6);
    ctx.stroke();
  }
  // Sparkles that float up.
  for (let i = 0; i < 5; i++) {
    const t = (time * 0.6 + i / 5) % 1, a = i * 1.3 + time;
    const [px, py] = v.P(x + Math.cos(a) * PORTAL_R * 0.7, y + Math.sin(a) * PORTAL_R * 0.7, t * 0.9);
    ctx.globalAlpha = 1 - t;
    blob(ctx, px, py, Math.max(1.5, v.s * 0.05), Math.max(1.5, v.s * 0.05), light);
  }
  ctx.globalAlpha = 1;
}

// ---------- Posts ----------

// Snowman: a ball that is round where the Gloop ball touches it (at ball height).
export function snowmanR(r) {
  return (r * r + BALL_R * BALL_R) / (2 * BALL_R);
}

export function postHeight(T, b) {
  if (T.post === 'lighthouse') return 3.9;
  if (T.post === 'lollipop') return 2.4;
  if (T.post === 'snowman') return snowmanR(b.r) * 3.6;
  return 0.9;
}

export function post(v, ctx, b, T, time) {
  const s = v.s, { x, y, r } = b;
  if (T.post === 'lighthouse') {
    const H = 2.8;
    for (let i = 0; i < 6; i++) {
      const z0 = (i / 6) * H, z1 = ((i + 1) / 6) * H;
      const r0 = r * (1 - 0.25 * (z0 / H)), r1 = r * (1 - 0.25 * (z1 / H));
      cylinder(v, ctx, x, y, r0, r1, z0, z1, i % 2 ? '#ffffff' : '#ff4d4d', null, false);
    }
    cylinder(v, ctx, x, y, r, r * 0.75, 0, H, 'rgba(0,0,0,0)', null, true);
    cylinder(v, ctx, x, y, r * 0.95, r * 0.95, H, H + 0.12, '#3a3a48', '#55556a');
    const glow = 0.75 + 0.25 * Math.sin(time * 3);
    cylinder(v, ctx, x, y, r * 0.55, r * 0.55, H + 0.12, H + 0.62, `rgba(255,226,110,${glow})`, null);
    cylinder(v, ctx, x, y, r * 0.62, 0.02, H + 0.62, H + 1.1, '#ff4d4d', null);
    return;
  }
  if (T.post === 'lollipop') {
    cylinder(v, ctx, x, y, r, r, 0, 1.5, '#ffffff', '#ffeef5');
    // Pink spiral on the stick.
    ctx.save();
    ctx.strokeStyle = '#ff5c8a';
    ctx.lineWidth = Math.max(2, s * 0.08);
    for (let z = 0.15; z < 1.5; z += 0.35) {
      ctx.beginPath();
      const [ax, ay] = v.P(x - r * 0.95, y + r * 0.3, z), [bx, by] = v.P(x + r * 0.95, y + r * 0.3, z + 0.2);
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }
    ctx.restore();
    const [dx, dy] = v.P(x, y, 1.5 + 0.75);
    swirlDisc(ctx, dx, dy, 0.8 * s, ['#ff5c8a', '#8a7dff', '#3fd99a', '#ffcf24'][Math.round(x + y) % 4]);
    return;
  }
  if (T.post === 'snowman') {
    const R0 = snowmanR(r), R1 = R0 * 0.72, R2 = R0 * 0.52;
    const z1 = R0 * 2 + R1 * 0.75, z2 = z1 + R1 + R2 * 0.7;
    const ball = (z, rr) => {
      const [cx, cy] = v.P(x, y, z);
      ctx.beginPath();
      ctx.arc(cx, cy, rr * s, 0, TAU);
      const g = ctx.createRadialGradient(cx - rr * s * 0.35, cy - rr * s * 0.4, 0, cx, cy, rr * s);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(1, '#bcd6ee');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = INK;
      ctx.stroke();
      return [cx, cy];
    };
    ball(R0, R0);
    const [mx, my] = ball(z1, R1);
    for (let i = 0; i < 3; i++) blob(ctx, mx, my - R1 * s * 0.5 + i * R1 * s * 0.4, s * 0.05, s * 0.05, INK);
    const [hx, hy] = ball(z2, R2);
    // Scarf, face, carrot, hat.
    ctx.strokeStyle = '#ff4d4d';
    ctx.lineWidth = Math.max(3, s * 0.12);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.ellipse(hx, hy + R2 * s * 0.85, R2 * s * 0.85, R2 * s * 0.25, 0, 0.2, Math.PI - 0.2);
    ctx.stroke();
    blob(ctx, hx - R2 * s * 0.32, hy - R2 * s * 0.15, s * 0.045, s * 0.045, INK);
    blob(ctx, hx + R2 * s * 0.32, hy - R2 * s * 0.15, s * 0.045, s * 0.045, INK);
    ctx.beginPath();
    ctx.moveTo(hx, hy - R2 * s * 0.08);
    ctx.lineTo(hx + R2 * s * 0.75, hy + R2 * s * 0.1);
    ctx.lineTo(hx, hy + R2 * s * 0.12);
    ctx.closePath();
    ctx.fillStyle = '#ff8a1a';
    ctx.fill();
    const [tx, ty] = v.P(x, y, z2 + R2 * 0.85);
    ctx.fillStyle = '#2a2a38';
    ctx.fillRect(tx - R2 * s * 0.75, ty - s * 0.04, R2 * s * 1.5, s * 0.08);
    ctx.fillRect(tx - R2 * s * 0.45, ty - R2 * s * 0.8, R2 * s * 0.9, R2 * s * 0.8);
    return;
  }
  cylinder(v, ctx, x, y, r, r, 0, 0.9, '#9aa0ad', '#c9ced8');
}

// ---------- Styled bumpers ----------

export function styledBumper(v, ctx, b, T, time, idx) {
  const s = v.s, h = 0.5;
  const wob = 1 + Math.sin(time * 22) * Math.min(1, b.data.wob || 0) * 0.18;
  const r = b.r * wob;
  const style = T.bumperStyle;
  const col = style === 'gumdrop' ? T.gumdrops[idx % T.gumdrops.length] : T.bumper;
  const g = ctx.createLinearGradient(...v.P(b.x - r, b.y), ...v.P(b.x + r, b.y));
  g.addColorStop(0, col[1]);
  g.addColorStop(1, col[2]);
  if (style === 'gumdrop') {
    cylinder(v, ctx, b.x, b.y, r, r * 0.92, 0, h * 0.7, g, null);
    // Dome top.
    const [tx, ty] = v.P(b.x, b.y, h * 0.7), [ax, ay] = v.P(b.x, b.y, h * 1.5);
    ctx.beginPath();
    ctx.moveTo(tx - r * 0.92 * s, ty);
    ctx.quadraticCurveTo(tx - r * 0.92 * s, ay, tx, ay);
    ctx.quadraticCurveTo(tx + r * 0.92 * s, ay, tx + r * 0.92 * s, ty);
    ctx.ellipse(tx, ty, r * 0.92 * s, r * 0.92 * s * v.k, 0, 0, Math.PI);
    const dg = ctx.createRadialGradient(tx - r * s * 0.3, ay + r * s * 0.2, 0, tx, ty, r * s * 1.2);
    dg.addColorStop(0, col[0]);
    dg.addColorStop(1, col[1]);
    ctx.fillStyle = dg;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const R = seeded(idx + 7);
    for (let i = 0; i < 9; i++) ctx.fillRect(tx + (R() - 0.5) * r * s * 1.4, ty + (R() - 0.85) * r * s * 0.9, 2, 2);
    return;
  }
  cylinder(v, ctx, b.x, b.y, r, r, 0, h, g, null);
  const [tx, ty] = v.P(b.x, b.y, h);
  const rx = r * s, ry = r * s * v.k;
  if (style === 'beachball') {
    const wedges = ['#ff4d4d', '#ffffff', '#ffd23f', '#ffffff', '#3fa9ff', '#ffffff'];
    const turn = (b.data.wob || 0) * 0.6 + idx;
    wedges.forEach((c, i) => {
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.ellipse(tx, ty, rx, ry, 0, turn + (i / 6) * TAU, turn + ((i + 1) / 6) * TAU);
      ctx.closePath();
      ctx.fillStyle = c;
      ctx.fill();
    });
    blob(ctx, tx, ty, rx * 0.18, ry * 0.18, '#ffffff');
  } else {
    const tg = ctx.createRadialGradient(tx - rx * 0.3, ty - ry * 0.4, 0, tx, ty, rx);
    tg.addColorStop(0, col[0]);
    tg.addColorStop(1, col[1]);
    ctx.beginPath();
    ctx.ellipse(tx, ty, rx, ry, 0, 0, TAU);
    ctx.fillStyle = tg;
    ctx.fill();
    // Snow sparkle.
    ctx.fillStyle = 'rgba(160,200,240,0.7)';
    const R = seeded(idx + 3);
    for (let i = 0; i < 8; i++) ctx.fillRect(tx + (R() - 0.5) * rx * 1.3, ty + (R() - 0.5) * ry * 1.3, 2, 2);
  }
  ctx.beginPath();
  ctx.ellipse(tx, ty, rx, ry, 0, 0, TAU);
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(tx - rx * 0.32, ty - ry * 0.38, rx * 0.26, ry * 0.15, -0.4, 0, TAU);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fill();
}
