// Canvas-drawn textures. No image assets: everything is painted in code.
import * as THREE from 'three';

const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
export const rng = seed => { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };
const tex = (c, srgb = true) => {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

// Mottled gunmetal glaze with horizontal throwing rings and a brown-gold streak.
// u = 0 is the front of a lathe-turned bowl (the side facing +z).
export function glazeTextures(seed = 1, streak = true) {
  const w = 1024, h = 512, c = cv(w, h), g = c.getContext('2d'), r = rng(seed * 97 + 3);
  g.fillStyle = '#9d9fa4'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 300; i++) {
    const x = r() * w, y = r() * h, rad = 18 + r() * 95, light = r() < .5;
    for (const dx of [-w, 0, w]) {
      const gr = g.createRadialGradient(x + dx, y, 0, x + dx, y, rad);
      gr.addColorStop(0, light ? 'rgba(225,227,232,.3)' : 'rgba(30,31,34,.5)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x + dx - rad, y - rad, rad * 2, rad * 2);
    }
  }
  for (let i = 0; i < 26; i++) {
    const y = r() * h; g.fillStyle = r() < .5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.1)'; g.fillRect(0, y, w, 1 + r() * 4);
  }
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = r() < .5 ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.12)';
    g.fillRect(r() * w, r() * h, 1 + r() * 1.5, 1 + r() * 1.5);
  }
  if (streak) {
    const drawStreak = (x0, y0, y1, wd, a, sd) => {
      for (const dx of [-w, 0, w]) {
        g.beginPath(); let x = x0 + dx; g.moveTo(x, y0);
        const rr = rng(sd);
        for (let y = y0; y < y1; y += 6) { x += (rr() - .5) * 7; g.lineTo(x, y); }
        g.lineCap = 'round'; g.lineJoin = 'round';
        g.strokeStyle = `rgba(150,100,42,${a})`; g.lineWidth = wd; g.stroke();
        g.strokeStyle = `rgba(214,168,92,${a * .85})`; g.lineWidth = wd * .38; g.stroke();
      }
    };
    drawStreak(4, h * .58, h * .86, 11, .9, 11);
    drawStreak(-22, h * .63, h * .8, 5, .75, 12);
    drawStreak(26, h * .62, h * .78, 4, .6, 13);
  }
  return { map: tex(c), bump: tex(c, false) };
}

// Split-bamboo grain. vertical = fibres run along v (cylinders); otherwise along u.
export function bambooTexture({ vertical = true, seed = 5, node = -1 } = {}) {
  const w = 512, h = 512, c = cv(w, h), g = c.getContext('2d'), r = rng(seed);
  const grad = g.createLinearGradient(0, 0, vertical ? w : 0, vertical ? 0 : h);
  grad.addColorStop(0, '#e6bd70'); grad.addColorStop(.5, '#dcab5a'); grad.addColorStop(1, '#e8c27a');
  g.fillStyle = grad; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 520; i++) {
    const p = r() * (vertical ? w : h), wd = .6 + r() * 2.4;
    g.fillStyle = r() < .5 ? `rgba(150,96,28,${.07 + r() * .16})` : `rgba(255,232,170,${.08 + r() * .2})`;
    if (vertical) g.fillRect(p, 0, wd, h); else g.fillRect(0, p, w, wd);
  }
  if (node >= 0) {
    const p = node * (vertical ? h : w);
    const ng = vertical ? g.createLinearGradient(0, p - 18, 0, p + 18) : g.createLinearGradient(p - 18, 0, p + 18, 0);
    ng.addColorStop(0, 'rgba(120,70,15,0)'); ng.addColorStop(.5, 'rgba(120,70,15,.7)'); ng.addColorStop(1, 'rgba(120,70,15,0)');
    g.fillStyle = ng; if (vertical) g.fillRect(0, p - 18, w, 36); else g.fillRect(p - 18, 0, 36, h);
  }
  return tex(c);
}

export function matchaTexture() {
  const w = 512, c = cv(w, w), g = c.getContext('2d'), r = rng(21);
  g.fillStyle = '#7fa31f'; g.fillRect(0, 0, w, w);
  for (let i = 0; i < 160; i++) {
    const x = r() * w, y = r() * w, rad = 20 + r() * 80, dark = r() < .45;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, dark ? 'rgba(60,98,10,.35)' : 'rgba(176,205,70,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  return tex(c);
}

// Unmixed powder: dull lumps on top of the liquid.
export function clumpTexture() {
  const w = 512, c = cv(w, w), g = c.getContext('2d'), r = rng(33);
  for (let i = 0; i < 260; i++) {
    const x = r() * w, y = r() * w, rad = 5 + r() * 24, dark = r() < .6;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, dark ? 'rgba(52,84,8,.95)' : 'rgba(150,178,52,.9)');
    gr.addColorStop(.7, dark ? 'rgba(62,98,12,.7)' : 'rgba(170,196,70,.55)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill();
  }
  return tex(c);
}

// Bubbles for the foam layers.
export function foamTexture(minR, maxR, count, seed) {
  const w = 1024, c = cv(w, w), g = c.getContext('2d'), r = rng(seed);
  for (let i = 0; i < count; i++) {
    const x = r() * w, y = r() * w, rad = minR + Math.pow(r(), 2) * (maxR - minR);
    const gr = g.createRadialGradient(x, y, rad * .1, x, y, rad);
    gr.addColorStop(0, 'rgba(190,214,96,.55)'); gr.addColorStop(.7, 'rgba(172,203,80,.7)');
    gr.addColorStop(.93, 'rgba(232,246,170,.95)'); gr.addColorStop(1, 'rgba(120,150,40,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,240,.8)'; g.beginPath(); g.arc(x - rad * .3, y - rad * .3, Math.max(.7, rad * .16), 0, 7); g.fill();
  }
  return tex(c);
}

export function gridAlpha() {
  const c = cv(64, 64), g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#fff';
  g.fillRect(0, 0, 64, 7); g.fillRect(0, 0, 7, 64);
  const t = tex(c, false); t.repeat.set(26, 6); return t;
}

export function clothTexture() {
  const c = cv(256, 256), g = c.getContext('2d'), r = rng(8);
  g.fillStyle = '#f2f0e9'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 256; i += 3) { g.fillStyle = 'rgba(80,76,66,.07)'; g.fillRect(i, 0, 1, 256); g.fillRect(0, i, 256, 1); }
  for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(0,0,0,${r() * .03})`; g.fillRect(r() * 256, r() * 256, 2, 2); }
  const t = tex(c); t.repeat.set(2, 2); return t;
}

export function softDot() {
  const c = cv(64, 64), g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.5, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return tex(c);
}
