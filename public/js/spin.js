// The ball's turn in 3D, so the face and spots roll with it. A spin is three unit vectors
// in world space (x right, y toward the front of the course, z up): where the face's
// right, up, and front (out of the face) point. k and hz are cos and sin of the camera tilt.

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// Face to the camera, head up on the screen.
export function facingCamera(k, hz) {
  return [[1, 0, 0], [0, -k, hz], [0, hz, k]];
}

// Turns all three vectors by angle `ang` around the unit axis (Rodrigues).
function turn(m, ax, ang) {
  const c = Math.cos(ang), s = Math.sin(ang);
  for (let i = 0; i < 3; i++) {
    const p = m[i], x = cross(ax, p), d = dot(ax, p) * (1 - c);
    m[i] = [p[0] * c + x[0] * s + ax[0] * d, p[1] * c + x[1] * s + ax[1] * d, p[2] * c + x[2] * s + ax[2] * d];
  }
}

// Keeps the three vectors unit length and square to each other.
function tidy(m) {
  const n = (v) => {
    const L = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / L, v[1] / L, v[2] / L];
  };
  const f = n(m[2]);
  const u0 = m[1], d = dot(f, u0);
  const u = n([u0[0] - f[0] * d, u0[1] - f[1] * d, u0[2] - f[2] * d]);
  m[0] = cross(f, u);
  m[1] = u;
  m[2] = f;
}

// The ball rolled (dx, dy) on the ground without slipping: the top moves with the ball.
export function roll(m, dx, dy, r) {
  const d = Math.hypot(dx, dy);
  if (d < 1e-6) return;
  turn(m, [-dy / d, dx / d, 0], d / r);
  tidy(m);
}

// Turns the share f (0..1) of the way back to facing the camera with the head up, like a
// bottom-heavy toy that rights itself.
export function settle(m, k, hz, f) {
  const cam = [0, hz, k], up = [0, -k, hz];
  const F = m[2], ax = cross(F, cam), s = Math.hypot(ax[0], ax[1], ax[2]), c = dot(F, cam);
  if (s > 1e-6) turn(m, [ax[0] / s, ax[1] / s, ax[2] / s], Math.atan2(s, c) * f);
  else if (c < 0) turn(m, m[1], Math.PI * f);
  // Then spin around the face's front so the head points up.
  const F2 = m[2], U = m[1], d = dot(F2, up);
  const upP = [up[0] - F2[0] * d, up[1] - F2[1] * d, up[2] - F2[2] * d];
  const a = Math.atan2(dot(cross(F2, U), upP), dot(U, upP));
  turn(m, F2, a * f);
  tidy(m);
}
