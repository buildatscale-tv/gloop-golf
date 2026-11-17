// Golf rules and ball physics: walls, surfaces, moving parts, the ball, and the cup.
// No DOM here, so Node tests can play whole holes.
import { Body } from './physics.js';
import { pointInPoly } from './course.js';

export const DT = 1 / 120;
export const BALL_R = 0.28;
export const CUP_R = 0.44;
export const MAX_SPEED = 11;
const WALL_T = 0.5;
// Rolling slow-down (m/s per second) on each surface.
export const DECEL = { grass: 2.3, sand: 9.5, ice: 0.45 };
const BUMPER_KICK = 2.6;
// Bounce: the share of the speed into a surface that the ball keeps.
const BOUNCE = { post: 0.62, rail: 0.68, wall: 0.68, block: 0.62, bumper: 0.9, sail: 0.62, slider: 0.62, spinner: 0.62 };
// Boost pads: size (m), the speed they push the ball up to, and how hard they push.
export const BOOST_W = 1.6, BOOST_H = 1.1;
const BOOST_SPEED = 7.5, BOOST_PUSH = 40;
// Portals: the ball warps when its center comes this close to the middle of a portal.
export const PORTAL_R = 0.5;
const PORTAL_IN = 0.32;
// Below this speed into a surface, the ball slides along it instead of bouncing.
const SLIDE_SPEED = 0.3;
// Hits faster than this make a sound.
const HIT_SOUND = 0.8;
const SINK_SPEED = 5.5;
// Ball on ball: the share of the closing speed kept after the hit (equal balls).
const BALL_E = 0.85;
// A ball that hops the hole but stops on top of it still drops in.
const LIP_STALL = 0.5;

// Ball velocity after a hit on a surface with normal (nx, ny), pointing toward the ball.
// A mirror bounce: the angle out is the same as the angle in. Only the speed into the
// surface is lost, so a glancing hit keeps almost all its speed. Bumpers then add a kick.
export function bounce(vx, vy, nx, ny, e, kick = 0) {
  const vn = vx * nx + vy * ny;
  if (vn >= 0) return [vx, vy];
  const tx = vx - vn * nx, ty = vy - vn * ny;
  if (-vn < SLIDE_SPEED) return [tx, ty];
  const k = Math.sqrt(tx * tx + ty * ty + e * e * vn * vn) / Math.hypot(vx, vy);
  return [(tx - vn * nx) * k + nx * kick, (ty - vn * ny) * k + ny * kick];
}

export class Golf {
  constructor(emit = () => {}) {
    this.emit = emit;
    this.time = 0;
  }

  load(hole) {
    this.hole = hole;
    this.time = 0;
    this.state = 'ready';
    this.lastLine = null;
    this.walls = [];
    this.bumpers = [];
    this.posts = [];
    this.movers = [];
    const box = (x, y, w, h, a, kind) => new Body({ static: true, x, y, w, h, a, data: { kind, w, h } });
    // A straight wall from (x1, y1) to (x2, y2), with e1 and e2 extra length at the ends.
    const wall = (x1, y1, x2, y2, t, kind, e1, e2) => {
      const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
      const ax = x1 - ux * e1, ay = y1 - uy * e1, bx = x2 + ux * e2, by = y2 + uy * e2;
      this.walls.push(box((ax + bx) / 2, (ay + by) / 2, L + e1 + e2, t, Math.atan2(dy, dx), kind));
    };
    // Outline rails sit just outside the fairway edge. At an outer corner each rail runs on
    // to close the gap. At an inner corner it stops at the corner, so no rail end sticks
    // out into the fairway.
    const pts = hole.outline, n = pts.length;
    const outer = (i) => {
      const [x0, y0] = pts[(i + n - 1) % n], [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % n];
      return (x1 - x0) * (y2 - y1) - (y1 - y0) * (x2 - x1) > 0;
    };
    for (let i = 0; i < n; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % n];
      const L = Math.hypot(x2 - x1, y2 - y1);
      const ox = ((y2 - y1) / L) * (WALL_T / 2), oy = (-(x2 - x1) / L) * (WALL_T / 2);
      wall(x1 + ox, y1 + oy, x2 + ox, y2 + oy, WALL_T, 'rail', outer(i) ? WALL_T / 2 : 0, outer((i + 1) % n) ? WALL_T / 2 : 0);
    }
    for (const [x1, y1, x2, y2, t = 0.4] of hole.walls || []) wall(x1, y1, x2, y2, t, 'wall', t / 2, t / 2);
    for (const [x0, y0, x1, y1] of hole.blocks || []) this.walls.push(box((x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0, 0, 'block'));
    for (const [x, y, r] of hole.bumpers || []) {
      this.bumpers.push(new Body({ shape: 'circle', static: true, x, y, r, data: { kind: 'bumper', wob: 0, wobV: 0 } }));
    }
    for (const [x, y, r] of hole.posts || []) {
      this.posts.push(new Body({ shape: 'circle', static: true, x, y, r, data: { kind: 'post' } }));
    }
    for (const m of hole.movers || []) {
      if (m.type === 'windmill') {
        // The sails turn upright in front of the tunnel. Only the part of a sail that dips to
        // the ground can hit the ball: one moving paddle that sweeps across the tunnel door.
        this.movers.push({ ...m, paddle: box(-100, -100, m.width, 0.3, 0, 'sail') });
      } else if (m.type === 'slider') {
        this.movers.push({ ...m, body: box(m.x, m.y, m.w, m.h, 0, 'slider') });
      } else if (m.type === 'spinner') {
        // A bar that turns around its middle, like a turnstile.
        this.movers.push({ ...m, body: box(m.x, m.y, m.len, 0.32, 0, 'spinner') });
      }
    }
    this.moveParts();
    const [tx, ty] = hole.tee;
    this.ball = new Body({ shape: 'circle', x: tx, y: ty, r: BALL_R, data: { kind: 'ball' } });
    this.ball.isBall = true;
    this.others = [];
    this.lastPos = { x: tx, y: ty };
    this.stopT = 0;
  }

  // The other players' balls on the field (take turns). Each is a ball state like the real
  // ball: { x, y, vx, vy, warpLock, ... } with isBall, shape 'circle', r and data.kind 'ball'.
  setOthers(list) {
    this.others = list;
    this.lastLine = null;
  }

  // A ball another ball can hit: on the field, not in the cup or the water.
  onField(b) {
    return b === this.ball ? this.state !== 'sunk' && this.state !== 'water' : !b.sunk && !b.hidden;
  }

  // Every ball on the field but this one.
  fieldBalls(not) {
    return [this.ball, ...this.others].filter((b) => b !== not && this.onField(b));
  }

  othersMoving() {
    return this.others.some((o) => !o.sunk && (o.vx || o.vy || o.waterT > 0));
  }

  // Spots on the tee for n balls, side by side across the line to the cup. Each spot is on
  // grass inside the hole, clear of every solid, and a ball left there stays still.
  teeSpots(n) {
    const [tx, ty] = this.hole.tee, [cx, cy] = this.hole.cup;
    const L = Math.hypot(cx - tx, cy - ty) || 1, ux = (cx - tx) / L, uy = (cy - ty) / L, px = -uy, py = ux;
    const gap = BALL_R * 2 + 0.1;
    const row = (m, back, shift) => Array.from({ length: m }, (_, i) => {
      const a = (i - (m - 1) / 2) * gap + shift;
      return [tx + ux * back + px * a, ty + uy * back + py * a];
    });
    const tries = [];
    for (const back of [0, -gap * 0.6, gap * 0.6, -gap * 1.2, gap * 1.2]) {
      for (const shift of [0, gap / 2, -gap / 2, gap, -gap, gap * 1.5, -gap * 1.5]) {
        tries.push(row(n, back, shift));
        if (n > 2) tries.push([...row(Math.ceil(n / 2), back, shift), ...row(Math.floor(n / 2), back - gap, shift)]);
      }
    }
    for (const spots of tries) if (spots.every(([x, y]) => this.spotOk(x, y))) return spots;
    return row(n, 0, 0).map(() => [tx, ty]);
  }

  // The clear spot nearest (x, y) with no ball from list on it (for a ball put back on the tee).
  freeSpot([x, y], list) {
    const clear = (px, py) => list.every((b) => Math.hypot(b.x - px, b.y - py) > BALL_R * 2 + 0.05);
    if (clear(x, y)) return [x, y];
    for (let r = 0.3; r < 3; r += 0.3) {
      for (let a = 0; a < 16; a++) {
        const px = x + Math.cos((a / 16) * Math.PI * 2) * r, py = y + Math.sin((a / 16) * Math.PI * 2) * r;
        if (clear(px, py) && this.spotOk(px, py)) return [px, py];
      }
    }
    return [x, y];
  }

  spotOk(x, y) {
    if (!pointInPoly(x, y, this.hole.outline) || this.surfaceAt(x, y) !== 'grass' || this.beltAt(x, y)) return false;
    if (this.solids(false).some((b) => this.contact(b, x, y).depth > -0.05)) return false;
    for (const bp of this.hole.boosts || []) if (this.onPad(bp, x, y)) return false;
    for (const q of this.hole.portals || []) if (Math.hypot(x - q[0], y - q[1]) < 1.2 || Math.hypot(x - q[2], y - q[3]) < 1.2) return false;
    const st = { x, y, vx: 0, vy: 0, lipped: 0, boost: -1, warpLock: null };
    for (let i = 0; i < 240; i++) if (this.tick(st, false)) return false;
    return Math.hypot(st.x - x, st.y - y) < 0.005;
  }

  // Moving parts follow the clock, so they are the same every time a hole is played.
  moveParts() {
    const t = this.time;
    for (const m of this.movers) {
      if (m.type === 'windmill') {
        // Sail angles in the upright plane (0 = pointing right, -PI/2 = pointing down).
        m.angles = [];
        let down = null, best = 9;
        for (let k = 0; k < m.arms; k++) {
          const a = -m.speed * t + (k / m.arms) * Math.PI * 2;
          m.angles.push(a);
          const d = Math.abs(Math.atan2(Math.sin(a + Math.PI / 2), Math.cos(a + Math.PI / 2)));
          if (d < best) {
            best = d;
            down = a;
          }
        }
        const p = m.paddle;
        if (best < 0.34) {
          p.x = m.x + Math.cos(down) * m.len;
          p.y = m.face + 0.22;
          p.vx = Math.sin(down) * m.len * m.speed;
          p.vy = 0;
        } else {
          p.x = -100;
          p.y = -100;
          p.vx = p.vy = 0;
        }
      } else if (m.type === 'slider') {
        const w = (Math.PI * 2) / m.period;
        const s = Math.sin(w * t) * (m.amp / 2), v = Math.cos(w * t) * (m.amp / 2) * w;
        m.body.x = m.x + m.ax * s;
        m.body.y = m.y + m.ay * s;
        m.body.vx = m.ax * v;
        m.body.vy = m.ay * v;
      } else if (m.type === 'spinner') {
        const b = m.body;
        b.a = (m.phase || 0) + m.speed * t;
        b.c = Math.cos(b.a);
        b.s = Math.sin(b.a);
        b.av = m.speed;
      }
    }
  }

  surfaceAt(x, y) {
    const h = this.hole;
    for (const p of h.water || []) if (pointInPoly(x, y, p)) return 'water';
    for (const p of h.sand || []) if (pointInPoly(x, y, p)) return 'sand';
    for (const p of h.ice || []) if (pointInPoly(x, y, p)) return 'ice';
    return 'grass';
  }

  // Everything the ball can hit. Moving parts only for the real ball (the aim line
  // leaves them out, because they move).
  // self: the ball that moves, so it does not hit itself. The aim line (not live) is the
  // real ball's path, so the real ball is left out and the other balls stand still.
  solids(live, self) {
    const out = this.walls.concat(this.bumpers, this.posts);
    if (live) {
      for (const m of this.movers) {
        const b = m.paddle || m.body;
        if (b.x > -50) out.push(b);
      }
    }
    for (const o of this.others || []) if (o !== self && this.onField(o)) out.push(o);
    if (live && self && self !== this.ball && this.onField(this.ball)) out.push(this.ball);
    return out;
  }

  // How the ball at (x, y) touches a solid: the normal from the solid to the ball center
  // and the depth of overlap (negative when there is a gap).
  contact(b, x, y) {
    const r = BALL_R;
    if (b.shape === 'circle') {
      const dx = x - b.x, dy = y - b.y, d = Math.hypot(dx, dy) || 1e-9;
      return { nx: dx / d, ny: dy / d, depth: b.r + r - d };
    }
    const c = b.c, s = b.s, hw = b.data.w / 2, hh = b.data.h / 2;
    const ox = c * (x - b.x) + s * (y - b.y), oy = -s * (x - b.x) + c * (y - b.y);
    const qx = Math.max(-hw, Math.min(hw, ox)), qy = Math.max(-hh, Math.min(hh, oy));
    let nx = ox - qx, ny = oy - qy, d = Math.hypot(nx, ny), depth;
    if (d > 1e-9) {
      nx /= d;
      ny /= d;
      depth = r - d;
    } else if (hw - Math.abs(ox) < hh - Math.abs(oy)) {
      // Center inside the box: out through the nearest side.
      nx = Math.sign(ox) || 1;
      ny = 0;
      depth = r + hw - Math.abs(ox);
    } else {
      nx = 0;
      ny = Math.sign(oy) || 1;
      depth = r + hh - Math.abs(oy);
    }
    return { nx: c * nx - s * ny, ny: s * nx + c * ny, depth };
  }

  // First solid the ball would touch moving from (x, y) along the unit direction (dx, dy)
  // for at most maxT. Exact for a round ball: boxes grow by the ball radius with round
  // corners, bumpers grow by the ball radius. A ball that already touches a solid and
  // moves into it hits it at t = 0.
  sweep(x, y, dx, dy, maxT, live, self) {
    let best = null;
    const r = BALL_R;
    for (const b of this.solids(live, self)) {
      const touch = this.contact(b, x, y);
      if (touch.depth > -1e-7) {
        if (dx * touch.nx + dy * touch.ny < 0) return { t: 0, nx: touch.nx, ny: touch.ny, body: b };
        continue;
      }
      if (b.shape === 'circle') {
        const R = b.r + r, fx = x - b.x, fy = y - b.y;
        const B = fx * dx + fy * dy, D = B * B - (fx * fx + fy * fy - R * R);
        if (D < 0) continue;
        const t = -B - Math.sqrt(D);
        if (t < 0 || t > maxT || (best && t >= best.t)) continue;
        best = { t, nx: (fx + dx * t) / R, ny: (fy + dy * t) / R, body: b };
        continue;
      }
      const c = b.c, s = b.s;
      const ox = c * (x - b.x) + s * (y - b.y), oy = -s * (x - b.x) + c * (y - b.y);
      const ux = c * dx + s * dy, uy = -s * dx + c * dy;
      const hw = b.data.w / 2, hh = b.data.h / 2;
      let t0 = -Infinity, t1 = Infinity, nx = 0, ny = 0;
      for (const [o, u, e, ax] of [[ox, ux, hw + r, 0], [oy, uy, hh + r, 1]]) {
        if (Math.abs(u) < 1e-12) {
          if (Math.abs(o) > e) t0 = Infinity;
          continue;
        }
        let ta = (-e - o) / u, tb = (e - o) / u, sgn = -1;
        if (ta > tb) {
          [ta, tb] = [tb, ta];
          sgn = 1;
        }
        if (ta > t0) {
          t0 = ta;
          nx = ax === 0 ? sgn : 0;
          ny = ax === 1 ? sgn : 0;
        }
        t1 = Math.min(t1, tb);
      }
      if (!(t0 <= t1) || t0 < 0 || t0 > maxT) continue;
      let px = ox + ux * t0, py = oy + uy * t0, t = t0;
      if (Math.abs(px) > hw && Math.abs(py) > hh) {
        // Corner region: hit the round corner instead.
        const cx = Math.sign(px) * hw, cy = Math.sign(py) * hh;
        const fx = ox - cx, fy = oy - cy;
        const B = fx * ux + fy * uy, D = B * B - (fx * fx + fy * fy - r * r);
        if (D < 0) continue;
        t = -B - Math.sqrt(D);
        if (t < 0 || t > maxT) continue;
        nx = (ox + ux * t - cx) / r;
        ny = (oy + uy * t - cy) / r;
      }
      if (!best || t < best.t) best = { t, nx: c * nx - s * ny, ny: s * nx + c * ny, body: b };
    }
    return best;
  }

  // The ball hits a solid: bounce off it (relative to a moving part's own speed).
  collide(st, nx, ny, o, live) {
    const kind = o.data.kind;
    if (o.isBall) return this.hitBall(st, nx, ny, o, live);
    let mvx = o.vx || 0, mvy = o.vy || 0;
    if (o.av) {
      const px = st.x - nx * BALL_R - o.x, py = st.y - ny * BALL_R - o.y;
      mvx -= o.av * py;
      mvy += o.av * px;
    }
    const rvx = st.vx - mvx, rvy = st.vy - mvy;
    const vn = rvx * nx + rvy * ny;
    if (vn >= 0) return;
    const [bx, by] = bounce(rvx, rvy, nx, ny, BOUNCE[kind], kind === 'bumper' ? BUMPER_KICK : 0);
    st.vx = bx + mvx;
    st.vy = by + mvy;
    if (st.hits) st.hits.push([st.x, st.y]);
    if (!live) return;
    if (kind === 'bumper' && -vn >= SLIDE_SPEED) o.data.wobV += 6;
    if (-vn > HIT_SOUND) this.emit('bounce', { kind, speed: -vn, x: st.x - nx * BALL_R, y: st.y - ny * BALL_R, nx, ny });
  }

  // Ball on ball, equal balls: along the line between the centers they swap the closing
  // speed (less what the hit loses); across it each ball keeps its own speed. The aim line
  // stops here and keeps where the other ball would go.
  hitBall(st, nx, ny, o, live) {
    const rvx = st.vx - o.vx, rvy = st.vy - o.vy, vn = rvx * nx + rvy * ny;
    if (vn >= 0) return;
    if (!live) {
      st.ballHit = { x: st.x, y: st.y, bx: o.x, by: o.y, nx, ny, speed: (-vn * (1 + BALL_E)) / 2 };
      st.vx = st.vy = 0;
      return;
    }
    const j = (-vn * (1 + BALL_E)) / 2;
    st.vx += j * nx;
    st.vy += j * ny;
    o.vx -= j * nx;
    o.vy -= j * ny;
    const target = o === this.ball ? 'me' : o.id;
    this.emit('bounce', { kind: 'ball', target, speed: -vn, x: st.x - nx * BALL_R, y: st.y - ny * BALL_R, nx, ny, quiet: -vn <= HIT_SOUND * 0.5 });
  }

  // Moves the ball for dt: straight to the next hit, bounce, and on with the time left.
  advance(st, dt, live) {
    let left = dt;
    for (let i = 0; i < 6 && left > 1e-12; i++) {
      const sp = Math.hypot(st.vx, st.vy);
      if (sp < 1e-9) break;
      const dx = st.vx / sp, dy = st.vy / sp;
      const hit = this.sweep(st.x, st.y, dx, dy, sp * left, live, st);
      if (!hit) {
        st.x += dx * sp * left;
        st.y += dy * sp * left;
        break;
      }
      st.x += dx * hit.t;
      st.y += dy * hit.t;
      left -= hit.t / sp;
      this.collide(st, hit.nx, hit.ny, hit.body, live);
    }
    // A moving part can push into a ball that waits: move the ball out and bat it away.
    for (const b of this.solids(live, st)) {
      const c = this.contact(b, st.x, st.y);
      if (c.depth <= 1e-9) continue;
      st.x += c.nx * c.depth;
      st.y += c.ny * c.depth;
      this.collide(st, c.nx, c.ny, b, live);
    }
  }

  // One physics tick for a ball state { x, y, vx, vy, lipped }. The real ball and the aim
  // line both use it, so the dotted path is the path the ball takes.
  // live: the real ball (moving parts, sounds). Returns 'water', 'sink', or null.
  tick(st, live) {
    const belt = this.beltAt(st.x, st.y);
    const surf = belt ? 'grass' : this.surfaceAt(st.x, st.y);
    if (surf === 'water') return 'water';
    // Boost pads push the ball along the arrows, up to the boost speed.
    let onBoost = -1;
    (this.hole.boosts || []).forEach((bp, i) => {
      if (!this.onPad(bp, st.x, st.y)) return;
      onBoost = i;
      const a = (bp[2] * Math.PI) / 180, dx = Math.cos(a), dy = Math.sin(a);
      const vd = st.vx * dx + st.vy * dy;
      if (vd < BOOST_SPEED) {
        const dv = Math.min(BOOST_PUSH * DT, BOOST_SPEED - vd);
        st.vx += dx * dv;
        st.vy += dy * dv;
      }
    });
    if (onBoost !== st.boost) {
      if (onBoost >= 0 && live) this.emit('boost', { x: st.x, y: st.y });
      st.boost = onBoost;
    }
    // Slopes push the ball.
    for (const s of this.hole.slopes || []) {
      if (pointInPoly(st.x, st.y, s.poly)) {
        st.vx += s.dir[0] * s.k * DT;
        st.vy += s.dir[1] * s.k * DT;
      }
    }
    // The cup pulls a slow ball in a little, so near misses feel fair.
    const [cx, cy] = this.hole.cup;
    const dx = cx - st.x, dy = cy - st.y, d = Math.hypot(dx, dy);
    let sp = Math.hypot(st.vx, st.vy);
    if (d < 1.1 && sp < 2.6 && d > 0.01) {
      const k = 2.4 * (1 - d / 1.1) * DT;
      st.vx += (dx / d) * k;
      st.vy += (dy / d) * k;
    }
    // Rolling friction: a steady slow-down until the ball stops (on a belt: until it moves
    // with the belt).
    const ux = belt ? belt.dir[0] * belt.speed : 0, uy = belt ? belt.dir[1] * belt.speed : 0;
    const rx = st.vx - ux, ry = st.vy - uy, rs = Math.hypot(rx, ry);
    const dv = DECEL[surf] * DT;
    if (rs <= dv) {
      st.vx = ux;
      st.vy = uy;
    } else {
      st.vx = ux + rx * (1 - dv / rs);
      st.vy = uy + ry * (1 - dv / rs);
    }
    sp = Math.hypot(st.vx, st.vy);
    // The cup decides once, when the ball first rolls over it: slow enough drops in, too
    // fast hops the hole. 'lip' fires as the ball rolls off the far side, so "Too fast!"
    // never shows for a ball that then drops. lipped: 1 over the hole, 2 rolled off it.
    const over = d < CUP_R * 0.85;
    if (over && !st.lipped) {
      if (sp < SINK_SPEED) return 'sink';
      st.lipped = 1;
      st.vx *= 0.8;
      st.vy *= 0.8;
    } else if (over && sp < LIP_STALL) return 'sink';
    else if (!over && st.lipped === 1) {
      st.lipped = 2;
      if (live) this.emit('lip', {});
    } else if (d > CUP_R) st.lipped = 0;
    this.advance(st, DT, live);
    this.warp(st, live);
    return null;
  }

  beltAt(x, y) {
    for (const b of this.hole.belts || []) if (pointInPoly(x, y, b.poly)) return b;
    return null;
  }

  // Is (x, y) on boost pad [cx, cy, angle in degrees]?
  onPad([cx, cy, deg], x, y) {
    const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    const lx = c * (x - cx) + s * (y - cy), ly = -s * (x - cx) + c * (y - cy);
    return Math.abs(lx) < BOOST_W / 2 && Math.abs(ly) < BOOST_H / 2;
  }

  // Portals come in pairs [ax, ay, bx, by]. The ball keeps its speed and direction and
  // comes out of the twin. It cannot go back in until it has left the twin.
  warp(st, live) {
    const P = this.hole.portals || [];
    if (st.warpLock) {
      const [i, side] = st.warpLock, q = P[i];
      const ex = side ? q[2] : q[0], ey = side ? q[3] : q[1];
      if (Math.hypot(st.x - ex, st.y - ey) > PORTAL_R + BALL_R) st.warpLock = null;
      else return;
    }
    for (let i = 0; i < P.length; i++) {
      const [ax, ay, bx, by] = P[i];
      for (const side of [0, 1]) {
        const [px, py, ex, ey] = side ? [bx, by, ax, ay] : [ax, ay, bx, by];
        if (Math.hypot(st.x - px, st.y - py) > PORTAL_IN) continue;
        if (st.jumps) st.jumps.push([st.x, st.y, ex, ey]);
        if (live) this.emit('warp', { x: st.x, y: st.y, ex, ey, pair: i });
        st.x = ex;
        st.y = ey;
        st.warpLock = [i, side ? 0 : 1];
        return;
      }
    }
  }

  // The path a putt would take: the same physics as the real ball (slopes, sand, ice, the
  // cup), without the moving parts. Ends after the given number of bounces plus one hit,
  // at the water, in the cup, or where the ball stops.
  predict(x, y, vx, vy, bounces = 2) {
    const key = `${x},${y},${vx},${vy},${bounces}`;
    if (this.lastLine && this.lastLine.key === key) return this.lastLine.pts;
    // A ball that waits on a portal it just came out of keeps that portal shut.
    const b = this.ball, here = b && b.x === x && b.y === y;
    const st = { x, y, vx, vy, lipped: 0, hits: [], jumps: [], boost: -1, warpLock: here ? b.warpLock : null };
    const pts = [[x, y]];
    let slow = 0;
    for (let i = 0; i < 1800; i++) {
      const n = st.hits.length, nj = st.jumps.length;
      const ev = this.tick(st, false);
      if (st.jumps.length > nj) {
        const [jx, jy, ex, ey] = st.jumps[nj];
        pts.push([jx, jy], null, [ex, ey]);
      }
      if (ev === 'sink') {
        pts.push(this.hole.cup.slice());
        this.lastLine = { key, pts, ballHit: null };
        return pts;
      }
      if (ev) break;
      for (let j = n; j < st.hits.length; j++) pts.push(st.hits[j]);
      if (st.ballHit) {
        pts.push([st.x, st.y]);
        break;
      }
      if (st.hits.length > bounces) break;
      pts.push([st.x, st.y]);
      slow = Math.hypot(st.vx, st.vy) < 0.05 ? slow + 1 : 0;
      if (slow > 30) break;
    }
    const [lx, ly] = pts[pts.length - 1];
    if (lx !== st.x || ly !== st.y) pts.push([st.x, st.y]);
    this.lastLine = { key, pts, ballHit: st.ballHit || null };
    return pts;
  }

  // Put the ball at rest at (x, y): the next player's ball when players take turns.
  place(x, y, warpLock = null) {
    this.lastLine = null;
    const b = this.ball;
    b.x = x;
    b.y = y;
    b.vx = b.vy = 0;
    b.warpLock = warpLock;
    b.lipped = 0;
    this.state = 'ready';
    this.stopT = 0;
  }

  canShoot() {
    return this.state === 'ready';
  }

  shoot(vx, vy) {
    if (!this.canShoot()) return false;
    const b = this.ball;
    this.lastPos = { x: b.x, y: b.y, warpLock: b.warpLock };
    for (const o of this.others) o.home = { x: o.x, y: o.y, warpLock: o.warpLock };
    b.lipped = 0;
    b.vx = vx;
    b.vy = vy;
    this.state = 'rolling';
    this.stopT = 0;
    this.emit('putt', { speed: Math.hypot(vx, vy) });
    return true;
  }

  // The other balls roll only after a hit. They use the same physics as the real ball, and
  // their events carry other: the player's index. A knocked ball that goes in the water
  // goes back to where it was before this putt, with no penalty.
  stepOthers() {
    for (const o of this.others) {
      if (o.sunk) continue;
      if (o.waterT > 0) {
        o.waterT -= DT;
        if (o.waterT <= 0) {
          const h = o.home || o;
          const [x, y] = this.freeSpot([h.x, h.y], this.fieldBalls(o));
          Object.assign(o, { x, y, warpLock: h.warpLock || null, vx: 0, vy: 0, hidden: false, waterT: 0 });
          this.emit('reset', { penalty: 0, other: o.id, x: o.x, y: o.y });
        }
        continue;
      }
      const emit = this.emit;
      this.emit = (name, d = {}) => emit(name, { ...d, other: o.id });
      const ev = this.tick(o, true);
      this.emit = emit;
      if (ev === 'water') {
        Object.assign(o, { vx: 0, vy: 0, hidden: true, waterT: 0.9 });
        this.emit('water', { x: o.x, y: o.y, other: o.id });
      } else if (ev === 'sink') {
        Object.assign(o, { vx: 0, vy: 0, hidden: true, sunk: true });
        const [cx, cy] = this.hole.cup;
        this.emit('sink', { x: cx, y: cy, other: o.id });
      } else {
        const sp = Math.hypot(o.vx, o.vy);
        o.stopT = sp > 0 && sp < 0.05 ? (o.stopT || 0) + DT : 0;
        if (o.stopT > 0.25) Object.assign(o, { vx: 0, vy: 0, stopT: 0 });
      }
    }
  }

  step() {
    this.time += DT;
    this.moveParts();
    const b = this.ball;
    // Also while waiting: a windmill sail or a sliding wall can push a resting ball.
    if (this.state === 'rolling' || this.state === 'ready') {
      const ev = this.tick(b, true);
      if (ev === 'water') {
        this.state = 'water';
        this.waterT = 0.9;
        b.vx = b.vy = 0;
        this.emit('water', { x: b.x, y: b.y });
      } else if (ev === 'sink') {
        const [cx, cy] = this.hole.cup;
        this.state = 'sunk';
        this.sinkT = 0;
        this.emit('sink', { x: cx, y: cy, speed: Math.hypot(b.vx, b.vy) });
      }
    }
    this.stepOthers();
    if (this.state === 'water') {
      this.waterT -= DT;
      if (this.waterT <= 0) {
        [b.x, b.y] = this.freeSpot([this.lastPos.x, this.lastPos.y], this.fieldBalls(b));
        b.warpLock = this.lastPos.warpLock;
        b.vx = b.vy = 0;
        this.state = 'ready';
        this.emit('reset', { penalty: 1 });
      }
      return;
    }
    if (this.state === 'sunk') {
      b.vx = b.vy = 0;
      return;
    }
    if (this.state === 'rolling') {
      const sp = Math.hypot(b.vx, b.vy);
      this.stopT = sp < 0.05 ? this.stopT + DT : 0;
      if (this.stopT > 0.25 && !this.othersMoving()) {
        b.vx = b.vy = 0;
        this.state = 'ready';
        this.emit('stop', { x: b.x, y: b.y });
      }
    }
  }
}
