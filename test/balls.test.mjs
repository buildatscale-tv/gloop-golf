// Take turns: tee spots for 2-4 balls on every hole, and ball-on-ball hits. A hit keeps
// the total speed along the line between the balls (equal balls), loses the right share,
// balls never overlap, and the aim line stops exactly where the real ball touches.
import { COURSES } from '../public/js/course.js';
import { Golf, BALL_R, MAX_SPEED } from '../public/js/golf.js';

let fail = 0;
const holes = COURSES.flatMap((c) => c.holes.map((h, i) => ({ ...h, id: `${c.id} ${i + 1}` })));
const other = (i, x, y) => ({ id: i, x, y, vx: 0, vy: 0, lipped: 0, boost: -1, warpLock: null, isBall: true, shape: 'circle', r: BALL_R, data: { kind: 'ball' } });

// 1. Tee spots.
let spotsChecked = 0;
for (const h of holes) {
  for (const n of [2, 3, 4]) {
    const g = new Golf();
    g.load(h);
    const spots = g.teeSpots(n);
    const [tx, ty] = h.tee;
    const stacked = spots.every(([x, y]) => x === tx && y === ty);
    let apart = true;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (Math.hypot(spots[i][0] - spots[j][0], spots[i][1] - spots[j][1]) < BALL_R * 2 + 0.05) apart = false;
    if (stacked || !apart) {
      fail++;
      console.log(`FAIL tee spots ${h.id} (${h.name}) n=${n}`);
    }
    spotsChecked++;
  }
}
console.log(`${spotsChecked} tee layouts: every ball on its own clear spot`);

// 2. Head-on and glancing hits on flat grass (Garden 1), then free rolls.
const g = new Golf();
g.load(holes[0]);
let worstMom = 0, worstE = 0, deepest = 0, hits = 0, lineErr = 0;
for (let k = 0; k < 400; k++) {
  const off = ((k % 21) - 10) / 10 * (BALL_R * 1.9);
  const v = 2 + (k % 7);
  g.load(holes[0]);
  const t = other(1, 9, 6 + off);
  const u = other(2, 12.5, 6 + off * 0.5 - 0.4);
  g.setOthers([t, u]);
  g.place(5, 6);
  const line = g.predict(5, 6, v, 0, 2);
  const hitAt = g.lastLine.ballHit;
  let got = null;
  g.emit = (name, d) => { if (name === 'bounce' && d.kind === 'ball' && d.other === undefined && !got) got = { x: g.ball.x, y: g.ball.y, bvx: g.ball.vx, bvy: g.ball.vy, tvx: t.vx, tvy: t.vy }; };
  g.shoot(v, 0);
  let vBefore = null;
  for (let i = 0; i < 4000 && g.state === 'rolling'; i++) {
    if (!vBefore && !got) vBefore = null;
    const pre = { bvx: g.ball.vx, bvy: g.ball.vy, tvx: t.vx, tvy: t.vy };
    g.step();
    if (got && !got.checked) {
      got.checked = true;
      // Momentum along x and y is kept (equal balls, friction is tiny in one tick).
      const mom = Math.hypot(g.ball.vx + t.vx - pre.bvx - pre.tvx, g.ball.vy + t.vy - pre.bvy - pre.tvy);
      worstMom = Math.max(worstMom, mom);
      hits++;
      if (hitAt) lineErr = Math.max(lineErr, Math.hypot(hitAt.x - got.x, hitAt.y - got.y));
    }
    for (const [a, b] of [[g.ball, t], [g.ball, u], [t, u]]) {
      if (a.sunk || b.sunk || a.hidden || b.hidden || (a === g.ball && g.state === 'sunk')) continue;
      deepest = Math.max(deepest, BALL_R * 2 - Math.hypot(a.x - b.x, a.y - b.y));
    }
  }
  if (g.state === 'rolling') { fail++; console.log('FAIL putt never ended'); }
  if (g.othersMoving()) { fail++; console.log('FAIL putt ended while another ball still rolls'); }
}
// Head-on: the striker keeps (1 - e) / 2 of its speed, the struck ball gets (1 + e) / 2.
g.load(holes[0]);
const t0 = other(1, 9, 6);
g.setOthers([t0]);
g.place(5, 6);
let first = null;
g.emit = (name, d) => { if (name === 'bounce' && d.kind === 'ball' && !first) first = true; };
g.shoot(6, 0);
let after = null;
for (let i = 0; i < 2000 && !after; i++) {
  const pre = g.ball.vx;
  g.step();
  if (first) after = { pre, b: g.ball.vx, t: t0.vx };
}
const keep = after.b / after.pre, give = after.t / after.pre;
console.log(`head-on: striker keeps ${(keep * 100).toFixed(1)}% of its speed, struck ball gets ${(give * 100).toFixed(1)}% (expected 7.5% and 92.5%)`);
if (Math.abs(keep - 0.075) > 0.01 || Math.abs(give - 0.925) > 0.01) fail++;
console.log(`${hits} ball hits: speed along the hit kept within ${worstMom.toFixed(4)} m/s; deepest ball overlap ${(Math.max(0, deepest) * 1000).toFixed(3)} mm; aim line hit point off by ${(lineErr * 1000).toFixed(2)} mm`);
if (worstMom > 0.05 || deepest > 1e-4 || lineErr > 1e-4 || hits < 100) fail++;
if (fail) {
  console.error('balls FAILED');
  process.exit(1);
}
console.log('balls ok');
