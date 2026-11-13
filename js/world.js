// Lays the tools out on the table, matching the reference render.
import { THREE, scene, addPickable } from './stage.js';
import * as M from './models.js';

export const HOME = {
  bowl: new THREE.Vector3(2, 0, 0),
  waste: new THREE.Vector3(16, 0, -10),
  holder: new THREE.Vector3(-22, 0, 5),
  whisk: new THREE.Vector3(-8, 0, 12),
  scoop: new THREE.Vector3(4, .06, 19),
  tin: new THREE.Vector3(3, 0, -16),
  kettle: new THREE.Vector3(-15, 0, -17),
  sieve: new THREE.Vector3(23, 2.2, 8),
  cloth: new THREE.Vector3(10, 0, 12),
};
export const RIM = new THREE.Vector3(5.5, 7.7, 0); // bowl lip, pivot used when tipping

export function buildWorld() {
  const W = {};
  const put = (o, pos, ry = 0) => { o.position.copy(pos); o.rotation.y = ry; scene.add(o); addPickable(o); return o; };

  W.bowl = M.createBowl({ seed: 1 });
  W.bowlPivot = new THREE.Group();
  W.bowlPivot.position.copy(HOME.bowl).add(RIM);
  W.bowl.root.position.copy(RIM).negate();
  W.bowlPivot.add(W.bowl.root); scene.add(W.bowlPivot); addPickable(W.bowlPivot);
  W.bowl.root.rotation.y = .25;

  W.waste = M.createBowl({ seed: 2, streak: false });
  W.waste.root.userData.pick = 'waste';
  put(W.waste.root, HOME.waste, .7);

  W.holder = put(M.createHolder(), HOME.holder);
  W.whisk = put(M.createWhisk(), HOME.whisk, .3);
  W.scoop = put(M.createScoop(), HOME.scoop, Math.PI);
  W.tin = put(M.createTin(), HOME.tin, .4);
  W.kettle = put(M.createKettle(), HOME.kettle, .22);
  W.sieve = put(M.createSieve(), HOME.sieve, -1.9);
  W.cloth = put(M.createCloth(), HOME.cloth, .3);

  W.stream = M.createStream(); scene.add(W.stream);
  W.steam = M.createParticles(40, { size: 5, color: 0xaab0b6, opacity: .22 });
  W.bowlSteam = M.createParticles(26, { size: 4, color: 0xaab0b6, opacity: .18 });
  W.powderFall = M.createParticles(70, { size: .7, color: 0x8db02e, opacity: .95 });
  scene.add(W.steam, W.bowlSteam, W.powderFall);
  return W;
}
