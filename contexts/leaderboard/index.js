/**
 * @fileoverview Leaderboard bounded context — public facade.
 * @description Score submission + leaderboard read use cases. Client mirror:
 *   public/modules/systems/LeaderboardSystem.js.
 */

const SubmitScoreUseCase = require('./SubmitScoreUseCase');
const GetLeaderboardUseCase = require('./GetLeaderboardUseCase');

module.exports = { SubmitScoreUseCase, GetLeaderboardUseCase };
