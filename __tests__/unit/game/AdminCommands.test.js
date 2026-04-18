'use strict';

const AdminCommands = require('../../../game/modules/admin/AdminCommands');

function makeSocket(userId, emitMock) {
  return { userId, emit: emitMock || jest.fn(), on: jest.fn() };
}

describe('AdminCommands', () => {
  beforeEach(() => {
 delete process.env.ADMIN_USER_IDS;
});

  test('isAdmin returns false when no env var set', () => {
    const ac = new AdminCommands({}, {}, null);
    expect(ac.isAdmin('anyone')).toBe(false);
  });

  test('isAdmin returns true for configured admin', () => {
    process.env.ADMIN_USER_IDS = 'uuid-1,uuid-2';
    const ac = new AdminCommands({}, {}, null);
    expect(ac.isAdmin('uuid-1')).toBe(true);
    expect(ac.isAdmin('uuid-3')).toBe(false);
  });

  test('handleCommand rejects non-admin with not authorized message', () => {
    const ac = new AdminCommands({}, {}, null);
    const emit = jest.fn();
    const socket = makeSocket('stranger', emit);
    ac.handleCommand(socket, { command: 'stats', args: [] });
    expect(emit).toHaveBeenCalledWith('adminResponse', expect.objectContaining({ success: false }));
  });

  test('handleCommand handles null/invalid data gracefully', () => {
    const ac = new AdminCommands({}, {}, null);
    const socket = makeSocket('x', jest.fn());
    expect(() => ac.handleCommand(socket, null)).not.toThrow();
    expect(() => ac.handleCommand(socket, 'string')).not.toThrow();
  });

  test('handleCommand emits unknown command for unrecognized command', () => {
    process.env.ADMIN_USER_IDS = 'admin-1';
    const ac = new AdminCommands({ to: jest.fn(() => ({ emit: jest.fn() })) }, {}, null);
    const emit = jest.fn();
    const socket = makeSocket('admin-1', emit);
    ac.handleCommand(socket, { command: 'unknown_xyz', args: [] });
    expect(emit).toHaveBeenCalledWith('adminResponse', expect.objectContaining({ success: false, message: expect.stringContaining('Unknown command') }));
  });
});
