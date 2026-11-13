// Renderer, studio lighting, camera rig, tweens and pointer picking.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export { THREE };
export const ease = {
  lin: t => t,
  inOut: t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: t => 1 - Math.pow(1 - t, 3),
  in: t => t * t * t,
  soft: t => t * t * (3 - 2 * t),
};
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;

export let renderer, scene, camera;
export const pointer = { ndc: new THREE.Vector2(), x: 0, y: 0, down: false };
export const handler = { down: null, move: null, up: null };
export const active = { keys: new Set() };

const hooks = new Set();
const tweens = [];
const pickRoots = [];
const raycaster = new THREE.Raycaster();

export function addHook(fn) { hooks.add(fn); return () => hooks.delete(fn); }
export function addPickable(obj) { pickRoots.push(obj); }

export function tween(obj, to, dur = .6, fn = ease.inOut, delay = 0) {
  return new Promise(res => tweens.push({ obj, to, from: null, t: 0, dur, fn, delay, res }));
}
export const wait = s => new Promise(res => tweens.push({ obj: {}, to: {}, from: null, t: 0, dur: 0, fn: ease.lin, delay: s, res }));

function stepTweens(dt) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    if (tw.delay > 0) { tw.delay -= dt; if (tw.delay > 0) continue; }
    if (!tw.from) { tw.from = {}; for (const k in tw.to) tw.from[k] = tw.obj[k]; }
    tw.t += dt;
    const p = tw.dur <= 0 ? 1 : Math.min(1, tw.t / tw.dur), e = tw.fn(p);
    for (const k in tw.to) tw.obj[k] = tw.from[k] + (tw.to[k] - tw.from[k]) * e;
    if (p >= 1) { tweens.splice(i, 1); tw.res(); }
  }
}

// ---- camera rig: orbit around a target, distance chosen to fit `span` cm across the screen
export const cam = { tx: 0, ty: 4, tz: 2, span: 60, elev: .5, azim: 0, sway: .01 };
const VFOV = 28;

export function focus(t, span, elev = .5, azim = 0, dur = 1.1) {
  return tween(cam, { tx: t[0], ty: t[1], tz: t[2], span, elev, azim }, dur, ease.inOut);
}
function applyCamera(time) {
  const asp = camera.aspect, vh = Math.tan(THREE.MathUtils.degToRad(VFOV / 2)), hh = vh * asp;
  const dist = Math.max(cam.span / 2 / hh, cam.span * .55 / 2 / vh);
  const az = cam.azim + Math.sin(time * .25) * cam.sway;
  camera.position.set(
    cam.tx + dist * Math.sin(az) * Math.cos(cam.elev),
    cam.ty + dist * Math.sin(cam.elev),
    cam.tz + dist * Math.cos(az) * Math.cos(cam.elev));
  camera.lookAt(cam.tx, cam.ty, cam.tz);
}

export function initStage(canvas) {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.setClearColor(0x000000, 0);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(VFOV, 1, 5, 500);

  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture;

  scene.add(new THREE.HemisphereLight(0xffffff, 0xcfd3d8, .55));
  const key = new THREE.DirectionalLight(0xfff6ea, 2.1);
  key.position.set(-34, 70, 38); key.target.position.set(0, 0, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -48, right: 48, top: 48, bottom: -48, near: 10, far: 180 });
  key.shadow.bias = -.0004; key.shadow.normalBias = .03; key.shadow.radius = 5;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0xe8f0ff, .55); fill.position.set(40, 30, 24); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, .5); rim.position.set(10, 25, -50); scene.add(rim);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), new THREE.ShadowMaterial({ opacity: .2 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

  const resize = () => {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize); resize();

  const setNdc = e => {
    const r = canvas.getBoundingClientRect();
    pointer.x = e.clientX; pointer.y = e.clientY;
    pointer.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  };
  canvas.addEventListener('pointerdown', e => {
    setNdc(e); pointer.down = true; canvas.setPointerCapture?.(e.pointerId);
    handler.down?.(pickKey(), e);
  });
  canvas.addEventListener('pointermove', e => {
    setNdc(e);
    if (!pointer.down) canvas.style.cursor = active.keys.has(pickKey()) ? 'pointer' : 'default';
    handler.move?.(e);
  });
  const up = e => { setNdc(e); pointer.down = false; handler.up?.(e); };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  let last = performance.now(), time = 0;
  const tick = dt => {
    time += dt;
    stepTweens(dt);
    for (const h of hooks) h(dt, time);
    applyCamera(time);
    renderer.render(scene, camera);
  };
  window.__step = (sec, dt = 1 / 30) => { for (let t = 0; t < sec; t += dt) tick(dt); }; // test hook
  const loop = now => {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    tick(dt);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

export function pickKey() {
  raycaster.setFromCamera(pointer.ndc, camera);
  const hits = raycaster.intersectObjects(pickRoots, true);
  const keys = [];
  for (const h of hits) { let o = h.object; while (o) { if (o.userData.pick) { keys.push(o.userData.pick); break; } o = o.parent; } }
  // a ray that passes through the wanted tool wins over whatever sits in front of it
  return keys.find(k => active.keys.has(k)) || keys[0] || null;
}
export function pointOnPlane(y) {
  raycaster.setFromCamera(pointer.ndc, camera);
  const r = raycaster.ray, t = (y - r.origin.y) / r.direction.y;
  return r.origin.clone().addScaledVector(r.direction, t);
}
