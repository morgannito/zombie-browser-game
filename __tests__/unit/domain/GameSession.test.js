/**
 * GAME SESSION ENTITY - Unit Tests
 * Tests session lifecycle: creation, disconnect, reconnect, recovery
 */

const GameSession = require('../../../lib/domain/entities/GameSession');

describe('GameSession Entity', () => {
  const baseSessionData = {
    sessionId: 'sess-001',
    playerId: 'player-001',
    socketId: 'socket-abc',
    state: { wave: 3, health: 80 }
  };

  describe('constructor', () => {
    it('should create a session with valid data', () => {
      const session = new GameSession(baseSessionData);

      expect(session.sessionId).toBe('sess-001');
      expect(session.playerId).toBe('player-001');
      expect(session.socketId).toBe('socket-abc');
      expect(session.state).toEqual({ wave: 3, health: 80 });
      expect(session.disconnectedAt).toBeNull();
    });

    it('should set default values for optional fields', () => {
      const session = new GameSession({
        sessionId: 'sess-min',
        playerId: 'player-min'
      });

      expect(session.socketId).toBeNull();
      expect(session.state).toBeNull();
      expect(session.disconnectedAt).toBeNull();
      expect(session.createdAt).toBeDefined();
      expect(session.updatedAt).toBeDefined();
    });
  });

  describe('disconnect', () => {
    it('should set disconnectedAt timestamp', () => {
      const session = new GameSession(baseSessionData);
      const beforeDisconnect = Date.now();

      session.disconnect();

      expect(session.disconnectedAt).toBeGreaterThanOrEqual(beforeDisconnect);
      expect(session.disconnectedAt).toBeLessThanOrEqual(Date.now());
    });

    it('should update the updatedAt timestamp', () => {
      const session = new GameSession({
        ...baseSessionData,
        updatedAt: 1000
      });

      session.disconnect();

      expect(session.updatedAt).toBeGreaterThan(1000);
    });
  });

  describe('reconnect', () => {
    it('should assign a new socketId', () => {
      const session = new GameSession(baseSessionData);
      session.disconnect();

      session.reconnect('socket-new');

      expect(session.socketId).toBe('socket-new');
    });

    it('should clear disconnectedAt', () => {
      const session = new GameSession(baseSessionData);
      session.disconnect();
      expect(session.disconnectedAt).not.toBeNull();

      session.reconnect('socket-new');

      expect(session.disconnectedAt).toBeNull();
    });

    it('should update updatedAt timestamp', () => {
      const session = new GameSession({
        ...baseSessionData,
        updatedAt: 1000
      });
      session.disconnect();

      session.reconnect('socket-new');

      expect(session.updatedAt).toBeGreaterThan(1000);
    });
  });

  describe('isActive', () => {
    it('should return true for a connected session', () => {
      const session = new GameSession(baseSessionData);

      expect(session.isActive()).toBe(true);
    });

    it('should return false after disconnect', () => {
      const session = new GameSession(baseSessionData);
      session.disconnect();

      expect(session.isActive()).toBe(false);
    });

    it('should return false when socketId is null', () => {
      const session = new GameSession({
        sessionId: 'sess-1',
        playerId: 'p-1',
        socketId: null
      });

      expect(session.isActive()).toBe(false);
    });

    it('should return true after reconnect', () => {
      const session = new GameSession(baseSessionData);
      session.disconnect();
      session.reconnect('socket-new');

      expect(session.isActive()).toBe(true);
    });
  });

  describe('isRecoverable', () => {
    it('should return false if session was never disconnected', () => {
      const session = new GameSession(baseSessionData);

      expect(session.isRecoverable()).toBe(false);
    });

    it('should return true if disconnected within timeout', () => {
      const session = new GameSession(baseSessionData);
      session.disconnectedAt = Date.now() - 1000; // 1 second ago

      expect(session.isRecoverable(300000)).toBe(true);
    });

    it('should return false if disconnected beyond timeout', () => {
      const session = new GameSession(baseSessionData);
      session.disconnectedAt = Date.now() - 400000; // 400 seconds ago

      expect(session.isRecoverable(300000)).toBe(false);
    });

    it('should respect custom timeout values', () => {
      const session = new GameSession(baseSessionData);
      session.disconnectedAt = Date.now() - 5000; // 5 seconds ago

      expect(session.isRecoverable(10000)).toBe(true); // 10s timeout
      expect(session.isRecoverable(3000)).toBe(false); // 3s timeout
    });

    it('should use default 300000ms timeout', () => {
      const session = new GameSession(baseSessionData);
      session.disconnectedAt = Date.now() - 200000; // 200 seconds ago

      expect(session.isRecoverable()).toBe(true);
    });
  });

  describe('updateState', () => {
    it('should update the session state', () => {
      const session = new GameSession(baseSessionData);
      const newState = { wave: 5, health: 50, score: 1200 };

      session.updateState(newState);

      expect(session.state).toEqual(newState);
    });

    it('should update the updatedAt timestamp', () => {
      const session = new GameSession({
        ...baseSessionData,
        updatedAt: 1000
      });

      session.updateState({ wave: 10 });

      expect(session.updatedAt).toBeGreaterThan(1000);
    });
  });

  describe('getDisconnectedDuration', () => {
    it('should return 0 if not disconnected', () => {
      const session = new GameSession(baseSessionData);

      expect(session.getDisconnectedDuration()).toBe(0);
    });

    it('should return duration in seconds since disconnection', () => {
      const session = new GameSession(baseSessionData);
      session.disconnectedAt = Date.now() - 10000; // 10 seconds ago

      const duration = session.getDisconnectedDuration();

      expect(duration).toBeGreaterThanOrEqual(9);
      expect(duration).toBeLessThanOrEqual(11);
    });
  });

  describe('fromDB', () => {
    it('should reconstruct a GameSession from a database row', () => {
      const dbRow = {
        session_id: 'db-sess-1',
        player_id: 'db-player-1',
        socket_id: 'db-socket-1',
        state: JSON.stringify({ wave: 7 }),
        created_at: 1700000000,
        updated_at: 1700001000,
        disconnected_at: null
      };

      const session = GameSession.fromDB(dbRow);

      expect(session.sessionId).toBe('db-sess-1');
      expect(session.playerId).toBe('db-player-1');
      expect(session.socketId).toBe('db-socket-1');
      expect(session.state).toEqual({ wave: 7 });
      expect(session.createdAt).toBe(1700000000 * 1000);
      expect(session.updatedAt).toBe(1700001000 * 1000);
      expect(session.disconnectedAt).toBeNull();
    });

    it('should handle disconnected_at from DB', () => {
      const dbRow = {
        session_id: 'db-sess-2',
        player_id: 'db-player-2',
        socket_id: null,
        state: null,
        created_at: 1700000000,
        updated_at: 1700002000,
        disconnected_at: 1700001500
      };

      const session = GameSession.fromDB(dbRow);

      expect(session.disconnectedAt).toBe(1700001500 * 1000);
      expect(session.state).toBeNull();
    });
  });

  describe('toObject', () => {
    it('should return a plain object with all fields', () => {
      const session = new GameSession({
        ...baseSessionData,
        createdAt: 1000,
        updatedAt: 2000,
        disconnectedAt: null
      });

      expect(session.toObject()).toEqual({
        sessionId: 'sess-001',
        playerId: 'player-001',
        socketId: 'socket-abc',
        state: { wave: 3, health: 80 },
        createdAt: 1000,
        updatedAt: 2000,
        disconnectedAt: null
      });
    });
  });
});
