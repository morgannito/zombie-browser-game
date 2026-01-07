/**
 * GAME SESSION ENTITY TESTS - Unit tests for domain logic
 * TDD approach: Tests session lifecycle, recovery, state management
 */

const GameSession = require('../../domain/entities/GameSession');

describe('GameSession Entity - Domain Logic', () => {
  describe('Constructor', () => {
    it('should create session with required fields', () => {
      const session = new GameSession({
        sessionId: 'test-session',
        playerId: 'player-123'
      });

      expect(session.sessionId).toBe('test-session');
      expect(session.playerId).toBe('player-123');
      expect(session.socketId).toBeNull();
      expect(session.state).toBeNull();
      expect(session.disconnectedAt).toBeNull();
    });

    it('should create session with socket and state', () => {
      const gameState = { wave: 5, level: 10 };
      const session = new GameSession({
        sessionId: 'test-session',
        playerId: 'player-123',
        socketId: 'socket-abc',
        state: gameState
      });

      expect(session.socketId).toBe('socket-abc');
      expect(session.state).toEqual(gameState);
    });

    it('should set timestamps on creation', () => {
      const before = Date.now();
      const session = new GameSession({
        sessionId: 'test-session',
        playerId: 'player-123'
      });
      const after = Date.now();

      expect(session.createdAt).toBeGreaterThanOrEqual(before);
      expect(session.createdAt).toBeLessThanOrEqual(after);
      expect(session.updatedAt).toBeGreaterThanOrEqual(before);
      expect(session.updatedAt).toBeLessThanOrEqual(after);
    });
  });

  describe('disconnect()', () => {
    it('should set disconnectedAt timestamp', () => {
      const session = new GameSession({
        sessionId: 'test-session',
        playerId: 'player-123',
        socketId: 'socket-abc'
      });

      const before = Date.now();
      session.disconnect();
      const after = Date.now();

      expect(session.disconnectedAt).toBeGreaterThanOrEqual(before);
      expect(session.disconnectedAt).toBeLessThanOrEqual(after);
    });

    it('should update updatedAt timestamp', () => {
      const session = new GameSession({
        sessionId: 'test-session',
        playerId: 'player-123',
        updatedAt: 1000000
      });

      session.disconnect();

      expect(session.updatedAt).toBeGreaterThan(1000000);
    });

    it('should NOT clear socketId', () => {
      const session = new GameSession({
        sessionId: 'test-session',
        playerId: 'player-123',
        socketId: 'socket-abc'
      });

      session.disconnect();

      expect(session.socketId).toBe('socket-abc');
    });
  });

  describe('reconnect()', () => {
    it('should update socketId', () => {
      const session = new GameSession({
        sessionId: 'test-session',
        playerId: 'player-123',
        socketId: 'old-socket',
        disconnectedAt: Date.now()
      });

      session.reconnect('new-socket');

      expect(session.socketId).toBe('new-socket');
    });

    it('should clear disconnectedAt', () => {
      const session = new GameSession({
        sessionId: 'test-session',
        playerId: 'player-123',
        disconnectedAt: Date.now()
      });

      session.reconnect('new-socket');

      expect(session.disconnectedAt).toBeNull();
    });

    it('should update updatedAt timestamp', () => {
      const session = new GameSession({
        sessionId: 'test-session',
        playerId: 'player-123',
        updatedAt: 1000000
      });

      session.reconnect('new-socket');

      expect(session.updatedAt).toBeGreaterThan(1000000);
    });
  });

  describe('updateState()', () => {
    it('should update state object', () => {
      const session = new GameSession({
        sessionId: 'test-session',
        playerId: 'player-123',
        state: { wave: 1 }
      });

      const newState = { wave: 5, level: 10, kills: 50 };
      session.updateState(newState);

      expect(session.state).toEqual(newState);
    });

    it('should update updatedAt timestamp', () => {
      const session = new GameSession({
        sessionId: 'test-session',
        playerId: 'player-123',
        updatedAt: 1000000
      });

      session.updateState({ wave: 5 });

      expect(session.updatedAt).toBeGreaterThan(1000000);
    });

    it('should handle null state', () => {
      const session = new GameSession({
        sessionId: 'test-session',
        playerId: 'player-123',
        state: { wave: 5 }
      });

      session.updateState(null);

      expect(session.state).toBeNull();
    });
  });

  describe('isActive()', () => {
    it('should return true when connected with socket', () => {
      const session = new GameSession({
        sessionId: 'test-session',
        playerId: 'player-123',
        socketId: 'socket-abc',
        disconnectedAt: null
      });

      expect(session.isActive()).toBe(true);
    });

    it('should return false when disconnected', () => {
      const session = new GameSession({
        sessionId: 'test-session',
        playerId: 'player-123',
        socketId: 'socket-abc'
      });

      session.disconnect();

      expect(session.isActive()).toBe(false);
    });

    it('should return false when socketId is null', () => {
      const session = new GameSession({
        sessionId: 'test-session',
        playerId: 'player-123',
        socketId: null,
        disconnectedAt: null
      });

      expect(session.isActive()).toBe(false);
    });

    it('should return false when both conditions fail', () => {
      const session = new GameSession({
        sessionId: 'test-session',
        playerId: 'player-123',
        socketId: null,
        disconnectedAt: Date.now()
      });

      expect(session.isActive()).toBe(false);
    });
  });

  describe('isRecoverable()', () => {
    it('should return true when disconnected within timeout', () => {
      const session = new GameSession({
        sessionId: 'test-session',
        playerId: 'player-123',
        disconnectedAt: Date.now() - 60000 // 1 minute ago
      });

      expect(session.isRecoverable(120000)).toBe(true); // 2 minute timeout
    });

    it('should return false when disconnected beyond timeout', () => {
      const session = new GameSession({
        sessionId: 'test-session',
        playerId: 'player-123',
        disconnectedAt: Date.now() - 400000 // 400 seconds ago
      });

      expect(session.isRecoverable(300000)).toBe(false); // 5 minute timeout
    });

    it('should return false when not disconnected', () => {
      const session = new GameSession({
        sessionId: 'test-session',
        playerId: 'player-123',
        disconnectedAt: null
      });

      expect(session.isRecoverable()).toBe(false);
    });

    it('should use default timeout of 5 minutes', () => {
      const session = new GameSession({
        sessionId: 'test-session',
        playerId: 'player-123',
        disconnectedAt: Date.now() - 60000 // 1 minute ago
      });

      expect(session.isRecoverable()).toBe(true);
    });

    it('should return false when exactly at timeout', () => {
      const timeout = 300000;
      const session = new GameSession({
        sessionId: 'test-session',
        playerId: 'player-123',
        disconnectedAt: Date.now() - timeout
      });

      expect(session.isRecoverable(timeout)).toBe(false);
    });
  });

  describe('getDisconnectedDuration()', () => {
    it('should return 0 when not disconnected', () => {
      const session = new GameSession({
        sessionId: 'test-session',
        playerId: 'player-123',
        disconnectedAt: null
      });

      expect(session.getDisconnectedDuration()).toBe(0);
    });

    it('should return duration in seconds', () => {
      const session = new GameSession({
        sessionId: 'test-session',
        playerId: 'player-123',
        disconnectedAt: Date.now() - 5000 // 5 seconds ago
      });

      const duration = session.getDisconnectedDuration();

      expect(duration).toBeGreaterThanOrEqual(4);
      expect(duration).toBeLessThanOrEqual(6);
    });

    it('should floor decimal values', () => {
      const session = new GameSession({
        sessionId: 'test-session',
        playerId: 'player-123',
        disconnectedAt: Date.now() - 1500 // 1.5 seconds ago
      });

      expect(session.getDisconnectedDuration()).toBe(1);
    });
  });

  describe('toObject()', () => {
    it('should serialize all fields correctly', () => {
      const session = new GameSession({
        sessionId: 'test-session',
        playerId: 'player-123',
        socketId: 'socket-abc',
        state: { wave: 5 },
        createdAt: 1000000,
        updatedAt: 2000000,
        disconnectedAt: 3000000
      });

      const obj = session.toObject();

      expect(obj).toEqual({
        sessionId: 'test-session',
        playerId: 'player-123',
        socketId: 'socket-abc',
        state: { wave: 5 },
        createdAt: 1000000,
        updatedAt: 2000000,
        disconnectedAt: 3000000
      });
    });

    it('should be JSON serializable', () => {
      const session = new GameSession({
        sessionId: 'test-session',
        playerId: 'player-123'
      });

      expect(() => JSON.stringify(session.toObject())).not.toThrow();
    });

    it('should handle null values', () => {
      const session = new GameSession({
        sessionId: 'test-session',
        playerId: 'player-123'
      });

      const obj = session.toObject();

      expect(obj.socketId).toBeNull();
      expect(obj.state).toBeNull();
      expect(obj.disconnectedAt).toBeNull();
    });
  });

  describe('fromDB()', () => {
    it('should create GameSession from database row', () => {
      const dbRow = {
        session_id: 'db-session',
        player_id: 'player-456',
        socket_id: 'socket-xyz',
        state: '{"wave":10,"level":20}',
        created_at: 1000, // SQLite timestamp in seconds
        updated_at: 2000,
        disconnected_at: null
      };

      const session = GameSession.fromDB(dbRow);

      expect(session.sessionId).toBe('db-session');
      expect(session.playerId).toBe('player-456');
      expect(session.socketId).toBe('socket-xyz');
      expect(session.state).toEqual({ wave: 10, level: 20 });
      expect(session.createdAt).toBe(1000000); // Converted to ms
      expect(session.updatedAt).toBe(2000000);
      expect(session.disconnectedAt).toBeNull();
    });

    it('should handle null state', () => {
      const dbRow = {
        session_id: 'db-session',
        player_id: 'player-456',
        socket_id: 'socket-xyz',
        state: null,
        created_at: 1000,
        updated_at: 2000,
        disconnected_at: null
      };

      const session = GameSession.fromDB(dbRow);

      expect(session.state).toBeNull();
    });

    it('should convert disconnectedAt timestamp', () => {
      const dbRow = {
        session_id: 'db-session',
        player_id: 'player-456',
        socket_id: null,
        state: null,
        created_at: 1000,
        updated_at: 2000,
        disconnected_at: 3000 // SQLite timestamp in seconds
      };

      const session = GameSession.fromDB(dbRow);

      expect(session.disconnectedAt).toBe(3000000); // Converted to ms
    });

    it('should parse complex state JSON', () => {
      const dbRow = {
        session_id: 'db-session',
        player_id: 'player-456',
        socket_id: 'socket-xyz',
        state: '{"wave":50,"level":99,"kills":1000,"gold":5000,"powerups":["speed","damage"]}',
        created_at: 1000,
        updated_at: 2000,
        disconnected_at: null
      };

      const session = GameSession.fromDB(dbRow);

      expect(session.state).toEqual({
        wave: 50,
        level: 99,
        kills: 1000,
        gold: 5000,
        powerups: ['speed', 'damage']
      });
    });
  });
});
