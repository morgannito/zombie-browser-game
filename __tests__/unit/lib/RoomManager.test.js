/**
 * Unit tests for lib/server/RoomManager.js
 */

const RoomManager = require('../../../contexts/wave/RoomManager');

const makeConfig = (overrides = {}) => ({
  ROOM_WIDTH: 3000,
  ROOM_HEIGHT: 2400,
  WALL_THICKNESS: 40,
  DOOR_WIDTH: 120,
  ROOMS_PER_RUN: 3,
  ...overrides
});

const makeGameState = () => ({
  rooms: [],
  walls: [],
  zombies: {},
  currentRoom: 0,
  bossSpawned: false,
  zombiesKilledThisWave: 0,
  zombiesSpawnedThisWave: 0
});

const makeIo = () => ({ emit: jest.fn() });

// --- generateRoom ---

describe('RoomManager.generateRoom', () => {
  test('test_generateRoom_default_returnsRoomWithCorrectDimensions', () => {
    const config = makeConfig();
    const rm = new RoomManager(makeGameState(), config, makeIo());

    const room = rm.generateRoom();

    expect(room.width).toBe(config.ROOM_WIDTH);
    expect(room.height).toBe(config.ROOM_HEIGHT);
  });

  test('test_generateRoom_default_returnsExactlyFiveWalls', () => {
    const rm = new RoomManager(makeGameState(), makeConfig(), makeIo());

    const room = rm.generateRoom();

    expect(room.walls).toHaveLength(5);
  });

  test('test_generateRoom_default_returnsExactlyOneDoor', () => {
    const rm = new RoomManager(makeGameState(), makeConfig(), makeIo());

    const room = rm.generateRoom();

    expect(room.doors).toHaveLength(1);
  });

  test('test_generateRoom_default_doorIsInitiallyInactive', () => {
    const rm = new RoomManager(makeGameState(), makeConfig(), makeIo());

    const room = rm.generateRoom();

    expect(room.doors[0].active).toBe(false);
  });

  test('test_generateRoom_default_doorPositionedAtTopCenter', () => {
    const config = makeConfig();
    const rm = new RoomManager(makeGameState(), config, makeIo());

    const room = rm.generateRoom();
    const door = room.doors[0];
    const expectedDoorX = (config.ROOM_WIDTH - config.DOOR_WIDTH) / 2;

    expect(door.x).toBe(expectedDoorX);
    expect(door.y).toBe(0);
    expect(door.width).toBe(config.DOOR_WIDTH);
    expect(door.height).toBe(config.WALL_THICKNESS);
  });

  test('test_generateRoom_default_obstacleCountBetweenThreeAndSeven', () => {
    const rm = new RoomManager(makeGameState(), makeConfig(), makeIo());

    // Run multiple times to exercise RNG range
    for (let i = 0; i < 20; i++) {
      const room = rm.generateRoom();
      expect(room.obstacles.length).toBeGreaterThanOrEqual(3);
      expect(room.obstacles.length).toBeLessThanOrEqual(7);
    }
  });

  test('test_generateRoom_default_obstaclesHavePositiveSize', () => {
    const rm = new RoomManager(makeGameState(), makeConfig(), makeIo());

    const room = rm.generateRoom();

    for (const obs of room.obstacles) {
      expect(obs.width).toBeGreaterThan(0);
      expect(obs.height).toBeGreaterThan(0);
    }
  });

  test('test_generateRoom_default_obstaclesStayWithinSafeMargin', () => {
    const config = makeConfig();
    const rm = new RoomManager(makeGameState(), config, makeIo());
    const margin = config.WALL_THICKNESS + 60;

    for (let i = 0; i < 30; i++) {
      const room = rm.generateRoom();
      for (const obs of room.obstacles) {
        expect(obs.x).toBeGreaterThanOrEqual(margin);
        expect(obs.y).toBeGreaterThanOrEqual(margin);
        expect(obs.x + obs.width).toBeLessThanOrEqual(config.ROOM_WIDTH - margin);
        expect(obs.y + obs.height).toBeLessThanOrEqual(config.ROOM_HEIGHT - margin);
      }
    }
  });
});

// --- initializeRooms ---

describe('RoomManager.initializeRooms', () => {
  test('test_initializeRooms_default_generatesCorrectNumberOfRooms', () => {
    const config = makeConfig();
    const gameState = makeGameState();
    const rm = new RoomManager(gameState, config, makeIo());

    rm.initializeRooms();

    expect(gameState.rooms).toHaveLength(config.ROOMS_PER_RUN);
  });

  test('test_initializeRooms_default_setsCurrentRoomToZero', () => {
    const gameState = makeGameState();
    const rm = new RoomManager(gameState, makeConfig(), makeIo());

    rm.initializeRooms();

    expect(gameState.currentRoom).toBe(0);
  });

  test('test_initializeRooms_default_loadsFirstRoomWalls', () => {
    const gameState = makeGameState();
    const rm = new RoomManager(gameState, makeConfig(), makeIo());

    rm.initializeRooms();

    expect(gameState.walls.length).toBeGreaterThan(0);
  });

  test('test_initializeRooms_calledTwice_resetsRoomsArray', () => {
    const config = makeConfig();
    const gameState = makeGameState();
    const rm = new RoomManager(gameState, config, makeIo());

    rm.initializeRooms();
    rm.initializeRooms();

    expect(gameState.rooms).toHaveLength(config.ROOMS_PER_RUN);
  });
});

// --- loadRoom ---

describe('RoomManager.loadRoom', () => {
  const buildRmWithRooms = () => {
    const config = makeConfig();
    const gameState = makeGameState();
    const io = makeIo();
    const rm = new RoomManager(gameState, config, io);
    rm.initializeRooms();
    return { rm, gameState, io, config };
  };

  test('test_loadRoom_validIndex_setsCurrentRoom', () => {
    const { rm, gameState } = buildRmWithRooms();

    rm.loadRoom(1);

    expect(gameState.currentRoom).toBe(1);
  });

  test('test_loadRoom_validIndex_clearsZombies', () => {
    const { rm, gameState } = buildRmWithRooms();
    gameState.zombies = { z1: {}, z2: {} };

    rm.loadRoom(0);

    expect(gameState.zombies).toEqual({});
  });

  test('test_loadRoom_validIndex_resetsBossSpawned', () => {
    const { rm, gameState } = buildRmWithRooms();
    gameState.bossSpawned = true;

    rm.loadRoom(0);

    expect(gameState.bossSpawned).toBe(false);
  });

  test('test_loadRoom_validIndex_resetsZombiesKilledThisWave', () => {
    const { rm, gameState } = buildRmWithRooms();
    gameState.zombiesKilledThisWave = 42;

    rm.loadRoom(0);

    expect(gameState.zombiesKilledThisWave).toBe(0);
  });

  test('test_loadRoom_validIndex_emitsRoomChangedEvent', () => {
    const { rm, io, config } = buildRmWithRooms();

    rm.loadRoom(1);

    expect(io.emit).toHaveBeenCalledWith(
      'roomChanged',
      expect.objectContaining({
        roomIndex: 1,
        totalRooms: config.ROOMS_PER_RUN
      })
    );
  });

  test('test_loadRoom_validIndex_wallsContainRoomWallsAndObstacles', () => {
    const { rm, gameState } = buildRmWithRooms();

    rm.loadRoom(0);
    const room = gameState.rooms[0];

    expect(gameState.walls).toEqual([...room.walls, ...room.obstacles]);
  });

  test('test_loadRoom_negativeIndex_doesNotChangeCurrentRoom', () => {
    const { rm, gameState } = buildRmWithRooms();
    gameState.currentRoom = 0;

    rm.loadRoom(-1);

    expect(gameState.currentRoom).toBe(0);
  });

  test('test_loadRoom_outOfBoundsIndex_doesNotChangeCurrentRoom', () => {
    const { rm, gameState, config } = buildRmWithRooms();
    gameState.currentRoom = 0;

    rm.loadRoom(config.ROOMS_PER_RUN);

    expect(gameState.currentRoom).toBe(0);
  });

  test('test_loadRoom_outOfBoundsIndex_doesNotEmitEvent', () => {
    const { rm, io, config } = buildRmWithRooms();
    io.emit.mockClear();

    rm.loadRoom(config.ROOMS_PER_RUN + 99);

    expect(io.emit).not.toHaveBeenCalled();
  });
});

// --- checkWallCollision ---

describe('RoomManager.checkWallCollision', () => {
  const buildRmWithWalls = walls => {
    const gameState = { ...makeGameState(), walls };
    return new RoomManager(gameState, makeConfig(), makeIo());
  };

  test('test_checkWallCollision_entityInsideWall_returnsTrue', () => {
    const wall = { x: 0, y: 0, width: 100, height: 40 };
    const rm = buildRmWithWalls([wall]);

    const result = rm.checkWallCollision(50, 20, 10);

    expect(result).toBe(true);
  });

  test('test_checkWallCollision_entityFarFromWalls_returnsFalse', () => {
    const wall = { x: 0, y: 0, width: 100, height: 40 };
    const rm = buildRmWithWalls([wall]);

    const result = rm.checkWallCollision(500, 500, 10);

    expect(result).toBe(false);
  });

  test('test_checkWallCollision_noWalls_returnsFalse', () => {
    const rm = buildRmWithWalls([]);

    const result = rm.checkWallCollision(100, 100, 20);

    expect(result).toBe(false);
  });

  test('test_checkWallCollision_entityJustTouchingWallEdge_returnsTrue', () => {
    const wall = { x: 100, y: 100, width: 50, height: 50 };
    const rm = buildRmWithWalls([wall]);

    // Entity at x=80, size=21 => right edge at 101, overlaps wall at x=100
    const result = rm.checkWallCollision(80, 125, 21);

    expect(result).toBe(true);
  });

  test('test_checkWallCollision_entityJustOutsideWall_returnsFalse', () => {
    const wall = { x: 100, y: 100, width: 50, height: 50 };
    const rm = buildRmWithWalls([wall]);

    // Entity at x=79, size=20 => right edge at 99, does not reach wall at x=100
    const result = rm.checkWallCollision(79, 125, 20);

    expect(result).toBe(false);
  });
});

// --- getWallCollisionInfo ---

describe('RoomManager.getWallCollisionInfo', () => {
  const buildRmWithWalls = walls => {
    const gameState = { ...makeGameState(), walls };
    return new RoomManager(gameState, makeConfig(), makeIo());
  };

  test('test_getWallCollisionInfo_noCollision_returnsCollidingFalse', () => {
    const wall = { x: 0, y: 0, width: 50, height: 50 };
    const rm = buildRmWithWalls([wall]);

    const info = rm.getWallCollisionInfo(500, 500, 10);

    expect(info.colliding).toBe(false);
  });

  test('test_getWallCollisionInfo_noCollision_returnsZeroPush', () => {
    const wall = { x: 0, y: 0, width: 50, height: 50 };
    const rm = buildRmWithWalls([wall]);

    const info = rm.getWallCollisionInfo(500, 500, 10);

    expect(info.pushX).toBe(0);
    expect(info.pushY).toBe(0);
  });

  test('test_getWallCollisionInfo_collision_returnsCollidingTrue', () => {
    const wall = { x: 0, y: 0, width: 100, height: 100 };
    const rm = buildRmWithWalls([wall]);

    // Entity center just inside wall boundary
    const info = rm.getWallCollisionInfo(5, 5, 20);

    expect(info.colliding).toBe(true);
  });

  test('test_getWallCollisionInfo_collision_wallCountIsOne', () => {
    const wall = { x: 0, y: 0, width: 100, height: 100 };
    const rm = buildRmWithWalls([wall]);

    const info = rm.getWallCollisionInfo(5, 5, 20);

    expect(info.wallCount).toBe(1);
  });

  test('test_getWallCollisionInfo_noWalls_returnsZeroWallCount', () => {
    const rm = buildRmWithWalls([]);

    const info = rm.getWallCollisionInfo(100, 100, 20);

    expect(info.wallCount).toBe(0);
  });

  test('test_getWallCollisionInfo_twoCollisions_wallCountIsTwo', () => {
    const walls = [
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 0, y: 0, width: 100, height: 100 } // same position, two separate walls
    ];
    const rm = buildRmWithWalls(walls);

    const info = rm.getWallCollisionInfo(5, 5, 20);

    expect(info.wallCount).toBe(2);
  });
});
