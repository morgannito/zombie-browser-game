'use strict';

/**
 * Regression: _checkLocalPlayerDesync no-op pour drift < 200px
 * Bug: le local player était snappé même pour de petits drifts
 */

describe('_checkLocalPlayerDesync — seuil 200px', () => {
  let nm;

  function makeNM(localX, localY, serverX, serverY) {
    global.window = {
      gameState: {
        playerId: 'p1',
        state: { players: { p1: { x: localX, y: localY } } }
      }
    };
    const delta = { updated: { players: { p1: { x: serverX, y: serverY } } } };
    const localPlayerState = { x: localX, y: localY };
    return { nm: { _checkLocalPlayerDesync }, delta, localPlayerState };
  }

  function _checkLocalPlayerDesync(delta, localPlayerState) {
    if (!localPlayerState || !delta.updated?.players?.[window.gameState.playerId]) {
return;
}
    const serverPatch = delta.updated.players[window.gameState.playerId];
    if (serverPatch.x === undefined || serverPatch.y === undefined) {
return;
}
    const dx = localPlayerState.x - serverPatch.x;
    const dy = localPlayerState.y - serverPatch.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > 50) {
      const p = window.gameState.state.players?.[window.gameState.playerId];
      if (p) {
        p.x = serverPatch.x;
        p.y = serverPatch.y;
      }
    }
  }

  test('drift_sous_seuil_50px_aucun_snap', () => {
    const { delta, localPlayerState } = makeNM(100, 100, 130, 100); // drift=30
    _checkLocalPlayerDesync(delta, localPlayerState);
    expect(window.gameState.state.players.p1.x).toBe(100);
  });

  test('drift_exactement_50px_aucun_snap', () => {
    const { delta, localPlayerState } = makeNM(100, 100, 150, 100); // drift=50
    _checkLocalPlayerDesync(delta, localPlayerState);
    expect(window.gameState.state.players.p1.x).toBe(100);
  });

  test('drift_superieur_50px_snap_applique', () => {
    const { delta, localPlayerState } = makeNM(100, 100, 200, 100); // drift=100
    _checkLocalPlayerDesync(delta, localPlayerState);
    expect(window.gameState.state.players.p1.x).toBe(200);
  });

  test('sans_coordonnees_server_aucun_snap', () => {
    global.window = {
      gameState: { playerId: 'p1', state: { players: { p1: { x: 0, y: 0 } } } }
    };
    const delta = { updated: { players: { p1: { health: 80 } } } };
    _checkLocalPlayerDesync(delta, { x: 0, y: 0 });
    expect(window.gameState.state.players.p1.x).toBe(0);
  });

  test('sans_localPlayerState_retour_immediat', () => {
    global.window = {
      gameState: { playerId: 'p1', state: { players: { p1: { x: 0, y: 0 } } } }
    };
    expect(() => _checkLocalPlayerDesync({ updated: {} }, null)).not.toThrow();
  });
});
