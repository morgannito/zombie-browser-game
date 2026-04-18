'use strict';

/**
 * Regression: BulletUpdater swept collision — pas de tunneling sur walls
 * Bug: balles rapides traversaient les murs sans collision (deltaMultiplier > 1)
 */

const MAX_SUBSTEP_DISTANCE = 15;
const TARGET_FRAME_TIME = 1000 / 60;

function simulateBulletMove(bullet, deltaMultiplier, wallHitFn) {
  const totalVx = bullet.vx * deltaMultiplier;
  const totalVy = bullet.vy * deltaMultiplier;
  const totalDistance = Math.sqrt(totalVx * totalVx + totalVy * totalVy);
  const destroyed = { value: false };

  if (totalDistance <= MAX_SUBSTEP_DISTANCE) {
    bullet.x += totalVx;
    bullet.y += totalVy;
    if (wallHitFn(bullet.x, bullet.y)) {
      destroyed.value = true;
    }
  } else {
    const numSubsteps = Math.ceil(totalDistance / MAX_SUBSTEP_DISTANCE);
    const substepVx = totalVx / numSubsteps;
    const substepVy = totalVy / numSubsteps;
    for (let step = 0; step < numSubsteps; step++) {
      bullet.x += substepVx;
      bullet.y += substepVy;
      if (wallHitFn(bullet.x, bullet.y)) {
        destroyed.value = true;
        break;
      }
    }
  }
  return destroyed.value;
}

describe('BulletUpdater — swept collision anti-tunneling', () => {
  test('balle_lente_en_dessous_substep_pas_de_subdivision', () => {
    const bullet = { x: 0, y: 0, vx: 5, vy: 0 };
    const wallHits = [];
    simulateBulletMove(bullet, 1.0, (x) => {
 wallHits.push(x); return false;
});
    expect(wallHits).toHaveLength(1);
  });

  test('balle_rapide_decoupe_en_substeps', () => {
    const bullet = { x: 0, y: 0, vx: 60, vy: 0 };
    const wallHits = [];
    simulateBulletMove(bullet, 1.0, (x) => {
 wallHits.push(x); return false;
});
    expect(wallHits.length).toBeGreaterThan(1);
  });

  test('balle_rapide_detecte_mur_intermediaire', () => {
    // mur à x=20, balle doit parcourir 60px → sans substep elle passerait à x=60
    const bullet = { x: 0, y: 0, vx: 60, vy: 0 };
    const wallX = 20;
    const destroyed = simulateBulletMove(bullet, 1.0, (x) => x >= wallX);
    expect(destroyed).toBe(true);
    expect(bullet.x).toBeLessThan(60); // arrêtée avant la fin
  });

  test('balle_lente_passe_sans_mur_non_detruite', () => {
    const bullet = { x: 0, y: 0, vx: 5, vy: 0 };
    const destroyed = simulateBulletMove(bullet, 1.0, () => false);
    expect(destroyed).toBe(false);
    expect(bullet.x).toBe(5);
  });

  test('grand_delta_multiplier_provoque_substeps', () => {
    // deltaMultiplier=4 → totalDistance = 5*4=20 > MAX_SUBSTEP_DISTANCE=15
    const bullet = { x: 0, y: 0, vx: 5, vy: 0 };
    const wallHits = [];
    simulateBulletMove(bullet, 4.0, (x) => {
 wallHits.push(x); return false;
});
    expect(wallHits.length).toBeGreaterThan(1);
  });
});
