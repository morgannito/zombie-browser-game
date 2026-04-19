const {
  createPlayerState,
  resolvePlayerSpawnPosition
} = require('../../../contexts/session/playerStateFactory');

describe('playerStateFactory', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('creates player state with expected identity and defaults', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1234567890);
    jest.spyOn(Math, 'random').mockReturnValue(0.5);

    const config = {
      ROOM_WIDTH: 3000,
      ROOM_HEIGHT: 2400,
      WALL_THICKNESS: 40,
      PLAYER_SIZE: 20,
      PLAYER_MAX_HEALTH: 100
    };

    const player = createPlayerState(config, 'socket-a', 'session-a', 'account-a');

    expect(player.id).toBe('socket-a');
    expect(player.socketId).toBe('socket-a');
    expect(player.sessionId).toBe('session-a');
    expect(player.accountId).toBe('account-a');
    expect(player.weapon).toBe('pistol');
    expect(player.level).toBe(1);
    expect(player.maxHealth).toBe(100);
    expect(player.health).toBe(100);
    expect(player.lastActivityTime).toBe(1234567890);
    expect(player.survivalTime).toBe(1234567890);
    expect(player.lastRegenTick).toBe(1234567890);
    expect(player.lastAutoShot).toBe(1234567890);
  });

  test('keeps spawn coordinates inside configured bounds', () => {
    jest
      .spyOn(Math, 'random')
      .mockReturnValueOnce(0) // x offset min
      .mockReturnValueOnce(0.999); // y offset max-ish

    const config = {
      ROOM_WIDTH: 3000,
      ROOM_HEIGHT: 2400,
      WALL_THICKNESS: 40,
      PLAYER_SIZE: 20,
      PLAYER_MAX_HEALTH: 100
    };

    const player = createPlayerState(config, 'socket-b');
    const minX = 60;
    const maxX = 2940;
    const minY = 60;
    const maxY = 2340;

    expect(player.x).toBeGreaterThanOrEqual(minX);
    expect(player.x).toBeLessThanOrEqual(maxX);
    expect(player.y).toBeGreaterThanOrEqual(minY);
    expect(player.y).toBeLessThanOrEqual(maxY);
  });

  test('clamps spawn for restrictive room configs', () => {
    jest
      .spyOn(Math, 'random')
      .mockReturnValueOnce(0.999) // push x near upper bound
      .mockReturnValueOnce(0.999); // push y below lower bound via formula

    const config = {
      ROOM_WIDTH: 120,
      ROOM_HEIGHT: 160,
      WALL_THICKNESS: 40,
      PLAYER_SIZE: 20,
      PLAYER_MAX_HEALTH: 100
    };

    const player = createPlayerState(config, 'socket-c');
    expect(player.x).toBe(60);
    expect(player.y).toBe(60);
  });

  test('chooses a spawn away from an existing zombie cluster when gameState is provided', () => {
    const config = {
      ROOM_WIDTH: 3000,
      ROOM_HEIGHT: 2400,
      WALL_THICKNESS: 40,
      PLAYER_SIZE: 20,
      PLAYER_MAX_HEALTH: 100
    };
    const gameState = {
      zombies: {
        z1: { x: 1500, y: 2240, health: 100 },
        z2: { x: 1460, y: 2200, health: 100 },
        z3: { x: 1540, y: 2200, health: 100 }
      },
      walls: []
    };

    const spawn = resolvePlayerSpawnPosition(config, gameState);
    const nearestDist = Math.min(
      ...Object.values(gameState.zombies).map(z => Math.hypot(z.x - spawn.x, z.y - spawn.y))
    );

    expect(nearestDist).toBeGreaterThan(300);
    expect(spawn.y).toBeLessThan(1000);
  });
});
