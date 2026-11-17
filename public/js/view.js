// Course renderer. tilt = 0 draws flat top-down; tilt > 0 draws 2.5D: a tilted camera,
// walls and buildings with height, a course "table" with a front edge, drawn back to front.
import { TAU } from './util.js';
import { drawBall } from './ballart.js';
import { BALL_R } from './golf.js';
import { THEMES } from './themes.js';
import { seeded, bbox, decorate, belt, boost, portal, post, postHeight, styledBumper, cylinder } from './scenery.js';

export { THEMES };

const INK = '#2a1533';
const SHADOW = 'rgba(16,40,8,0.3)';
// The flag in world units: a pole, and a cloth in the upright plane (dx along x, z up).
// shape(t) gives [start, curve, corner, corner, curve, end] for a gently waving cloth.
const FLAG = {
  pole: 2.5,
  shape(t) {
    const w = Math.sin(t * 4) * 0.06;
    return [[0, 2.5], [0.5, 2.5 + w], [1.05, 2.44], [1.05, 1.92], [0.5, 1.9 - w], [0, 1.84]];
  },
};

export class View {
  constructor() {
    this.tilt = 0;
    this.s = 40;
    this.ox = 0;
    this.oy = 0;
    this.k = 1;
    this.hz = 0;
  }

  // Fits the hole into a screen rectangle (x, y, w, h).
  fit(b, rx, ry, rw, rh, tilt) {
    this.tilt = tilt;
    this.k = tilt ? Math.cos(tilt) : 1;
    this.hz = tilt ? Math.sin(tilt) : 0;
    const pad = 1.1;
    const w = b.x1 - b.x0 + pad * 2, h = b.y1 - b.y0 + pad * 2;
    const top = tilt ? 3.4 * this.hz : 0; // room for the windmill roof and the flag
    const bottom = tilt ? 0.8 * this.hz : 0; // the course table's front edge
    this.s = Math.min(rw / w, rh / (h * this.k + top + bottom));
    this.ox = rx + (rw - (b.x1 + b.x0) * this.s) / 2;
    this.oy = ry + (rh - (b.y1 + b.y0) * this.s * this.k) / 2 + ((top - bottom) * this.s) / 2;
  }

  P(x, y, z = 0) {
    return [this.ox + x * this.s, this.oy + y * this.s * this.k - z * this.s * this.hz];
  }

  path(ctx, pts, z = 0) {
    ctx.beginPath();
    pts.forEach(([x, y], i) => {
      const [a, b] = this.P(x, y, z);
      i ? ctx.lineTo(a, b) : ctx.moveTo(a, b);
    });
    ctx.closePath();
  }

  // Ground shadow offset of a point at height h (light from the top left, 45 degrees up).
  shadowOff(h) {
    return [this.s * h * 0.4, this.s * h * 0.4 * this.k];
  }

  // A box of height h casts the base, the raised top, and everything in between.
  prismShadow(ctx, pts, h) {
    const [ox, oy] = this.shadowOff(h);
    const base = pts.map(([x, y]) => this.P(x, y, 0));
    const top = base.map(([a, b]) => [a + ox, b + oy]);
    const quad = (A) => {
      ctx.beginPath();
      A.forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b)));
      ctx.closePath();
      ctx.fill();
    };
    quad(base);
    quad(top);
    for (let i = 0; i < base.length; i++) {
      const j = (i + 1) % base.length;
      quad([base[i], base[j], top[j], top[i]]);
    }
  }

  // All shadows go on one layer first, so they never paint over solid things and never
  // get darker where two of them overlap.
  drawShadows(ctx, golf, ball, W, H, dpr, theme = 'garden', waiting = []) {
    const T = THEMES[theme];
    if (!this.sh || this.sh.width !== Math.ceil(W * dpr) || this.sh.height !== Math.ceil(H * dpr)) {
      this.sh = document.createElement('canvas');
      this.sh.width = Math.ceil(W * dpr);
      this.sh.height = Math.ceil(H * dpr);
    }
    const c = this.sh.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.sh.width, this.sh.height);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = '#000';
    c.strokeStyle = '#000';
    const houses = golf.movers.filter((m) => m.type === 'windmill');
    for (const b of golf.walls) {
      if (b.data.kind === 'block' && houses.some((m) => this.inHouse(b, m))) continue;
      this.prismShadow(c, this.corners(b), b.data.kind === 'block' ? 1.2 : 0.42);
    }
    for (const m of golf.movers) {
      if (m.type === 'slider') this.prismShadow(c, this.corners(m.body), 0.6);
      if (m.type === 'windmill') {
        const [x0, y0, x1, y1] = m.house;
        this.prismShadow(c, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], 2.4);
        for (const a of m.angles || []) {
          const ca = Math.cos(a), sa = Math.sin(a);
          const pt = (t, w) => {
            const x = m.x + ca * t - sa * w, z = Math.max(0, m.hubZ + sa * t + ca * w);
            const [gx, gy] = this.P(x, m.face + 0.12, 0), [ox, oy] = this.shadowOff(z);
            return [gx + ox, gy + oy];
          };
          c.beginPath();
          [pt(0.15, -0.08), pt(m.len, -m.width / 2), pt(m.len, m.width / 2), pt(0.15, 0.08)].forEach(([a2, b2], i) => (i ? c.lineTo(a2, b2) : c.moveTo(a2, b2)));
          c.closePath();
          c.fill();
        }
      }
    }
    for (const b of golf.bumpers) this.cylShadow(c, b.x, b.y, b.r, 0.5);
    for (const b of golf.posts || []) {
      this.cylShadow(c, b.x, b.y, b.r, postHeight(T, b));
      if (T.post === 'lollipop') {
        const [gx, gy] = this.P(b.x, b.y, 0), [ox, oy] = this.shadowOff(2.25);
        c.beginPath();
        c.ellipse(gx + ox, gy + oy, 0.8 * this.s, 0.8 * this.s * this.k, 0, 0, TAU);
        c.fill();
      }
    }
    for (const m of golf.movers) {
      if (m.type !== 'spinner') continue;
      this.prismShadow(c, this.corners(m.body), 0.45);
      this.cylShadow(c, m.x, m.y, 0.3, 0.7);
    }
    // Flag pole and flag (the same world shape the flag is drawn with).
    const [fx, fy] = golf.hole.cup;
    const sp = (x, z) => {
      const [gx, gy] = this.P(x, fy, 0), [ox, oy] = this.shadowOff(z);
      return [gx + ox, gy + oy];
    };
    c.lineWidth = Math.max(3, this.s * 0.08);
    c.beginPath();
    c.moveTo(...this.P(fx, fy, 0));
    c.lineTo(...sp(fx, FLAG.pole));
    c.stroke();
    c.beginPath();
    FLAG.shape(0).forEach(([dx, z], i) => (i ? c.lineTo(...sp(fx + dx, z)) : c.moveTo(...sp(fx + dx, z))));
    c.closePath();
    c.fill();
    for (const bl of [ball, ...waiting]) {
      if (!bl || bl.hidden) continue;
      const z = BALL_R + (bl.z || 0);
      const [gx, gy] = this.P(bl.x, bl.y, 0), [ox, oy] = this.shadowOff(z);
      const r = BALL_R * this.s * (bl.scale || 1);
      c.beginPath();
      c.ellipse(gx + ox, gy + oy, r * 1.05, r * this.k, 0, 0, TAU);
      c.fill();
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 0.26;
    ctx.drawImage(this.sh, 0, 0);
    ctx.restore();
  }

  // Shadow of an upright cylinder: its base, its top moved by the light, and the band
  // between them.
  cylShadow(c, x, y, r, h) {
    const [gx, gy] = this.P(x, y, 0), [ox, oy] = this.shadowOff(h);
    const rx = r * this.s, ry = r * this.s * this.k;
    c.beginPath();
    c.ellipse(gx, gy, rx, ry, 0, 0, TAU);
    c.ellipse(gx + ox, gy + oy, rx, ry, 0, 0, TAU);
    c.fill();
    const L = Math.hypot(ox, oy) || 1, px = (-oy / L) * rx, py = (ox / L) * ry;
    c.beginPath();
    c.moveTo(gx + px, gy + py);
    c.lineTo(gx + ox + px, gy + oy + py);
    c.lineTo(gx + ox - px, gy + oy - py);
    c.lineTo(gx - px, gy - py);
    c.fill();
  }

  inHouse(b, m) {
    return b.x > m.house[0] && b.x < m.house[2] && b.y > m.house[1] && b.y < m.house[3];
  }

  // ---------- Scenery and ground ----------
  drawBackground(ctx, W, H, hole, theme) {
    const T = THEMES[theme];
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, T.bg[0]);
    g.addColorStop(1, T.bg[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const B = this.boundsPx(hole);
    const away = (x, y, m) => x < B.x0 - m || x > B.x1 + m || y < B.y0 - m || y > B.y1 + m;
    this.bushes = [];
    if (T.decor !== 'garden') {
      decorate(this, ctx, W, H, hole, T, away);
      return;
    }
    // Grass texture.
    const R = seeded(3);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 260; i++) {
      const x = R() * W, y = R() * H;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 2, y - 6);
      ctx.stroke();
    }
    // Flower clusters, away from the course.
    for (let i = 0; i < 160; i++) {
      const x = R() * W, y = R() * H, r = 2 + R() * 3.5;
      if (!away(x, y, 12)) continue;
      ctx.fillStyle = T.flowers[i % 4];
      for (let k = 0; k < 5; k++) {
        ctx.beginPath();
        ctx.arc(x + Math.cos((k / 5) * TAU) * r, y + Math.sin((k / 5) * TAU) * r, r * 0.62, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#ffcf3a';
      ctx.beginPath();
      ctx.arc(x, y, r * 0.45, 0, TAU);
      ctx.fill();
    }
    for (let i = 0; i < 40; i++) {
      const x = R() * W, y = R() * H, r = this.s * (0.6 + R() * 0.7);
      if (away(x, y, r + 14)) this.bushes.push({ x, y, r });
    }
    this.bushes.sort((a, b) => a.y - b.y);
    for (const b of this.bushes) this.bush(ctx, b, T);
  }

  boundsPx(hole) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of hole.outline) {
      for (const z of [0, 0.6]) {
        const [a, b] = this.P(x, y, z);
        x0 = Math.min(x0, a);
        x1 = Math.max(x1, a);
        y0 = Math.min(y0, b);
        y1 = Math.max(y1, b);
      }
    }
    const m = this.s * 0.7;
    return { x0: x0 - m, y0: y0 - m, x1: x1 + m, y1: y1 + m * 1.6 };
  }

  bush(ctx, b, T) {
    const lift = this.tilt ? b.r * 0.55 : 0;
    ctx.beginPath();
    ctx.ellipse(b.x + b.r * 0.35, b.y + b.r * 0.35, b.r * 1.05, b.r * 0.8 * (this.tilt ? 0.7 : 1), 0, 0, TAU);
    ctx.fillStyle = SHADOW;
    ctx.fill();
    const R = seeded(Math.round(b.x * 13 + b.y));
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * TAU + R();
      const x = b.x + Math.cos(a) * b.r * 0.45, y = b.y - lift + Math.sin(a) * b.r * 0.35;
      ctx.beginPath();
      ctx.arc(x, y, b.r * 0.62, 0, TAU);
      const g = ctx.createRadialGradient(x - b.r * 0.2, y - b.r * 0.25, 0, x, y, b.r * 0.62);
      g.addColorStop(0, T.bush[0]);
      g.addColorStop(1, T.bush[1]);
      ctx.fillStyle = g;
      ctx.fill();
    }
    ctx.fillStyle = '#ff5a6a';
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.arc(b.x + (R() - 0.5) * b.r, b.y - lift + (R() - 0.5) * b.r * 0.7, Math.max(1.5, b.r * 0.09), 0, TAU);
      ctx.fill();
    }
  }

  // The outline pushed out by the rail width, with mitered corners: the table's edge.
  outer(hole) {
    const pts = hole.outline, n = pts.length, d = 0.5;
    const off = (i) => {
      const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % n], L = Math.hypot(x2 - x1, y2 - y1);
      const nx = (y2 - y1) / L, ny = -(x2 - x1) / L;
      return [x1 + nx * d, y1 + ny * d, x2 - x1, y2 - y1];
    };
    return pts.map((_, i) => {
      const [ax, ay, adx, ady] = off((i + n - 1) % n), [bx, by, bdx, bdy] = off(i);
      const den = adx * bdy - ady * bdx;
      if (Math.abs(den) < 1e-9) return [bx, by];
      const t = ((bx - ax) * bdy - (by - ay) * bdx) / den;
      return [ax + adx * t, ay + ady * t];
    });
  }

  drawCourse(ctx, hole, theme, time, teeSpots = null) {
    const T = THEMES[theme];
    const out = hole.outline;
    const rim = this.outer(hole);
    // Course table: a front edge in 2.5D, a soft shadow in both styles.
    ctx.save();
    const [sx, sy] = this.shadowOff(0.6);
    ctx.translate(sx, sy);
    this.path(ctx, rim);
    ctx.fillStyle = SHADOW;
    ctx.fill();
    ctx.restore();
    if (this.tilt) {
      for (let i = 0; i < rim.length; i++) {
        const p = rim[i], q = rim[(i + 1) % rim.length];
        if (p[0] - q[0] <= 0) continue; // faces away from the camera
        ctx.beginPath();
        ctx.moveTo(...this.P(p[0], p[1], 0));
        ctx.lineTo(...this.P(q[0], q[1], 0));
        ctx.lineTo(...this.P(q[0], q[1], -0.65));
        ctx.lineTo(...this.P(p[0], p[1], -0.65));
        ctx.closePath();
        ctx.fillStyle = T.base[1];
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = INK;
        ctx.stroke();
      }
    }
    this.path(ctx, out);
    ctx.fillStyle = T.felt[0];
    ctx.fill();
    ctx.save();
    this.path(ctx, out);
    ctx.clip();
    ctx.fillStyle = T.felt[1];
    for (let i = -40; i < 40; i += 2) {
      ctx.beginPath();
      ctx.moveTo(...this.P(i, -10));
      ctx.lineTo(...this.P(i + 1, -10));
      ctx.lineTo(...this.P(i + 9, 30));
      ctx.lineTo(...this.P(i + 8, 30));
      ctx.fill();
    }
    for (const p of hole.sand || []) this.sand(ctx, p, T);
    for (const p of hole.ice || []) this.ice(ctx, p);
    for (const s of hole.slopes || []) this.slope(ctx, s, time);
    for (const p of hole.water || []) this.water(ctx, p, time, T);
    for (const b of hole.belts || []) belt(this, ctx, b, time);
    for (const b of hole.boosts || []) boost(this, ctx, b, time);
    (hole.portals || []).forEach(([ax, ay, bx, by], i) => {
      portal(this, ctx, ax, ay, i, time, 0);
      portal(this, ctx, bx, by, i, time, 1);
    });
    // Soft shade where the felt meets the walls.
    this.path(ctx, out);
    ctx.lineWidth = this.s * 0.5;
    ctx.strokeStyle = T.edge;
    ctx.stroke();
    ctx.restore();
    this.tee(ctx, hole.tee, T, teeSpots);
  }

  // The tee mat. With several balls on the tee (take turns) it grows to hold them all.
  tee(ctx, [x, y], T, spots) {
    const s = this.s;
    let x0 = x - 0.75, y0 = y - 0.75, x1 = x + 0.75, y1 = y + 0.75;
    for (const [px, py] of spots || []) {
      const m = BALL_R + 0.22;
      x0 = Math.min(x0, px - m);
      y0 = Math.min(y0, py - m);
      x1 = Math.max(x1, px + m);
      y1 = Math.max(y1, py + m);
    }
    const [a, b] = this.P(x0, y0), [c, d] = this.P(x1, y1);
    ctx.beginPath();
    ctx.roundRect(a, b, c - a, d - b, s * 0.15);
    ctx.fillStyle = T ? T.tee : '#3f9a3a';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    const ni = Math.floor((x1 - x - 0.18) / 0.28), nj = Math.floor((y1 - y - 0.18) / 0.28);
    const mi = Math.floor((x - x0 - 0.18) / 0.28), mj = Math.floor((y - y0 - 0.18) / 0.28);
    for (let i = -mi; i <= ni; i++) {
      for (let j = -mj; j <= nj; j++) {
        const [px, py] = this.P(x + i * 0.28, y + j * 0.28);
        ctx.beginPath();
        ctx.arc(px, py, Math.max(1, s * 0.045), 0, TAU);
        ctx.fill();
      }
    }
  }

  sand(ctx, p, T) {
    const S = (T && T.sand) || THEMES.garden.sand;
    const [x0, y0, x1, y1] = bbox(p);
    this.path(ctx, p);
    ctx.fillStyle = S.fill;
    ctx.fill();
    ctx.save();
    ctx.clip();
    const R = seeded(5);
    for (let i = 0; i < 320; i++) {
      const [a, b] = this.P(x0 + R() * (x1 - x0), y0 + R() * (y1 - y0));
      ctx.fillStyle = S.dots[Math.floor(R() * S.dots.length)];
      ctx.fillRect(a, b, 1.8, 1.8);
    }
    // Rake lines (ripples in snow).
    ctx.strokeStyle = S.rake;
    ctx.lineWidth = 2;
    for (let y = y0 + 0.5; y < y1; y += 0.6) {
      ctx.beginPath();
      for (let x = x0; x <= x1; x += 0.25) {
        const [a, b] = this.P(x, y + Math.sin(x * 2) * 0.08);
        x === x0 ? ctx.moveTo(a, b) : ctx.lineTo(a, b);
      }
      ctx.stroke();
    }
    ctx.restore();
    this.path(ctx, p);
    ctx.lineWidth = 3;
    ctx.strokeStyle = S.edge;
    ctx.stroke();
  }

  ice(ctx, p) {
    const [x0, y0] = bbox(p);
    this.path(ctx, p);
    ctx.fillStyle = 'rgba(220,248,255,0.9)';
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 3;
    for (let i = 0; i < Math.ceil((bbox(p)[2] - x0) / 0.9) + 2; i++) {
      const [a, b] = this.P(x0 + i * 0.9, y0 + 0.4);
      ctx.beginPath();
      ctx.moveTo(a, b);
      ctx.lineTo(a + this.s * 0.9, b + this.s * 0.9 * this.k);
      ctx.stroke();
    }
    ctx.restore();
    this.path(ctx, p);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(120,200,240,0.9)';
    ctx.stroke();
  }

  slope(ctx, s, time) {
    const [x0, y0] = s.poly[0], x1 = s.poly[1][0], y1 = s.poly[2][1];
    this.path(ctx, s.poly);
    const [ax, ay] = this.P(x0, y0), [bx, by] = this.P(x0 + s.dir[0] * (x1 - x0), y0 + s.dir[1] * (y1 - y0));
    const g = ctx.createLinearGradient(ax, ay, bx || ax + 1, by || ay + 1);
    g.addColorStop(0, 'rgba(255,255,255,0.14)');
    g.addColorStop(1, 'rgba(20,70,10,0.22)');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    const off = (time * 0.9) % 1.6;
    for (let x = x0 + 0.8; x < x1; x += 1.6) {
      for (let y = y0 + off; y < y1; y += 1.6) {
        ctx.beginPath();
        ctx.moveTo(...this.P(x - 0.35 * s.dir[1] - 0.2 * s.dir[0], y - 0.35 * s.dir[0] - 0.2 * s.dir[1]));
        ctx.lineTo(...this.P(x + 0.2 * s.dir[0], y + 0.2 * s.dir[1]));
        ctx.lineTo(...this.P(x + 0.35 * s.dir[1] - 0.2 * s.dir[0], y + 0.35 * s.dir[0] - 0.2 * s.dir[1]));
        ctx.stroke();
      }
    }
  }

  water(ctx, p, time, T) {
    T = T || THEMES.garden;
    const [x0, y0, x1, y1] = bbox(p);
    this.path(ctx, p);
    const [ax, ay] = this.P(x0, y0), [bx, by] = this.P(x1, y1);
    const g = ctx.createLinearGradient(ax, ay, bx, by);
    g.addColorStop(0, T.water[0]);
    g.addColorStop(1, T.water[1]);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    ctx.clip();
    const R = seeded(9);
    ctx.strokeStyle = T.pads === 'marsh' ? 'rgba(255,220,180,0.45)' : 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    const n = Math.round(((x1 - x0) * (y1 - y0)) / 2) + 4;
    for (let i = 0; i < n; i++) {
      const x = x0 + R() * (x1 - x0), y = y0 + R() * (y1 - y0);
      const w = 0.45 + 0.25 * Math.sin(time * 2 + i);
      ctx.beginPath();
      ctx.moveTo(...this.P(x - w, y));
      ctx.quadraticCurveTo(...this.P(x, y - 0.18), ...this.P(x + w, y));
      ctx.stroke();
    }
    // Lily pads, foam, marshmallows, or ice floes.
    for (let i = 0; i < 2; i++) {
      const x = x0 + (0.25 + i * 0.5) * (x1 - x0), y = y0 + (0.3 + i * 0.35) * (y1 - y0);
      const bob = Math.sin(time * 1.5 + i * 2) * 0.05;
      const [a, b] = this.P(x, y + bob);
      const r = this.s * 0.38, k = this.k;
      ctx.beginPath();
      if (T.pads === 'lily') {
        ctx.ellipse(a, b, r, r * k, 0, 0.3, TAU - 0.3);
        ctx.lineTo(a, b);
        ctx.fillStyle = '#4fbf4a';
        ctx.fill();
      } else if (T.pads === 'marsh') {
        ctx.roundRect(a - r * 0.8, b - r * 0.55, r * 1.6, r * 1.1, r * 0.35);
        ctx.fillStyle = '#fff7fb';
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = INK;
        ctx.stroke();
      } else if (T.pads === 'floe') {
        for (let j = 0; j < 6; j++) {
          const t = (j / 6) * TAU;
          ctx.lineTo(a + Math.cos(t) * r * (0.8 + ((i + j) % 3) * 0.15), b + Math.sin(t) * r * k * (0.8 + ((i * 2 + j) % 3) * 0.15));
        }
        ctx.closePath();
        ctx.fillStyle = '#f2fbff';
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(80,140,190,0.8)';
        ctx.stroke();
      } else {
        ctx.ellipse(a, b, r * 0.9, r * 0.3 * k, 0, 0, TAU);
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fill();
      }
    }
    ctx.restore();
    this.path(ctx, p);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.stroke();
  }

  // ---------- Solid things, back to front ----------
  drawSolids(ctx, golf, theme, time, ball, holeNo, waiting = []) {
    this.ctxRef = ctx;
    const T = THEMES[theme];
    const list = [];
    const houses = golf.movers.filter((m) => m.type === 'windmill');
    for (const b of golf.walls) {
      if (b.data.kind === 'block' && houses.some((m) => this.inHouse(b, m))) continue;
      const block = b.data.kind === 'block';
      const h = block ? 1.2 : 0.42, col = block ? T.block : T.rail;
      const deco = block ? T.blockDeco : T.railDeco;
      this.pushBox(list, b, h, col, deco);
    }
    golf.bumpers.forEach((b, i) => list.push({ y: b.y + b.r, draw: () => (T.bumperStyle === 'jelly' ? this.bumper(ctx, b, T, time) : styledBumper(this, ctx, b, T, time, i)) }));
    for (const b of golf.posts || []) list.push({ y: b.y + b.r, draw: () => post(this, ctx, b, T, time) });
    for (const m of golf.movers) {
      if (m.type === 'slider') list.push({ y: this.front(m.body), draw: () => this.box(ctx, this.corners(m.body), 0.6, T.slider, false, true) });
      if (m.type === 'windmill') list.push({ y: m.house[3], draw: () => this.windmill(ctx, m, T, time) });
      if (m.type === 'spinner') {
        this.pushBox(list, m.body, 0.45, T.spin, T.spinDeco, 4);
        list.push({ y: m.y + 0.3, draw: () => cylinder(this, ctx, m.x, m.y, 0.3, 0.3, 0, 0.7, T.spin[2], T.spin[0]) });
      }
    }
    const [cx, cy] = golf.hole.cup;
    this.cup(ctx, cx, cy);
    list.push({ y: cy, draw: () => this.flag(ctx, cx, cy, time, holeNo) });
    for (const w of waiting) list.push({ y: w.y + BALL_R, draw: () => this.ball(ctx, w, time) });
    if (ball && !ball.hidden) list.push({ y: ball.y + BALL_R + 1e-6, draw: () => this.ball(ctx, ball, time) });
    list.sort((a, b) => a.y - b.y);
    for (const it of list) it.draw();
  }

  // Adds a box to the draw list. Long diagonal boxes go in short pieces, each sorted by its
  // own front edge, so the ball is drawn in front of or behind each piece correctly.
  pushBox(list, b, h, col, deco, pieces = 0) {
    const diag = Math.abs(Math.sin(2 * b.a)) > 0.05 && b.data.w > 1.6;
    const n = pieces || (diag ? Math.ceil(b.data.w / 1.2) : 1);
    const draw = (q) => this.box(this.ctxRef, this.corners(q), h, col, deco === 'wood', deco === 'stripes', deco);
    if (n === 1) {
      list.push({ y: this.front(b), draw: () => draw(b) });
      return;
    }
    const c = Math.cos(b.a), s = Math.sin(b.a);
    for (let i = 0; i < n; i++) {
      const f = (i + 0.5) / n - 0.5;
      const piece = { x: b.x + c * b.data.w * f, y: b.y + s * b.data.w * f, a: b.a, data: { w: b.data.w / n + 0.01, h: b.data.h } };
      list.push({ y: this.front(piece), draw: () => draw(piece) });
    }
  }

  corners(b) {
    const c = Math.cos(b.a), s = Math.sin(b.a), hw = b.data.w / 2, hh = b.data.h / 2;
    return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => [b.x + c * x - s * y, b.y + s * x + c * y]);
  }

  front(b) {
    return Math.max(...this.corners(b).map((p) => p[1]));
  }

  // Extruded box from z0 to z0 + h: the faces toward the camera (2.5D), then the top.
  // deco: wood grain, warning stripes, or a theme look (cane, drift, snow, choc, ice, castle).
  box(ctx, pts, h, col, wood, stripes, deco, z0 = 0) {
    const zt = this.tilt ? z0 + h : 0;
    if (this.tilt) {
      for (let i = 0; i < 4; i++) {
        const p = pts[i], q = pts[(i + 1) % 4];
        if (p[0] - q[0] <= 0.001) continue;
        const quad = [this.P(p[0], p[1], z0), this.P(q[0], q[1], z0), this.P(q[0], q[1], zt), this.P(p[0], p[1], zt)];
        const pathQ = () => {
          ctx.beginPath();
          quad.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
          ctx.closePath();
        };
        pathQ();
        ctx.fillStyle = col[2];
        if (deco === 'ice') ctx.globalAlpha = 0.85;
        ctx.fill();
        ctx.globalAlpha = 1;
        if (deco === 'cane' || deco === 'snow') {
          ctx.save();
          pathQ();
          ctx.clip();
          if (deco === 'cane') {
            ctx.strokeStyle = '#ff3b5c';
            ctx.lineWidth = this.s * 0.16;
            const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
            for (let t = -0.5; t < L + 0.5; t += 0.5) {
              const f0 = t / L, f1 = (t + 0.35) / L;
              ctx.beginPath();
              ctx.moveTo(...this.P(p[0] + (q[0] - p[0]) * f0, p[1] + (q[1] - p[1]) * f0, z0));
              ctx.lineTo(...this.P(p[0] + (q[0] - p[0]) * f1, p[1] + (q[1] - p[1]) * f1, zt));
              ctx.stroke();
            }
          } else {
            // Snow hangs over the front edge in soft lumps.
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(...quad[3]);
            ctx.lineTo(...quad[2]);
            const L = Math.hypot(q[0] - p[0], q[1] - p[1]), n = Math.max(2, Math.round(L / 0.45));
            for (let j = n; j >= 0; j--) {
              const f = j / n, dz = h * (0.28 + 0.14 * Math.sin(j * 2.3));
              ctx.lineTo(...this.P(p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f, zt - dz));
            }
            ctx.closePath();
            ctx.fill();
          }
          ctx.restore();
        }
        pathQ();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = INK;
        ctx.stroke();
      }
    }
    this.path(ctx, pts, zt);
    const [a, b] = this.P(pts[0][0], pts[0][1], zt), [c, d] = this.P(pts[2][0], pts[2][1], zt);
    const g = ctx.createLinearGradient(a, b, c, d);
    g.addColorStop(0, col[0]);
    g.addColorStop(1, col[1]);
    ctx.fillStyle = g;
    ctx.fill();
    // Long axis of the top: u0 -> u1, and the short side v0 -> v1.
    const L01 = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]);
    const L12 = Math.hypot(pts[2][0] - pts[1][0], pts[2][1] - pts[1][1]);
    const [u0, u1] = L01 >= L12 ? [pts[0], pts[1]] : [pts[1], pts[2]];
    const [v0, v1] = L01 >= L12 ? [pts[0], pts[3]] : [pts[1], pts[0]];
    const Lu = Math.max(L01, L12), Lv = Math.min(L01, L12);
    const at = (fu, fv, z = zt) => this.P(u0[0] + (u1[0] - u0[0]) * fu + (v1[0] - v0[0]) * fv, u0[1] + (u1[1] - u0[1]) * fu + (v1[1] - v0[1]) * fv, z);
    const line = (A, B) => {
      ctx.beginPath();
      ctx.moveTo(...A);
      ctx.lineTo(...B);
      ctx.stroke();
    };
    if (wood || stripes || deco) {
      ctx.save();
      ctx.clip();
      if (stripes) {
        ctx.strokeStyle = 'rgba(42,21,51,0.55)';
        ctx.lineWidth = this.s * 0.12;
        for (let i = 1; i < 6; i++) line(at(i / 6 - 0.15 / Lu, -0.1), at(i / 6 + 0.15 / Lu, 1.1));
      } else if (wood || deco === 'drift') {
        ctx.strokeStyle = deco === 'drift' ? 'rgba(120,100,70,0.35)' : 'rgba(150,90,40,0.35)';
        ctx.lineWidth = 1.5;
        for (let i = 1; i < 3; i++) line(at(0, i / 3), at(1, i / 3));
        if (deco === 'drift') {
          ctx.fillStyle = 'rgba(120,100,70,0.4)';
          for (let f = 0.17; f < 1; f += 0.31) {
            const [kx, ky] = at(f, 0.5);
            ctx.beginPath();
            ctx.ellipse(kx, ky, this.s * 0.09, this.s * 0.05, 0, 0, TAU);
            ctx.fill();
          }
        }
      } else if (deco === 'cane') {
        ctx.strokeStyle = '#ff3b5c';
        ctx.lineWidth = this.s * 0.16;
        for (let t = -1; t < Lu + 1; t += 0.5) line(at(t / Lu, -0.2), at((t + Lv * 0.8) / Lu, 1.2));
      } else if (deco === 'snow') {
        ctx.fillStyle = 'rgba(150,190,230,0.35)';
        const R = seeded(Math.round(u0[0] * 7 + u0[1] * 13));
        for (let i = 0; i < Lu * 6; i++) {
          const [px, py] = at(R(), R());
          ctx.fillRect(px, py, 2, 2);
        }
      } else if (deco === 'choc') {
        ctx.strokeStyle = 'rgba(40,15,5,0.55)';
        ctx.lineWidth = 2;
        const nu = Math.max(1, Math.round(Lu / 0.6)), nv = Math.max(1, Math.round(Lv / 0.6));
        for (let i = 1; i < nu; i++) line(at(i / nu, 0), at(i / nu, 1));
        for (let j = 1; j < nv; j++) line(at(0, j / nv), at(1, j / nv));
        ctx.strokeStyle = 'rgba(255,220,180,0.25)';
        for (let i = 0; i < nu; i++) line(at(i / nu + 0.08 / Lu, 0.12 / Lv), at((i + 1) / nu - 0.08 / Lu, 0.12 / Lv));
      } else if (deco === 'ice') {
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 2.5;
        for (let f = 0.15; f < 1; f += 0.35) line(at(f, 0.15), at(f + 0.25 / Lu * 2, 0.85));
      } else if (deco === 'castle') {
        ctx.strokeStyle = 'rgba(160,110,40,0.4)';
        ctx.lineWidth = 1.5;
        for (let j = 1; j < 3; j++) line(at(0, j / 3), at(1, j / 3));
        for (let i = 1; i < Lu / 0.5; i++) line(at(i * 0.5 / Lu, ((i % 2) * 1) / 3), at(i * 0.5 / Lu, ((i % 2) + 1) / 3));
      }
      ctx.restore();
    }
    this.path(ctx, pts, zt);
    ctx.lineWidth = 2;
    ctx.strokeStyle = INK;
    ctx.stroke();
    // Sandcastle walls get battlements along both long edges.
    if (deco === 'castle' && this.tilt) {
      const n = Math.max(2, Math.floor(Lu / 0.55));
      const w = 0.32 / Lu, dv = Math.min(0.3, Lv * 0.45) / Lv;
      const merlons = [];
      for (const fv of [0, 1 - dv]) {
        for (let i = 0; i < n; i++) {
          const fu = (i + 0.5) / n - w / 2;
          const q = [[fu, fv], [fu + w, fv], [fu + w, fv + dv], [fu, fv + dv]].map(([a2, b2]) => [u0[0] + (u1[0] - u0[0]) * a2 + (v1[0] - v0[0]) * b2, u0[1] + (u1[1] - u0[1]) * a2 + (v1[1] - v0[1]) * b2]);
          merlons.push(q);
        }
      }
      merlons.sort((m1, m2) => Math.max(...m1.map((q) => q[1])) - Math.max(...m2.map((q) => q[1])));
      for (const q of merlons) {
        // Keep the corner order the box() face test expects (clockwise on screen).
        const area = q.reduce((acc, [x1, y1], i) => acc + x1 * q[(i + 1) % 4][1] - q[(i + 1) % 4][0] * y1, 0);
        this.box(ctx, area > 0 ? q : q.slice().reverse(), 0.28, col, false, false, null, zt);
      }
    }
  }

  bumper(ctx, b, T, time) {
    const h = 0.5, s = this.s;
    const wob = 1 + Math.sin(time * 22) * Math.min(1, b.data.wob || 0) * 0.18;
    const rx = b.r * s * wob, ry = b.r * s * this.k * wob;
    const [gx, gy] = this.P(b.x, b.y, 0);
    const [tx, ty] = this.P(b.x, b.y, this.tilt ? h : 0);
    if (this.tilt) {
      ctx.beginPath();
      ctx.ellipse(gx, gy, rx, ry, 0, 0, Math.PI);
      ctx.lineTo(tx - rx, ty);
      ctx.ellipse(tx, ty, rx, ry, 0, Math.PI, 0, true);
      ctx.closePath();
      const g = ctx.createLinearGradient(tx - rx, 0, tx + rx, 0);
      g.addColorStop(0, T.bumper[1]);
      g.addColorStop(1, T.bumper[2]);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = INK;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(tx, ty, rx, ry, 0, 0, TAU);
    const g = ctx.createRadialGradient(tx - rx * 0.3, ty - ry * 0.4, 0, tx, ty, rx);
    g.addColorStop(0, T.bumper[0]);
    g.addColorStop(1, T.bumper[1]);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = INK;
    ctx.stroke();
    // Spring ring and shine.
    ctx.beginPath();
    ctx.ellipse(tx, ty, rx * 0.6, ry * 0.6, 0, 0, TAU);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(tx - rx * 0.32, ty - ry * 0.38, rx * 0.28, ry * 0.16, -0.4, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fill();
  }

  // Windmill: a house with a pointed roof, a tunnel door, and sails turning in front.
  windmill(ctx, m, T, time) {
    const [x0, y0, x1, y1] = m.house;
    const H = 1.9, ridge = 1.15, xm = (x0 + x1) / 2;
    const house = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    const brick = ['#fff1d8', '#f2c88f', '#d8a060'];
    if (this.tilt) {
      this.box(ctx, house, H, brick, false);
      // Roof: two slopes, then the front gable.
      for (const [xa, col] of [[x0 - 0.18, T.roof[0]], [x1 + 0.18, T.roof[1]]]) {
        ctx.beginPath();
        ctx.moveTo(...this.P(xa, y1 + 0.18, H));
        ctx.lineTo(...this.P(xm, y1 + 0.18, H + ridge));
        ctx.lineTo(...this.P(xm, y0 - 0.18, H + ridge));
        ctx.lineTo(...this.P(xa, y0 - 0.18, H));
        ctx.closePath();
        ctx.fillStyle = col;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = INK;
        ctx.stroke();
        // Roof tiles.
        ctx.strokeStyle = 'rgba(120,20,10,0.35)';
        ctx.lineWidth = 1.5;
        for (let t = 0.2; t < 1; t += 0.2) {
          ctx.beginPath();
          ctx.moveTo(...this.P(xa + (xm - xa) * t, y1 + 0.18, H + ridge * t));
          ctx.lineTo(...this.P(xa + (xm - xa) * t, y0 - 0.18, H + ridge * t));
          ctx.stroke();
        }
      }
      ctx.beginPath();
      ctx.moveTo(...this.P(x0, y1, H));
      ctx.lineTo(...this.P(xm, y1, H + ridge));
      ctx.lineTo(...this.P(x1, y1, H));
      ctx.closePath();
      ctx.fillStyle = brick[1];
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = INK;
      ctx.stroke();
      // Round window in the gable.
      const [wx, wy] = this.P(xm, y1, H + ridge * 0.4);
      ctx.beginPath();
      ctx.arc(wx, wy, this.s * 0.2, 0, TAU);
      ctx.fillStyle = '#7fd6ff';
      ctx.fill();
      ctx.stroke();
      // Tunnel door on the front.
      const [ta, tb] = m.tunnel;
      ctx.beginPath();
      ctx.moveTo(...this.P(ta, y1, 0));
      ctx.lineTo(...this.P(ta, y1, 0.75));
      const [ax, ay] = this.P((ta + tb) / 2, y1, 0.75);
      ctx.arc(ax, ay, ((tb - ta) / 2) * this.s, Math.PI, 0);
      ctx.lineTo(...this.P(tb, y1, 0));
      ctx.closePath();
      ctx.fillStyle = '#2a1a14';
      ctx.fill();
      ctx.stroke();
    } else {
      // Top-down: the roof, split along the ridge, and the door at the front.
      this.box(ctx, house, H, brick, false);
      for (const [xa, xb, col] of [[x0 - 0.18, xm, T.roof[0]], [xm, x1 + 0.18, T.roof[1]]]) {
        this.path(ctx, [[xa, y0 - 0.18], [xb, y0 - 0.18], [xb, y1 + 0.18], [xa, y1 + 0.18]]);
        ctx.fillStyle = col;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = INK;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(120,20,10,0.35)';
        ctx.lineWidth = 1.5;
        for (let y = y0 + 0.3; y < y1; y += 0.45) {
          ctx.beginPath();
          ctx.moveTo(...this.P(xa, y));
          ctx.lineTo(...this.P(xb, y));
          ctx.stroke();
        }
      }
      const [ta, tb] = m.tunnel;
      this.path(ctx, [[ta, y1 - 0.05], [tb, y1 - 0.05], [tb, y1 + 0.2], [ta, y1 + 0.2]]);
      ctx.fillStyle = '#2a1a14';
      ctx.fill();
    }
    // Sails.
    const hy = y1 + 0.12;
    const angles = m.angles || [];
    for (const a of angles) {
      const ca = Math.cos(a), sa = Math.sin(a);
      const sail = (t, w) => {
        // A point on the sail: t along it, w across it (in the upright plane).
        const x = m.x + ca * t - sa * w, z = m.hubZ + sa * t + ca * w;
        // Flat view: the sails face the camera (raised up the screen), as top-down games do.
        return this.tilt ? this.P(x, hy, z) : this.P(x, hy - (z - 0.2) * 0.75, 0);
      };
      ctx.beginPath();
      ctx.moveTo(...sail(0.15, -0.08));
      ctx.lineTo(...sail(m.len, -m.width / 2));
      ctx.lineTo(...sail(m.len, m.width / 2));
      ctx.lineTo(...sail(0.15, 0.08));
      ctx.closePath();
      ctx.fillStyle = '#fff8ec';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(160,100,50,0.75)';
      ctx.lineWidth = 1.5;
      for (let k = 1; k < 5; k++) {
        const t = 0.15 + (k / 5) * (m.len - 0.15), w = 0.08 + (k / 5) * (m.width / 2 - 0.08);
        ctx.beginPath();
        ctx.moveTo(...sail(t, -w));
        ctx.lineTo(...sail(t, w));
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(...sail(0.1, 0));
      ctx.lineTo(...sail(m.len, 0));
      ctx.strokeStyle = 'rgba(120,70,30,0.8)';
      ctx.stroke();
    }
    const [hx, hyy] = this.tilt ? this.P(m.x, hy, m.hubZ) : this.P(m.x, hy - (m.hubZ - 0.2) * 0.75, 0);
    ctx.beginPath();
    ctx.arc(hx, hyy, this.s * 0.2, 0, TAU);
    ctx.fillStyle = '#c4352a';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }

  cup(ctx, x, y) {
    const [cx, cy] = this.P(x, y);
    const r = 0.44 * this.s;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 1.25, r * 1.25 * this.k, 0, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * this.k, 0, 0, TAU);
    ctx.fillStyle = '#1b2614';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * this.k * 0.3, r * 0.82, r * this.k * 0.55, 0, 0, Math.PI);
    ctx.fillStyle = '#0a1007';
    ctx.fill();
  }

  flag(ctx, x, y, time, n) {
    const s = this.s;
    const [bx, by] = this.P(x, y, 0), [tx, ty] = this.P(x, y, FLAG.pole);
    ctx.strokeStyle = '#f7f7f7';
    ctx.lineWidth = Math.max(3, s * 0.08);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = INK;
    ctx.stroke();
    const pts = FLAG.shape(time).map(([dx, z]) => this.P(x + dx, y, z));
    ctx.beginPath();
    ctx.moveTo(...pts[0]);
    ctx.quadraticCurveTo(...pts[1], ...pts[2]);
    ctx.lineTo(...pts[3]);
    ctx.quadraticCurveTo(...pts[4], ...pts[5]);
    ctx.closePath();
    ctx.fillStyle = '#ff3b30';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = INK;
    ctx.stroke();
    if (n) {
      const [cx, cy] = this.P(x + 0.52, y, FLAG.pole - 0.33);
      ctx.font = `${Math.round(s * 0.42 * this.hz + s * 0.12)}px "Lilita One", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.fillText(String(n), cx, cy);
    }
  }

  // The ball: a round Gloop with its style and face rolling on it (ballart.js).
  ball(ctx, b, time) {
    const r = BALL_R * this.s * (b.scale || 1);
    const z = this.tilt ? BALL_R + (b.z || 0) : 0;
    const [x, y] = this.P(b.x, b.y, z);
    ctx.save();
    ctx.translate(x, y);
    const sq = b.squash || 0;
    ctx.rotate(b.squashA || 0);
    ctx.scale(1 + sq, 1 - sq);
    ctx.rotate(-(b.squashA || 0));
    drawBall(ctx, r, { color: b.color, style: b.style, spin: b.spin, k: this.k, hz: this.hz, look: b.look, mood: b.mood, t: time });
    ctx.restore();
  }

  // Aim guide: dots along the path with one bounce.
  guide(ctx, pts) {
    const n = pts.length;
    pts.forEach(([x, y], i) => {
      const [a, b] = this.P(x, y, this.tilt ? 0.05 : 0);
      const f = 1 - i / (n + 2);
      ctx.beginPath();
      ctx.arc(a, b, Math.max(2, this.s * 0.08 * f + 1), 0, TAU);
      ctx.fillStyle = `rgba(255,255,255,${0.95 * f})`;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = `rgba(42,21,51,${0.45 * f})`;
      ctx.stroke();
    });
  }
}
