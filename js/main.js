import * as STAGE from './stage.js';
import { buildWorld } from './world.js';
import { initGame, playGame } from './game.js';
import * as A from './audio.js';
import { scan, stopScan, startCamera } from './scan.js';

const $ = id => document.getElementById(id);
STAGE.initStage($('stage'));
const W = buildWorld();
initGame(W);
window.W = W; window.STAGE = STAGE; // handy for debugging

// hero shot: the reference arrangement, shifted right so the title card has room
const wide = window.innerWidth / window.innerHeight > 1.15;
Object.assign(STAGE.cam, { tx: wide ? -6 : 0, ty: 4, tz: 3, span: wide ? 66 : 60, elev: .5, sway: .02 });
W.bowl.setMl(0);

let started = false;
async function play() {
  if (started) return; started = true;
  A.initAudio(); A.click();
  $('start').classList.add('fade'); setTimeout(() => ($('start').hidden = true), 650);
  STAGE.tween(W.bowl.root.rotation, { y: 2.5 }, .9);
  STAGE.cam.sway = .008;
  await playGame();
}

// ---- AR: scan the printed card, then play over the live camera
async function scanThenPlay() {
  if (started) return;
  A.initAudio(); A.click();
  const status = t => ($('scanStatus').textContent = t);
  $('start').classList.add('fade'); $('scan').hidden = false; $('ar').hidden = false;
  if (!navigator.mediaDevices?.getUserMedia) { status('No camera available here. Playing on screen.'); return fallback(900); }
  try {
    await scan($('ar'), {
      onStatus: status,
      onFound: async () => {
        status('Found it!'); A.chime();
        try { await startCamera($('cam')); document.body.classList.add('ar'); }
        catch { /* no feed: the plain studio backdrop still works */ }
        $('ar').hidden = true; $('scan').hidden = true;
        $('start').hidden = true;
        play();
      },
    });
  } catch (e) {
    status('Could not open the camera. Playing on screen.'); fallback(1400);
  }
}
function fallback(ms = 0) {
  setTimeout(() => { stopScan(); $('ar').hidden = true; $('scan').hidden = true; $('start').classList.remove('fade'); play(); }, ms);
}

$('scanBtn').onclick = scanThenPlay;
$('startBtn').onclick = play;
$('scanSkip').onclick = () => { stopScan(); $('ar').hidden = true; $('scan').hidden = true; $('start').classList.remove('fade'); play(); };
$('againBtn').onclick = () => { try { sessionStorage.setItem('matcha-ar', document.body.classList.contains('ar') ? '1' : ''); } catch {} location.hash = 'again'; location.reload(); };
$('muteBtn').onclick = () => { const m = !A.isMuted(); A.setMuted(m); $('muteBtn').classList.toggle('muted', m); };
const q = new URLSearchParams(location.search);
if (q.has('demo')) setTimeout(play, 300);
if (location.hash === '#again') {
  location.hash = '';
  let ar = ''; try { ar = sessionStorage.getItem('matcha-ar'); } catch {}
  setTimeout(async () => { if (ar) { try { await startCamera($('cam')); document.body.classList.add('ar'); } catch {} } play(); }, 300);
}
