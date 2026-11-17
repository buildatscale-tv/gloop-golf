// Game: players and turns, aiming, effects, and the frame loop. Rules live in golf.js,
// drawing in view.js.
import { COURSES, bounds, pointInPoly } from './course.js';
import { Golf, DT, MAX_SPEED, BALL_R } from './golf.js';
import { View, THEMES } from './view.js';
import { PORTAL_COLORS } from './themes.js';
import { Awards } from './trophies.js';
import { Sfx, Music } from './audio.js';
import { TAU, rand, clamp, pick } from './util.js';
import { facingCamera, roll, settle } from './spin.js';

export const TILT = 0.72;
export const MAX_STROKES = 8;
// A drag shorter than this (px) does not aim, so a tap or a small slip never putts.
const AIM_DEAD = 10;
// Full power needs this share of the short screen side (the reference pull is longer).
const PULL_FULL = 0.32, PULL_REF = 0.5;
// How much a finger move turns the aim, by power k (0 to 1). On a short pull the aim
// follows the finger. Further out the turn falls away faster and faster (a curve, not a
// straight line), down to AIM_MIN at full power. This comes on top of the finer control
// that a longer pull gives by itself.
const AIM_MIN = 0.2;
const aimGain = (k) => 1 - (1 - AIM_MIN) * k * k;
export const PLAYER_COLORS = ['cherry', 'lime', 'grape', 'berry'];

// Name for a score relative to par.
export function resultName(strokes, par) {
  if (strokes === 1) return { text: 'Hole in one!', level: 3 };
  const d = strokes - par;
  if (d <= -3) return { text: 'Albatross!', level: 3 };
  if (d === -2) return { text: 'Eagle!', level: 2 };
  if (d === -1) return { text: 'Birdie!', level: 2 };
  if (d === 0) return { text: 'Par', level: 1 };
  if (d === 1) return { text: 'Bogey', level: 0 };
  if (d === 2) return { text: 'Double bogey', level: 0 };
  return { text: strokes >= MAX_STROKES ? 'Max strokes' : 'Keep going!', level: 0 };
}

export class Game {
  constructor(canvas, ui, store) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ui = ui;
    this.store = store;
    this.view = new View();
    this.golf = new Golf((n, d) => this.onEvent(n, d));
    this.sfx = new Sfx();
    this.music = new Music(this.sfx);
    this.awards = new Awards(store, (t, style, who) => {
      this.sfx.trophy();
      this.ui.trophyToast(t, style, this.players.length > 1 ? who : null);
    });
    this.state = 'menu';
    this.phase = 'idle';
    this.course = COURSES[0];
    this.holeIndex = 4;
    this.players = [];
    this.turn = 0;
    this.strokes = 0;
    this.particles = [];
    this.texts = [];
    this.callouts = [];
    this.trail = [];
    this.aim = null;
    this.time = 0;
    this.acc = 0;
    this.paused = false;
    this.joy = { t: 0, a: null };
    this.ballFx = { squash: 0, squashV: 0, squashA: 0, mood: 'sour', moodT: 0, scale: 1, z: 0, hidden: false, spin: null };
    this.applySettings();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 200));
    this.bindInput();
    this.showMenuScene();
    this.resize();
    this.last = performance.now();
    this.frame = this.frame.bind(this);
    requestAnimationFrame(this.frame);
  }

  applySettings() {
    const s = this.store.data.settings;
    this.sfx.enabled = s.sound;
    this.music.enabled = s.music;
    this.music.fade();
  }

  get hole() {
    return this.course.holes[this.holeIndex];
  }

  get player() {
    return this.players[this.turn];
  }

  // ---------- Layout ----------
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.canvas.width = Math.round(this.W * dpr);
    this.canvas.height = Math.round(this.H * dpr);
    this.canvas.style.width = this.W + 'px';
    this.canvas.style.height = this.H + 'px';
    this.ui.setRotateHint(this.H > this.W && this.W < 700);
    this.fit();
  }

  fit() {
    const top = this.state === 'menu' ? Math.min(150, this.H * 0.22) : Math.min(76, this.H * 0.12);
    const bottom = this.state === 'menu' ? Math.min(120, this.H * 0.18) : 8;
    this.view.fit(bounds(this.hole), 0, top, this.W, this.H - top - bottom, TILT);
    // maxPull: the pull for full power. refPull: a longer pull that sets how fine the power
    // and the aim are at the start, so short putts keep the same control.
    this.maxPull = clamp(Math.min(this.W, this.H) * PULL_FULL, 100, 220);
    this.refPull = clamp(Math.min(this.W, this.H) * PULL_REF, 150, 340);
    this.buildBackground();
  }

  buildBackground() {
    const c = document.createElement('canvas');
    c.width = Math.ceil(this.W * this.dpr);
    c.height = Math.ceil(this.H * this.dpr);
    const ctx = c.getContext('2d');
    ctx.scale(this.dpr, this.dpr);
    this.view.drawBackground(ctx, this.W, this.H, this.hole, this.course.theme);
    this.bg = c;
  }

  // ---------- Flow ----------
  showMenuScene() {
    this.state = 'menu';
    this.phase = 'idle';
    this.course = COURSES.find((c) => c.id === this.store.data.lastCourse) || COURSES[0];
    this.holeIndex = this.course.thumb || 0;
    this.loadHole();
    this.ui.showMenu();
    this.music.intensity = 0;
    if (this.W) this.fit();
  }

  loadHole() {
    this.golf.load(this.hole);
    this.particles.length = 0;
    this.texts.length = 0;
    this.callouts.length = 0;
    this.trail.length = 0;
    this.aim = null;
    Object.assign(this.ballFx, { squash: 0, squashV: 0, mood: 'sour', moodT: 0, scale: 1, z: 0, hidden: false, spin: null });
  }

  startCourse(players, courseId) {
    this.course = COURSES.find((c) => c.id === courseId) || COURSES[0];
    this.players = players.map((p) => ({ ...p, scores: [] }));
    this.state = 'play';
    this.paused = false;
    this.holeIndex = 0;
    this.music.intensity = 1;
    this.startHole();
  }

  startHole() {
    this.turn = 0;
    // Take turns (2+ players, a setting): one putt each, and each ball stays where it
    // stopped until that player's next turn. Off: each player plays the whole hole.
    this.turnMode = this.players.length > 1 && this.store.data.settings.turns;
    this.balls = null;
    this.fit();
    this.startTurn(true);
  }

  // Take turns: every player's ball is on the field, each on its own spot on the tee. The
  // entries are live ball states: the rules move them when they are hit.
  setupBalls() {
    if (!this.balls) {
      const spots = this.golf.teeSpots(this.players.length);
      this.balls = this.players.map((p, i) => ({
        id: i, x: spots[i][0], y: spots[i][1], tee: spots[i], vx: 0, vy: 0, lipped: 0, boost: -1, warpLock: null,
        strokes: 0, done: false, spin: null, isBall: true, shape: 'circle', r: BALL_R, data: { kind: 'ball' },
      }));
    }
    const me = this.balls[this.turn];
    this.golf.place(me.x, me.y, me.warpLock);
    this.golf.setOthers(this.balls.filter((b, i) => i !== this.turn && !b.done));
    this.strokeKnocks = [];
  }

  // Runs fn once no knocked ball is still rolling (or waiting to come back from the water).
  whenStill(fn) {
    const id = this.turnId;
    const go = () => {
      if (this.state !== 'play' || this.turnId !== id) return;
      if (this.golf.othersMoving()) setTimeout(go, 100);
      else fn();
    };
    go();
  }

  // Take turns: the putt is over and the ball did not drop. Wait a moment so everyone sees
  // where it stopped, then the next player who is still on the hole putts.
  endStroke() {
    const b = this.golf.ball;
    Object.assign(this.balls[this.turn], { x: b.x, y: b.y, warpLock: b.warpLock, strokes: this.strokes });
    this.phase = 'wait';
    this.whenStill(() => {
      const next = this.nextPlayer();
      if (next === this.turn) {
        this.phase = 'aim';
        return;
      }
      const id = this.turnId;
      setTimeout(() => {
        if (this.state === 'play' && this.turnId === id) this.switchTo(next);
      }, 600);
    });
  }

  // The next player after this one who has not finished the hole, or -1 if all have.
  nextPlayer() {
    const n = this.players.length;
    for (let i = 1; i <= n; i++) {
      const j = (this.turn + i) % n;
      if (!this.balls[j].done) return j;
    }
    return -1;
  }

  switchTo(i) {
    this.turnId++;
    const prev = this.balls[this.turn];
    Object.assign(prev, { vx: 0, vy: 0, lipped: 0, boost: -1, spin: this.ballFx.spin, lx: prev.x, ly: prev.y });
    this.turn = i;
    const s = this.balls[i];
    this.setupBalls();
    this.strokes = s.strokes;
    this.trail.length = 0;
    this.aim = null;
    Object.assign(this.ballFx, { squash: 0, squashV: 0, mood: 'sour', moodT: 0, scale: 1, z: 0, hidden: false, spin: s.spin, lastX: s.x, lastY: s.y });
    this.phase = 'aim';
    this.ui.showHud(this);
    this.ui.banner(`${this.player.name}'s turn`, this.strokes ? `Stroke ${this.strokes + 1}` : `Hole ${this.holeIndex + 1} · Par ${this.hole.par}`, 1200);
    this.sfx.turn();
  }

  // The other players' balls on the field, to draw. A knocked ball looks where it rolls.
  waitingBalls() {
    if (!this.turnMode || this.state !== 'play' || !this.balls) return [];
    const [cx, cy] = this.hole.cup;
    const out = [];
    this.balls.forEach((s, i) => {
      if (i === this.turn || s.done || s.hidden) return;
      const p = this.players[i], sp = Math.hypot(s.vx, s.vy);
      const lx = sp > 0.3 ? s.vx : cx - s.x, ly = sp > 0.3 ? s.vy : cy - s.y, L = Math.hypot(lx, ly) || 1;
      out.push({ x: s.x, y: s.y, color: p.color, style: p.style, spin: s.spin, mood: sp > 2.5 ? 'dizzy' : 'sour', look: { x: lx / L, y: (ly / L) * 0.6 } });
    });
    return out;
  }

  // A knocked ball dropped: it counts for its player, with no extra stroke (at least 1).
  knockedIn(i, d) {
    const s = this.balls[i], p = this.players[i];
    s.done = true;
    const score = Math.max(1, s.strokes);
    p.scores[this.holeIndex] = score;
    this.strokeKnocks.push(i);
    this.awards.holeDone(score, this.hole.par, this.course.id, this.holeIndex, p.name);
    const key = `${this.course.id}-${this.holeIndex}`, hb = this.store.data.holeBest;
    if (!hb[key] || score < hb[key]) {
      hb[key] = score;
      this.store.save();
    }
    this.callout('Knocked in!', `${p.name} · ${score} stroke${score === 1 ? '' : 's'}`, 1);
    this.sfx.plop();
    for (let k = 0; k < 2; k++) this.particles.push({ kind: 'ring', x: d.x, y: d.y, z: 0.02, r: 1.4 + k * 0.6, color: 'rgba(255,255,255,0.9)', t: -k * 0.12, life: 0.55 });
    this.ui.updateHud(this);
  }

  // Events from a knocked ball: sounds and effects only, no strokes or trophies.
  onOtherEvent(name, d) {
    const sfx = this.sfx;
    const who = this.player && this.player.name;
    if (name === 'sink') {
      this.knockedIn(d.other, d);
      this.awards.knockIn(who);
    } else if (name === 'bounce') {
      // A knocked ball hits another player's ball: that ball rolls too.
      if (d.kind === 'ball' && d.target !== 'me') {
        this.awards.moved(d.target, who);
        this.awards.chain(who);
      }
      if (d.quiet) return;
      const k = clamp(d.speed / 9, 0, 1);
      if (d.kind === 'bumper' || d.kind === 'ball') sfx.boing(k);
      else if (d.kind === 'sail' || d.kind === 'slider' || d.kind === 'spinner') sfx.thwack(k);
      else sfx.knock(k);
    } else if (name === 'water') {
      this.awards.dunk(who);
      sfx.splash();
      for (let i = 0; i < 12; i++) {
        const a = rand(0, TAU), sp = rand(1, 3);
        this.particles.push({ kind: 'drop', x: d.x, y: d.y, z: 0.1, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: rand(2.5, 4.5), r: rand(0.05, 0.09), color: THEMES[this.course.theme].water[0], t: 0, life: 1 });
      }
      this.particles.push({ kind: 'ripple', x: d.x, y: d.y, z: 0, r: 0.6, t: 0, life: 1.1 });
    } else if (name === 'reset') {
      this.particles.push({ kind: 'ring', x: d.x, y: d.y, z: 0.05, r: 0.9, color: 'rgba(255,255,255,0.9)', t: 0, life: 0.35 });
    } else if (name === 'lip') sfx.lip();
    else if (name === 'warp') {
      sfx.warp();
      const col = PORTAL_COLORS[d.pair % PORTAL_COLORS.length][0];
      for (const [x, y] of [[d.x, d.y], [d.ex, d.ey]]) this.particles.push({ kind: 'ring', x, y, z: 0.05, r: 1.1, color: col, t: 0, life: 0.4 });
    } else if (name === 'boost') sfx.boost();
  }

  startTurn(first = false) {
    this.turnId = (this.turnId || 0) + 1;
    this.loadHole();
    this.strokes = 0;
    if (this.turnMode) this.setupBalls();
    this.phase = 'aim';
    this.ui.showHud(this);
    const h = this.hole;
    const seen = this.store.data.seenTips;
    const key = `${this.course.id}-${this.holeIndex}`;
    if (first && h.tip && !seen[key]) {
      this.ui.banner(`Hole ${this.holeIndex + 1} · Par ${h.par}`, h.tip, 4200);
      seen[key] = true;
      this.store.save();
    } else if (this.players.length > 1) {
      this.ui.banner(`${this.player.name}'s turn`, `Hole ${this.holeIndex + 1} · Par ${h.par}`, 1700);
      this.sfx.turn();
    } else if (first) this.ui.banner(`Hole ${this.holeIndex + 1}`, `${h.name} · Par ${h.par}`, 1700);
  }

  finishTurn(sunk) {
    if (this.phase === 'done') return;
    this.phase = 'done';
    this.aim = null;
    const score = Math.min(this.strokes, MAX_STROKES);
    this.player.scores[this.holeIndex] = score;
    if (this.turnMode) this.balls[this.turn].done = true;
    const r = resultName(score, this.hole.par);
    if (sunk) {
      this.callout(r.text, this.players.length > 1 ? this.player.name : `${score} stroke${score === 1 ? '' : 's'}`, r.level);
      this.sfx.cheer(r.level);
      if (r.level >= 2) for (let i = 0; i < (r.level === 3 ? 90 : 40); i++) this.particles.push(this.confetti());
    } else {
      this.callout('Max strokes', `${this.player.name} picks up`, 0);
    }
    this.awards.holeDone(score, this.hole.par, this.course.id, this.holeIndex, this.player.name);
    // Best score for this hole (any player).
    const key = `${this.course.id}-${this.holeIndex}`;
    const hb = this.store.data.holeBest;
    if (!hb[key] || score < hb[key]) {
      hb[key] = score;
      this.store.save();
    }
    this.ui.updateHud(this);
    const id = this.turnId;
    setTimeout(() => {
      if (this.state !== 'play' || this.turnId !== id) return;
      if (this.turnMode) {
        this.whenStill(() => {
          const next = this.nextPlayer();
          if (next >= 0) this.switchTo(next);
          else this.ui.showScorecard(this, true);
        });
      } else if (this.turn < this.players.length - 1) {
        this.turn++;
        this.startTurn();
      } else this.ui.showScorecard(this, true);
    }, 2000);
  }

  nextHole() {
    if (this.holeIndex < this.course.holes.length - 1) {
      this.holeIndex++;
      this.startHole();
    } else this.finishCourse();
  }

  finishCourse() {
    this.state = 'over';
    const par = this.course.holes.reduce((n, h) => n + h.par, 0);
    const totals = this.players.map((p) => ({ ...p, total: p.scores.reduce((a, b) => a + b, 0) }));
    const best = Math.min(...totals.map((t) => t.total));
    const data = this.store.data;
    const prev = data.best[this.course.id];
    const newBest = !prev || best < prev;
    if (newBest) data.best[this.course.id] = best;
    this.store.save();
    this.awards.courseDone(this.course, this.players, COURSES.map((c) => c.id));
    this.sfx.win();
    for (let i = 0; i < 80; i++) this.particles.push(this.confetti());
    this.music.intensity = 0;
    this.ui.showFinal({ course: this.course, par, totals, best, newBest, prevBest: prev });
  }

  // Start this player's try at the hole again, from the tee, with no strokes. Not after the
  // ball is in the cup: that score stands.
  canRestart() {
    return this.state === 'play' && (this.phase === 'aim' || this.phase === 'roll');
  }

  restartHole() {
    if (!this.canRestart()) return;
    this.player.scores.length = this.holeIndex;
    if (this.turnMode) {
      if (this.phase === 'roll') {
        for (const i of this.strokeKnocks) {
          this.balls[i].done = false;
          this.players[i].scores.length = this.holeIndex;
        }
        for (const o of this.golf.others) {
          if (!o.home) continue;
          Object.assign(o, { x: o.home.x, y: o.home.y, warpLock: o.home.warpLock, vx: 0, vy: 0, hidden: false, sunk: false, waterT: 0, lx: o.home.x, ly: o.home.y });
        }
      }
      const me = this.balls[this.turn];
      const [tx, ty] = this.golf.freeSpot(me.tee, this.balls.filter((b, i) => i !== this.turn && !b.done));
      Object.assign(me, { x: tx, y: ty, warpLock: null, strokes: 0 });
    }
    this.startTurn(false);
    this.sfx.turn();
    const b = this.golf.ball;
    this.floatText(b.x, b.y, 0.9, 'Try again!', '#fff4e2');
  }

  // ---------- Input ----------
  bindInput() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => this.down(e));
    window.addEventListener('pointermove', (e) => this.move(e));
    window.addEventListener('pointerup', (e) => this.up(e));
    window.addEventListener('pointercancel', (e) => {
      if (this.aim && e.pointerId === this.aim.id) this.aim = null;
    });
  }

  ballScreen() {
    const b = this.golf.ball;
    return this.view.P(b.x, b.y, BALL_R);
  }

  down(e) {
    if (this.state !== 'play' || this.paused || this.phase !== 'aim' || this.aim || !this.golf.canShoot()) return;
    this.aim = { id: e.pointerId, x0: e.clientX, y0: e.clientY, fx: e.clientX, fy: e.clientY, px: 0, py: 0, k: 0, hist: [], ang: null, fa: 0 };
  }

  // The pull is measured from where the finger touched down (on the ball or anywhere), so
  // the aim never jumps or flips at the start of a drag. Sliding back to the start cancels.
  // The pull length sets the power. Moving the finger around the touch-down point turns
  // the aim, by less the further the pull: on a long pull, a big finger move makes a small
  // turn, so far shots and bank shots can be set exactly.
  move(e) {
    const a = this.aim;
    if (!a || e.pointerId !== a.id) return;
    a.fx = e.clientX;
    a.fy = e.clientY;
    const dx = e.clientX - a.x0, dy = e.clientY - a.y0;
    const len = Math.hypot(dx, dy);
    a.u = clamp((len - AIM_DEAD) / (this.maxPull - AIM_DEAD), 0, 1);
    a.k = this.power(a.u);
    // Angles on the ground, not on screen, so a turn is the same in every direction.
    const fa = Math.atan2(dy / this.view.k, dx);
    if (a.k <= 0) a.ang = null;
    else if (a.ang === null) a.ang = fa;
    else {
      // The turn per pixel of finger move is set against the reference pull, so a shorter
      // pull for full power does not make the aim coarser.
      const turn = Math.atan2(Math.sin(fa - a.fa), Math.cos(fa - a.fa));
      const ref = AIM_DEAD + a.k * (this.refPull - AIM_DEAD);
      a.ang += turn * aimGain(a.k) * (len / ref);
    }
    a.fa = fa;
    const ang = a.ang === null ? fa : a.ang, pull = Math.min(len, this.maxPull);
    const sx = Math.cos(ang), sy = Math.sin(ang) * this.view.k, sl = Math.hypot(sx, sy);
    a.px = (sx / sl) * pull;
    a.py = (sy / sl) * pull;
    a.hist.push({ t: e.timeStamp, px: a.px, py: a.py, k: a.k });
    if (a.hist.length > 16) a.hist.shift();
  }

  up(e) {
    const a = this.aim;
    if (!a || e.pointerId !== a.id) return;
    this.aim = null;
    // A finger moves a little as it lifts. If it was almost still just before, use the
    // aim from that moment.
    for (let i = a.hist.length - 1; i >= 0; i--) {
      const h = a.hist[i];
      if (e.timeStamp - h.t < 50) continue;
      if (Math.hypot(h.px - a.px, h.py - a.py) < 8) Object.assign(a, { px: h.px, py: h.py, k: h.k });
      break;
    }
    if (a.k <= 0 || this.phase !== 'aim') return;
    const v = this.shotVelocity(a);
    if (this.golf.shoot(v.vx, v.vy)) {
      this.strokes++;
      this.phase = 'roll';
      this.trail.length = 0;
      this.ui.updateHud(this);
    }
  }

  // Power k (0 to 1) for pull u (0 to 1). k sets how far the ball rolls on grass. At the
  // start, k grows as fast as it would over the longer reference pull, so short putts are
  // as fine as before. Then it grows faster, to reach full power at the shorter pull.
  power(u) {
    const a = (this.maxPull - AIM_DEAD) / (this.refPull - AIM_DEAD);
    return a * u + (1 - a) * u * u;
  }

  // Pulling back on screen aims the other way on the ground. The screen y is squashed by
  // the camera tilt, so the pull is turned into ground units first.
  shotVelocity(a) {
    const gx = -a.px, gy = -a.py / this.view.k;
    const L = Math.hypot(gx, gy) || 1;
    const sp = MAX_SPEED * Math.sqrt(a.k);
    return { vx: (gx / L) * sp, vy: (gy / L) * sp, k: a.k };
  }

  // ---------- Events from the rules ----------
  onEvent(name, d) {
    if (this.state === 'menu') return;
    if (d && d.other !== undefined) return this.onOtherEvent(name, d);
    const sfx = this.sfx;
    const fx = this.ballFx;
    const who = this.player && this.player.name;
    if (name === 'putt') {
      this.strokeKnocks = [];
      const b = this.golf.ball;
      this.awards.putt(b, this.hole.cup, (d.speed / MAX_SPEED) ** 2, this.golf.surfaceAt(b.x, b.y));
      sfx.putt(d.speed / MAX_SPEED);
      fx.squashV -= 6 * (d.speed / MAX_SPEED);
    } else if (name === 'bounce') {
      const k = clamp(d.speed / 9, 0, 1);
      this.awards.bounce(d.kind, who, d.speed);
      if (d.kind === 'ball' && d.target !== 'me') this.awards.moved(d.target, who);
      if (d.quiet) return;
      if (d.kind === 'bumper' || d.kind === 'ball') sfx.boing(k);
      else if (d.kind === 'sail' || d.kind === 'slider' || d.kind === 'spinner') sfx.thwack(k);
      else sfx.knock(k);
      const b = this.golf.ball;
      fx.squashA = Math.atan2(d.y - b.y, d.x - b.x);
      fx.squashV += 10 * k;
      if (d.speed > 6) {
        fx.mood = 'dizzy';
        fx.moodT = 1.4;
      }
      if (d.kind === 'bumper') this.particles.push({ kind: 'ring', x: d.x, y: d.y, z: 0.25, r: 1.2, color: 'rgba(255,255,255,0.9)', t: 0, life: 0.3 });
      if (k > 0.25) {
        for (let i = 0; i < 4; i++) {
          const a = rand(0, TAU);
          this.particles.push({ kind: 'spark', x: d.x, y: d.y, z: 0.25, vx: Math.cos(a) * 2, vy: Math.sin(a) * 2, vz: rand(1, 2), r: 0.06, color: '#fff8e0', t: 0, life: 0.35 });
        }
      }
    } else if (name === 'water') {
      this.awards.bump('splashes');
      sfx.splash();
      fx.hidden = true;
      for (let i = 0; i < 18; i++) {
        const a = rand(0, TAU), sp = rand(1, 3.5);
        this.particles.push({ kind: 'drop', x: d.x, y: d.y, z: 0.1, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: rand(2.5, 5), r: rand(0.05, 0.1), color: THEMES[this.course.theme].water[0], t: 0, life: 1 });
      }
      for (let i = 0; i < 3; i++) this.particles.push({ kind: 'ripple', x: d.x, y: d.y, z: 0, r: 0.6 + i * 0.5, t: -i * 0.15, life: 1.1 });
      this.floatText(d.x, d.y, 1, 'Splash! +1', '#bfeaff');
    } else if (name === 'reset') {
      this.strokes += d.penalty;
      fx.hidden = false;
      fx.squashV += 6;
      this.ui.updateHud(this);
      if (this.strokes >= MAX_STROKES) this.finishTurn(false);
      else if (this.turnMode) this.endStroke();
      else this.phase = 'aim';
    } else if (name === 'stop') {
      if (this.phase !== 'roll') return;
      if (this.strokes >= MAX_STROKES) this.finishTurn(false);
      else if (this.turnMode) this.endStroke();
      else this.phase = 'aim';
    } else if (name === 'sink') {
      this.awards.sink(this.strokes, who);
      sfx.plop();
      fx.mood = 'happy';
      fx.moodT = 3;
      this.sinkT = 0;
      this.sinkFrom = { x: this.golf.ball.x, y: this.golf.ball.y };
      this.phase = 'sink';
      for (let i = 0; i < 2; i++) this.particles.push({ kind: 'ring', x: d.x, y: d.y, z: 0.02, r: 1.4 + i * 0.6, color: 'rgba(255,255,255,0.9)', t: -i * 0.12, life: 0.55 });
      const id = this.turnId;
      setTimeout(() => {
        if (this.state === 'play' && this.turnId === id) this.finishTurn(true);
      }, 650);
    } else if (name === 'warp') {
      if (this.awards.shot) this.awards.shot.warp = true;
      sfx.warp();
      const col = PORTAL_COLORS[d.pair % PORTAL_COLORS.length][0];
      for (const [x, y] of [[d.x, d.y], [d.ex, d.ey]]) {
        this.particles.push({ kind: 'ring', x, y, z: 0.05, r: 1.1, color: col, t: 0, life: 0.4 });
        for (let i = 0; i < 8; i++) {
          const a = rand(0, TAU);
          this.particles.push({ kind: 'spark', x, y, z: 0.2, vx: Math.cos(a) * 1.6, vy: Math.sin(a) * 1.6, vz: rand(1.5, 3), r: 0.07, color: col, t: 0, life: 0.5 });
        }
      }
      this.trail.length = 0;
      fx.squashV += 5;
      fx.mood = 'dizzy';
      fx.moodT = 1.2;
    } else if (name === 'boost') {
      if (this.awards.shot) this.awards.shot.boost = true;
      sfx.boost();
      fx.squashV -= 5;
      fx.mood = 'happy';
      fx.moodT = 1.2;
      for (let i = 0; i < 6; i++) this.particles.push({ kind: 'spark', x: d.x, y: d.y, z: 0.15, vx: rand(-1, 1), vy: rand(-1, 1), vz: rand(1, 2.5), r: 0.06, color: '#ffd23f', t: 0, life: 0.4 });
    } else if (name === 'lip') {
      this.awards.lip(who);
      sfx.lip();
      this.floatText(this.golf.ball.x, this.golf.ball.y, 0.9, 'Too fast!', '#fff4e2');
    }
  }

  // ---------- Effects ----------
  confetti() {
    const cols = ['#ffb13a', '#ff4f8b', '#7dff8a', '#7fe3ff', '#ffe36b', '#b05cf0'];
    return { kind: 'confetti', sx: rand(0, this.W), sy: rand(-this.H * 0.5, -10), vx: rand(-40, 40), vy: rand(90, 230), a: rand(0, TAU), av: rand(-8, 8), w: rand(6, 11), h: rand(3, 6), color: pick(cols), t: 0, life: rand(2.5, 4) };
  }

  floatText(x, y, z, text, color) {
    this.texts.push({ x, y, z, text, color, t: 0, life: 1.2 });
  }

  callout(text, sub, level) {
    this.callouts = [{ text, sub, level, t: 0 }];
  }

  // ---------- Update ----------
  frame(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (!this.paused) this.update(dt);
    this.ui.syncRestart(this.canRestart());
    this.render();
    requestAnimationFrame(this.frame);
  }

  update(dt) {
    this.time += dt;
    this.acc += dt;
    let n = 0;
    while (this.acc >= DT && n < 6) {
      this.golf.step();
      this.acc -= DT;
      n++;
    }
    if (n === 6) this.acc = 0;
    // Thumb joystick: fades in while aiming, and out after the putt with its last pose.
    const j = this.joy, on = !!this.aim && this.phase === 'aim';
    if (on) j.a = this.aim;
    j.t = on ? Math.min(1, j.t + dt / 0.08) : Math.max(0, j.t - dt / 0.15);
    const g = this.golf;
    const b = g.ball;
    const fx = this.ballFx;
    // Ball squash: a stiff spring, so bounces look jelly-like.
    fx.squashV += (-160 * fx.squash - 9 * fx.squashV) * dt;
    fx.squash = clamp(fx.squash + fx.squashV * dt, -0.35, 0.35);
    if (fx.moodT > 0) {
      fx.moodT -= dt;
      if (fx.moodT <= 0) fx.mood = 'sour';
    }
    const sp = Math.hypot(b.vx, b.vy);
    if (fx.moodT <= 0) {
      const nearWater = (g.hole.water || []).length && g.state === 'rolling' && sp > 1.5;
      fx.mood = nearWater ? 'scared' : 'sour';
    }
    // Eyes look where the ball goes, or at the cup while it waits.
    const [cx, cy] = g.hole.cup;
    const lx = sp > 0.3 ? b.vx : cx - b.x, ly = sp > 0.3 ? b.vy : cy - b.y;
    const L = Math.hypot(lx, ly) || 1;
    fx.look = { x: lx / L, y: (ly / L) * 0.6 };
    // The face rolls with the ball, then turns back to look at the player when it stops.
    const v = this.view;
    if (!fx.spin) {
      fx.spin = facingCamera(v.k, v.hz);
      fx.lastX = b.x;
      fx.lastY = b.y;
    }
    const mx = b.x - fx.lastX, my = b.y - fx.lastY;
    if (Math.hypot(mx, my) < 1.5) roll(fx.spin, mx, my, BALL_R * (fx.scale || 1));
    // Trophies that care where and how far the putt rolls (not a portal jump).
    if (this.phase === 'roll' && g.state === 'rolling' && Math.hypot(mx, my) < 1.5) {
      const hill = (g.hole.slopes || []).some((s) => pointInPoly(b.x, b.y, s.poly));
      this.awards.roll(Math.hypot(mx, my), { ice: g.surfaceAt(b.x, b.y) === 'ice', hill, belt: !!g.beltAt(b.x, b.y) }, this.player && this.player.name);
    }
    fx.lastX = b.x;
    fx.lastY = b.y;
    const calm = this.phase === 'sink' ? 0 : clamp(1 - sp / 0.7, 0, 1);
    if (calm > 0) settle(fx.spin, v.k, v.hz, (1 - Math.exp(-dt * 6)) * calm);
    if (this.turnMode && this.balls) {
      this.balls.forEach((s, i) => {
        if (i === this.turn || s.done) return;
        if (!s.spin) s.spin = facingCamera(v.k, v.hz);
        const ox = s.x - (s.lx ?? s.x), oy = s.y - (s.ly ?? s.y);
        if (Math.hypot(ox, oy) < 1.5) roll(s.spin, ox, oy, BALL_R);
        s.lx = s.x;
        s.ly = s.y;
        const c = clamp(1 - Math.hypot(s.vx, s.vy) / 0.7, 0, 1);
        if (c > 0) settle(s.spin, v.k, v.hz, (1 - Math.exp(-dt * 6)) * c);
      });
    }
    // Sinking: slide to the cup center and drop in.
    if (this.phase === 'sink' || (this.phase === 'done' && this.sinkFrom)) {
      this.sinkT = Math.min(1, (this.sinkT || 0) + dt / 0.45);
      const t = this.sinkT;
      b.x = this.sinkFrom.x + (cx - this.sinkFrom.x) * Math.min(1, t * 1.6);
      b.y = this.sinkFrom.y + (cy - this.sinkFrom.y) * Math.min(1, t * 1.6);
      fx.z = -0.32 * t * t;
      fx.scale = 1 - 0.35 * t;
      if (t >= 1) fx.hidden = true;
    } else this.sinkFrom = null;
    // Trail and sand puffs.
    if (g.state === 'rolling' && sp > 0.4) {
      this.trailT = (this.trailT || 0) - dt;
      if (this.trailT <= 0) {
        this.trailT = 0.035;
        this.trail.push({ x: b.x, y: b.y, t: 0 });
        if (this.trail.length > 40) this.trail.shift();
      }
      if (g.surfaceAt(b.x, b.y) === 'sand' && Math.random() < dt * 30) {
        this.sfx.sand();
        this.particles.push({ kind: 'puff', x: b.x + rand(-0.15, 0.15), y: b.y + rand(-0.15, 0.15), z: 0.05, vx: -b.vx * 0.1, vy: -b.vy * 0.1, vz: 0.4, r: rand(0.12, 0.22), color: '#f2d999', t: 0, life: rand(0.5, 0.8) });
      }
    }
    for (const p of this.trail) p.t += dt;
    for (const bm of g.bumpers) {
      const d = bm.data;
      d.wobV = (d.wobV || 0) + (-60 * (d.wob || 0) - 6 * (d.wobV || 0)) * dt;
      d.wob = clamp((d.wob || 0) + d.wobV * dt, -1, 1);
    }
    this.updateParticles(dt);
    for (const c of this.callouts) c.t += dt;
    this.callouts = this.callouts.filter((c) => c.t < 1.9);
    this.hintT = (this.hintT || 0) - dt;
    if (this.hintT <= 0) {
      this.hintT = 0.5;
      this.sfx.watch();
      const s = this.store.data.settings;
      this.ui.setSoundHint((s.sound || s.music) && !!this.sfx.ctx && !this.sfx.running && !document.hidden);
    }
  }

  updateParticles(dt) {
    const out = [];
    for (const p of this.particles) {
      p.t += dt;
      if (p.t >= p.life) continue;
      if (p.t < 0) {
        out.push(p);
        continue;
      }
      if (p.kind === 'confetti') {
        p.sx += p.vx * dt;
        p.sy += p.vy * dt;
        p.a += p.av * dt;
      } else {
        if (p.vz != null) {
          p.vz -= (p.kind === 'puff' ? 0.5 : 9.8) * dt;
          p.z = Math.max(0, p.z + p.vz * dt);
        }
        p.x += (p.vx || 0) * dt;
        p.y += (p.vy || 0) * dt;
      }
      out.push(p);
    }
    this.particles = out;
    for (const t of this.texts) {
      t.t += dt;
      t.z += dt * 0.9;
    }
    this.texts = this.texts.filter((t) => t.t < t.life);
  }

  // ---------- Drawing ----------
  render() {
    const ctx = this.ctx;
    const v = this.view;
    const g = this.golf;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.bg) ctx.drawImage(this.bg, 0, 0, this.W, this.H);
    v.drawCourse(ctx, g.hole, this.course.theme, this.time, this.turnMode && this.balls && this.state === 'play' ? this.balls.map((b) => b.tee) : null);
    const fx = this.ballFx;
    const b = g.ball;
    const ball = { x: b.x, y: b.y, style: this.state === 'play' ? this.player.style : 'jelly', color: this.state === 'play' ? this.player.color : 'cherry', look: fx.look, mood: fx.mood, squash: fx.squash, squashA: fx.squashA, z: fx.z, scale: fx.scale, hidden: fx.hidden, spin: fx.spin };
    const waiting = this.waitingBalls();
    v.drawShadows(ctx, g, ball, this.W, this.H, this.dpr, this.course.theme, waiting);
    this.drawTrail(ctx);
    if (this.aim && this.aim.k > 0 && this.phase === 'aim') this.drawAim(ctx);
    v.drawSolids(ctx, g, this.course.theme, this.time, ball, this.holeIndex + 1, waiting);
    this.drawParticles(ctx);
    this.drawTexts(ctx);
    this.drawCallouts(ctx);
    if (this.paused) this.joy.t = 0;
    else this.drawJoystick(ctx);
  }

  // A small see-through thumbstick where the thumb touched down, shown while aiming. The cap
  // tilts toward the pull: its offset is how far you pull (the rim is full power) and its
  // direction is the aim. On a long pull the aim turns less than the thumb, and so does the
  // cap. Back in the middle: no putt.
  drawJoystick(ctx) {
    const j = this.joy, a = j.a;
    if (!a || j.t <= 0) return;
    const R = clamp(this.maxPull * 0.3, 30, 44), kr = R * 0.62, travel = R - kr * 0.45;
    const cx = a.x0, cy = a.y0;
    const L = Math.hypot(a.px, a.py) || 1, d = travel * (a.u || 0);
    const nx = cx + (a.px / L) * d, ny = cy + (a.py / L) * d;
    const dark = (o) => `rgba(28,28,34,${o})`, white = (o) => `rgba(255,255,255,${o})`;
    ctx.save();
    ctx.globalAlpha = j.t * j.t * (3 - 2 * j.t);
    // Well: a dark round socket with a light rim.
    const well = ctx.createRadialGradient(cx, cy - R * 0.2, R * 0.2, cx, cy, R);
    well.addColorStop(0, dark(0.28));
    well.addColorStop(1, dark(0.45));
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.fillStyle = well;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = white(0.5);
    ctx.stroke();
    // Cap shadow, toward the tilt.
    ctx.beginPath();
    ctx.arc(nx + (nx - cx) * 0.15, ny + (ny - cy) * 0.15 + 2.5, kr, 0, TAU);
    ctx.fillStyle = dark(0.3);
    ctx.fill();
    // Cap: grip edge, then a dished top with a soft light.
    const cap = ctx.createRadialGradient(nx - kr * 0.35, ny - kr * 0.45, kr * 0.1, nx, ny, kr);
    cap.addColorStop(0, 'rgba(92,92,104,0.7)');
    cap.addColorStop(1, 'rgba(44,44,52,0.7)');
    ctx.beginPath();
    ctx.arc(nx, ny, kr, 0, TAU);
    ctx.fillStyle = cap;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = white(0.35);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(nx, ny, kr - 3.5, 0, TAU);
    ctx.setLineDash([1.5, 2.5]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = dark(0.55);
    ctx.stroke();
    ctx.setLineDash([]);
    const top = ctx.createRadialGradient(nx + kr * 0.15, ny + kr * 0.2, 0, nx, ny, kr * 0.68);
    top.addColorStop(0, 'rgba(64,64,74,0.74)');
    top.addColorStop(1, 'rgba(36,36,44,0.74)');
    ctx.beginPath();
    ctx.arc(nx, ny, kr * 0.68, 0, TAU);
    ctx.fillStyle = top;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(nx, ny, kr * 0.68, Math.PI * 0.95, Math.PI * 1.6);
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = white(0.4);
    ctx.stroke();
    ctx.restore();
  }

  drawTrail(ctx) {
    for (const p of this.trail) {
      const a = Math.max(0, 0.5 - p.t * 0.6);
      if (a <= 0) continue;
      const [x, y] = this.view.P(p.x, p.y, 0.02);
      ctx.beginPath();
      ctx.ellipse(x, y, this.view.s * 0.08, this.view.s * 0.08 * this.view.k, 0, 0, TAU);
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.fill();
    }
  }

  // Aim: a pull band behind the ball, a power ring, and the exact predicted path.
  drawAim(ctx) {
    const a = this.aim;
    const v = this.view;
    const b = this.golf.ball;
    const sh = this.shotVelocity(a);
    const pts = this.golf.predict(b.x, b.y, sh.vx, sh.vy, 2);
    // Dots spaced evenly along the predicted path.
    const dots = [];
    const step = 0.45;
    let carry = step * 0.6;
    for (let i = 1; i < pts.length; i++) {
      // A gap (null) is a portal jump: the dots start again at the twin.
      if (!pts[i] || !pts[i - 1]) {
        carry = step * 0.6;
        continue;
      }
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      const L = Math.hypot(x1 - x0, y1 - y0);
      for (let d = carry; d < L; d += step) dots.push([x0 + ((x1 - x0) * d) / L, y0 + ((y1 - y0) * d) / L]);
      carry = (carry - L) % step;
      if (carry < 0) carry += step;
    }
    if (!this.store.data.settings.guide) dots.length = Math.min(dots.length, 4);
    v.guide(ctx, dots.slice(0, 60));
    const hit = this.golf.lastLine && this.golf.lastLine.ballHit;
    if (hit && this.store.data.settings.guide) this.drawBallHit(ctx, hit);
    // Pull band from the ball back toward the finger.
    const [bx, by] = this.ballScreen();
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + a.px * 0.6, by + a.py * 0.6);
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(4, v.s * 0.12);
    ctx.strokeStyle = 'rgba(42,21,51,0.35)';
    ctx.stroke();
    // Power ring.
    const R = Math.max(26, v.s * 0.75);
    ctx.beginPath();
    ctx.arc(bx, by, R, -Math.PI / 2, -Math.PI / 2 + TAU * a.k);
    ctx.lineWidth = 5;
    ctx.strokeStyle = a.k > 0.85 ? '#ff4f4f' : a.k > 0.5 ? '#ffb13a' : '#7dff8a';
    ctx.stroke();
  }

  // The aim line meets another ball: a dashed ring where your ball touches it, and gold
  // dots for the way the other ball goes (along the line through both centers).
  drawBallHit(ctx, h) {
    const v = this.view;
    const [x, y] = v.P(h.x, h.y, BALL_R);
    ctx.beginPath();
    ctx.arc(x, y, BALL_R * v.s, 0, TAU);
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.stroke();
    ctx.setLineDash([]);
    const len = clamp(h.speed * 0.45, 0.8, 3), dx = -h.nx, dy = -h.ny;
    const pts = [];
    for (let d = BALL_R + 0.3; d <= BALL_R + len; d += 0.3) pts.push(v.P(h.bx + dx * d, h.by + dy * d, 0.05));
    pts.forEach(([px, py], i) => {
      ctx.beginPath();
      ctx.arc(px, py, Math.max(2, v.s * 0.075) * (1 - (i / pts.length) * 0.4), 0, TAU);
      ctx.fillStyle = '#ffd23f';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(42,21,51,0.55)';
      ctx.stroke();
    });
    const e = BALL_R + len + 0.25;
    const [ax, ay] = v.P(h.bx + dx * e, h.by + dy * e, 0.05), [bx, by] = v.P(h.bx + dx * (e - 0.3), h.by + dy * (e - 0.3), 0.05);
    const L = Math.hypot(ax - bx, ay - by) || 1, ux = (ax - bx) / L, uy = (ay - by) / L, w = Math.max(5, v.s * 0.16);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax - ux * w * 1.5 - uy * w, ay - uy * w * 1.5 + ux * w);
    ctx.lineTo(ax - ux * w * 1.5 + uy * w, ay - uy * w * 1.5 - ux * w);
    ctx.closePath();
    ctx.fillStyle = '#ffd23f';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(42,21,51,0.7)';
    ctx.stroke();
  }

  drawParticles(ctx) {
    const v = this.view;
    for (const p of this.particles) {
      if (p.t < 0) continue;
      const life = 1 - p.t / p.life;
      if (p.kind === 'confetti') {
        ctx.save();
        ctx.translate(p.sx, p.sy);
        ctx.rotate(p.a);
        ctx.globalAlpha = Math.min(1, life * 3);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
        continue;
      }
      const [x, y] = v.P(p.x, p.y, p.z || 0);
      if (p.kind === 'ring' || p.kind === 'ripple') {
        const r = p.r * v.s * (1 - life * 0.7);
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * v.k, 0, 0, TAU);
        ctx.lineWidth = Math.max(2, v.s * 0.08 * life);
        ctx.strokeStyle = p.kind === 'ripple' ? `rgba(255,255,255,${life * 0.8})` : p.color;
        ctx.globalAlpha = p.kind === 'ring' ? life : 1;
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (p.kind === 'puff') {
        ctx.globalAlpha = life * 0.7;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(x, y, p.r * v.s * (1.4 - life * 0.4), 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else {
        ctx.globalAlpha = Math.min(1, life * 2);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(1.5, p.r * v.s), 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  drawTexts(ctx) {
    const v = this.view;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of this.texts) {
      const k = t.t / t.life;
      const size = clamp(v.s * 0.6, 16, 34);
      ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      ctx.font = `${Math.round(size)}px "Lilita One", sans-serif`;
      ctx.lineWidth = size * 0.2;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#2a1533';
      const [x, y] = v.P(t.x, t.y, t.z);
      ctx.strokeText(t.text, x, y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, x, y);
    }
    ctx.globalAlpha = 1;
  }

  drawCallouts(ctx) {
    for (const c of this.callouts) {
      const k = c.t / 1.9;
      const pop = k < 0.1 ? 0.5 + (k / 0.1) * 0.7 : 1.2 - Math.min(0.2, (k - 0.1) * 0.5);
      const big = c.level >= 2 ? 1.25 : 1;
      const size = clamp(Math.min(this.W, this.H) * 0.11, 32, 84) * pop * big;
      ctx.save();
      ctx.globalAlpha = k > 0.8 ? (1 - k) / 0.2 : 1;
      ctx.translate(this.W / 2, this.H * 0.36);
      ctx.rotate(-0.05);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `${Math.round(size)}px "Lilita One", sans-serif`;
      ctx.lineJoin = 'round';
      ctx.lineWidth = size * 0.2;
      ctx.strokeStyle = '#2a1533';
      ctx.strokeText(c.text, 0, 0);
      ctx.fillStyle = c.level >= 3 ? '#ffe36b' : c.level === 2 ? '#7dff8a' : c.level === 1 ? '#fff4e2' : '#ffb0b0';
      ctx.fillText(c.text, 0, 0);
      if (c.sub) {
        ctx.font = `${Math.round(size * 0.42)}px "Lilita One", sans-serif`;
        ctx.lineWidth = size * 0.1;
        ctx.strokeText(c.sub, 0, size * 0.72);
        ctx.fillStyle = '#fff4e2';
        ctx.fillText(c.sub, 0, size * 0.72);
      }
      ctx.restore();
    }
  }
}
