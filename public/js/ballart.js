// The Gloop ball: jelly body, a pattern (ball style) and a face that sit on the surface and
// turn with the ball's spin (spin.js), and a gloss that stays put because it is the light.
// The same code draws the ball in the game and the small pictures in the menus.
import { TAU } from './util.js';
import { GLOOP_COLORS, drawGloopFace } from './gloop-art.js';
import { facingCamera } from './spin.js';

// Ball styles. unlock: the trophy that unlocks it (none = from the start).
export const STYLES = [
  { id: 'jelly', name: 'Jelly', unlock: null },
  { id: 'dots', name: 'Polka Dots', unlock: 'birdie' },
  { id: 'stars', name: 'Stars', unlock: 'ace' },
  { id: 'hearts', name: 'Hearts', unlock: 'regular' },
  { id: 'flowers', name: 'Flowers', unlock: 'garden-done' },
  { id: 'stripes', name: 'Stripes', unlock: 'beach-done' },
  { id: 'sprinkles', name: 'Sprinkles', unlock: 'candy-done' },
  { id: 'snowflakes', name: 'Snowflakes', unlock: 'frost-done' },
];

// Points spread evenly over the ball (in its own frame: right, up, front), none on the face.
function spread(n, seed) {
  const N = Math.round(n * 1.15), out = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - ((i + 0.5) / N) * 2;
    const rr = Math.sqrt(1 - y * y), a = i * golden + seed;
    const p = [Math.cos(a) * rr, y, Math.sin(a) * rr];
    if (p[2] > 0.74) continue; // the face
    out.push(p);
  }
  return out;
}

// Jelly bubbles: [x, y, z, size].
const BUBBLES = [
  [0, 0, -1, 0.22], [0.87, 0.45, -0.2, 0.16], [-0.87, 0.45, -0.2, 0.18], [0, -0.97, -0.25, 0.2],
  [0.62, -0.5, -0.6, 0.14], [-0.66, -0.4, -0.63, 0.15], [0.25, 0.8, -0.55, 0.15], [0.97, -0.2, 0.15, 0.12], [-0.95, -0.25, 0.2, 0.13],
];
const PATTERN = {
  dots: spread(24, 0.3).map((p) => [...p, 0.16]),
  stars: spread(16, 1.1).map((p) => [...p, 0.22]),
  hearts: spread(16, 2.2).map((p) => [...p, 0.2]),
  flowers: spread(16, 0.7).map((p) => [...p, 0.21]),
  snowflakes: spread(16, 1.7).map((p) => [...p, 0.22]),
  sprinkles: spread(44, 0.2).map((p) => [...p, 0.15]),
};
const SPRINKLE_COLS = ['#ffffff', '#ffe14d', '#5ce0ff', '#7dff8a', '#b78cff', '#ff9a3c'];

const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm3 = (v) => {
  const L = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / L, v[1] / L, v[2] / L];
};
// World direction of a point given in the ball's own frame.
const onBall = (m, p) => [0, 1, 2].map((i) => m[0][i] * p[0] + m[1][i] * p[1] + m[2][i] * p[2]);

// Draws a picture on the ball's surface at point p (own frame): fn draws it in a unit box
// around (0, 0), on the plane that touches the ball there, seen at its angle.
function decal(ctx, cam, m, p, size, r, fn, i) {
  const n = norm3(onBall(m, p));
  const vis = dot3(n, cam.dir);
  if (vis <= 0.02) return;
  // A fixed "right" on the ball for each picture, so it rolls with the ball.
  const ref = Math.abs(p[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const uB = norm3(cross3(ref, p)), wB = cross3(p, uB);
  const u = onBall(m, uB), w = onBall(m, wB);
  const su = cam.S(u), sw = cam.S(w), sn = cam.S(n);
  ctx.save();
  ctx.globalAlpha = Math.min(1, vis * 3);
  ctx.transform(su[0] * size * r, su[1] * size * r, -sw[0] * size * r, -sw[1] * size * r, sn[0] * r * 0.97, sn[1] * r * 0.97);
  fn(ctx, i);
  ctx.restore();
}

function starPath(ctx, n, ro, ri) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i / (n * 2)) * TAU, rr = i % 2 ? ri : ro;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
}

const DRAW = {
  jelly(ctx) {
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.42)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-0.3, -0.3, 0.32, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fill();
  },
  dots(ctx) {
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, TAU);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  },
  stars(ctx) {
    starPath(ctx, 5, 1, 0.45);
    ctx.fillStyle = '#ffe14d';
    ctx.fill();
    ctx.lineWidth = 0.14;
    ctx.strokeStyle = '#c98a00';
    ctx.stroke();
  },
  hearts(ctx) {
    ctx.beginPath();
    ctx.moveTo(0, 0.85);
    ctx.bezierCurveTo(-1.1, 0.1, -0.9, -0.95, 0, -0.4);
    ctx.bezierCurveTo(0.9, -0.95, 1.1, 0.1, 0, 0.85);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  },
  flowers(ctx) {
    ctx.fillStyle = '#ffffff';
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * TAU;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 0.55, Math.sin(a) * 0.55, 0.42, 0, TAU);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(0, 0, 0.36, 0, TAU);
    ctx.fillStyle = '#ffcf3a';
    ctx.fill();
  },
  snowflakes(ctx) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.2;
    ctx.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI;
      const c = Math.cos(a), s = Math.sin(a);
      ctx.beginPath();
      ctx.moveTo(-c, -s);
      ctx.lineTo(c, s);
      for (const e of [-1, 1]) {
        const bx = c * 0.55 * e, by = s * 0.55 * e;
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + (c * 0.3 - s * 0.3) * e, by + (s * 0.3 + c * 0.3) * e);
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + (c * 0.3 + s * 0.3) * e, by + (s * 0.3 - c * 0.3) * e);
      }
      ctx.stroke();
    }
  },
  sprinkles(ctx, i) {
    ctx.rotate(i * 1.7);
    ctx.beginPath();
    ctx.roundRect(-1, -0.28, 2, 0.56, 0.28);
    ctx.fillStyle = SPRINKLE_COLS[i % SPRINKLE_COLS.length];
    ctx.fill();
  },
};

// Two white bands round the ball, above and below the face.
function stripes(ctx, cam, m, r) {
  ctx.lineCap = 'round';
  ctx.lineWidth = r * 0.17;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  for (const lat of [0.62, -0.62]) {
    let prev = null;
    for (let i = 0; i <= 48; i++) {
      const t = (i / 48) * TAU;
      const p = [Math.cos(lat) * Math.sin(t), Math.sin(lat), Math.cos(lat) * Math.cos(t)];
      const n = onBall(m, p), vis = dot3(n, cam.dir);
      const s = cam.S(n);
      const pt = vis > 0 ? [s[0] * r * 0.97, s[1] * r * 0.97] : null;
      if (pt && prev) {
        ctx.beginPath();
        ctx.moveTo(...prev);
        ctx.lineTo(...pt);
        ctx.stroke();
      }
      prev = pt;
    }
  }
}

// The face, drawn on the plane just under it, seen at the angle the ball has turned to.
function rollingFace(ctx, cam, m, r, face) {
  const [R, U, F] = m;
  const vis = dot3(F, cam.dir);
  if (vis < -0.2) return;
  const sr = cam.S(R), su = cam.S(U), sf = cam.S(F);
  const sd = [-su[0], -su[1]];
  // Eyes look the same way on the screen, whatever the turn of the face.
  const det = sr[0] * sd[1] - sd[0] * sr[1];
  let look = { x: 0, y: 0 };
  if (Math.abs(det) > 0.08) {
    const lx = face.look.x, ly = face.look.y;
    const fx = (sd[1] * lx - sd[0] * ly) / det, fy = (-sr[1] * lx + sr[0] * ly) / det;
    const L = Math.hypot(fx, fy) || 1;
    look = { x: fx / Math.max(1, L), y: fy / Math.max(1, L) };
  }
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, (vis + 0.2) / 0.35));
  ctx.transform(sr[0], sr[1], sd[0], sd[1], sf[0] * r * 0.86, sf[1] * r * 0.86);
  drawGloopFace(ctx, r * 0.92, { ...face, look });
  ctx.restore();
}

// Draws the ball centered at (0, 0) with radius r (px). o: color, style, spin, k and hz
// (cos and sin of the camera tilt; 1 and 0 for a picture seen from the front), look, mood, t.
export function drawBall(ctx, r, o) {
  const color = o.color || 'lime';
  const cols = GLOOP_COLORS[color];
  const k = o.k ?? 1, hz = o.hz ?? 0;
  const cam = { dir: [0, hz, k], S: (w) => [w[0], w[1] * k - w[2] * hz] };
  const m = o.spin || facingCamera(k, hz);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.05, 0, 0, r * 1.05);
  g.addColorStop(0, cols[0]);
  g.addColorStop(0.5, cols[1]);
  g.addColorStop(1, cols[2]);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.95, 0, TAU);
  ctx.clip();
  const style = o.style || 'jelly';
  if (style === 'stripes') stripes(ctx, cam, m, r);
  else {
    const list = style === 'jelly' ? BUBBLES : PATTERN[style] || BUBBLES;
    const fn = DRAW[style] || DRAW.jelly;
    list.forEach(([x, y, z, size], i) => decal(ctx, cam, m, [x, y, z], size, r, fn, i));
  }
  rollingFace(ctx, cam, m, r, { look: o.look || { x: 1, y: 0 }, mood: o.mood || 'sour', kind: 'two', color, t: o.t || 0 });
  ctx.restore();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.lineWidth = Math.max(1.5, r * 0.13);
  ctx.strokeStyle = cols[4];
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.82, Math.PI * 1.1, Math.PI * 1.45);
  ctx.lineWidth = r * 0.14;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.stroke();
}
