// The matcha procedure (usucha, "thin tea"), step by step.
//  1 warm the bowl   2 rinse the whisk   3 rest it on its holder   4 empty the bowl   5 dry it
//  6 set the sieve   7 open the tin      8 measure 2 scoops        9 sift             10 pour ~70 ml at ~80C
//  11 whisk (dissolve, froth, slow finish)   12 serve with the front turned to the guest
import { THREE, scene, cam, tween, wait, focus, ease, clamp, lerp, addHook, handler, active, pointer, pointOnPlane } from './stage.js';
import { HOME, RIM } from './world.js';
import * as M from './models.js';
import * as A from './audio.js';

const $ = id => document.getElementById(id);
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const wrapPi = a => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };

let W, bowl, waste;
const G = { scores: [], mistakes: 0, idle: 0, hintObj: null, hintBase: 0, steamBowl: false, time: 0, heatStart: 0, T0: 98, stepNo: 0 };
const temp = () => 60 + (G.T0 - 60) * Math.exp(-(G.time - G.heatStart) / 120);

// ---------------------------------------------------------------- UI
const ui = {
  fig(i, title) { $('figNo').textContent = 'Fig. ' + String(i + 1).padStart(2, '0'); $('figTitle').textContent = title; document.querySelectorAll('#steps i').forEach((e, k) => { e.className = k < i ? 'done' : k === i ? 'now' : ''; }); },
  say(kicker, html) { $('kicker').textContent = kicker; $('instruction').innerHTML = html; },
  kicker(t) { $('kicker').textContent = t; },
  meter(on, { band, left = '', right = '' } = {}) {
    $('meter').hidden = !on; if (!on) return;
    const b = $('mBand'); b.style.display = band ? '' : 'none';
    if (band) { b.style.left = band[0] * 100 + '%'; b.style.width = (band[1] - band[0]) * 100 + '%'; }
    $('mLeft').textContent = left; $('mRight').textContent = right; ui.value(0, false);
  },
  value(v, good) { $('mFill').style.width = clamp(v, 0, 1) * 100 + '%'; $('mFill').classList.toggle('good', !!good); },
  toast(t, good = false) { const e = $('toast'); e.textContent = t; e.classList.toggle('good', good); e.classList.add('show'); clearTimeout(ui._t); ui._t = setTimeout(() => e.classList.remove('show'), 1700); },
  rows(temp, ml, g) { $('readouts').hidden = !(temp || ml || g); $('rdTemp').hidden = !temp; $('rdMl').hidden = !ml; $('rdG').hidden = !g; },
};
function mistake(msg = 'Follow the highlighted step.') { G.mistakes++; A.wrong(); ui.toast(msg); }

// ---------------------------------------------------------------- hint (hop after idle)
const objFor = k => ({ bowl: W.bowlPivot, whisk: W.wp, holder: W.holder, kettle: W.kettle, cloth: W.cloth, sieve: W.sieve, tin: W.tin, scoop: W.scoop }[k]);
function hintOn(k) { hintOff(); const o = objFor(k); if (!o) return; G.hintObj = o; G.hintBase = o.position.y; G.idle = 0; }
function hintOff() { if (G.hintObj) G.hintObj.position.y = G.hintBase; G.hintObj = null; }

function tap(key, wrong) {
  active.keys = new Set([key]); hintOn(key);
  return new Promise(res => {
    handler.down = k => {
      G.idle = 0;
      if (k === key) { handler.down = null; active.keys = new Set(); hintOff(); A.click(); res(); }
      else if (k) mistake(wrong);
    };
  });
}

// ---------------------------------------------------------------- poses
const ws = { x: HOME.whisk.x, y: 0, z: HOME.whisk.z, f: 0, tx: 0, tz: 0, ry: .3 };
function applyWhisk() {
  const H = W.whisk.userData.height;
  W.wp.position.set(ws.x, ws.y, ws.z); W.wp.rotation.set(ws.tx, ws.ry, ws.tz);
  W.whisk.rotation.x = Math.PI * ws.f; W.whisk.position.y = ws.f * H;
}
const ss = { hx: 0, hy: 0, hz: 0, ry: Math.PI, tz: 0, home: true };
const _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YZX');
function applyScoop() {
  if (ss.home) return;
  _e.set(0, ss.ry, ss.tz, 'YZX'); _q.setFromEuler(_e);
  const v = W.scoop.userData.head.clone().applyQuaternion(_q);
  W.scoop.quaternion.copy(_q); W.scoop.position.set(ss.hx - v.x, ss.hy - v.y, ss.hz - v.z);
}
function scoopFromHome(on) { // seed `ss` from the resting pose so tweens start cleanly
  if (!on) { ss.home = true; W.scoop.position.copy(HOME.scoop); W.scoop.rotation.set(0, Math.PI, 0); return; }
  ss.home = false; ss.ry = Math.PI; ss.tz = 0;
  const v = W.scoop.userData.head.clone().applyQuaternion(W.scoop.quaternion);
  ss.hx = HOME.scoop.x + v.x; ss.hy = HOME.scoop.y + v.y; ss.hz = HOME.scoop.z + v.z;
}

// kettle: p 0 = at rest, .6 = over the bowl, 1 = tilted and pouring
const TILT = .62;
let kettlePour, kettleRest;
function kettlePose(p) {
  const a = ease.soft(clamp(p / .6, 0, 1)), b = ease.soft(clamp((p - .6) / .4, 0, 1)), k = W.kettle;
  k.position.lerpVectors(kettleRest, kettlePour, a); k.position.y += Math.sin(a * Math.PI) * 3;
  k.rotation.set(0, lerp(.22, 0, a), -TILT * b);
}
const tipWorld = () => { W.kettle.updateMatrixWorld(); return W.kettle.localToWorld(W.kettle.userData.tip.clone()); };

const bowlHome = HOME.bowl.clone().add(RIM);
let bowlPour;
function bowlPose(p) {
  const a = ease.soft(clamp(p / .6, 0, 1)), b = ease.soft(clamp((p - .6) / .4, 0, 1)), pv = W.bowlPivot;
  pv.position.lerpVectors(bowlHome, bowlPour, a); pv.position.y += Math.sin(a * Math.PI) * 4;
  pv.rotation.z = -1.15 * b;
  bowl.liquid.rotation.z = -pv.rotation.z; bowl.liquid.visible = bowl.ml > .5 && p < .55;
}

function streamTo(from, toY, on) {
  const s = W.stream; s.visible = on; if (!on) return;
  s.position.copy(from); s.scale.set(1, Math.max(.1, from.y - toY), 1);
}
const surfWorldY = (b, base) => (b.ml > .5 ? base.y + b.surfaceY() : base.y + 1.1);

// generic "press and hold on an object" task
function holdTask({ key, pose, onTick, canFinish, auto, notYet }) {
  return new Promise(res => {
    let p = 0, holding = false, released = false;
    active.keys = new Set([key]); hintOn(key);
    handler.down = k => { G.idle = 0; if (k === key) { holding = true; hintOff(); } else if (k) mistake(); };
    handler.up = () => { if (holding) released = true; holding = false; };
    const off = addHook(dt => {
      if (auto?.()) holding = false;
      p = clamp(p + (holding ? 1.5 : -2) * dt, 0, 1);
      pose(p); onTick(dt, holding && p > .97, p);
      if (!holding && p <= 0) {
        if (canFinish()) { off(); handler.down = handler.up = null; active.keys = new Set(); res(); }
        else if (released) { released = false; notYet?.(); hintOn(key); }
      }
    });
  });
}

// ---------------------------------------------------------------- steps
const STEPS = [
  { title: 'Warm the bowl', focus: [[-8, 7, -3], 58, .5] },
  { title: 'Rinse the whisk', focus: [[-4, 6, 4], 46, .55] },
  { title: 'Rest the whisk', focus: [[-10, 7, 5], 46, .5] },
  { title: 'Empty the bowl', focus: [[9, 8, -4], 54, .5] },
  { title: 'Dry the bowl', focus: [[2, 5, 4], 34, .6] },
  { title: 'Set the sieve', focus: [[10, 5, 4], 50, .5] },
  { title: 'Open the tin', focus: [[2, 5, -8], 40, .5] },
  { title: 'Measure the matcha', focus: [[2, 6, -6], 50, .55] },
  { title: 'Sift the powder', focus: [[2, 6, 0], 30, .62] },
  { title: 'Add the water', focus: [[-8, 7, -3], 58, .5] },
  { title: 'Whisk', focus: [[2, 4, 0], 22, .95] },
  { title: 'Serve', focus: [[2, 4, 0], 30, .55] },
];
const total = STEPS.length;
const begin = i => {
  G.stepNo = i; ui.fig(i, STEPS[i].title); focus(...STEPS[i].focus);
  G.idle = 0; ui.meter(false); hintOff(); ui.toast; G.kick = `Step ${i + 1} of ${total}`;
};
const done = async (name, v = 1, msg = 'Done') => { G.scores.push({ name, v }); A.chime(); ui.toast(msg, true); ui.meter(false); await wait(.7); };

// 1 ---- warm the bowl
async function stepWarm() {
  begin(0);
  ui.say(G.kick, 'Hold the <em>kettle</em> to pour hot water into the bowl. A warm bowl keeps the tea hot and the foam steady.');
  ui.rows(true, true, false); ui.meter(true, { band: [90 / 250, 160 / 250], left: '0 ml', right: '250 ml' });
  bowl.setState({ clear: 1, matcha: 0 });
  await holdTask({
    key: 'kettle', pose: kettlePose,
    onTick(dt, pouring) {
      if (pouring) { bowl.setMl(Math.min(bowl.maxMl, bowl.ml + 30 * dt)); bowl.setWet(.4); G.steamBowl = true; A.pourPitch(bowl.ml / 250); }
      pourFx(dt, pouring, HOME.bowl);
      ui.value(bowl.ml / 250, bowl.ml >= 90 && bowl.ml <= 160);
    },
    canFinish: () => bowl.ml >= 60, notYet: () => ui.toast('A little more water.'),
  });
  const ml = bowl.ml, d = ml < 90 ? 90 - ml : Math.max(0, ml - 160);
  await done('Warm the bowl', clamp(1 - d / 120, .3, 1), 'Bowl warmed');
}

// pouring effects shared by kettle steps
let pouringNow = false;
function pourFx(dt, pouring, base) {
  if (pouring !== pouringNow) { pouringNow = pouring; pouring ? A.pourOn() : A.pourOff(); }
  const tip = tipWorld();
  streamTo(tip, surfWorldY(bowl, base), pouring);
}

// 2 ---- rinse the whisk
async function stepRinse() {
  begin(1);
  ui.say(G.kick, 'Tap the <em>whisk</em>, then swirl it gently in the hot water. This softens the tines so they do not snap.');
  ui.rows(false, true, false);
  await tap('whisk');
  await tween(ws, { y: 22 }, .5);
  await tween(ws, { x: HOME.bowl.x, z: HOME.bowl.z, f: 1, ry: 0 }, .8);
  await tween(ws, { y: 2.1 }, .55);
  ui.say(G.kick, 'Drag side to side to <em>swirl the whisk</em> in the water.');
  ui.meter(true, { left: 'Rinse', right: 'Done' });
  let prog = 0, last = null, down = false;
  await new Promise(res => {
    handler.down = () => { down = true; G.idle = 0; last = null; };
    handler.up = () => { down = false; };
    const off = addHook(dt => {
      const p = pointOnPlane(5);
      const tx = HOME.bowl.x + clamp((p.x - HOME.bowl.x) * .5, -1.4, 1.4), tz = HOME.bowl.z + clamp((p.z - HOME.bowl.z) * .5, -1, 1);
      if (down) {
        if (last) { const d = Math.hypot(p.x - last.x, p.z - last.z); prog += d; if (d > .8) A.scrape(); }
        last = p.clone();
        ws.x = lerp(ws.x, tx, 1 - Math.exp(-14 * dt)); ws.z = lerp(ws.z, tz, 1 - Math.exp(-14 * dt));
        ws.tz = lerp(ws.tz, clamp((tx - ws.x) * -2, -.4, .4), .2);
      } else { ws.x = lerp(ws.x, HOME.bowl.x, 1 - Math.exp(-6 * dt)); ws.z = lerp(ws.z, HOME.bowl.z, 1 - Math.exp(-6 * dt)); ws.tz *= .9; }
      ui.value(prog / 70, true);
      if (prog >= 70) { off(); handler.down = handler.up = null; res(); }
    });
  });
  ws.tz = 0;
  await tween(ws, { y: 16, x: HOME.bowl.x, z: HOME.bowl.z }, .7);
  await done('Rinse the whisk', 1, 'Tines softened');
}

// 3 ---- rest on the holder
async function stepRest() {
  begin(2);
  ui.say(G.kick, 'Tap the <em>holder</em> to stand the whisk on it, tines down. It keeps the tines in shape.');
  ui.rows(false, false, false);
  await tap('holder');
  await tween(ws, { y: 22 }, .35);
  await tween(ws, { x: HOME.holder.x, z: HOME.holder.z }, .8);
  await tween(ws, { y: 7.5 }, .6, ease.out);
  A.clack();
  await done('Rest the whisk');
}

// 4 ---- empty the bowl
async function stepEmpty() {
  begin(3);
  ui.say(G.kick, 'Hold the <em>bowl</em> to tip the water into the waste bowl.');
  ui.rows(false, true, false); ui.meter(true, { left: 'Full', right: 'Empty' });
  const start = bowl.ml; let wasteMl = 0;
  await holdTask({
    key: 'bowl', pose: bowlPose,
    onTick(dt, pouring) {
      if (pouring && bowl.ml > 0) {
        const d = Math.min(bowl.ml, 45 * dt); bowl.ml -= d; wasteMl += d; waste.setMl(wasteMl); waste.setState({ clear: 1, matcha: 0 });
        A.pourPitch(.3);
      }
      const lip = W.bowlPivot.position;
      if (pouringNow !== (pouring && bowl.ml > 0)) { pouringNow = pouring && bowl.ml > 0; pouringNow ? A.pourOn() : A.pourOff(); }
      streamTo(V3(lip.x, lip.y, lip.z), surfWorldY(waste, HOME.waste), pouring && bowl.ml > 0);
      ui.value(1 - bowl.ml / (start || 1), true);
    },
    auto: () => bowl.ml <= .5,
    canFinish: () => bowl.ml <= .5,
  });
  bowl.setMl(0); bowl.liquid.rotation.z = 0; G.steamBowl = false; bowl.setWet(.4);
  await done('Empty the bowl', 1, 'Bowl emptied');
}

// 5 ---- dry
async function stepDry() {
  begin(4);
  ui.say(G.kick, 'Tap the <em>cloth</em>, then wipe the inside of the bowl dry. Leftover water would thin the tea.');
  ui.rows(false, false, false);
  await tap('cloth');
  const c = W.cloth.position;
  await tween(c, { y: 10, x: HOME.bowl.x, z: HOME.bowl.z }, .6);
  await tween(c, { y: 2.9 }, .4);
  ui.say(G.kick, 'Drag in circles to <em>wipe the bowl</em>.');
  ui.meter(true, { left: 'Wet', right: 'Dry' });
  let prog = 0, last = null, down = false;
  await new Promise(res => {
    handler.down = () => { down = true; G.idle = 0; last = null; };
    handler.up = () => { down = false; };
    const off = addHook(dt => {
      const p = pointOnPlane(5);
      if (down) {
        if (last) { const d = Math.hypot(p.x - last.x, p.z - last.z); prog += d; if (d > .8) A.scrape(); }
        last = p.clone();
        c.x = lerp(c.x, HOME.bowl.x + clamp((p.x - HOME.bowl.x) * .5, -2.3, 2.3), 1 - Math.exp(-14 * dt));
        c.z = lerp(c.z, HOME.bowl.z + clamp((p.z - HOME.bowl.z) * .5, -2.3, 2.3), 1 - Math.exp(-14 * dt));
      }
      const k = clamp(prog / 80, 0, 1); bowl.setWet(.4 * (1 - k)); ui.value(k, true);
      if (k >= 1) { off(); handler.down = handler.up = null; res(); }
    });
  });
  await tween(c, { y: 10 }, .4);
  await tween(c, { x: HOME.cloth.x, z: HOME.cloth.z }, .6);
  await tween(c, { y: 0 }, .35);
  await done('Dry the bowl', 1, 'Bowl dry');
}

// 6 ---- sieve
async function stepSieve() {
  begin(5);
  ui.say(G.kick, 'Tap the <em>sieve</em> to rest it on the bowl. Sifting breaks up the lumps for a smooth tea.');
  await tap('sieve');
  const s = W.sieve.position;
  await tween(s, { y: 14 }, .4);
  await tween(s, { x: HOME.bowl.x, z: HOME.bowl.z }, .7);
  await tween(s, { y: 7.95 }, .45, ease.out);
  A.clack();
  await done('Set the sieve');
}

// 7 ---- tin
async function stepTin() {
  begin(6);
  ui.say(G.kick, 'Tap the <em>tin</em> to lift its lid.');
  await tap('tin');
  const lid = W.tin.userData.lid.position;
  await tween(lid, { y: 9 }, .4);
  await tween(lid, { x: 7.6, z: 2 }, .5);
  await tween(lid, { y: 0 }, .4, ease.out);
  A.clack();
  await done('Open the tin');
}

// 8 ---- scoop twice
async function stepScoop() {
  begin(7);
  ui.rows(false, false, true); $('vG').textContent = '0';
  ui.meter(true, { band: [1, 1], left: '0 scoops', right: '2 scoops' });
  ui.meter(true, { left: '0', right: '2 scoops' });
  const tinTop = V3(HOME.tin.x, 4.9, HOME.tin.z), sievePt = V3(HOME.bowl.x, 9.6, HOME.bowl.z);
  scoopFromHome(true);
  const pile = W.sieve.userData.pile, sp = W.scoop.userData.powder;
  for (let n = 1; n <= 2; n++) {
    ui.say(G.kick, n === 1 ? 'Tap the <em>tin</em> to scoop. One bamboo scoop, lightly heaped.' : 'Once more: tap the <em>tin</em>. Two scoops is about 2 g.');
    await tap('tin');
    await tween(ss, { hx: tinTop.x, hy: 8, hz: tinTop.z, ry: Math.PI / 2, tz: -.15 }, .7);
    await tween(ss, { hy: tinTop.y - .6, tz: -.5 }, .35);
    A.sieveTick(); sp.visible = true; sp.material.opacity = 1;
    await tween(ss, { hy: 8, tz: -.2 }, .4);
    await tween(ss, { hx: sievePt.x, hz: sievePt.z, hy: 10.2 }, .7);
    await tween(ss, { tz: -.65, hy: 9.4 }, .35);
    sp.visible = false; A.scrape();
    G.matcha = n; $('vG').textContent = String(n); ui.value(n / 2, n === 2);
    await tween(pile.scale, { x: 3.0 * n / 2, y: 1.1 * n / 2, z: 3.0 * n / 2 }, .4);
    await tween(ss, { tz: -.2, hy: 11 }, .3);
  }
  await done('Measure the matcha', 1, 'About 2 g');
}

// 9 ---- sift
async function stepSift() {
  begin(8);
  ui.say(G.kick, 'Drag the back of the <em>scoop</em> over the sieve to press the powder through.');
  const sv = V3(HOME.bowl.x, 7.4, HOME.bowl.z);
  await tween(ss, { hx: sv.x, hy: 7.1, hz: sv.z, ry: Math.PI / 2, tz: -.05 }, .6);
  ui.meter(true, { left: 'Lumpy', right: 'Fine' });
  let prog = 0, last = null, down = false, tick = 0;
  const pile = W.sieve.userData.pile;
  await new Promise(res => {
    handler.down = () => { down = true; G.idle = 0; last = null; };
    handler.up = () => { down = false; };
    const off = addHook(dt => {
      const p = pointOnPlane(7.4); let moving = 0;
      if (down) {
        if (last) { const d = Math.hypot(p.x - last.x, p.z - last.z); prog += d; moving = d / dt; tick += d; if (tick > 1.6) { tick = 0; A.sieveTick(); } }
        last = p.clone();
        ss.hx = lerp(ss.hx, HOME.bowl.x + clamp(p.x - HOME.bowl.x, -3.2, 3.2), 1 - Math.exp(-16 * dt));
        ss.hz = lerp(ss.hz, HOME.bowl.z + clamp(p.z - HOME.bowl.z, -3.2, 3.2), 1 - Math.exp(-16 * dt));
      }
      const k = clamp(prog / 90, 0, 1);
      bowl.setMound(k); const r = 1 - k; pile.scale.set(3 * r + .001, 1.1 * r + .001, 3 * r + .001);
      M.stepParticles(W.powderFall, dt, moving > 3 ? 90 : 0, () => ({ x: HOME.bowl.x + (Math.random() - .5) * 5, y: 5.7, z: HOME.bowl.z + (Math.random() - .5) * 5, vx: (Math.random() - .5) * .6, vy: -4, vz: (Math.random() - .5) * .6, life: .36 }), -60);
      ui.value(k, true);
      if (k >= 1) { off(); handler.down = handler.up = null; res(); }
    });
  });
  M.stepParticles(W.powderFall, 1, 0, () => ({}), 0);
  // put everything away
  await tween(ss, { hy: 12 }, .4);
  scoopFromHome(true);
  await tween(ss, { hx: HOME.scoop.x - 8, hy: 6, hz: HOME.scoop.z, ry: Math.PI, tz: 0 }, .6);
  scoopFromHome(false); W.scoop.position.copy(HOME.scoop); W.scoop.rotation.set(0, Math.PI, 0);
  const s = W.sieve.position;
  await tween(s, { y: 14 }, .4); pile.scale.set(.001, .001, .001);
  await tween(s, { x: HOME.sieve.x, z: HOME.sieve.z }, .7);
  await tween(s, { y: HOME.sieve.y }, .45, ease.out);
  const lid = W.tin.userData.lid.position;
  await tween(lid, { y: 9 }, .35); await tween(lid, { x: 0, z: 0 }, .45); await tween(lid, { y: 4.95 }, .35, ease.out); A.clack();
  await done('Sift the powder', 1, 'Powder sifted');
}

// 10 ---- pour the water (~70 ml, ~80C)
async function stepPour() {
  begin(9);
  ui.say(G.kick, 'Hold the <em>kettle</em> and pour about 70 ml. The water should be near 80&deg;C: too hot turns the tea bitter.');
  ui.rows(true, true, true); ui.meter(true, { band: [60 / 120, 80 / 120], left: '0 ml', right: '120 ml' });
  bowl.setState({ clear: 0, matcha: 0, clump: 0 });
  let tAtPour = temp();
  await holdTask({
    key: 'kettle', pose: kettlePose,
    onTick(dt, pouring) {
      if (pouring) {
        tAtPour = temp(); bowl.setMl(Math.min(bowl.maxMl, bowl.ml + 20 * dt)); G.steamBowl = true;
        const k = clamp(bowl.ml / 22, 0, 1); bowl.setState({ matcha: k, clump: .95 * k, clear: 0 }); bowl.setMound(1 - k);
        A.pourPitch(bowl.ml / 120);
      }
      pourFx(dt, pouring, HOME.bowl);
      ui.value(bowl.ml / 120, bowl.ml >= 60 && bowl.ml <= 80);
    },
    canFinish: () => bowl.ml >= 40, notYet: () => ui.toast('Pour a little more.'),
  });
  const ml = bowl.ml, dm = ml < 60 ? 60 - ml : Math.max(0, ml - 80);
  const dt_ = tAtPour < 75 ? 75 - tAtPour : Math.max(0, tAtPour - 85);
  G.scores.push({ name: 'Water amount', v: clamp(1 - dm / 50, .3, 1) });
  const msg = tAtPour > 90 ? 'That water was too hot.' : tAtPour < 72 ? 'The water had cooled.' : 'Good temperature';
  await done('Water temperature', clamp(1 - dt_ / 25, .3, 1), msg);
}

// 11 ---- whisk
async function stepWhisk() {
  begin(10);
  ui.say(G.kick, 'Tap the <em>whisk</em> to pick it up.');
  ui.rows(false, true, true);
  await tap('whisk');
  await tween(ws, { y: 22 }, .45);
  await tween(ws, { x: HOME.bowl.x, z: HOME.bowl.z }, .8);
  await tween(ws, { y: 1.9 }, .55);

  const phases = [
    { k: 'Dissolve', t: 'Press and drag side to side, <em>gently</em>, to dissolve the powder.' },
    { k: 'Froth', t: 'Now <em>faster</em>: a quick W from the wrist, wall to wall. Keep the speed in the green zone.' },
    { k: 'Finish', t: '<em>Slow down</em>. Draw the whisk gently to the centre, then let go to lift it out.' },
  ];
  let ph = 0, A_ = 0, B_ = 0, tB = 0, C_ = 0, down = false;
  const revs = []; let dir = 0, ext = 0, lastRev = 0, spin = 0, slowStart = null;
  const say = () => ui.say(`Step 11 of ${total} · ${phases[ph].k}`, phases[ph].t);
  const setMeter = () => ui.meter(true, ph === 0 ? { band: [1.5 / 12, 5 / 12], left: 'Still', right: 'Fast' } : ph === 1 ? { band: [4 / 12, 10 / 12], left: 'Slow', right: 'Fast' } : { band: [0, 2 / 12], left: 'Slow', right: 'Fast' });
  say(); setMeter();
  bowl.setState({ matcha: 1, clump: .95 });
  const need = { A: 2.2, B: 7 };
  let lastTick = 0, px = 0, pz = 0;
  await new Promise(res => {
    handler.down = () => { down = true; G.idle = 0; ext = null; dir = 0; };
    handler.up = () => {
      down = false;
      if (ph === 2) {
        if (C_ >= .8) { off(); handler.down = handler.up = null; res(); } else ui.toast('Slow right down before lifting.');
      }
    };
    const off = addHook((dt, t) => {
      const p = pointOnPlane(5);
      if (down) {
        px = p.x - HOME.bowl.x; pz = p.z - HOME.bowl.z;
        if (ext === null) { ext = px; }
        if (dir >= 0 && px < ext - .7) { if (dir > 0) revs.push(t); dir = -1; ext = px; }
        else if (dir <= 0 && px > ext + .7) { if (dir < 0) revs.push(t); dir = 1; ext = px; }
        else if ((dir > 0 && px > ext) || (dir < 0 && px < ext)) ext = px;
        if (dir === 0 && Math.abs(px - ext) > .7) dir = px > ext ? 1 : -1;
      }
      while (revs.length && revs[0] < t - 1) revs.shift();
      const rate = down ? revs.length : 0;
      // whisk follows the pointer like a pendulum
      const tx = HOME.bowl.x + (down ? clamp(px * .45, -1.3, 1.3) : 0), tz = HOME.bowl.z + (down ? clamp(pz * .3, -.8, .8) : 0);
      const ox = ws.x; ws.x = lerp(ws.x, tx, 1 - Math.exp(-18 * dt)); ws.z = lerp(ws.z, tz, 1 - Math.exp(-14 * dt));
      ws.tz = lerp(ws.tz, clamp(-(ws.x - ox) / Math.max(dt, .001) * .035, -.45, .45), 1 - Math.exp(-12 * dt));
      ws.y = lerp(ws.y, down ? 1.9 : 3.2, 1 - Math.exp(-8 * dt));
      if (down && t - lastTick > .09 && ph < 2 && rate > 1) { lastTick = t; A.whiskTick(Math.min(1, rate / 9)); }
      spin = lerp(spin, rate * .12, 1 - Math.exp(-4 * dt)); bowl.surf.rotation.y += spin * dt;

      if (ph === 0) {
        if (down && rate >= 1.5) A_ += dt;
        const k = clamp(A_ / need.A, 0, 1);
        bowl.setState({ clump: .95 * (1 - k) });
        ui.value(rate / 12, rate >= 1.5 && rate <= 5);
        ui.kicker(`Step 11 of ${total} · Dissolve ${Math.round(k * 100)}%`);
        if (k >= 1) { ph = 1; say(); setMeter(); A.chime(); }
      } else if (ph === 1) {
        if (down) { tB += dt; if (rate >= 4 && rate <= 10) B_ += dt; else if (rate > 10) B_ += dt * .5; }
        const k = clamp(B_ / need.B, 0, 1);
        bowl.setState({ clump: 0, fine: .95 * k, coarse: .5 * Math.sin(Math.PI * Math.min(1, k * 1.15)) });
        ui.value(rate / 12, rate >= 4 && rate <= 10);
        ui.kicker(`Step 11 of ${total} · Froth ${Math.round(k * 100)}%`);
        if (k >= 1) { ph = 2; say(); setMeter(); A.chime(); }
      } else {
        if (down && rate <= 2 && Math.abs(px) < 3) C_ += dt; else if (down && rate > 3) C_ = Math.max(0, C_ - dt);
        bowl.setState({ coarse: .5 * Math.max(0, 1 - C_ / 1.2) * .3, fine: .95 });
        ui.value(rate / 12, rate <= 2);
        ui.kicker(`Step 11 of ${total} · Finish ${Math.round(clamp(C_ / .8, 0, 1) * 100)}%`);
      }
    });
  });
  const eff = clamp(need.B / Math.max(tB, need.B), .35, 1);
  ws.tz = 0;
  await tween(ws, { y: 12 }, .5);
  bowl.setState({ coarse: .05, fine: .95 });
  await tween(ws, { x: HOME.holder.x, z: HOME.holder.z, y: 22 }, .8);
  await tween(ws, { y: 7.5 }, .5, ease.out);
  G.scores.push({ name: 'Foam', v: eff });
  await done('Whisk finish', 1, 'Fine foam');
  G.steamBowl = true;
}

// 12 ---- serve
async function stepServe() {
  begin(11);
  ui.say(G.kick, 'Turn the <em>bowl</em> so its front, the side with the gold streak, faces your guest. Drag sideways.');
  ui.rows(false, false, false);
  await tween(bowl.root.rotation, { y: 2.5 }, .8);
  active.keys = new Set(['bowl']); hintOn('bowl');
  let err = 0;
  await new Promise(res => {
    let drag = false, lastX = 0;
    handler.down = k => { G.idle = 0; if (k === 'bowl') { drag = true; lastX = pointer.x; hintOff(); } };
    handler.move = () => { if (drag) { bowl.root.rotation.y += (pointer.x - lastX) * .014; lastX = pointer.x; } };
    handler.up = () => {
      if (!drag) return; drag = false;
      const a = wrapPi(bowl.root.rotation.y);
      if (Math.abs(a) < .45) { err = Math.abs(a); handler.down = handler.move = handler.up = null; active.keys = new Set(); res(); }
      else ui.toast('Front toward the guest.');
    };
  });
  await tween(bowl.root.rotation, { y: Math.round(bowl.root.rotation.y / (Math.PI * 2)) * Math.PI * 2 }, .35);
  A.clack();
  await done('Serve the bowl', clamp(1 - err / .5, .5, 1), 'Served');
}

// ---------------------------------------------------------------- results
const TITLES = [[.93, 'A beautiful bowl', 5], [.82, 'A good bowl', 4], [.7, 'Nicely made', 3], [.55, 'Keep practising', 2], [0, 'Needs work', 1]];
function results() {
  const S = {}; G.scores.forEach(s => { (S[s.name] = S[s.name] || []).push(s.v); });
  const avg = n => { const a = [].concat(...n.map(k => S[k] || [])); return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 1; };
  const rows = [
    ['Warming the bowl', avg(['Warm the bowl'])], ['Whisk preparation', avg(['Rinse the whisk', 'Rest the whisk'])],
    ['Drying the bowl', avg(['Empty the bowl', 'Dry the bowl'])], ['Measuring and sifting', avg(['Set the sieve', 'Open the tin', 'Measure the matcha', 'Sift the powder'])],
    ['Water amount', avg(['Water amount'])], ['Water temperature', avg(['Water temperature'])],
    ['Whisking and foam', avg(['Foam', 'Whisk finish'])], ['Serving', avg(['Serve the bowl'])],
  ];
  const mean = rows.reduce((a, r) => a + r[1], 0) / rows.length, score = clamp(mean - G.mistakes * .02, 0, 1);
  const t = TITLES.find(t => score >= t[0]);
  $('endTitle').textContent = t[1];
  $('stars').innerHTML = [1, 2, 3, 4, 5].map(i => `<svg viewBox="0 0 24 24" class="${i <= t[2] ? 'on' : ''}"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z"/></svg>`).join('');
  $('endText').textContent = G.mistakes ? `${G.mistakes} wrong tap${G.mistakes > 1 ? 's' : ''} along the way. Each one costs a little.` : 'Every step in order, with no wrong taps.';
  $('breakdown').innerHTML = rows.map(r => `<li><span>${r[0]}</span><span class="bar"><i class="${r[1] > .93 ? 'best' : ''}" style="width:${Math.round(r[1] * 100)}%"></i></span></li>`).join('');
}

// ---------------------------------------------------------------- entry
export function initGame(world) {
  W = world; bowl = W.bowl; waste = W.waste;
  // whisk pivot so tines-down poses swing from the tip
  W.wp = new THREE.Group(); scene.add(W.wp); W.wp.add(W.whisk); W.whisk.position.set(0, 0, 0); W.whisk.rotation.set(0, 0, 0);
  applyWhisk();
  // scoop powder
  const sp = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10), new THREE.MeshStandardMaterial({ color: 0x86a928, roughness: .9 }));
  sp.scale.set(1.1, .4, .45); sp.position.copy(W.scoop.userData.head).add(V3(0, .1, 0)); sp.visible = false; sp.material.transparent = true; W.scoop.add(sp); W.scoop.userData.powder = sp;

  // kettle pour pose: tip ends up above the bowl centre
  kettleRest = W.kettle.position.clone();
  W.kettle.rotation.set(0, 0, -TILT); W.kettle.position.set(0, 0, 0); W.kettle.updateMatrixWorld();
  const tip = W.kettle.localToWorld(W.kettle.userData.tip.clone());
  kettlePour = V3(HOME.bowl.x + 1.5, 13.5, HOME.bowl.z).sub(tip);
  W.kettle.position.copy(kettleRest); W.kettle.rotation.set(0, .22, 0);
  bowlPour = V3(HOME.waste.x - 1, 17.5, HOME.waste.z);

  // per-frame: clock, hint hop, steam, whisk/scoop apply, readouts
  let rd = 0;
  addHook((dt, t) => {
    G.time = t; G.idle += dt;
    if (G.hintObj && G.idle > 5.5) G.hintObj.position.y = G.hintBase + Math.abs(Math.sin(t * 5)) * .9;
    applyWhisk(); applyScoop();
    const tp = temp(), tipW = tipWorld();
    M.stepParticles(W.steam, dt, tp > 72 ? 6 : 0, () => ({ x: tipW.x + (Math.random() - .5) * .6, y: tipW.y + .3, z: tipW.z + (Math.random() - .5) * .6, vx: (Math.random() - .5) * .8 + 1, vy: 4 + Math.random() * 2, vz: (Math.random() - .5) * .8, life: 1.3 + Math.random() * .6 }), 0);
    M.stepParticles(W.bowlSteam, dt, G.steamBowl && bowl.ml > 1 && !G.hintHide ? 5 : 0, () => ({ x: HOME.bowl.x + (Math.random() - .5) * 6, y: HOME.bowl.y + bowl.surfaceY() + .6, z: HOME.bowl.z + (Math.random() - .5) * 6, vx: (Math.random() - .5) * .5, vy: 2.5 + Math.random(), vz: (Math.random() - .5) * .5, life: 1.8 }), 0);
    rd -= dt; if (rd <= 0) {
      rd = .2; $('vTemp').textContent = tp.toFixed(0); $('vMl').textContent = Math.round(bowl.ml);
      const row = $('rdTemp'); row.classList.toggle('hot', tp > 90); row.classList.toggle('ok', tp >= 75 && tp <= 85);
      $('reheat').hidden = !(G.stepNo >= 0 && G.stepNo <= 9 && G.playing && tp < 76);
    }
  });
  $('reheat').onclick = () => { G.T0 = 98; G.heatStart = G.time; ui.toast('Kettle reheated', true); A.click(); };
  const bar = $('steps'); bar.innerHTML = STEPS.map(() => '<i></i>').join('');
}

export async function playGame() {
  G.playing = true; G.heatStart = G.time; G.T0 = 98;
  $('hud').hidden = false;
  for (const s of [stepWarm, stepRinse, stepRest, stepEmpty, stepDry, stepSieve, stepTin, stepScoop, stepSift, stepPour, stepWhisk, stepServe]) await s();
  G.playing = false; $('reheat').hidden = true;
  results();
  await focus([window.innerWidth / window.innerHeight > 1.15 ? 12 : 3, 4, 3], 56, .5, 0, 1.6);
  $('hud').hidden = true; $('end').hidden = false;
}
