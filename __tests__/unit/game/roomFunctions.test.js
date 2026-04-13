'use strict';

const { generateRoom, initializeRooms, loadRoom } = require('../../../game/roomFunctions');
const ConfigManager = require('../../../lib/server/ConfigManager');
const { CONFIG } = ConfigManager;

describe('roomFunctions', () => {
  describe('generateRoom', () => {
    test('test_generateRoom_always_returnsRoomWithCorrectDimensions', () => {
      const room = generateRoom();
      expect(room.width).toBe(CONFIG.ROOM_WIDTH);
      expect(room.height).toBe(CONFIG.ROOM_HEIGHT);
    });

    test('test_generateRoom_always_hasFiveWalls', () => {
      const room = generateRoom();
      expect(room.walls).toHaveLength(5);
    });

    test('test_generateRoom_always_hasExactlyOneDoor', () => {
      const room = generateRoom();
      expect(room.doors).toHaveLength(1);
    });

    test('test_generateRoom_door_isInitiallyInactive', () => {
      const room = generateRoom();
      expect(room.doors[0].active).toBe(false);
    });

    test('test_generateRoom_door_hasCenteredXPosition', () => {
      const room = generateRoom();
      const door = room.doors[0];
      const expectedDoorX = (CONFIG.ROOM_WIDTH - CONFIG.DOOR_WIDTH) / 2;
      expect(door.x).toBe(expectedDoorX);
      expect(door.width).toBe(CONFIG.DOOR_WIDTH);
    });

    test('test_generateRoom_obstacles_countBetween3and7', () => {
      for (let i = 0; i < 20; i++) {
        const room = generateRoom();
        expect(room.obstacles.length).toBeGreaterThanOrEqual(3);
        expect(room.obstacles.length).toBeLessThanOrEqual(7);
      }
    });

    test('test_generateRoom_obstacles_havePositiveDimensions', () => {
      const room = generateRoom();
      room.obstacles.forEach(obs => {
        expect(obs.width).toBeGreaterThan(0);
        expect(obs.height).toBeGreaterThan(0);
      });
    });

    test('test_generateRoom_always_hasObstaclesArray', () => {
      const room = generateRoom();
      expect(Array.isArray(room.obstacles)).toBe(true);
    });
  });

  describe('initializeRooms', () => {
    test('test_initializeRooms_always_setsCurrentRoomToZero', () => {
      const gameState = {};
      initializeRooms(gameState, CONFIG);
      expect(gameState.currentRoom).toBe(0);
    });

    test('test_initializeRooms_always_createsCorrectNumberOfRooms', () => {
      const gameState = {};
      initializeRooms(gameState, CONFIG);
      expect(gameState.rooms).toHaveLength(CONFIG.ROOMS_PER_RUN);
    });

    test('test_initializeRooms_always_initializesWallsArray', () => {
      const gameState = {};
      initializeRooms(gameState, CONFIG);
      expect(Array.isArray(gameState.walls)).toBe(true);
    });

    test('test_initializeRooms_always_overwritesPreviousState', () => {
      const gameState = { rooms: ['old'], currentRoom: 99 };
      initializeRooms(gameState, CONFIG);
      expect(gameState.currentRoom).toBe(0);
      expect(gameState.rooms).toHaveLength(CONFIG.ROOMS_PER_RUN);
    });
  });

  describe('loadRoom', () => {
    test('test_loadRoom_withValidRoomManager_delegatesToIt', () => {
      const roomManager = { loadRoom: jest.fn() };
      loadRoom(2, roomManager);
      expect(roomManager.loadRoom).toHaveBeenCalledWith(2);
    });

    test('test_loadRoom_withoutRoomManager_doesNotThrow', () => {
      expect(() => loadRoom(0, null)).not.toThrow();
    });

    test('test_loadRoom_roomManagerMissingLoadRoom_doesNotThrow', () => {
      expect(() => loadRoom(0, {})).not.toThrow();
    });
  });
});
