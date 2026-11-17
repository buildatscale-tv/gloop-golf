// Trophy rules: each physics trophy is given for the right putt, and not for a near miss.
import { TROPHIES, Awards } from '../public/js/trophies.js';

let fail = 0;
const ids = TROPHIES.map((t) => t.id);
if (new Set(ids).size !== ids.length) {
  fail++;
  console.log('FAIL trophy ids are not unique');
}
const fresh = () => {
  const store = { data: { trophies: {}, stats: {} }, save() {} };
  const got = [];
  return { a: new Awards(store, (t) => got.push(t.id)), got };
};
const ball = { x: 0, y: 0 }, cup5 = [5, 0];
const cases = [
  ['carom: bounce off a ball, then sink', 'carom', (a) => { a.putt(ball, cup5, 0.5); a.bounce('ball', 'P', 3); a.sink(2, 'P'); }],
  ['no carom when the ball did not drop', null, (a) => { a.putt(ball, cup5, 0.5); a.bounce('ball', 'P', 3); }, 'carom'],
  ['assist: knock a ball in', 'assist', (a) => { a.putt(ball, cup5, 0.5); a.knockIn('P'); }],
  ['double: sink, then knock one in', 'double', (a) => { a.putt(ball, cup5, 0.5); a.sink(2, 'P'); a.knockIn('P'); }],
  ['double: knock one in, then sink', 'double', (a) => { a.putt(ball, cup5, 0.5); a.knockIn('P'); a.sink(2, 'P'); }],
  ['strike: 3 different balls roll', 'strike', (a) => { a.putt(ball, cup5, 0.5); a.moved(1, 'P'); a.moved(2, 'P'); a.moved(3, 'P'); }],
  ['no strike for one ball hit 3 times', null, (a) => { a.putt(ball, cup5, 0.5); a.moved(1, 'P'); a.moved(1, 'P'); a.moved(1, 'P'); }, 'strike'],
  ['chain reaction', 'chain', (a) => { a.putt(ball, cup5, 0.5); a.chain('P'); }],
  ['dunk tank', 'dunk', (a) => { a.putt(ball, cup5, 0.5); a.dunk('P'); }],
  ['trick shot: 3 wall bounces', 'trick', (a) => { a.putt(ball, cup5, 0.5); for (const k of ['rail', 'wall', 'block']) a.bounce(k, 'P', 2); a.sink(2, 'P'); }],
  ['no trick shot with 2 walls and a sail', null, (a) => { a.putt(ball, cup5, 0.5); for (const k of ['rail', 'wall', 'sail']) a.bounce(k, 'P', 2); a.sink(2, 'P'); }, 'trick'],
  ['boing: bumper then sink', 'boing', (a) => { a.putt(ball, cup5, 0.5); a.bounce('bumper', 'P', 2); a.sink(2, 'P'); }],
  ['lucky bat: spinner then sink', 'lucky', (a) => { a.putt(ball, cup5, 0.5); a.bounce('spinner', 'P', 2); a.sink(2, 'P'); }],
  ['second chance: lip, then sink', 'comeback', (a) => { a.putt(ball, cup5, 0.5); a.lip('P'); a.sink(2, 'P'); }],
  ['ice skater', 'skater', (a) => { a.putt(ball, cup5, 0.5); a.roll(0.1, { ice: true }, 'P'); a.sink(2, 'P'); }],
  ['sand escape', 'escape', (a) => { a.putt(ball, cup5, 0.5, 'sand'); a.sink(2, 'P'); }],
  ['curve ball', 'curve', (a) => { a.putt(ball, cup5, 0.5); a.roll(0.1, { hill: true }, 'P'); a.sink(2, 'P'); }],
  ['belt rider', 'belt', (a) => { a.putt(ball, cup5, 0.5); a.roll(0.1, { belt: true }, 'P'); a.sink(2, 'P'); }],
  ['feather touch: soft from 2 m', 'feather', (a) => { a.putt(ball, [2.2, 0], 0.08); a.sink(2, 'P'); }],
  ['no feather touch from 1 m', null, (a) => { a.putt(ball, [1, 0], 0.05); a.sink(2, 'P'); }, 'feather'],
  ['full send', 'fullsend', (a) => { a.putt(ball, cup5, 1); a.sink(2, 'P'); }],
  ['marathon: 30 m in one putt', 'marathon', (a) => { a.putt(ball, cup5, 1); for (let i = 0; i < 401; i++) a.roll(0.1, {}, 'P'); }],
  ['seeing stars: a hard hit', 'dizzy', (a) => { a.putt(ball, cup5, 1); a.bounce('wall', 'P', 7); }],
  ['no seeing stars for a soft hit', null, (a) => { a.putt(ball, cup5, 1); a.bounce('wall', 'P', 5); }, 'dizzy'],
  ['bank shot ignores a ball hit', null, (a) => { a.putt(ball, cup5, 0.5); a.bounce('ball', 'P', 3); a.sink(1, 'P'); }, 'bank'],
];
for (const [name, want, run, notWant] of cases) {
  const { a, got } = fresh();
  run(a);
  const pass = want ? got.includes(want) : !got.includes(notWant);
  if (!pass) {
    fail++;
    console.log(`FAIL ${name}: got ${got.join(', ') || 'none'}`);
  }
}
console.log(`${TROPHIES.length} trophies, ${cases.length} trophy rules checked`);
if (fail) {
  console.error('trophies FAILED');
  process.exit(1);
}
console.log('trophies ok');
