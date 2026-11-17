// 2D rigid-body physics for boxes and circles. No DOM, so it also runs in Node tests.
// Method: sequential impulses with warm starting and feature-matched contacts (after
// Box2D Lite), plus restitution, island sleep, explosions, and impact reports.
// Units are meters, kilograms, and seconds. +y points up.

let nextId = 1;

export class Body {
  constructor(o) {
    this.id = nextId++;
    this.shape = o.shape || 'box';
    this.x = o.x;
    this.y = o.y;
    this.a = o.a || 0;
    this.vx = o.vx || 0;
    this.vy = o.vy || 0;
    this.av = o.av || 0;
    if (this.shape === 'box') {
      this.hw = o.w / 2;
      this.hh = o.h / 2;
    } else {
      this.r = o.r;
    }
    this.friction = o.friction ?? 0.6;
    this.restitution = o.restitution ?? 0.1;
    this.isStatic = !!o.static;
    this.linDamp = o.linDamp ?? 0.02;
    this.angDamp = o.angDamp ?? 0.1;
    this.gravityScale = o.gravityScale ?? 1;
    this.setDensity(o.density ?? 1, o.mass);
    this.sleeping = false;
    this.sleepTime = 0;
    this.removed = false;
    this.touching = false;
    this.data = o.data || {};
    this.c = Math.cos(this.a);
    this.s = Math.sin(this.a);
  }

  setDensity(density, mass) {
    if (this.isStatic) {
      this.mass = this.invMass = this.I = this.invI = 0;
      return;
    }
    const area = this.shape === 'box' ? 4 * this.hw * this.hh : Math.PI * this.r * this.r;
    this.mass = mass ?? density * area;
    this.I = this.shape === 'box' ? (this.mass * (4 * this.hw * this.hw + 4 * this.hh * this.hh)) / 12 : 0.5 * this.mass * this.r * this.r;
    this.invMass = 1 / this.mass;
    this.invI = 1 / this.I;
  }

  get awake() {
    return !this.isStatic && !this.sleeping;
  }

  wake() {
    if (this.isStatic) return;
    this.sleeping = false;
    this.sleepTime = 0;
  }

  applyImpulse(ix, iy, px = this.x, py = this.y) {
    if (this.isStatic) return;
    this.wake();
    this.vx += this.invMass * ix;
    this.vy += this.invMass * iy;
    this.av += this.invI * ((px - this.x) * iy - (py - this.y) * ix);
  }

  // Local corners for drawing and debris.
  extent() {
    if (this.shape === 'circle') return this.r;
    return Math.hypot(this.hw, this.hh);
  }
}

// ---------- Narrow phase ----------
// Each collide function pushes contacts { px, py, nx, ny, sep, key } with the normal from a to b.

function clipSegment(vIn, nx, ny, offset, clipEdge) {
  const out = [];
  const d0 = nx * vIn[0].x + ny * vIn[0].y - offset;
  const d1 = nx * vIn[1].x + ny * vIn[1].y - offset;
  if (d0 <= 0) out.push(vIn[0]);
  if (d1 <= 0) out.push(vIn[1]);
  if (d0 * d1 < 0) {
    const t = d0 / (d0 - d1);
    const v = {
      x: vIn[0].x + t * (vIn[1].x - vIn[0].x),
      y: vIn[0].y + t * (vIn[1].y - vIn[0].y),
    };
    if (d0 > 0) {
      v.i1 = clipEdge; v.o1 = vIn[0].o1; v.i2 = 0; v.o2 = vIn[0].o2;
    } else {
      v.i1 = vIn[1].i1; v.o1 = clipEdge; v.i2 = vIn[1].i2; v.o2 = 0;
    }
    out.push(v);
  }
  return out;
}

// Incident edge of box B (half sizes hx, hy) for reference normal (nx, ny).
function incidentEdge(B, hx, hy, nx, ny) {
  const c = B.c, s = B.s;
  // n in B's frame, sign flipped.
  const lx = -(c * nx + s * ny);
  const ly = -(-s * nx + c * ny);
  let v;
  if (Math.abs(lx) > Math.abs(ly)) {
    if (lx > 0) v = [{ x: hx, y: -hy, i2: 3, o2: 4 }, { x: hx, y: hy, i2: 4, o2: 1 }];
    else v = [{ x: -hx, y: hy, i2: 1, o2: 2 }, { x: -hx, y: -hy, i2: 2, o2: 3 }];
  } else if (ly > 0) v = [{ x: hx, y: hy, i2: 4, o2: 1 }, { x: -hx, y: hy, i2: 1, o2: 2 }];
  else v = [{ x: -hx, y: -hy, i2: 2, o2: 3 }, { x: hx, y: -hy, i2: 3, o2: 4 }];
  for (const p of v) {
    const x = p.x, y = p.y;
    p.x = B.x + c * x - s * y;
    p.y = B.y + s * x + c * y;
    p.i1 = 0;
    p.o1 = 0;
  }
  return v;
}

function collideBoxes(A, B, out) {
  const hAx = A.hw, hAy = A.hh, hBx = B.hw, hBy = B.hh;
  const cA = A.c, sA = A.s, cB = B.c, sB = B.s;
  const dpx = B.x - A.x, dpy = B.y - A.y;
  const dAx = cA * dpx + sA * dpy, dAy = -sA * dpx + cA * dpy;
  const dBx = cB * dpx + sB * dpy, dBy = -sB * dpx + cB * dpy;
  const c11 = cA * cB + sA * sB, c12 = -cA * sB + sA * cB;
  const c21 = -sA * cB + cA * sB, c22 = sA * sB + cA * cB;
  const a11 = Math.abs(c11), a12 = Math.abs(c12), a21 = Math.abs(c21), a22 = Math.abs(c22);

  const faceAx = Math.abs(dAx) - hAx - (a11 * hBx + a12 * hBy);
  const faceAy = Math.abs(dAy) - hAy - (a21 * hBx + a22 * hBy);
  if (faceAx > 0 || faceAy > 0) return;
  const faceBx = Math.abs(dBx) - (a11 * hAx + a21 * hAy) - hBx;
  const faceBy = Math.abs(dBy) - (a12 * hAx + a22 * hAy) - hBy;
  if (faceBx > 0 || faceBy > 0) return;

  const relTol = 0.95, absTol = 0.01;
  let axis = 0, sep = faceAx;
  let nx = dAx > 0 ? cA : -cA, ny = dAx > 0 ? sA : -sA;
  if (faceAy > relTol * sep + absTol * hAy) {
    axis = 1; sep = faceAy;
    nx = dAy > 0 ? -sA : sA; ny = dAy > 0 ? cA : -cA;
  }
  if (faceBx > relTol * sep + absTol * hBx) {
    axis = 2; sep = faceBx;
    nx = dBx > 0 ? cB : -cB; ny = dBx > 0 ? sB : -sB;
  }
  if (faceBy > relTol * sep + absTol * hBy) {
    axis = 3; sep = faceBy;
    nx = dBy > 0 ? -sB : sB; ny = dBy > 0 ? cB : -cB;
  }

  let fnx, fny, front, snx, sny, negSide, posSide, negEdge, posEdge, inc;
  if (axis === 0) {
    fnx = nx; fny = ny;
    front = A.x * fnx + A.y * fny + hAx;
    snx = -sA; sny = cA;
    const side = A.x * snx + A.y * sny;
    negSide = -side + hAy; posSide = side + hAy; negEdge = 3; posEdge = 1;
    inc = incidentEdge(B, hBx, hBy, fnx, fny);
  } else if (axis === 1) {
    fnx = nx; fny = ny;
    front = A.x * fnx + A.y * fny + hAy;
    snx = cA; sny = sA;
    const side = A.x * snx + A.y * sny;
    negSide = -side + hAx; posSide = side + hAx; negEdge = 2; posEdge = 4;
    inc = incidentEdge(B, hBx, hBy, fnx, fny);
  } else if (axis === 2) {
    fnx = -nx; fny = -ny;
    front = B.x * fnx + B.y * fny + hBx;
    snx = -sB; sny = cB;
    const side = B.x * snx + B.y * sny;
    negSide = -side + hBy; posSide = side + hBy; negEdge = 3; posEdge = 1;
    inc = incidentEdge(A, hAx, hAy, fnx, fny);
  } else {
    fnx = -nx; fny = -ny;
    front = B.x * fnx + B.y * fny + hBy;
    snx = cB; sny = sB;
    const side = B.x * snx + B.y * sny;
    negSide = -side + hBx; posSide = side + hBx; negEdge = 2; posEdge = 4;
    inc = incidentEdge(A, hAx, hAy, fnx, fny);
  }

  let cp = clipSegment(inc, -snx, -sny, negSide, negEdge);
  if (cp.length < 2) return;
  cp = clipSegment(cp, snx, sny, posSide, posEdge);
  if (cp.length < 2) return;

  for (let i = 0; i < 2; i++) {
    const v = cp[i];
    const s = fnx * v.x + fny * v.y - front;
    if (s <= 0) {
      let i1 = v.i1, o1 = v.o1, i2 = v.i2, o2 = v.o2;
      if (axis >= 2) {
        [i1, i2] = [i2, i1];
        [o1, o2] = [o2, o1];
      }
      out.push({ px: v.x - s * fnx, py: v.y - s * fny, nx, ny, sep: s, key: i1 + o1 * 5 + i2 * 25 + o2 * 125 });
    }
  }
}

function collideBoxCircle(A, B, out, flip) {
  const dx = B.x - A.x, dy = B.y - A.y;
  const lx = A.c * dx + A.s * dy, ly = -A.s * dx + A.c * dy;
  const hw = A.hw, hh = A.hh, r = B.r;
  let qx = lx < -hw ? -hw : lx > hw ? hw : lx;
  let qy = ly < -hh ? -hh : ly > hh ? hh : ly;
  let nlx, nly, sep;
  if (qx !== lx || qy !== ly) {
    const ex = lx - qx, ey = ly - qy;
    const d2 = ex * ex + ey * ey;
    if (d2 > r * r) return;
    const d = Math.sqrt(d2);
    nlx = ex / d; nly = ey / d;
    sep = d - r;
  } else {
    const px = hw - Math.abs(lx), py = hh - Math.abs(ly);
    if (px < py) {
      nlx = lx < 0 ? -1 : 1; nly = 0;
      sep = -px - r; qx = nlx * hw;
    } else {
      nlx = 0; nly = ly < 0 ? -1 : 1;
      sep = -py - r; qy = nly * hh;
    }
  }
  let nx = A.c * nlx - A.s * nly, ny = A.s * nlx + A.c * nly;
  const sx = A.x + A.c * qx - A.s * qy, sy = A.y + A.s * qx + A.c * qy;
  const px = sx + nx * sep * 0.5, py = sy + ny * sep * 0.5;
  if (flip) { nx = -nx; ny = -ny; }
  out.push({ px, py, nx, ny, sep, key: 1 });
}

function collideCircles(A, B, out) {
  const dx = B.x - A.x, dy = B.y - A.y;
  const rr = A.r + B.r;
  const d2 = dx * dx + dy * dy;
  if (d2 > rr * rr) return;
  const d = Math.sqrt(d2);
  const nx = d > 1e-9 ? dx / d : 0, ny = d > 1e-9 ? dy / d : 1;
  const sep = d - rr;
  out.push({ px: A.x + nx * (A.r + sep * 0.5), py: A.y + ny * (A.r + sep * 0.5), nx, ny, sep, key: 2 });
}

export function collide(a, b, out) {
  if (a.shape === 'box') {
    if (b.shape === 'box') collideBoxes(a, b, out);
    else collideBoxCircle(a, b, out, false);
  } else if (b.shape === 'box') collideBoxCircle(b, a, out, true);
  else collideCircles(a, b, out);
  return out;
}

// ---------- World ----------

const SLOP = 0.01;
const BAUMGARTE = 0.2;
const SLEEP_LIN = 0.06;
const SLEEP_ANG = 0.08;
const TIME_TO_SLEEP = 0.5;

export class World {
  constructor() {
    this.bodies = [];
    this.arbiters = new Map();
    this.gravity = -12;
    this.iterations = 10;
    this.stamp = 0;
    this.impacts = [];
    this.islands = [];
    this.time = 0;
  }

  add(b) {
    this.bodies.push(b);
    return b;
  }

  // Removes a body and wakes everything that touched it.
  remove(b) {
    if (b.removed) return;
    b.removed = true;
    for (const [k, arb] of this.arbiters) {
      if (arb.a === b || arb.b === b) {
        (arb.a === b ? arb.b : arb.a).wake();
        this.arbiters.delete(k);
      }
    }
    const i = this.bodies.indexOf(b);
    if (i >= 0) this.bodies.splice(i, 1);
  }

  clear() {
    this.bodies.length = 0;
    this.arbiters.clear();
    this.impacts.length = 0;
  }

  // Radial push from a point. Returns [{ body, f }] where f is 0..1 strength.
  explode(x, y, radius, power) {
    const hit = [];
    for (const b of this.bodies) {
      if (b.isStatic) continue;
      const dx = b.x - x, dy = b.y - y;
      const d = Math.max(0.05, Math.hypot(dx, dy) - b.extent() * 0.6);
      if (d > radius) continue;
      const f = 1 - d / radius;
      const len = Math.hypot(dx, dy) || 1;
      const imp = power * f * Math.sqrt(b.mass);
      b.applyImpulse((dx / len) * imp, (dy / len) * imp + imp * 0.25, b.x - (dx / len) * 0.05, b.y);
      hit.push({ body: b, f });
    }
    return hit;
  }

  broadphase() {
    const stamp = ++this.stamp;
    const bodies = this.bodies;
    const n = bodies.length;
    for (const b of bodies) {
      b.c = Math.cos(b.a);
      b.s = Math.sin(b.a);
      let ex, ey;
      if (b.shape === 'box') {
        const ac = Math.abs(b.c), as = Math.abs(b.s);
        ex = ac * b.hw + as * b.hh;
        ey = as * b.hw + ac * b.hh;
      } else ex = ey = b.r;
      b.minX = b.x - ex; b.maxX = b.x + ex;
      b.minY = b.y - ey; b.maxY = b.y + ey;
      b.touching = false;
    }
    const order = bodies.slice().sort((p, q) => p.minX - q.minX);
    const tmp = [];
    for (let i = 0; i < n; i++) {
      const A = order[i];
      for (let j = i + 1; j < n; j++) {
        const B = order[j];
        if (B.minX > A.maxX) break;
        if (B.minY > A.maxY || B.maxY < A.minY) continue;
        if (!A.awake && !B.awake) continue;
        if (A.data.group && A.data.group === B.data.group) continue;
        if ((A.data.noHit && A.data.noHit.includes(B.data.kind)) || (B.data.noHit && B.data.noHit.includes(A.data.kind))) continue;
        const a = A.id < B.id ? A : B;
        const b = a === A ? B : A;
        const key = a.id * 4194304 + b.id;
        tmp.length = 0;
        collide(a, b, tmp);
        const arb = this.arbiters.get(key);
        if (tmp.length) {
          if (arb) {
            // Keep accumulated impulses for contacts with the same feature (warm start).
            const merged = tmp.map((c) => {
              const old = arb.contacts.find((o) => o.key === c.key);
              c.Pn = old ? old.Pn : 0;
              c.Pt = old ? old.Pt : 0;
              c.fresh = !old;
              return c;
            });
            arb.contacts = merged;
            arb.stamp = stamp;
          } else {
            for (const c of tmp) {
              c.Pn = 0;
              c.Pt = 0;
              c.fresh = true;
            }
            this.arbiters.set(key, {
              a, b, contacts: tmp.slice(), stamp,
              friction: Math.sqrt(a.friction * b.friction),
              restitution: Math.max(a.restitution, b.restitution),
              fresh: true,
            });
          }
        } else if (arb) this.arbiters.delete(key);
      }
    }
    for (const [k, arb] of this.arbiters) {
      if (arb.stamp !== stamp && (arb.a.awake || arb.b.awake)) this.arbiters.delete(k);
    }
  }

  // Groups touching dynamic bodies. An island wakes as a whole and sleeps as a whole.
  buildIslands() {
    const dyn = [];
    for (const b of this.bodies) {
      if (b.isStatic) continue;
      b.uf = dyn.length;
      dyn.push(b);
    }
    const parent = dyn.map((_, i) => i);
    const find = (i) => {
      while (parent[i] !== i) {
        parent[i] = parent[parent[i]];
        i = parent[i];
      }
      return i;
    };
    for (const arb of this.arbiters.values()) {
      if (arb.a.isStatic || arb.b.isStatic) continue;
      const ra = find(arb.a.uf), rb = find(arb.b.uf);
      if (ra !== rb) parent[ra] = rb;
    }
    const groups = new Map();
    for (let i = 0; i < dyn.length; i++) {
      const r = find(i);
      let g = groups.get(r);
      if (!g) groups.set(r, (g = []));
      g.push(dyn[i]);
    }
    this.islands = [...groups.values()];
    for (const isl of this.islands) {
      if (isl.some((b) => !b.sleeping)) for (const b of isl) if (b.sleeping) b.wake();
    }
  }

  step(dt) {
    const inv = 1 / dt;
    this.time += dt;
    this.impacts.length = 0;
    this.broadphase();
    this.buildIslands();

    for (const b of this.bodies) {
      if (!b.awake) continue;
      b.vy += this.gravity * b.gravityScale * dt;
      const ld = 1 / (1 + dt * b.linDamp);
      b.vx *= ld;
      b.vy *= ld;
      b.av *= 1 / (1 + dt * b.angDamp);
    }

    const active = [];
    for (const arb of this.arbiters.values()) {
      if (arb.a.awake || arb.b.awake) active.push(arb);
    }

    // Impact speeds before any impulse changes the velocities.
    for (const arb of active) {
      const A = arb.a, B = arb.b;
      A.touching = B.touching = true;
      let best = 0, bc = null;
      for (const c of arb.contacts) {
        const r1x = c.px - A.x, r1y = c.py - A.y, r2x = c.px - B.x, r2y = c.py - B.y;
        const dvx = B.vx - B.av * r2y - A.vx + A.av * r1y;
        const dvy = B.vy + B.av * r2x - A.vy - A.av * r1x;
        const vn = dvx * c.nx + dvy * c.ny;
        c.vn0 = vn;
        if (-vn > best) {
          best = -vn;
          bc = c;
        }
      }
      if (best > 0.8 && bc) this.impacts.push({ a: A, b: B, speed: best, x: bc.px, y: bc.py, nx: bc.nx, ny: bc.ny });
    }

    // Pre-step: effective masses, bias, warm start.
    for (const arb of active) {
      const A = arb.a, B = arb.b;
      for (const c of arb.contacts) {
        const r1x = (c.r1x = c.px - A.x), r1y = (c.r1y = c.py - A.y);
        const r2x = (c.r2x = c.px - B.x), r2y = (c.r2y = c.py - B.y);
        const rn1 = r1x * c.nx + r1y * c.ny, rn2 = r2x * c.nx + r2y * c.ny;
        let k = A.invMass + B.invMass + A.invI * (r1x * r1x + r1y * r1y - rn1 * rn1) + B.invI * (r2x * r2x + r2y * r2y - rn2 * rn2);
        c.massN = 1 / k;
        const tx = c.ny, ty = -c.nx;
        const rt1 = r1x * tx + r1y * ty, rt2 = r2x * tx + r2y * ty;
        k = A.invMass + B.invMass + A.invI * (r1x * r1x + r1y * r1y - rt1 * rt1) + B.invI * (r2x * r2x + r2y * r2y - rt2 * rt2);
        c.massT = 1 / k;
        c.bias = -BAUMGARTE * inv * Math.min(0, c.sep + SLOP);
        if (c.vn0 < -1.2 && arb.restitution > 0) c.bias = Math.max(c.bias, -arb.restitution * c.vn0);
        const Px = c.Pn * c.nx + c.Pt * tx, Py = c.Pn * c.ny + c.Pt * ty;
        A.vx -= A.invMass * Px; A.vy -= A.invMass * Py;
        A.av -= A.invI * (r1x * Py - r1y * Px);
        B.vx += B.invMass * Px; B.vy += B.invMass * Py;
        B.av += B.invI * (r2x * Py - r2y * Px);
      }
    }

    for (let it = 0; it < this.iterations; it++) {
      for (const arb of active) {
        const A = arb.a, B = arb.b;
        for (const c of arb.contacts) {
          const r1x = c.r1x, r1y = c.r1y, r2x = c.r2x, r2y = c.r2y;
          let dvx = B.vx - B.av * r2y - A.vx + A.av * r1y;
          let dvy = B.vy + B.av * r2x - A.vy - A.av * r1x;
          const vn = dvx * c.nx + dvy * c.ny;
          let dPn = c.massN * (-vn + c.bias);
          const Pn0 = c.Pn;
          c.Pn = Math.max(Pn0 + dPn, 0);
          dPn = c.Pn - Pn0;
          let Px = dPn * c.nx, Py = dPn * c.ny;
          A.vx -= A.invMass * Px; A.vy -= A.invMass * Py;
          A.av -= A.invI * (r1x * Py - r1y * Px);
          B.vx += B.invMass * Px; B.vy += B.invMass * Py;
          B.av += B.invI * (r2x * Py - r2y * Px);

          dvx = B.vx - B.av * r2y - A.vx + A.av * r1y;
          dvy = B.vy + B.av * r2x - A.vy - A.av * r1x;
          const tx = c.ny, ty = -c.nx;
          const vt = dvx * tx + dvy * ty;
          let dPt = c.massT * -vt;
          const maxPt = arb.friction * c.Pn;
          const Pt0 = c.Pt;
          c.Pt = Math.max(-maxPt, Math.min(maxPt, Pt0 + dPt));
          dPt = c.Pt - Pt0;
          Px = dPt * tx; Py = dPt * ty;
          A.vx -= A.invMass * Px; A.vy -= A.invMass * Py;
          A.av -= A.invI * (r1x * Py - r1y * Px);
          B.vx += B.invMass * Px; B.vy += B.invMass * Py;
          B.av += B.invI * (r2x * Py - r2y * Px);
        }
      }
    }

    for (const b of this.bodies) {
      if (!b.awake) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.a += b.av * dt;
    }

    // Sleep: a whole island sleeps when all its bodies stayed slow for a while.
    for (const isl of this.islands) {
      let minT = Infinity;
      for (const b of isl) {
        if (b.removed) continue;
        if (b.vx * b.vx + b.vy * b.vy > SLEEP_LIN * SLEEP_LIN || Math.abs(b.av) > SLEEP_ANG || b.data.noSleep) b.sleepTime = 0;
        else b.sleepTime += dt;
        minT = Math.min(minT, b.sleepTime);
      }
      if (minT >= TIME_TO_SLEEP) {
        for (const b of isl) {
          b.sleeping = true;
          b.vx = b.vy = b.av = 0;
        }
      }
    }
  }

  // Puts every dynamic body to sleep (used after a level settles).
  sleepAll() {
    for (const b of this.bodies) {
      if (b.isStatic) continue;
      b.sleeping = true;
      b.vx = b.vy = b.av = 0;
    }
  }

  get allAsleep() {
    for (const b of this.bodies) if (b.awake) return false;
    return true;
  }
}
