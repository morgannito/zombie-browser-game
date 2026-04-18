'use strict';

/**
 * GET /debug/replay — dump du ring buffer replay (30s de deltas).
 * Activé uniquement si ENABLE_REPLAY=true (sinon 404).
 * Requiert Bearer token (même que /metrics).
 */

const express = require('express');
const { requireMetricsToken } = require('../../middleware/security');

const router = express.Router();

router.get('/', requireMetricsToken, (req, res) => {
  if (process.env.ENABLE_REPLAY !== 'true') {
    return res.status(404).json({ error: 'Replay buffer not enabled. Set ENABLE_REPLAY=true.' });
  }
  // Lazy require to avoid circular dep at module load
  const { replayBuffer } = require('../../lib/server/NetworkManager');
  if (!replayBuffer) {
    return res.status(503).json({ error: 'Replay buffer not initialized.' });
  }
  const entries = replayBuffer.dump();
  res.json({ count: entries.length, entries });
});

module.exports = router;
