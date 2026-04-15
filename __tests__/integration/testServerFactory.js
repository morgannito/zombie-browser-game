/**
 * Factory to spin up a minimal Socket.IO game server for integration tests.
 * No database, no game loop — just the socket handlers under test.
 */

'use strict';

const http = require('http');
const express = require('express');
const socketIO = require('socket.io');
const { io: clientIO } = require('socket.io-client');

const { initializeGameState } = require('../../game/gameState');
const { initializeRooms, loadRoom } = require('../../game/roomFunctions');
const ConfigManager = require('../../lib/server/ConfigManager');
const EntityManager = require('../../lib/server/EntityManager');
const RoomManager = require("../../contexts/wave/RoomManager");
const MetricsCollector = require('../../lib/infrastructure/MetricsCollector');
const perfIntegration = require('../../lib/server/PerformanceIntegration');
const { initSocketHandlers, stopSessionCleanupInterval } = require('../../transport/websocket');

const { CONFIG } = ConfigManager;

/**
 * Start a test server on an ephemeral port.
 * @returns {{ server, io, gameState, port, createClient, stop }}
 */
function createTestServer() {
  const app = express();
  const server = http.createServer(app);
  const io = socketIO(server, {
    cors: { origin: '*' },
    transports: ['websocket'],
    pingTimeout: 2000,
    pingInterval: 1000
  });

  const gameState = initializeGameState();
  initializeRooms(gameState, CONFIG);

  const entityManager = new EntityManager(gameState, CONFIG);
  const roomManager = new RoomManager(gameState, CONFIG, io);
  const metricsCollector = MetricsCollector.getInstance();

  gameState.roomManager = roomManager;
  loadRoom(0, roomManager);

  const socketHandler = initSocketHandlers(
    io,
    gameState,
    entityManager,
    roomManager,
    metricsCollector,
    perfIntegration,
    null
  );
  io.on('connection', socketHandler);

  return new Promise(resolve => {
    server.listen(0, () => {
      const { port } = server.address();

      function createClient(opts = {}) {
        return clientIO(`http://localhost:${port}`, {
          transports: ['websocket'],
          forceNew: true,
          ...opts
        });
      }

      function stop() {
        stopSessionCleanupInterval();
        return new Promise(res => {
          io.close(() => server.close(res));
        });
      }

      resolve({ server, io, gameState, port, createClient, stop });
    });
  });
}

/**
 * Connect a client and wait for the 'init' event.
 * @param {Function} createClient
 * @param {Object} opts - socket.io-client options
 * @returns {Promise<{ client, initData }>}
 */
function connectAndInit(createClient, opts = {}) {
  return new Promise((resolve, reject) => {
    const client = createClient(opts);
    const timeout = setTimeout(() => {
      client.disconnect();
      reject(new Error('Timeout waiting for init event'));
    }, 3000);

    client.once('init', initData => {
      clearTimeout(timeout);
      resolve({ client, initData });
    });

    client.once('connect_error', err => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

/**
 * Wait for a specific socket event with a timeout.
 * @param {Object} socket - socket.io-client socket
 * @param {string} event
 * @param {number} timeoutMs
 * @returns {Promise<any>}
 */
function waitForEvent(socket, event, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout waiting for "${event}"`)), timeoutMs);
    socket.once(event, data => {
      clearTimeout(t);
      resolve(data);
    });
  });
}

module.exports = { createTestServer, connectAndInit, waitForEvent };
