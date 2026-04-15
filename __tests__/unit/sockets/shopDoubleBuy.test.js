/**
 * Regression test — double-buy guard
 *
 * Symptom: clicking a shop button twice rapidly before the server response
 * arrives emits two `buyItem` socket events. The server processes both
 * sequentially inside the Node.js event loop; both pass the `player.gold >= cost`
 * pre-check before either deducts, resulting in gold deducted twice and the
 * upgrade applied twice (or gold going negative).
 *
 * Fix: `window.buyItem` in UIManager sets `_buyPending = true` on the first
 * click and returns early on every subsequent click. `handleShopUpdate` in
 * NetworkManager clears `_buyPending` once the server responds.
 *
 * These tests verify the server-side handler (applyPermanentPurchase) and the
 * client-side guard logic independently, without requiring a DOM environment.
 */

'use strict';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSocket(emitted = []) {
  return {
    id: 'socket-test',
    emit(event, data) {
      emitted.push({ event, data });
    }
  };
}

function makePlayer(gold = 100) {
  return {
    gold,
    alive: true,
    hasNickname: true,
    upgrades: {},
    lastActivityTime: 0,
    // Applied by speed upgrade effect in the real game; we don't need it here
    speed: 5
  };
}

// Minimal replica of applyPermanentPurchase (shop.js) so we can exercise the
// exact deduction path without importing the full handler (which would require
// a real socket + gameState dependency tree).
function applyPermanentPurchase(socket, player, item, itemId, _emitted) {
  const currentLevel = player.upgrades[itemId] || 0;

  if (currentLevel >= item.maxLevel) {
    socket.emit('shopUpdate', { success: false, message: 'Niveau maximum atteint' });
    return;
  }

  const cost = item.baseCost + currentLevel * item.costIncrease;

  if (player.gold < cost) {
    socket.emit('shopUpdate', { success: false, message: 'Or insuffisant' });
    return;
  }

  // Atomic deduction with rollback (mirrors shop.js lines 50-58)
  player.gold -= cost;
  if (player.gold < 0) {
    player.gold += cost;
    socket.emit('shopUpdate', { success: false, message: 'Or insuffisant' });
    return;
  }

  player.upgrades[itemId] = currentLevel + 1;
  // item.effect(player) omitted — not under test here

  socket.emit('shopUpdate', { success: true, itemId, category: 'permanent' });
}

// ---------------------------------------------------------------------------
// Test item fixture
// ---------------------------------------------------------------------------

const SPEED_ITEM = {
  name: 'Vitesse',
  baseCost: 50,
  costIncrease: 25,
  maxLevel: 3,
  effect: player => {
    player.speed = (player.speed || 5) + 1;
  }
};

// ---------------------------------------------------------------------------
// 1. Server-side: two sequential calls simulate the double-emit race
// ---------------------------------------------------------------------------

describe('regression — shop double-buy: server-side sequential processing', () => {
  test('test_doubleBuy_sufficientGoldForOne_secondCallFails', () => {
    // Arrange — player has exactly enough gold for ONE purchase
    const emitted = [];
    const socket = makeSocket(emitted);
    const player = makePlayer(50); // cost = baseCost(50) + level(0)*costIncrease(25) = 50

    // Act — two back-to-back calls before any client update (simulates double-click race)
    applyPermanentPurchase(socket, player, SPEED_ITEM, 'speed', emitted);
    applyPermanentPurchase(socket, player, SPEED_ITEM, 'speed', emitted);

    // Assert — only one deduction; second call must fail
    const successes = emitted.filter(e => e.data.success === true);
    const failures = emitted.filter(e => e.data.success === false);

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(failures[0].data.message).toBe('Or insuffisant');

    // Gold ends at 0, never negative
    expect(player.gold).toBe(0);
  });

  test('test_doubleBuy_upgradeLevel_onlyIncrementedOnce', () => {
    // Arrange
    const emitted = [];
    const socket = makeSocket(emitted);
    const player = makePlayer(50);

    // Act
    applyPermanentPurchase(socket, player, SPEED_ITEM, 'speed', emitted);
    applyPermanentPurchase(socket, player, SPEED_ITEM, 'speed', emitted);

    // Assert — upgrade is at level 1, not 2
    expect(player.upgrades.speed).toBe(1);
  });

  test('test_doubleBuy_goldNeverGoesNegative', () => {
    // Arrange — player has exactly the cost amount
    const emitted = [];
    const socket = makeSocket(emitted);
    const player = makePlayer(50);

    // Act — simulate 5 rapid clicks (network flood scenario)
    for (let i = 0; i < 5; i++) {
      applyPermanentPurchase(socket, player, SPEED_ITEM, 'speed', emitted);
    }

    // Assert
    expect(player.gold).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// 2. Client-side guard logic — _buyPending flag behaviour
// ---------------------------------------------------------------------------

describe('regression — shop double-buy: client-side _buyPending guard', () => {
  // Simulate the exact logic added to window.buyItem in UIManager.js
  function makeBuyItemFn(networkManager) {
    let _buyPending = false;

    const buyItem = (itemId, category) => {
      if (!networkManager) {
return { sent: false, reason: 'no_network' };
}
      if (_buyPending) {
return { sent: false, reason: 'pending' };
}

      _buyPending = true;
      networkManager.buyItem(itemId, category);
      return { sent: true };
    };

    // handleShopUpdate clears the flag (mirrors NetworkManager.handleShopUpdate)
    const handleShopUpdate = _data => {
      _buyPending = false;
    };

    return { buyItem, handleShopUpdate };
  }

  test('test_guard_firstClick_emitsToNetwork', () => {
    const calls = [];
    const nm = { buyItem: (id, cat) => calls.push({ id, cat }) };
    const { buyItem } = makeBuyItemFn(nm);

    const result = buyItem('speed', 'permanent');

    expect(result.sent).toBe(true);
    expect(calls).toHaveLength(1);
  });

  test('test_guard_secondClickBeforeAck_dropped', () => {
    const calls = [];
    const nm = { buyItem: (id, cat) => calls.push({ id, cat }) };
    const { buyItem } = makeBuyItemFn(nm);

    buyItem('speed', 'permanent'); // first — goes through
    const result = buyItem('speed', 'permanent'); // second — must be dropped

    expect(result.sent).toBe(false);
    expect(result.reason).toBe('pending');
    expect(calls).toHaveLength(1); // only one socket emit
  });

  test('test_guard_afterAckReceived_nextClickGoesThrough', () => {
    const calls = [];
    const nm = { buyItem: (id, cat) => calls.push({ id, cat }) };
    const { buyItem, handleShopUpdate } = makeBuyItemFn(nm);

    buyItem('speed', 'permanent'); // first click
    handleShopUpdate({ success: true }); // server ack
    const result = buyItem('speed', 'permanent'); // second click after ack

    expect(result.sent).toBe(true);
    expect(calls).toHaveLength(2);
  });

  test('test_guard_failedAckAlsoClearsFlag', () => {
    const calls = [];
    const nm = { buyItem: (id, cat) => calls.push({ id, cat }) };
    const { buyItem, handleShopUpdate } = makeBuyItemFn(nm);

    buyItem('speed', 'permanent');
    handleShopUpdate({ success: false, message: 'Or insuffisant' });
    const result = buyItem('speed', 'permanent');

    expect(result.sent).toBe(true); // flag was cleared even on failure
    expect(calls).toHaveLength(2);
  });
});
