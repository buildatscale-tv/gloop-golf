// Renders the app icons with the game's own art module.
// Usage: NODE_PATH=<dir with playwright> node tools/make-icons.cjs  (server must run on :5180)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', 'public', 'icons');
const sizes = [
  ['icon-512.png', 512, false],
  ['icon-192.png', 192, false],
  ['apple-touch-icon.png', 180, false],
  ['icon-maskable-512.png', 512, true],
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5180/', { waitUntil: 'networkidle' });
  fs.mkdirSync(outDir, { recursive: true });
  for (const [name, size, maskable] of sizes) {
    const data = await page.evaluate(async ({ size, maskable }) => {
      const { GLOOP_COLORS, drawGloopFace } = await import('/js/gloop-art.js');
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const ctx = c.getContext('2d');
      const TAU = Math.PI * 2;
      const k = maskable ? 0.76 : 1;
      const S = size * k;
      const cx = size / 2, cy = size / 2;
      const tilt = 0.55;
      // Sky-to-garden background.
      const bg = ctx.createLinearGradient(0, 0, 0, size);
      bg.addColorStop(0, '#9fe07a');
      bg.addColorStop(1, '#3f9a2e');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, size, size);
      // Green as a tilted disc with a wooden rim.
      const gx = cx, gy = cy + S * 0.12, gr = S * 0.46;
      ctx.beginPath();
      ctx.ellipse(gx, gy + S * 0.05, gr, gr * tilt, 0, 0, TAU);
      ctx.fillStyle = '#7a4a24';
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(gx, gy, gr, gr * tilt, 0, 0, TAU);
      ctx.fillStyle = '#d9a46b';
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(gx, gy, gr * 0.9, gr * 0.9 * tilt, 0, 0, TAU);
      const felt = ctx.createLinearGradient(0, gy - gr * tilt, 0, gy + gr * tilt);
      felt.addColorStop(0, '#7fd35a');
      felt.addColorStop(1, '#55b23c');
      ctx.fillStyle = felt;
      ctx.fill();
      // Cup.
      const hx = gx + S * 0.17, hy = gy - S * 0.05, hr = S * 0.075;
      ctx.beginPath();
      ctx.ellipse(hx, hy, hr * 1.25, hr * 1.25 * tilt, 0, 0, TAU);
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(hx, hy, hr, hr * tilt, 0, 0, TAU);
      ctx.fillStyle = '#1b2614';
      ctx.fill();
      // Flag.
      const poleTop = hy - S * 0.42;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#2b1d14';
      ctx.lineWidth = S * 0.03;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx, poleTop);
      ctx.stroke();
      ctx.strokeStyle = '#f7f7f7';
      ctx.lineWidth = S * 0.018;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(hx, poleTop);
      ctx.quadraticCurveTo(hx + S * 0.12, poleTop + S * 0.02, hx + S * 0.21, poleTop + S * 0.05);
      ctx.lineTo(hx + S * 0.2, poleTop + S * 0.16);
      ctx.quadraticCurveTo(hx + S * 0.1, poleTop + S * 0.13, hx, poleTop + S * 0.15);
      ctx.closePath();
      ctx.fillStyle = '#ff3b30';
      ctx.fill();
      ctx.lineWidth = S * 0.012;
      ctx.strokeStyle = '#2b1d14';
      ctx.stroke();
      // Dotted putt line from the ball to the cup.
      const bx = gx - S * 0.13, by = gy + S * 0.09, br = S * 0.17;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (let i = 1; i <= 3; i++) {
        const t = 0.32 + i * 0.16;
        ctx.beginPath();
        ctx.arc(bx + (hx - bx) * t, by + (hy - by) * t, S * 0.014, 0, TAU);
        ctx.fill();
      }
      // Ball shadow, then the Gloop ball.
      ctx.beginPath();
      ctx.ellipse(bx + br * 0.25, by + br * 0.85, br * 0.95, br * 0.95 * tilt * 0.6, 0, 0, TAU);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fill();
      const cols = GLOOP_COLORS.cherry;
      ctx.save();
      ctx.translate(bx, by);
      ctx.beginPath();
      ctx.arc(0, 0, br, 0, TAU);
      const g = ctx.createRadialGradient(-br * 0.3, -br * 0.35, br * 0.05, 0, 0, br * 1.05);
      g.addColorStop(0, cols[0]);
      g.addColorStop(0.5, cols[1]);
      g.addColorStop(1, cols[2]);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = br * 0.12;
      ctx.strokeStyle = cols[4];
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, br * 0.82, Math.PI * 1.1, Math.PI * 1.45);
      ctx.lineWidth = br * 0.13;
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.stroke();
      drawGloopFace(ctx, br * 0.92, { look: { x: 0.8, y: -0.4 }, mood: 'happy', kind: 'two', color: 'cherry' });
      ctx.restore();
      return c.toDataURL('image/png');
    }, { size, maskable });
    fs.writeFileSync(path.join(outDir, name), Buffer.from(data.split(',')[1], 'base64'));
    console.log('wrote', name);
  }
  await browser.close();
})();
