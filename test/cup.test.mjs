// The cup decides once per pass: a ball that shows "Too fast!" never drops on that same
// pass, and the aim line ends in the cup exactly when the real ball drops.
import { COURSES } from '../public/js/course.js';
import { Golf, CUP_R } from '../public/js/golf.js';

let putts = 0, lips = 0, sinks = 0, lipThenDrop = 0, lineWrong = 0;
for (const c of COURSES) {
  for (const hole of c.holes) {
    const [cx, cy] = hole.cup;
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2 + 0.05, ux = Math.cos(ang), uy = Math.sin(ang);
      for (let off = -0.32; off <= 0.33; off += 0.16) {
        for (let v = 2; v <= 9; v += 0.5) {
          const g = new Golf();
          g.load(hole);
          const sx = cx - ux * 1.3 - uy * off, sy = cy - uy * 1.3 + ux * off;
          if (g.surfaceAt(sx, sy) !== 'grass') continue;
          if (g.solids(true).some((o) => g.contact(o, sx, sy).depth > -0.02)) continue;
          g.ball.x = sx;
          g.ball.y = sy;
          const pts = hole.movers ? null : g.predict(sx, sy, ux * v, uy * v, 99);
          let lipped = false, left = false, sank = false;
          g.emit = (name) => {
            if (name === 'lip') {
              lips++;
              lipped = true;
              left = false;
            } else if (name === 'sink') {
              sinks++;
              sank = true;
              if (lipped && !left) lipThenDrop++;
            }
          };
          g.shoot(ux * v, uy * v);
          for (let i = 0; i < 3000 && g.state === 'rolling'; i++) {
            g.step();
            if (lipped && Math.hypot(g.ball.x - cx, g.ball.y - cy) > CUP_R) left = true;
          }
          putts++;
          if (pts) {
            const [ex, ey] = pts[pts.length - 1];
            if ((ex === cx && ey === cy) !== sank) lineWrong++;
          }
        }
      }
    }
  }
}
console.log(`${putts} putts at the cup: ${sinks} dropped, ${lips} too fast, ${lipThenDrop} "too fast" then dropped, ${lineWrong} aim lines wrong about the cup`);
if (!putts || !lips || !sinks || lipThenDrop || lineWrong) {
  console.error('cup FAILED');
  process.exit(1);
}
console.log('cup ok');
