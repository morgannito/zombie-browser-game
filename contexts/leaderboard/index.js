/**
 * @fileoverview Leaderboard bounded context — public facade.
 * @description Score submission + leaderboard read use cases. Note: the
 *   client-side leaderboardSystem.js mirror still lives under public/ and
 *   will be migrated in Phase 4 (client mirror).
 */

const SubmitScoreUseCase = require('./SubmitScoreUseCase');
const GetLeaderboardUseCase = require('./GetLeaderboardUseCase');

module.exports = { SubmitScoreUseCase, GetLeaderboardUseCase };
