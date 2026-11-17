// Plays every hole with a greedy random search: proves each hole can be finished, and
// reports the fewest strokes found (compare with par).
import { COURSES, bounds, pointInPoly } from '../public/js/course.js';
import { Golf, DT, MAX_SPEED, BALL_R } from '../public/js/golf.js';

// Walking distance to the cup on a 0.2 m grid (a flood fill around walls and water).
function distanceField(hole) {
  const g = new Golf();
  g.load(hole);
  const B = bounds(hole), step = 0.2;
  const nx = Math.ceil((B.x1 - B.x0) / step) + 1, ny = Math.ceil((B.y1 - B.y0) / step) + 1;
  const free = new Uint8Array(nx * ny);
  const solid = g.walls.concat(g.bumpers, g.posts);
  const blocked = (x, y) => {
    for (const b of solid) {
      if (b.shape === 'circle') { if (Math.hypot(x - b.x, y - b.y) < b.r + BALL_R) return true; continue; }
      const c = Math.cos(b.a), s = Math.sin(b.a), dx = x - b.x, dy = y - b.y;
      const lx = c * dx + s * dy, ly = -s * dx + c * dy;
      if (Math.abs(lx) < b.data.w / 2 + BALL_R * 0.8 && Math.abs(ly) < b.data.h / 2 + BALL_R * 0.8) return true;
    }
    return false;
  };
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = B.x0 + i * step, y = B.y0 + j * step;
    const wet = g.surfaceAt(x, y) === 'water' && !g.beltAt(x, y);
    free[j * nx + i] = pointInPoly(x, y, hole.outline) && !blocked(x, y) && !wet ? 1 : 0;
  }
  const dist = new Int32Array(nx * ny).fill(1e9);
  const [cx, cy] = hole.cup;
  const ci = Math.round((cx - B.x0) / step), cj = Math.round((cy - B.y0) / step);
  const q = [cj * nx + ci];
  dist[q[0]] = 0;
  const cell = (x, y) => Math.round((y - B.y0) / step) * nx + Math.round((x - B.x0) / step);
  for (let h = 0; h < q.length; h++) {
    // A portal links its two ends: reaching one end reaches the other.
    if (h === q.length - 1) {
      for (const [ax, ay, bx, by] of hole.portals || []) {
        const a = cell(ax, ay), b = cell(bx, by);
        if (dist[b] < dist[a]) { dist[a] = dist[b]; q.push(a); }
        if (dist[a] < dist[b]) { dist[b] = dist[a]; q.push(b); }
      }
    }
    const k = q[h], i = k % nx, j = (k - i) / nx;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di, b = j + dj;
      if (a < 0 || b < 0 || a >= nx || b >= ny) continue;
      const kk = b * nx + a;
      if (!free[kk] || dist[kk] <= dist[k] + 1) continue;
      dist[kk] = dist[k] + 1;
      q.push(kk);
    }
  }
  return (x, y) => {
    const i = Math.round((x - B.x0) / step), j = Math.round((y - B.y0) / step);
    if (i < 0 || j < 0 || i >= nx || j >= ny) return 1e9;
    return dist[j * nx + i] * step;
  };
}

const N = Number(process.argv[2] || 120);
let seed = 99;
const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);

// Plays a list of shots [angle, power] and returns { sunk, strokes, x, y }.
let field = null;
function play(hole, shots) {
  const g = new Golf();
  g.load(hole);
  let strokes = 0;
  for (const [ang, k] of shots) {
    if (!g.shoot(Math.cos(ang) * MAX_SPEED * k, Math.sin(ang) * MAX_SPEED * k)) break;
    strokes++;
    for (let t = 0; t < 20; t += DT) {
      g.step();
      if (g.state === 'sunk') return { sunk: true, strokes };
      if (g.state === 'ready' && t > 0.1) break;
    }
    if (g.state === 'water') for (let t = 0; t < 1.2; t += DT) g.step();
  }
  return { sunk: false, strokes, d: field(g.ball.x, g.ball.y) };
}

let bad = 0;
const only = process.argv[3];
for (const C of COURSES) {
  if (only && C.id !== only) continue;
  console.log(`-- ${C.name}`);
  C.holes.forEach((h, i) => {
    seed = 1000 + i * 7919;
    field = distanceField(h);
    const chosen = [];
    let res = null;
    for (let s = 0; s < 8 && !(res && res.sunk); s++) {
      let best = null, br = null;
      for (let n = 0; n < N; n++) {
        const c = [rnd() * Math.PI * 2, 0.15 + rnd() * 0.85];
        const r = play(h, [...chosen, c]);
        if (!br || (r.sunk && !br.sunk) || (!r.sunk && !br.sunk && r.d < br.d)) { best = c; br = r; }
        if (r.sunk) break;
      }
      chosen.push(best);
      res = br;
    }
    if (!res.sunk) bad++;
    console.log(`${res.sunk ? 'ok ' : 'BAD'} hole ${i + 1} ${h.name.padEnd(16)} par ${h.par}  ${res.sunk ? 'finished in ' + res.strokes : 'NOT finished'}`);
  });
}
process.exit(bad ? 1 : 0);
