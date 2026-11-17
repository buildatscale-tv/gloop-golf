// The aim line must be the path the ball takes: play real putts and measure how far the
// ball ever gets from the predicted line (up to the end of the line).
import { COURSES } from '../public/js/course.js';
import { Golf, DT, MAX_SPEED } from '../public/js/golf.js';

function distToLine(x, y, pts) {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    if (!pts[i] || !pts[i - 1]) continue; // portal jump
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
    const t = L2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2)) : 0;
    best = Math.min(best, Math.hypot(x - ax - dx * t, y - ay - dy * t));
  }
  return best;
}

let worst = 0, n = 0, bounced = 0;
const holes = COURSES.flatMap((c) => c.holes);
for (let hi = 0; hi < holes.length; hi++) {
  if (holes[hi].movers) continue; // the line leaves moving parts out
  for (let s = 0; s < 12; s++) {
    const ang = -Math.PI + (s / 12) * Math.PI * 2 + 0.13, k = 0.35 + (s % 4) * 0.2;
    const g = new Golf();
    g.load(holes[hi]);
    const vx = Math.cos(ang) * MAX_SPEED * k, vy = Math.sin(ang) * MAX_SPEED * k;
    const pts = g.predict(g.ball.x, g.ball.y, vx, vy, 2);
    const [ex, ey] = pts[pts.length - 1];
    let hits = 0, err = 0;
    const off = g.emit;
    g.emit = (type) => { if (type === 'bounce') hits++; };
    g.shoot(vx, vy);
    for (let t = 0; t < 15 && g.state === 'rolling' && hits <= 2; t += DT) {
      g.step();
      if (g.state !== 'rolling') break;
      err = Math.max(err, distToLine(g.ball.x, g.ball.y, pts));
      if (Math.hypot(g.ball.x - ex, g.ball.y - ey) < 1e-6) break;
    }
    g.emit = off;
    if (hits) bounced++;
    worst = Math.max(worst, err);
    n++;
    if (err > 0.01) console.log(`${holes[hi].name} shot ${s}: ball left the line by ${err.toFixed(3)} m`);
  }
}
console.log(`${n} putts (${bounced} with bounces): ball never more than ${(worst * 1000).toFixed(2)} mm from the aim line`);
process.exit(n >= 60 && bounced >= 30 && worst < 0.01 ? 0 : 1);
