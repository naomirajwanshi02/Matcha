// Procedural models for every tool on the table. Units are centimetres, y is up.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as T from './textures.js';

const V2 = (x, y) => new THREE.Vector2(x, y);
const curvePts = (arr, n) =>
  new THREE.CatmullRomCurve3(arr.map(([x, y]) => new THREE.Vector3(x, y, 0)), false, 'centripetal')
    .getPoints(n).map(p => V2(p.x, p.y));
const shadows = (o, cast = true, recv = true) => { o.traverse(m => { if (m.isMesh) { m.castShadow = cast; m.receiveShadow = recv; } }); return o; };

function hitMesh(geo, pos = [0, 0, 0]) {
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ visible: false }));
  m.position.set(...pos); m.userData.hit = true; return m;
}

export function glazeMat(seed = 1, streak = true) {
  const { map, bump } = T.glazeTextures(seed, streak);
  return new THREE.MeshPhysicalMaterial({
    map, bumpMap: bump, bumpScale: .5, color: 0xffffff, metalness: .25, roughness: .32,
    clearcoat: 1, clearcoatRoughness: .14, envMapIntensity: 1.15,
  });
}

// ------------------------------------------------------------------ bowl (chawan)
export function createBowl({ seed = 1, streak = true } = {}) {
  const outerCtl = [[2.2, 0], [2.45, .04], [2.6, .35], [2.72, .8], [3.2, 1.4], [4.2, 2.3], [5.1, 3.5], [5.65, 4.9], [5.9, 6.2], [5.85, 7.1], [5.7, 7.55], [5.4, 7.78], [5.15, 7.62]];
  const innerCtl = [[5.15, 7.62], [5.17, 7.3], [5.28, 6.4], [4.95, 4.7], [4.15, 3.0], [3.1, 1.85], [1.8, 1.25], [0, 1.08]];
  let outer = curvePts(outerCtl, 120);
  let inner = curvePts(innerCtl, 80);
  outer = outer.map(p => {
    if (p.y > 1.4 && p.y < 6.6) p.x += .075 * Math.sin(p.y * 4.8) * Math.min(1, Math.sin(Math.PI * (p.y - 1.4) / 5.2) * 2.5);
    return p;
  });
  inner = inner.map(p => { if (p.y > 2 && p.y < 6.8) p.x += .03 * Math.sin(p.y * 4.8 + 1); return p; });
  const prof = [V2(0, 0), V2(1.1, 0), ...outer, ...inner.slice(1)];

  const root = new THREE.Group();
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 112), glazeMat(seed, streak));
  root.add(body);

  // inner radius / volume tables (bottom to top) so water levels use real volumes
  const ys = [], rs = [];
  for (let i = inner.length - 1; i >= 0; i--) { ys.push(inner[i].y); rs.push(Math.max(0, inner[i].x)); }
  const vol = [0];
  for (let i = 1; i < ys.length; i++) vol.push(vol[i - 1] + Math.PI * ((rs[i] ** 2 + rs[i - 1] ** 2) / 2) * (ys[i] - ys[i - 1]));
  const rAt = y => {
    if (y <= ys[0]) return rs[0];
    for (let i = 1; i < ys.length; i++) if (y <= ys[i]) return lerpN(rs[i - 1], rs[i], (y - ys[i - 1]) / (ys[i] - ys[i - 1] || 1));
    return rs[rs.length - 1];
  };
  const yForMl = ml => {
    for (let i = 1; i < vol.length; i++) if (ml <= vol[i]) return lerpN(ys[i - 1], ys[i], (ml - vol[i - 1]) / (vol[i] - vol[i - 1] || 1));
    return ys[ys.length - 1];
  };
  const lerpN = (a, b, t) => a + (b - a) * t;

  // thin wet film on the inside of the bowl
  const wetPts = inner.map(p => V2(Math.max(0, p.x - .03), p.y + (p.x < .5 ? .02 : 0)));
  const wetMat = new THREE.MeshPhysicalMaterial({ color: 0xe6f0f4, transparent: true, opacity: 0, roughness: .04, metalness: 0, clearcoat: 1, depthWrite: false, envMapIntensity: 1.6 });
  const wet = new THREE.Mesh(new THREE.LatheGeometry(wetPts, 64), wetMat);
  wet.renderOrder = 1; root.add(wet);

  // liquid: layered discs on a group that can spin
  const liquid = new THREE.Group(); const surf = new THREE.Group(); liquid.add(surf); root.add(liquid);
  const disc = (mat, k) => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(1, 72), mat);
    m.rotation.x = -Math.PI / 2; m.position.y = k * .012; m.renderOrder = 2 + k; surf.add(m); return m;
  };
  const water = disc(new THREE.MeshPhysicalMaterial({ color: 0xd9ecf2, transparent: true, opacity: 0, roughness: .03, metalness: 0, clearcoat: 1, depthWrite: false, envMapIntensity: 1.5 }), 0);
  const base = disc(new THREE.MeshStandardMaterial({ map: T.matchaTexture(), roughness: .16, transparent: true, opacity: 0, envMapIntensity: .9 }), 1);
  const clump = disc(new THREE.MeshStandardMaterial({ map: T.clumpTexture(), roughness: .7, transparent: true, opacity: 0, depthWrite: false }), 2);
  const fine = disc(new THREE.MeshStandardMaterial({ map: T.foamTexture(2.6, 7, 1500, 11), roughness: .3, transparent: true, opacity: 0, depthWrite: false }), 3);
  const coarse = disc(new THREE.MeshStandardMaterial({ map: T.foamTexture(9, 26, 90, 12), roughness: .25, transparent: true, opacity: 0, depthWrite: false }), 4);
  liquid.visible = false;

  // powder mound from sifting
  const mound = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 16), new THREE.MeshStandardMaterial({ map: T.matchaTexture(), roughness: .95, color: 0xdfe8c0 }));
  mound.position.set(0, 1.08, 0); mound.scale.set(.001, .001, .001); mound.castShadow = false; root.add(mound);

  const api = {
    root, body, liquid, surf, mound, ml: 0, wet: 0, rAt, yForMl, maxMl: vol[vol.length - 2],
    layers: { water, base, clump, fine, coarse },
    setMl(ml) {
      api.ml = ml; liquid.visible = ml > .5;
      const y = yForMl(Math.max(ml, 0));
      surf.position.y = y; const r = rAt(y) + .08; surf.scale.set(r, 1, r);
    },
    setState({ clear, matcha, clump: c, fine: f, coarse: co }) {
      if (clear !== undefined) water.material.opacity = clear * .5;
      if (matcha !== undefined) base.material.opacity = matcha;
      if (c !== undefined) clump.material.opacity = c;
      if (f !== undefined) fine.material.opacity = f;
      if (co !== undefined) coarse.material.opacity = co;
    },
    setWet(v) { api.wet = v; wetMat.opacity = v * .42; },
    setMound(g) { const s = Math.max(.001, g); mound.scale.set(2.5 * s, .55 * s, 2.5 * s); mound.visible = g > .01; },
    surfaceY: () => surf.position.y,
  };
  root.userData.pick = 'bowl';
  root.add(hitMesh(new THREE.CylinderGeometry(6.2, 6.2, 8, 20), [0, 4, 0]));
  shadows(root); wet.castShadow = false; wet.receiveShadow = false; surf.traverse(m => { m.castShadow = m.receiveShadow = false; });
  mound.castShadow = false;
  return api;
}

// ------------------------------------------------------------------ whisk
export function createWhisk() {
  const g = new THREE.Group();
  const hMat = new THREE.MeshStandardMaterial({ map: T.bambooTexture({ vertical: true, seed: 5 }), roughness: .45, envMapIntensity: .6 });
  const hp = [V2(0, 0), V2(.92, 0), V2(1.03, .1), V2(1.07, .5), V2(1.07, 3.85), V2(1.02, 4.15), V2(.95, 4.5), V2(0, 4.5)];
  const handle = new THREE.Mesh(new THREE.LatheGeometry(hp, 48), hMat); g.add(handle);
  const dark = new THREE.MeshStandardMaterial({ color: 0x14110e, roughness: .6 });
  const ringMat = new THREE.MeshStandardMaterial({ color: 0xa8742a, roughness: .5 });
  for (const y of [.5, .64]) { const t = new THREE.Mesh(new THREE.TorusGeometry(1.075, .028, 8, 48), ringMat); t.rotation.x = Math.PI / 2; t.position.y = y; g.add(t); }
  for (const y of [3.45, 3.57, 3.69]) { const t = new THREE.Mesh(new THREE.TorusGeometry(1.085, .035, 8, 48), dark); t.rotation.x = Math.PI / 2; t.position.y = y; g.add(t); }
  const knot = new THREE.Mesh(new THREE.BoxGeometry(.34, .34, .14), dark); knot.position.set(0, 3.57, 1.1); g.add(knot);
  for (const s of [-1, 1]) { const tail = new THREE.Mesh(new THREE.BoxGeometry(.045, .75, .035), dark); tail.position.set(s * .13, 3.1, 1.12); tail.rotation.z = s * .32; g.add(tail); }

  const R = T.rng(77), geos = [];
  const tine = (prof, n, rad, off, jit) => {
    for (let i = 0; i < n; i++) {
      const th = (i + off) / n * Math.PI * 2 + (R() - .5) * .018, j = 1 + (R() - .5) * jit, dy = (R() - .5) * .1;
      const pts = prof.map(([r, y]) => new THREE.Vector3(r * j * Math.cos(th), y + dy, r * j * Math.sin(th)));
      geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), 30, rad, 4, false));
    }
  };
  tine([[1.02, 4.3], [1.35, 4.9], [1.95, 6.1], [2.55, 7.5], [2.95, 8.8], [3.05, 9.7], [2.9, 10.3], [2.55, 10.5], [2.3, 10.2], [2.28, 9.85], [2.45, 9.7]], 72, .034, 0, .06);
  tine([[.9, 4.3], [1.2, 5.0], [1.65, 6.4], [1.95, 8.0], [2.0, 9.2], [1.85, 9.9], [1.6, 10.05], [1.45, 9.8], [1.55, 9.55]], 44, .03, .5, .07);
  tine([[.6, 4.3], [.64, 5.6], [.58, 7.5], [.5, 9.0], [.38, 9.9], [.2, 10.2]], 28, .028, .25, .1);
  const tMat = new THREE.MeshStandardMaterial({ color: 0xe0b161, roughness: .5, emissive: 0x2a1805, envMapIntensity: .6 });
  const tines = new THREE.Mesh(mergeGeometries(geos), tMat); g.add(tines);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(.42, 16, 12), hMat); cap.scale.y = .8; cap.position.y = 10.2; g.add(cap);
  const cord = new THREE.Mesh(new THREE.TorusGeometry(.4, .03, 6, 24), dark); cord.rotation.x = Math.PI / 2; cord.position.y = 10.05; g.add(cord);

  g.add(hitMesh(new THREE.CylinderGeometry(3.3, 3.3, 11, 12), [0, 5.3, 0]));
  g.userData.pick = 'whisk'; g.userData.height = 10.6; g.userData.tines = tines;
  return shadows(g);
}

// ------------------------------------------------------------------ whisk holder
export function createHolder() {
  const outer = curvePts([[4.3, 0], [4.55, .35], [4.25, 1.0], [3.3, 1.8], [2.7, 2.4], [2.65, 3.0], [3.3, 3.9], [3.9, 4.9], [3.95, 5.8], [3.5, 6.7], [2.95, 7.2], [2.6, 7.35], [2.4, 7.2]], 90);
  const inner = curvePts([[2.4, 7.2], [2.45, 6.6], [2.7, 5.6], [2.2, 4.6], [1.2, 4.0], [0, 3.85]], 40);
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.LatheGeometry([V2(0, 0), V2(2, 0), ...outer, ...inner.slice(1)], 96), glazeMat(3, false)));
  g.add(hitMesh(new THREE.CylinderGeometry(4.5, 4.5, 8, 14), [0, 4, 0]));
  g.userData.pick = 'holder'; g.userData.restY = 7.35;
  return shadows(g);
}

// ------------------------------------------------------------------ scoop (chashaku)
export function createScoop() {
  const L = 18, W = 1.15, Tk = .1, x0 = L / 2 - 3.6, R = 2.6;
  const geo = new THREE.BoxGeometry(L, Tk, W, 120, 1, 8);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const zn = z / (W / 2), t = Math.max(0, x - x0);
    y += .26 * zn * zn * Math.min(1, t / 2.4);                               // cupped bowl of the scoop
    y += Math.sign(y || 1) * .05 * Math.exp(-(((x + 1.5) / .5) ** 2));        // bamboo node
    const s0 = L / 2 - 1.4;
    if (x > s0) { const u = (x - s0) / (L / 2 - s0); z *= Math.sqrt(Math.max(0, 1 - u * u)); }
    if (x < -L / 2 + 1.2) { const u = (x + L / 2 - 1.2) / 1.2; z *= .75 + .25 * Math.sqrt(Math.max(0, u)); }
    if (x > x0) { const ph = (x - x0) / R; const r = R - y; x = x0 + r * Math.sin(ph); y = R - r * Math.cos(ph); }
    p.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ map: T.bambooTexture({ vertical: false, seed: 9, node: .42 }), roughness: .42, envMapIntensity: .6 });
  const mesh = new THREE.Mesh(geo, mat);
  const g = new THREE.Group(); g.add(mesh);
  g.add(hitMesh(new THREE.BoxGeometry(19, 2.4, 3.6), [0, 1, 0]));
  g.userData.pick = 'scoop'; g.userData.head = new THREE.Vector3(x0 + 2.6, 1.2, 0);
  return shadows(g);
}

// ------------------------------------------------------------------ tea tin
export function createTin() {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({ color: 0x2c2e31, roughness: .34, metalness: .25, clearcoat: .9, clearcoatRoughness: .2, envMapIntensity: 1 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9a15a, metalness: 1, roughness: .32 });
  const bodyProf = [V2(0, 0), V2(2.4, 0), V2(2.9, .15), V2(3.2, .8), V2(3.3, 2.5), V2(3.28, 4.6), V2(3.12, 4.95), V2(2.92, 4.92), V2(2.9, 4.4), V2(0, 4.4)];
  g.add(new THREE.Mesh(new THREE.LatheGeometry(bodyProf, 64), mat));
  const powder = new THREE.Mesh(new THREE.CircleGeometry(2.88, 40), new THREE.MeshStandardMaterial({ map: T.matchaTexture(), roughness: .95, color: 0xe8f0c8 }));
  powder.rotation.x = -Math.PI / 2; powder.position.y = 4.28; g.add(powder);
  const ring = (y, r) => { const t = new THREE.Mesh(new THREE.TorusGeometry(r, .05, 8, 64), brass); t.rotation.x = Math.PI / 2; t.position.y = y; return t; };
  g.add(ring(.9, 3.22), ring(4.55, 3.3));
  const lid = new THREE.Group(); lid.position.y = 4.95;
  const lidProf = [V2(0, 0), V2(3.15, 0), V2(3.3, .1), V2(3.3, .9), V2(3.0, 1.5), V2(2.2, 1.95), V2(1.0, 2.15), V2(0, 2.2)];
  lid.add(new THREE.Mesh(new THREE.LatheGeometry(lidProf, 64), mat));
  const lr = ring(.45, 3.31); lid.add(lr); g.add(lid);
  g.add(hitMesh(new THREE.CylinderGeometry(3.5, 3.5, 7.5, 14), [0, 3.7, 0]));
  g.userData.pick = 'tin'; g.userData.lid = lid; g.userData.topY = 4.4;
  return shadows(g);
}

// ------------------------------------------------------------------ sieve
export function createSieve() {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0x6c7077, metalness: .9, roughness: .38, envMapIntensity: .7 });
  const flange = [V2(4.5, -.08), V2(6.2, -.08), V2(6.3, 0), V2(6.2, .12), V2(4.5, .12), V2(4.5, -.08)];
  g.add(new THREE.Mesh(new THREE.LatheGeometry(flange, 72), steel));
  const meshProf = [V2(4.55, 0), V2(4.45, -.6), V2(3.6, -1.45), V2(2.1, -1.95), V2(0, -2.15)];
  const meshMat = new THREE.MeshStandardMaterial({ color: 0xe0e3e6, metalness: 1, roughness: .35, alphaMap: T.gridAlpha(), transparent: true, alphaTest: .35, side: THREE.DoubleSide, envMapIntensity: 1.2 });
  g.add(new THREE.Mesh(new THREE.LatheGeometry(meshProf, 72), meshMat));
  const band = new THREE.Mesh(new THREE.CylinderGeometry(4.55, 4.5, .35, 72, 1, true), steel); band.position.y = -.12; band.material.side = THREE.DoubleSide; g.add(band);
  const sh = new THREE.Shape(); sh.moveTo(0, -.7); sh.lineTo(6.3, -.7); sh.absarc(6.3, 0, .7, -Math.PI / 2, Math.PI / 2, false); sh.lineTo(0, .7); sh.lineTo(0, -.7);
  const hole = new THREE.Path(); hole.absarc(6.4, 0, .28, 0, Math.PI * 2, true); sh.holes.push(hole);
  const hg = new THREE.ExtrudeGeometry(sh, { depth: .2, bevelEnabled: false, curveSegments: 20 });
  const handle = new THREE.Mesh(hg, steel); handle.rotation.x = -Math.PI / 2; handle.position.set(5.9, .02, 0); g.add(handle);
  const pile = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 14), new THREE.MeshStandardMaterial({ map: T.matchaTexture(), roughness: .95, color: 0xe3ecc2 }));
  pile.position.y = -1.9; pile.scale.set(.001, .001, .001); g.add(pile);
  g.add(hitMesh(new THREE.CylinderGeometry(6.4, 6.4, 3, 16), [0, -1, 0]));
  g.userData.pick = 'sieve'; g.userData.pile = pile;
  return shadows(g);
}

// ------------------------------------------------------------------ linen cloth
export function createCloth() {
  const geo = new THREE.BoxGeometry(7.2, 1.1, 5.6, 16, 3, 12);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    p.setY(i, p.getY(i) + .09 * Math.sin(x * 1.3) * Math.cos(z * 1.6) + (p.getY(i) > 0 ? .06 * Math.sin(x * 3 + z) : 0));
    p.setX(i, x * (1 - Math.max(0, Math.abs(z) - 2.4) * .03));
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: T.clothTexture(), roughness: .95, metalness: 0 }));
  const g = new THREE.Group(); m.position.y = .55; g.add(m);
  g.add(hitMesh(new THREE.BoxGeometry(7.6, 2, 6), [0, 1, 0]));
  g.userData.pick = 'cloth';
  return shadows(g);
}

// ------------------------------------------------------------------ kettle
export function createKettle() {
  const g = new THREE.Group();
  const iron = new THREE.MeshStandardMaterial({ color: 0x4a4c51, metalness: .7, roughness: .42, envMapIntensity: 1.2 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9a15a, metalness: 1, roughness: .3 });
  const bodyProf = curvePts([[5.0, 0], [5.3, .15], [6.6, 1.2], [7.1, 3.5], [6.9, 6.0], [5.8, 8.2], [4.2, 9.2], [3.2, 9.5]], 60);
  g.add(new THREE.Mesh(new THREE.LatheGeometry([V2(0, 0), ...bodyProf, V2(3.1, 9.35), V2(0, 9.35)], 72), iron));
  const lid = new THREE.Group(); lid.position.y = 9.4;
  lid.add(new THREE.Mesh(new THREE.LatheGeometry([V2(0, 0), V2(3.35, 0), V2(3.45, .12), V2(3.1, .5), V2(1.9, 1.0), V2(.9, 1.3), V2(0, 1.36)], 48), iron));
  const knob = new THREE.Mesh(new THREE.SphereGeometry(.6, 16, 12), brass); knob.position.y = 1.7; lid.add(knob); g.add(lid);
  const spoutCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(6.0, 1.8, 0), new THREE.Vector3(8.2, 3.0, 0), new THREE.Vector3(10.0, 5.4, 0), new THREE.Vector3(10.9, 7.4, 0)]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(spoutCurve, 24, .72, 12, false), iron));
  const lip = new THREE.Mesh(new THREE.TorusGeometry(.72, .13, 8, 20), iron); lip.position.copy(spoutCurve.getPoint(1)); lip.lookAt(spoutCurve.getPoint(1).add(spoutCurve.getTangent(1))); g.add(lip);
  const root = new THREE.Mesh(new THREE.SphereGeometry(1.0, 16, 12), iron); root.position.set(6.2, 1.9, 0); root.scale.set(1, .9, .9); g.add(root);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(6.4, .4, 10, 48, Math.PI), iron);
  handle.scale.set(1, .6, 1); handle.position.y = 7.4; handle.rotation.y = Math.PI / 2; g.add(handle);
  for (const s of [-1, 1]) { const lug = new THREE.Mesh(new THREE.CylinderGeometry(.55, .55, 1.0, 12), iron); lug.rotation.x = Math.PI / 2; lug.position.set(0, 7.4, s * 6.4); g.add(lug); }
  const tip = spoutCurve.getPoint(1).clone(); tip.y += .1;
  g.add(hitMesh(new THREE.CylinderGeometry(7.4, 7.4, 11, 14), [0, 5.5, 0]));
  g.add(hitMesh(new THREE.BoxGeometry(6, 5, 4), [8.2, 4.5, 0]));
  g.userData.pick = 'kettle'; g.userData.tip = tip; g.userData.lid = lid;
  return shadows(g);
}

// ------------------------------------------------------------------ effects
export function createStream() {
  const geo = new THREE.CylinderGeometry(.2, .24, 1, 10, 1, true); geo.translate(0, -.5, 0);
  const m = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: 0xe9f5f9, transparent: true, opacity: .62, roughness: .05, clearcoat: 1, depthWrite: false }));
  m.visible = false; m.renderOrder = 10; return m;
}

export function createParticles(count, { size = 3, color = 0xffffff, opacity = .3 } = {}) {
  const pos = new Float32Array(count * 3), life = new Float32Array(count).fill(-1), vel = new Float32Array(count * 3);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ map: T.softDot(), size, color, transparent: true, opacity, depthWrite: false, sizeAttenuation: true });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 11;
  pts.userData = { life, vel, count };
  for (let i = 0; i < count; i++) pos[i * 3 + 1] = -100;
  return pts;
}
// emit: (i) => {x,y,z,vx,vy,vz,life}; gravity g; returns after updating positions
export function stepParticles(pts, dt, emitRate, emit, g = 0, grow = 0) {
  const { life, vel, count } = pts.userData, pos = pts.geometry.attributes.position.array;
  let want = emitRate * dt + (pts.userData.acc || 0); const n = Math.floor(want); pts.userData.acc = want - n;
  let spawned = 0;
  for (let i = 0; i < count; i++) {
    if (life[i] <= 0 && spawned < n && emitRate > 0) {
      const e = emit(i); pos[i * 3] = e.x; pos[i * 3 + 1] = e.y; pos[i * 3 + 2] = e.z;
      vel[i * 3] = e.vx; vel[i * 3 + 1] = e.vy; vel[i * 3 + 2] = e.vz; life[i] = e.life; spawned++;
    } else if (life[i] > 0) {
      life[i] -= dt; vel[i * 3 + 1] += g * dt;
      pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      if (life[i] <= 0) pos[i * 3 + 1] = -100;
    }
  }
  pts.geometry.attributes.position.needsUpdate = true;
}
