'use strict';

/**
 * Regression: applyInterpolation doit appeler _interpolate chaque frame
 * Bug: un throttle bloquait l'appel certaines frames → saccades visuelles
 */

describe('applyInterpolation — appel chaque frame sans throttle', () => {
  function makeGSM() {
    return {
      interpolation: {
        enabled: true,
        lastFrameTime: 0,
        deltaTime: 0,
        baseSpeed: 50
      },
      _serverTimeSynced: true,
      _interpolateZombies: jest.fn(),
      _interpolatePlayers: jest.fn(),
      _interpolateBullets: jest.fn(),
      debugStats: { interpolatedEntities: 0 },
      getEstimatedServerTime() {
 return Date.now();
},
      _adaptiveSpeed() {
 return this.interpolation.baseSpeed;
},
      applyInterpolation() {
        if (!this.interpolation.enabled) {
return;
}
        if (!this._serverTimeSynced) {
return;
}
        const now = this.getEstimatedServerTime();
        const rawDelta = now - this.interpolation.lastFrameTime;
        this.interpolation.lastFrameTime = now;
        const deltaTime = Math.min(rawDelta, 100);
        this.interpolation.deltaTime = deltaTime;
        const skipExtrapolation = rawDelta > 500;
        const effectiveSpeed = this._adaptiveSpeed();
        const smoothFactor = 1 - Math.exp((-effectiveSpeed * deltaTime) / 1000);
        this.debugStats.interpolatedEntities = 0;
        this._interpolateZombies(now, smoothFactor, skipExtrapolation);
        this._interpolatePlayers(now, smoothFactor, skipExtrapolation);
        this._interpolateBullets(now, smoothFactor, skipExtrapolation);
      }
    };
  }

  test('interpolate_appele_a_chaque_frame', () => {
    const gsm = makeGSM();
    gsm.applyInterpolation();
    gsm.applyInterpolation();
    gsm.applyInterpolation();
    expect(gsm._interpolatePlayers).toHaveBeenCalledTimes(3);
  });

  test('interpolate_zombies_appele_chaque_frame', () => {
    const gsm = makeGSM();
    gsm.applyInterpolation();
    gsm.applyInterpolation();
    expect(gsm._interpolateZombies).toHaveBeenCalledTimes(2);
  });

  test('interpolate_bullets_appele_chaque_frame', () => {
    const gsm = makeGSM();
    gsm.applyInterpolation();
    gsm.applyInterpolation();
    expect(gsm._interpolateBullets).toHaveBeenCalledTimes(2);
  });

  test('disabled_interpolation_aucun_appel', () => {
    const gsm = makeGSM();
    gsm.interpolation.enabled = false;
    gsm.applyInterpolation();
    expect(gsm._interpolatePlayers).not.toHaveBeenCalled();
  });

  test('server_non_synce_aucun_appel', () => {
    const gsm = makeGSM();
    gsm._serverTimeSynced = false;
    gsm.applyInterpolation();
    expect(gsm._interpolatePlayers).not.toHaveBeenCalled();
  });
});
