// Tiny WebAudio synth: no audio files.
let ctx, master, noiseBuf, muted = false;
let pour = null;

export function initAudio() {
  if (ctx) { ctx.resume?.(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC(); master = ctx.createGain(); master.gain.value = muted ? 0 : .55; master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}
export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : .55; }
export const isMuted = () => muted;

function burst({ freq = 2000, q = 1, dur = .08, vol = .2, type = 'bandpass' }) {
  if (!ctx) return;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = .8 + Math.random() * .4;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); const t = ctx.currentTime;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .008); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + dur + .05);
}
function tone(freq, dur, vol = .15, type = 'sine', when = 0) {
  if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + when;
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .05);
}

export const click = () => { tone(880, .07, .08, 'triangle'); burst({ freq: 3500, dur: .04, vol: .08 }); };
export const clack = () => { tone(300, .1, .12, 'triangle'); burst({ freq: 1200, dur: .06, vol: .1 }); };
export const wrong = () => { tone(150, .18, .16, 'sine'); };
export const chime = () => { tone(784, .5, .12); tone(1046, .7, .1, 'sine', .09); tone(1318, .9, .08, 'sine', .2); };
export const whiskTick = (v = 1) => burst({ freq: 2600 + Math.random() * 900, q: 1.6, dur: .05, vol: .05 + .05 * v });
export const scrape = () => burst({ freq: 1500, q: .7, dur: .12, vol: .05, type: 'lowpass' });
export const sieveTick = () => burst({ freq: 4200, q: 2, dur: .05, vol: .04 });

export function pourOn() {
  if (!ctx || pour) return;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = .7;
  const g = ctx.createGain(); g.gain.value = 0; g.gain.linearRampToValueAtTime(.2, ctx.currentTime + .15);
  s.connect(f); f.connect(g); g.connect(master); s.start();
  pour = { s, f, g };
}
export function pourPitch(level = 0) { if (pour) pour.f.frequency.value = 1300 + level * 1500; }
export function pourOff() {
  if (!pour) return;
  const { s, g } = pour; pour = null;
  g.gain.cancelScheduledValues(ctx.currentTime); g.gain.setValueAtTime(g.gain.value, ctx.currentTime);
  g.gain.linearRampToValueAtTime(0, ctx.currentTime + .2); s.stop(ctx.currentTime + .25);
}
