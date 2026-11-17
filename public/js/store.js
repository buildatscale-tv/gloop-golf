// Saved settings, players, and best scores in localStorage. Works without storage too.
const KEY = 'gloop-golf-v1';

const defaults = () => ({
  v: 1,
  settings: { sound: true, music: true, guide: true, turns: true },
  players: [{ name: 'Cherry', color: 'cherry' }],
  best: {},
  holeBest: {},
  stats: {},
  seenTips: {},
  lastCourse: 'garden',
  trophies: {},
});

export class Store {
  constructor() {
    this.data = defaults();
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw);
        const d = defaults();
        this.data = { ...d, ...s, settings: { ...d.settings, ...s.settings }, best: { ...s.best }, holeBest: { ...s.holeBest }, stats: { ...s.stats }, seenTips: { ...s.seenTips }, trophies: { ...s.trophies } };
      }
    } catch {
      // Keep defaults.
    }
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      // Storage blocked.
    }
  }

  reset() {
    const players = this.data.players;
    this.data = defaults();
    this.data.players = players;
    this.save();
  }
}
