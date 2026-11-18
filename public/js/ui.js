// DOM screens: menu, player setup, HUD, scorecard, final results, pause, settings, help.
import { COURSES, bounds } from './course.js';
import { View } from './view.js';
import { Golf } from './golf.js';
import { drawBall, STYLES } from './ballart.js';
import { TROPHIES, trophyById, hasStyle, unlockedStyles } from './trophies.js';
import { facingCamera, roll } from './spin.js';
import { PLAYER_COLORS, resultName, MAX_STROKES, TILT } from './game.js';
import { GLOOP_COLORS } from './gloop-art.js';

const $ = (id) => document.getElementById(id);
const DEFAULT_NAMES = { cherry: 'Cherry', lime: 'Lime', grape: 'Grape', berry: 'Berry' };
const icons = {};

// A round Gloop ball as an image, for the DOM: turned a little, so its style shows.
export function ballIcon(color, px = 48, mood = 'sour', style = 'jelly') {
  const key = color + px + mood + style;
  if (icons[key]) return icons[key];
  const c = document.createElement('canvas');
  c.width = c.height = px * 2;
  const ctx = c.getContext('2d');
  ctx.scale(2, 2);
  ctx.translate(px / 2, px / 2);
  const spin = facingCamera(1, 0);
  roll(spin, -0.12, -0.07, 0.28);
  drawBall(ctx, px * 0.42, { color, style, spin, look: { x: 0.3, y: 0.1 }, mood });
  icons[key] = c.toDataURL();
  return icons[key];
}

// A small picture of one hole of a course, drawn with the game's own renderer.
const thumbs = {};
function courseThumb(course) {
  if (thumbs[course.id]) return thumbs[course.id];
  const w = 280, h = 150, dpr = 2;
  const hole = course.holes[course.thumb || 0];
  const c = document.createElement('canvas');
  c.width = w * dpr;
  c.height = h * dpr;
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  const v = new View();
  v.fit(bounds(hole), 4, 4, w - 8, h - 8, TILT);
  const g = new Golf();
  g.load(hole);
  v.drawBackground(ctx, w, h, hole, course.theme);
  v.drawCourse(ctx, hole, course.theme, 0.4);
  v.drawShadows(ctx, g, null, w, h, dpr, course.theme);
  v.drawSolids(ctx, g, course.theme, 0.4, null, (course.thumb || 0) + 1);
  thumbs[course.id] = c.toDataURL('image/jpeg', 0.86);
  return thumbs[course.id];
}

const coursePar = (c) => c.holes.reduce((n, h) => n + h.par, 0);

function vsPar(total, par) {
  const d = total - par;
  return d === 0 ? 'E' : d > 0 ? `+${d}` : `${d}`;
}

export class UI {
  constructor(store) {
    this.store = store;
    this.el = {};
    for (const id of ['menu', 'setup', 'courses', 'trophies', 'hud', 'card', 'final', 'pause', 'settings', 'howto', 'banner', 'rotate', 'tapGate', 'soundHint']) this.el[id] = $(id);
    this.modals = ['setup', 'courses', 'trophies', 'card', 'final', 'pause', 'settings', 'howto'];
    this.toasts = [];
  }

  attach(game) {
    this.game = game;
    const g = game;
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const act = btn.dataset.act;
      g.sfx.ui();
      if (act === 'play') this.openSetup();
      else if (act === 'courses') this.openCourses();
      else if (act === 'course') this.startFromSetup(btn.dataset.id);
      else if (act === 'howto') this.open('howto');
      else if (act === 'trophies') this.openTrophies();
      else if (act === 'settings') this.openSettings();
      else if (act === 'close') this.closeTop();
      else if (act === 'pause') this.pauseGame();
      else if (act === 'resume') this.resumeGame();
      else if (act === 'restart') {
        if (!g.canRestart()) return;
        this.closeAll();
        g.restartHole();
      } else if (act === 'card') this.showScorecard(g, false);
      else if (act === 'next') {
        this.closeAll();
        g.nextHole();
      } else if (act === 'again') {
        this.closeAll();
        g.startCourse(g.players.map(({ name, color, style }) => ({ name, color, style })), g.course.id);
      } else if (act === 'menu') {
        this.closeAll();
        g.showMenuScene();
      } else if (act === 'fullscreen') this.toggleFullscreen();
    });
    $('setSound').addEventListener('change', (e) => this.setSetting('sound', e.target.checked));
    $('setMusic').addEventListener('change', (e) => this.setSetting('music', e.target.checked));
    $('setGuide').addEventListener('change', (e) => this.setSetting('guide', e.target.checked));
    $('setTurns').addEventListener('change', (e) => this.setSetting('turns', e.target.checked));
    $('resetBtn').addEventListener('click', () => {
      if (confirm('Reset all scores and trophies?')) {
        this.store.reset();
        g.applySettings();
        this.openSettings();
      }
    });
    const s = this.store.data.settings;
    if (s.sound || s.music) this.el.tapGate.hidden = false;
    const unlock = () => {
      g.sfx.unlock();
      g.music.start();
    };
    $('tapGateBtn').addEventListener('click', () => {
      unlock();
      this.el.tapGate.hidden = true;
    });
    this.el.soundHint.addEventListener('click', unlock);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && g.state === 'play' && !g.paused) this.pauseGame();
    });
    window.addEventListener('keydown', (e) => {
      if ((e.key === 'Escape' || e.key === 'p') && g.state === 'play') g.paused ? this.resumeGame() : this.pauseGame();
      else if (e.key === 'r' && !g.paused && g.canRestart()) g.restartHole();
    });
    this.renderMenu();
  }

  setSetting(k, v) {
    this.store.data.settings[k] = v;
    this.store.save();
    this.game.applySettings();
  }

  open(name) {
    this.el[name].hidden = false;
  }

  closeTop() {
    for (const m of ['howto', 'settings', 'trophies', 'card', 'courses', 'setup']) {
      if (!this.el[m].hidden) {
        this.el[m].hidden = true;
        if (m === 'courses') this.el.setup.hidden = false;
        if (m === 'settings' && this.game.paused) this.el.pause.hidden = false;
        if ((m === 'setup' || m === 'trophies') && this.game.state === 'menu') this.el.menu.hidden = false;
        return;
      }
    }
  }

  closeAll() {
    for (const m of this.modals) this.el[m].hidden = true;
    const g = this.game;
    if (g && g.paused) g.music.duck(false);
    if (g) g.paused = false;
  }

  // Restart buttons (HUD and pause menu) work only while a hole is in play.
  syncRestart(can) {
    if (can === this.restartOn) return;
    this.restartOn = can;
    for (const b of document.querySelectorAll('[data-act="restart"]')) b.disabled = !can;
  }

  // ---------- Menu ----------
  showMenu() {
    this.closeAll();
    this.el.hud.hidden = true;
    this.el.banner.hidden = true;
    this.el.menu.hidden = false;
    this.renderMenu();
  }

  renderMenu() {
    const d = this.store.data;
    const played = COURSES.filter((c) => d.best[c.id]).length;
    $('menuBest').textContent = played ? `${played} of ${COURSES.length} courses played` : `${COURSES.length} courses · ${COURSES.length * 9} holes`;
    $('trophyCount').textContent = `${Object.keys(d.trophies).length}/${TROPHIES.length}`;
  }

  // ---------- Trophies and ball styles ----------
  openTrophies() {
    const d = this.store.data;
    $('trophyTotal').textContent = `${Object.keys(d.trophies).length} of ${TROPHIES.length}`;
    $('trophyGrid').innerHTML = TROPHIES.map((t) => {
      const got = !!d.trophies[t.id];
      const style = STYLES.find((s) => s.unlock === t.id);
      let prog = '';
      if (t.goal && !got) {
        const n = Math.min(t.goal, d.stats[t.stat] || 0);
        prog = `<div class="tp"><i style="width:${(n / t.goal) * 100}%"></i></div><div class="tv">${n} / ${t.goal}</div>`;
      }
      return `<div class="trophy${got ? '' : ' locked'}"><div class="medal">${t.icon}</div><div class="tx"><div class="tn">${t.name}</div><div class="td">${t.desc}</div>${prog}</div>${style ? `<span class="tr">🎁 ${style.name}</span>` : ''}</div>`;
    }).join('');
    $('styleGrid').innerHTML = STYLES.map((st) => {
      const got = hasStyle(this.store, st.id);
      const t = st.unlock && trophyById(st.unlock);
      return `<div class="style-card${got ? '' : ' locked'}"><img src="${ballIcon('lime', 64, got ? 'happy' : 'sour', st.id)}" alt=""><b>${st.name}</b><span>${got ? 'Unlocked' : `Win “${t.name}”`}</span></div>`;
    }).join('');
    this.el.menu.hidden = true;
    this.open('trophies');
  }

  // A trophy pops in at the side. Several wait their turn.
  trophyToast(t, style, who) {
    this.toasts.push({ t, style, who });
    if (this.toasts.length === 1) this.nextToast();
  }

  nextToast() {
    const q = this.toasts[0];
    if (!q) return;
    const el = document.createElement('div');
    el.className = 'ach-toast';
    el.innerHTML = `<div class="ai">${q.t.icon}</div><div><small>Trophy!${q.who ? ` · <span class="who"></span>` : ''}</small><b></b>${q.style ? `<em>New ball style: ${q.style.name}</em>` : ''}</div>`;
    el.querySelector('b').textContent = q.t.name;
    if (q.who) el.querySelector('.who').textContent = q.who;
    $('ui').appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => {
        el.remove();
        this.toasts.shift();
        this.nextToast();
      }, 320);
    }, 2600);
    this.renderMenu();
  }

  // ---------- Player setup ----------
  // Each slot has its own ball color. Two playing players never share a color: a color
  // another playing player has is dimmed, and a slot that joins with a taken color gets a
  // free one.
  openSetup() {
    const saved = this.store.data.players.filter((p) => PLAYER_COLORS.includes(p.color));
    const box = $('slots');
    box.textContent = '';
    const free = PLAYER_COLORS.filter((c) => !saved.some((p) => p.color === c));
    const slots = [];
    const takenBy = (slot, c) => slots.some((s) => s !== slot && s.classList.contains('on') && s.dataset.color === c);
    const refreshDots = () => {
      for (const s of slots) {
        for (const d of s.querySelectorAll('.dot')) {
          d.classList.toggle('pick', d.dataset.c === s.dataset.color);
          d.disabled = takenBy(s, d.dataset.c);
        }
      }
    };
    PLAYER_COLORS.forEach((_, i) => {
      const p = saved[i];
      const on = i === 0 || !!p;
      let color = p ? p.color : free.shift();
      const slot = document.createElement('div');
      slots.push(slot);
      slot.className = 'slot' + (on ? ' on' : '');
      slot.dataset.color = color;
      const styles = unlockedStyles(this.store);
      let style = p && hasStyle(this.store, p.style) ? p.style : 'jelly';
      slot.dataset.style = style;
      const dots = PLAYER_COLORS.map((c) => `<button class="dot" type="button" data-c="${c}" style="--c:${GLOOP_COLORS[c][1]}" aria-label="${DEFAULT_NAMES[c]} color"></button>`).join('');
      slot.innerHTML = `<button class="slot-ball" type="button" aria-label="Change ball color"><img src="${ballIcon(color, 64, 'sour', style)}" alt=""></button><div class="slot-dots">${dots}</div><button class="slot-style" type="button" aria-label="Ball style"></button><input type="text" maxlength="12" value="${(p && p.name) || DEFAULT_NAMES[color]}" aria-label="Player ${i + 1} name"><button class="slot-tog" type="button">${on ? (i === 0 ? 'Player 1' : 'Playing') : 'Add'}</button>`;
      const sb = slot.querySelector('.slot-style');
      const input = slot.querySelector('input');
      const showStyle = () => {
        sb.textContent = `${STYLES.find((x) => x.id === style).name}${styles.length > 1 ? ' ▸' : ''}`;
        slot.querySelector('img').src = ballIcon(color, 64, 'sour', style);
        slot.dataset.style = style;
      };
      // A default name follows the color (Cherry becomes Lime); a name the player typed stays.
      // A slot that is not playing and has the chosen color takes the color given up, so all
      // four slots always show different colors.
      const setColor = (c, quiet = false) => {
        if (c === color || takenBy(slot, c)) return;
        const old = color;
        if (input.value.trim() === DEFAULT_NAMES[color]) input.value = DEFAULT_NAMES[c];
        color = c;
        slot.dataset.color = c;
        showStyle();
        for (const s of slots) if (s !== slot && s.dataset.color === c) s.setColor(old, true);
        refreshDots();
        if (!quiet) this.game.sfx.ui();
      };
      slot.setColor = setColor;
      for (const d of slot.querySelectorAll('.dot')) d.addEventListener('click', () => setColor(d.dataset.c));
      slot.querySelector('.slot-ball').addEventListener('click', () => {
        const at = PLAYER_COLORS.indexOf(color);
        for (let k = 1; k < PLAYER_COLORS.length; k++) {
          const c = PLAYER_COLORS[(at + k) % PLAYER_COLORS.length];
          if (!takenBy(slot, c)) return setColor(c);
        }
      });
      showStyle();
      sb.disabled = styles.length < 2;
      sb.addEventListener('click', () => {
        const at = styles.findIndex((x) => x.id === style);
        style = styles[(at + 1) % styles.length].id;
        showStyle();
        this.game.sfx.ui();
      });
      const tog = slot.querySelector('.slot-tog');
      if (i === 0) tog.disabled = true;
      tog.addEventListener('click', () => {
        slot.classList.toggle('on');
        const nowOn = slot.classList.contains('on');
        tog.textContent = nowOn ? 'Playing' : 'Add';
        if (nowOn && takenBy(slot, slot.dataset.color)) slot.setColor(PLAYER_COLORS.find((c) => !takenBy(slot, c)));
        refreshDots();
        this.game.sfx.ui();
      });
      box.appendChild(slot);
    });
    refreshDots();
    this.el.menu.hidden = true;
    this.open('setup');
  }

  readPlayers() {
    const players = [];
    for (const slot of $('slots').querySelectorAll('.slot.on')) {
      const color = slot.dataset.color;
      const name = slot.querySelector('input').value.trim() || DEFAULT_NAMES[color];
      players.push({ name, color, style: slot.dataset.style || 'jelly' });
    }
    this.store.data.players = players;
    this.store.save();
    return players;
  }

  // ---------- Course picker ----------
  openCourses() {
    this.readPlayers();
    const d = this.store.data;
    $('courseList').innerHTML = COURSES.map((c) => {
      const par = coursePar(c), best = d.best[c.id];
      return `<button class="course${c.id === d.lastCourse ? ' last' : ''}" data-act="course" data-id="${c.id}"><img src="${courseThumb(c)}" alt=""><b>${c.name}</b><span>${c.blurb}</span><small>Par ${par}${best ? ` · Best ${best} (${vsPar(best, par)})` : ''}</small></button>`;
    }).join('');
    this.el.setup.hidden = true;
    this.open('courses');
  }

  startFromSetup(courseId) {
    const players = this.store.data.players;
    this.store.data.lastCourse = courseId;
    this.store.save();
    this.closeAll();
    this.game.startCourse(players, courseId);
  }

  // ---------- HUD ----------
  showHud(g) {
    this.el.menu.hidden = true;
    this.el.hud.hidden = false;
    this.updateHud(g);
  }

  updateHud(g) {
    const h = g.hole;
    $('hudHole').textContent = `Hole ${g.holeIndex + 1}`;
    $('hudName').textContent = h.name;
    $('hudPar').textContent = `Par ${h.par}`;
    const p = g.player;
    $('hudAvatar').src = ballIcon(p.color, 40, 'sour', p.style);
    $('hudPlayer').textContent = p.name;
    $('hudStroke').textContent = g.strokes ? `Stroke ${g.strokes}` : 'Your putt';
    const total = p.scores.reduce((a, b) => a + (b || 0), 0);
    const parSoFar = g.course.holes.slice(0, p.scores.length).reduce((n, x) => n + x.par, 0);
    $('hudTotal').textContent = p.scores.length ? `Total ${total} (${vsPar(total, parSoFar)})` : '';
  }

  banner(title, text, ms = 2000) {
    const b = this.el.banner;
    b.querySelector('b').textContent = title;
    b.querySelector('span').textContent = text;
    b.hidden = false;
    b.classList.remove('out');
    clearTimeout(this.bT);
    clearTimeout(this.bT2);
    this.bT = setTimeout(() => {
      b.classList.add('out');
      this.bT2 = setTimeout(() => (b.hidden = true), 320);
    }, ms);
  }

  setRotateHint(on) {
    this.el.rotate.hidden = !on;
  }

  setSoundHint(on) {
    if (this.el.soundHint.hidden === !on) return;
    this.el.soundHint.hidden = !on;
  }

  // ---------- Scorecard ----------
  showScorecard(g, advance) {
    const C = g.course;
    const holes = C.holes;
    const par = holes.reduce((n, h) => n + h.par, 0);
    let html = '<table class="sc"><thead><tr><th>Hole</th>';
    holes.forEach((_, i) => (html += `<th class="${i === g.holeIndex ? 'cur' : ''}">${i + 1}</th>`));
    html += '<th>Total</th></tr><tr class="par"><td>Par</td>';
    holes.forEach((h) => (html += `<td>${h.par}</td>`));
    html += `<td>${par}</td></tr></thead><tbody>`;
    for (const p of g.players) {
      html += `<tr><td class="pn"><img src="${ballIcon(p.color, 28, 'sour', p.style)}" alt="">${p.name}</td>`;
      let total = 0, parSoFar = 0;
      holes.forEach((h, i) => {
        const s = p.scores[i];
        if (s == null) {
          html += '<td></td>';
          return;
        }
        total += s;
        parSoFar += h.par;
        const cls = s === 1 ? 'ace' : s < h.par ? 'under' : s > h.par ? 'over' : 'even';
        html += `<td class="${cls}">${s}</td>`;
      });
      html += `<td class="tot">${p.scores.length ? `${total}<small>${vsPar(total, parSoFar)}</small>` : ''}</td></tr>`;
    }
    html += '</tbody></table>';
    $('cardTable').innerHTML = html;
    const last = g.holeIndex >= holes.length - 1;
    $('cardTitle').textContent = advance ? `Hole ${g.holeIndex + 1} done!` : 'Scorecard';
    $('cardNext').hidden = !advance;
    $('cardNext').textContent = last ? 'See results' : 'Next hole';
    $('cardClose').hidden = advance;
    if (!advance) this.el.pause.hidden = true;
    this.open('card');
  }

  // ---------- Final results ----------
  showFinal(r) {
    const sorted = r.totals.slice().sort((a, b) => a.total - b.total);
    const medals = ['🥇', '🥈', '🥉', '🏅'];
    $('finalTitle').textContent = r.totals.length > 1 ? `${sorted[0].name} wins!` : r.newBest ? 'New best round!' : 'Round complete!';
    $('finalSub').textContent = `${r.course.name} · par ${r.par}`;
    $('finalList').innerHTML = sorted.map((p, i) => {
      const aces = p.scores.filter((s) => s === 1).length;
      return `<li><span class="md">${r.totals.length > 1 ? medals[Math.min(i, 3)] : '⛳'}</span><img src="${ballIcon(p.color, 40, i === 0 ? 'happy' : 'sour', p.style)}" alt=""><b>${p.name}</b><span class="ft">${p.total}<small>${vsPar(p.total, r.par)}</small></span>${aces ? `<em>${aces} hole in one${aces > 1 ? 's' : ''}!</em>` : ''}</li>`;
    }).join('');
    $('finalBest').textContent = r.newBest ? `Best round ever: ${r.best}` : `Best round: ${r.prevBest}`;
    setTimeout(() => (this.el.final.hidden = false), 700);
  }

  // ---------- Pause and settings ----------
  pauseGame() {
    const g = this.game;
    if (g.state !== 'play') return;
    g.paused = true;
    g.aim = null;
    this.open('pause');
    g.music.duck(true);
  }

  resumeGame() {
    const g = this.game;
    g.paused = false;
    for (const m of ['pause', 'settings', 'card']) this.el[m].hidden = true;
    g.music.duck(false);
  }

  openSettings() {
    const s = this.store.data.settings;
    $('setSound').checked = s.sound;
    $('setMusic').checked = s.music;
    $('setGuide').checked = s.guide;
    $('setTurns').checked = s.turns;
    const d = this.store.data;
    $('statKpis').innerHTML = [
      ['Rounds', d.stats.rounds || 0],
      ['Holes in one', d.stats.holeInOnes || 0],
      ['Courses played', COURSES.filter((c) => d.best[c.id]).length],
    ].map(([l, v]) => `<div class="kpi"><span class="kl">${l}</span><span class="kv">${v}</span></div>`).join('');
    this.el.pause.hidden = true;
    this.open('settings');
  }

  toggleFullscreen() {
    const d = document, el = d.documentElement;
    try {
      if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
      else (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
    } catch {
      // Not supported (iPhone).
    }
  }
}

export { resultName, MAX_STROKES };
