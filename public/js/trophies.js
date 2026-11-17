// Trophies, and the ball styles they unlock. The game reports what happened; this module
// decides which trophies that earns. Saved per device in store.data.trophies.
import { STYLES } from './ballart.js';

// goal + stat: a trophy with a progress bar (stat is a key in store.data.stats).
export const TROPHIES = [
  { id: 'first-hole', icon: '⛳', name: 'First Putt', desc: 'Finish your first hole.' },
  { id: 'birdie', icon: '🐦', name: 'Birdie', desc: 'Finish a hole one under par.' },
  { id: 'eagle', icon: '🦅', name: 'Eagle Eye', desc: 'Finish a hole two under par.' },
  { id: 'ace', icon: '⭐', name: 'Hole in One!', desc: 'Sink the ball with your first putt.' },
  { id: 'aces', icon: '🌟', name: 'Ace Collector', desc: 'Get 5 holes in one.', goal: 5, stat: 'holeInOnes' },
  { id: 'bank', icon: '🎱', name: 'Bank Shot', desc: 'Get a hole in one after a bounce off a wall.' },
  { id: 'pinball', icon: '💥', name: 'Pinball Wizard', desc: 'Hit 3 bumpers with one putt.' },
  { id: 'warp', icon: '🌀', name: 'Warp Speed', desc: 'Go through a portal and sink the ball with the same putt.' },
  { id: 'rocket', icon: '🚀', name: 'Rocket Roll', desc: 'Ride a boost pad and sink the ball with the same putt.' },
  { id: 'windmill', icon: '🌬️', name: 'Windmill Wizard', desc: 'Make par or better on the Windmill.' },
  { id: 'long', icon: '📏', name: 'Long Shot', desc: 'Sink a putt from 10 meters away or more.' },
  { id: 'lip', icon: '😮', name: 'So Close!', desc: 'Roll over the cup too fast.' },
  { id: 'splash', icon: '💦', name: 'Splash Zone', desc: 'Find the water 10 times.', goal: 10, stat: 'splashes' },
  // Ball physics.
  { id: 'trick', icon: '🪃', name: 'Trick Shot', desc: 'Sink a putt after 3 or more bounces off walls.' },
  { id: 'boing', icon: '🫧', name: 'Boing!', desc: 'Sink a putt after a bounce off a bumper.' },
  { id: 'lucky', icon: '🍀', name: 'Lucky Bat', desc: 'A moving part bats your ball, and it still drops in.' },
  { id: 'comeback', icon: '🔄', name: 'Second Chance', desc: 'Roll over the cup too fast, then sink it with the same putt.' },
  { id: 'skater', icon: '⛸️', name: 'Ice Skater', desc: 'Sink a putt that slides across ice.' },
  { id: 'escape', icon: '⛱️', name: 'Sand Escape', desc: 'Sink a putt that starts in the sand.' },
  { id: 'curve', icon: '🌈', name: 'Curve Ball', desc: 'Sink a putt that rolls over a hill.' },
  { id: 'belt', icon: '🏭', name: 'Belt Rider', desc: 'Ride a conveyor belt and sink with the same putt.' },
  { id: 'feather', icon: '🪶', name: 'Feather Touch', desc: 'Sink a putt from 2 meters or more with a very soft pull.' },
  { id: 'fullsend', icon: '💪', name: 'Full Send', desc: 'Sink a putt hit at full power.' },
  { id: 'marathon', icon: '🏃', name: 'Marathon Roll', desc: 'Roll 30 meters or more in one putt.' },
  { id: 'dizzy', icon: '😵', name: 'Seeing Stars', desc: 'Hit something so hard your ball gets dizzy.' },
  // Balls that hit each other (2+ players, take turns).
  { id: 'carom', icon: '🎯', name: 'Carom!', desc: "Bounce off another player's ball and sink with the same putt." },
  { id: 'assist', icon: '🤝', name: 'Helping Hand', desc: "Knock another player's ball into the cup." },
  { id: 'double', icon: '✌️', name: 'Double Drop', desc: 'Sink your ball and knock another one in with the same putt.' },
  { id: 'strike', icon: '🎳', name: 'Strike!', desc: 'Set 3 other balls rolling with one putt.' },
  { id: 'chain', icon: '⛓️', name: 'Chain Reaction', desc: 'Hit a ball that then hits another ball.' },
  { id: 'dunk', icon: '🦆', name: 'Dunk Tank', desc: "Knock another player's ball into the water." },
  { id: 'clean', icon: '🧼', name: 'Clean Card', desc: 'Finish a course with no hole over par.' },
  { id: 'under', icon: '🏆', name: 'Under Par', desc: 'Finish a course under par.' },
  { id: 'garden-done', icon: '🌷', name: 'Garden Green', desc: 'Finish the Garden Green course.' },
  { id: 'beach-done', icon: '🏖️', name: 'Sunny Beach', desc: 'Finish the Sunny Beach course.' },
  { id: 'candy-done', icon: '🍭', name: 'Candy Factory', desc: 'Finish the Candy Factory course.' },
  { id: 'frost-done', icon: '⛄', name: 'Frosty Peak', desc: 'Finish the Frosty Peak course.' },
  { id: 'tour', icon: '🌍', name: 'World Tour', desc: 'Finish all four courses.' },
  { id: 'regular', icon: '🔁', name: 'Regular', desc: 'Play 3 rounds.', goal: 3, stat: 'rounds' },
  { id: 'party', icon: '🎉', name: 'Party of Four', desc: 'Play a round with 4 players.' },
  { id: 'putts', icon: '🟢', name: 'Jelly Legs', desc: 'Make 100 putts.', goal: 100, stat: 'putts' },
];

export const trophyById = (id) => TROPHIES.find((t) => t.id === id);

// Moving parts: a bounce off one counts for Lucky Bat, not as a wall.
const MOVERS = new Set(['sail', 'slider', 'spinner']);
// A hit this hard makes the ball dizzy (the same as its face).
export const DIZZY_SPEED = 6;
// Feather Touch: under this power (0 to 1), from at least this far (m).
const FEATHER_K = 0.1, FEATHER_FROM = 2;
export const styleFor = (trophyId) => STYLES.find((s) => s.unlock === trophyId);

export function hasStyle(store, styleId) {
  const st = STYLES.find((s) => s.id === styleId);
  return !!st && (!st.unlock || !!store.data.trophies[st.unlock]);
}

export function unlockedStyles(store) {
  return STYLES.filter((s) => hasStyle(store, s.id));
}

export class Awards {
  constructor(store, onUnlock) {
    this.store = store;
    this.onUnlock = onUnlock;
  }

  get data() {
    return this.store.data;
  }

  give(id, who) {
    const d = this.data;
    if (d.trophies[id] || !trophyById(id)) return;
    d.trophies[id] = Date.now();
    this.store.save();
    this.onUnlock(trophyById(id), styleFor(id), who);
  }

  bump(stat, by = 1) {
    const s = this.data.stats;
    s[stat] = (s[stat] || 0) + by;
    for (const t of TROPHIES) if (t.stat === stat && s[stat] >= t.goal) this.give(t.id);
    this.store.save();
  }

  // A putt is struck: start counting what it does. k: power (0 to 1). surface: where the
  // ball starts.
  putt(ball, cup, k = 0, surface = 'grass') {
    this.shot = {
      from: Math.hypot(cup[0] - ball.x, cup[1] - ball.y), k, start: surface, walls: 0, bumpers: 0, movers: 0, balls: 0,
      moved: new Set(), knocked: 0, sunk: false, warp: false, boost: false, lipped: false, ice: false, hill: false, belt: false, dist: 0,
    };
    this.bump('putts');
  }

  bounce(kind, who, speed = 0) {
    const s = this.shot;
    if (!s) return;
    if (speed > DIZZY_SPEED) this.give('dizzy', who);
    if (kind === 'ball') s.balls++;
    else if (kind === 'bumper') {
      s.bumpers++;
      if (s.bumpers >= 3) this.give('pinball', who);
    } else if (MOVERS.has(kind)) s.movers++;
    else s.walls++;
  }

  // Another player's ball starts to roll because of this putt (hit by your ball or by a
  // ball your ball hit).
  moved(id, who) {
    const s = this.shot;
    if (!s) return;
    s.moved.add(id);
    if (s.moved.size >= 3) this.give('strike', who);
  }

  chain(who) {
    if (this.shot) this.give('chain', who);
  }

  knockIn(who) {
    this.give('assist', who);
    const s = this.shot;
    if (!s) return;
    s.knocked++;
    if (s.sunk) this.give('double', who);
  }

  dunk(who) {
    this.give('dunk', who);
  }

  lip(who) {
    this.give('lip', who);
    if (this.shot) this.shot.lipped = true;
  }

  // The ball rolled d meters this frame, over these surfaces.
  roll(d, { ice, hill, belt }, who) {
    const s = this.shot;
    if (!s) return;
    s.dist += d;
    if (ice) s.ice = true;
    if (hill) s.hill = true;
    if (belt) s.belt = true;
    if (s.dist >= 30) this.give('marathon', who);
  }

  // The ball dropped. strokes: this player's strokes on the hole so far.
  sink(strokes, who) {
    const s = this.shot || {};
    if (strokes === 1) {
      this.give('ace', who);
      if (s.walls > 0) this.give('bank', who);
      this.bump('holeInOnes');
    }
    if (s.warp) this.give('warp', who);
    if (s.boost) this.give('rocket', who);
    if (s.from >= 10) this.give('long', who);
    s.sunk = true;
    if (s.balls) this.give('carom', who);
    if (s.knocked) this.give('double', who);
    if (s.walls >= 3) this.give('trick', who);
    if (s.bumpers) this.give('boing', who);
    if (s.movers) this.give('lucky', who);
    if (s.lipped) this.give('comeback', who);
    if (s.ice) this.give('skater', who);
    if (s.start === 'sand') this.give('escape', who);
    if (s.hill) this.give('curve', who);
    if (s.belt) this.give('belt', who);
    if (s.k < FEATHER_K && s.from >= FEATHER_FROM) this.give('feather', who);
    if (s.k >= 0.98) this.give('fullsend', who);
  }

  holeDone(score, par, courseId, holeIndex, who) {
    this.give('first-hole', who);
    if (score <= par - 1) this.give('birdie', who);
    if (score <= par - 2) this.give('eagle', who);
    if (courseId === 'garden' && holeIndex === 4 && score <= par) this.give('windmill', who);
  }

  // players: [{ name, scores }], holes: the course's holes.
  courseDone(course, players, allCourseIds) {
    const pars = course.holes.map((h) => h.par);
    const par = pars.reduce((a, b) => a + b, 0);
    this.give(`${course.id}-done`);
    for (const p of players) {
      if (p.scores.every((s, i) => s <= pars[i])) this.give('clean', p.name);
      if (p.scores.reduce((a, b) => a + b, 0) < par) this.give('under', p.name);
    }
    if (players.length >= 4) this.give('party');
    if (allCourseIds.every((id) => this.data.trophies[`${id}-done`])) this.give('tour');
    this.bump('rounds');
  }
}
