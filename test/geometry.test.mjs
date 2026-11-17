// Geometry rules: mirror bounces, no ball through a wall, no rail end inside the fairway.
import { COURSES, pointInPoly } from '../public/js/course.js';
import { Golf, DT, MAX_SPEED, BALL_R } from '../public/js/golf.js';

let fail = 0;
const holes = COURSES.flatMap((c) => c.holes);
const deg = (r) => (r * 180) / Math.PI;

// 1. Angle out = angle in, on rails, walls and blocks (bumpers add a kick on purpose).
let worstAng = 0, nb = 0;
for (let hi = 0; hi < holes.length; hi++) {
  if (holes[hi].movers || holes[hi].belts || holes[hi].boosts || holes[hi].slopes) continue; // they bend the path
  for (let s = 0; s < 16; s++) {
    const g = new Golf();
    g.load(holes[hi]);
    const ang = (s / 16) * Math.PI * 2 + 0.21;
    let ev = null;
    g.emit = (type, e) => { if (type === 'bounce' && e.kind !== 'bumper' && e.kind !== 'sail') ev = e; };
    g.shoot(Math.cos(ang) * MAX_SPEED * 0.8, Math.sin(ang) * MAX_SPEED * 0.8);
    for (let t = 0; t < 10 && g.state === 'rolling' && nb < 2000; t += DT) {
      const v0 = [g.ball.vx, g.ball.vy];
      ev = null;
      g.step();
      if (!ev) continue;
      const v1 = [g.ball.vx, g.ball.vy];
      const s0 = Math.hypot(...v0), s1 = Math.hypot(...v1);
      if (s0 < 1 || s1 < 0.2) continue;
      // Angle between the path and the surface normal, before and after.
      const aIn = Math.acos(Math.min(1, -(v0[0] * ev.nx + v0[1] * ev.ny) / s0));
      const aOut = Math.acos(Math.min(1, (v1[0] * ev.nx + v1[1] * ev.ny) / s1));
      worstAng = Math.max(worstAng, Math.abs(aIn - aOut));
      nb++;
    }
  }
}
console.log(`${nb} wall bounces: angle out = angle in within ${deg(worstAng).toFixed(4)} deg`);
if (nb < 40 || deg(worstAng) > 0.05) fail++;

// 2. Full-power putts in all directions never leave the fairway or enter a solid.
let worstIn = 0, putts = 0;
for (const h of holes) {
  for (let s = 0; s < 24; s++) {
    const g = new Golf();
    g.load(h);
    const ang = (s / 24) * Math.PI * 2 + 0.05;
    g.shoot(Math.cos(ang) * MAX_SPEED, Math.sin(ang) * MAX_SPEED);
    putts++;
    for (let t = 0; t < 12 && g.state === 'rolling'; t += DT) {
      g.step();
      if (g.state !== 'rolling') break;
      const { x, y } = g.ball;
      if (!pointInPoly(x, y, h.outline)) {
        console.log(`${h.name}: ball left the fairway at (${x.toFixed(2)}, ${y.toFixed(2)})`);
        fail++;
        break;
      }
      for (const b of g.walls.concat(g.bumpers, g.posts)) worstIn = Math.max(worstIn, g.contact(b, x, y).depth);
    }
  }
}
console.log(`${putts} full-power putts: deepest overlap with a solid ${(worstIn * 1000).toFixed(3)} mm`);
if (worstIn > 0.001) fail++;

// 3. Rails stay outside the fairway (no rail end sticks out at an inner corner).
for (const h of holes) {
  const g = new Golf();
  g.load(h);
  for (const b of g.walls.filter((w) => w.data.kind === 'rail')) {
    const hw = b.data.w / 2 - 0.001, hh = b.data.h / 2 - 0.001;
    for (const [lx, ly] of [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]]) {
      const x = b.x + b.c * lx - b.s * ly, y = b.y + b.s * lx + b.c * ly;
      if (pointInPoly(x, y, h.outline)) {
        console.log(`${h.name}: rail corner inside the fairway at (${x.toFixed(2)}, ${y.toFixed(2)})`);
        fail++;
      }
    }
  }
}
console.log(fail ? `${fail} geometry problems` : 'geometry ok');
process.exit(fail ? 1 : 0);
