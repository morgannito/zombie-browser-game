/**
 * @fileoverview Session bounded context — public facade.
 * @description Player session recovery, snapshotting, factory.
 */

const sessionRecovery = require('./sessionRecovery');
const { createPlayerState } = require('./playerStateFactory');

module.exports = { ...sessionRecovery, createPlayerState };
