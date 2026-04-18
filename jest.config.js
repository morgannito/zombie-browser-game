const config = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'lib/**/*.js',
    'game/**/*.js',
    'contexts/**/*.js',
    'server/**/*.js',
    'transport/**/*.js',
    'infrastructure/**/*.js',
    '!**/*.test.js',
    '!**/__tests__/**',
    '!contexts/**/index.js',
    '!**/node_modules/**'
  ],
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
  // TODO: BossAbilities.test.js triggers RangeError (source-map/jest-mock stack overflow) on jest 29.7 — re-enable after jest 30 upgrade
  testPathIgnorePatterns: ['/node_modules/', '__tests__/integration/testServerFactory\\.js', '/e2e/', 'contexts/zombie/modules/__tests__/BossAbilities\\.test\\.js'],
  verbose: true
};

if (process.env.CI) {
  config.coverageThreshold = {
    global: {
      branches: 7,
      functions: 10,
      lines: 10,
      statements: 10
    },
    // Per-context floors — see ADR 0001. These are realistic baselines based
    // on the current state, with a 70% aspirational target tracked in
    // REFACTOR_PLAN.md (Phase 6). Raise these as more tests land.
    './contexts/leaderboard/': { lines: 95, statements: 95, functions: 100, branches: 95 },
    './contexts/session/':     { lines: 93, statements: 93, functions: 100, branches: 75 },
    './contexts/wave/':        { lines: 92, statements: 92, functions: 95, branches: 85 },
    './contexts/zombie/':      { lines: 88, statements: 88, functions: 78, branches: 78 },
    './contexts/weapons/':     { lines: 82, statements: 82, functions: 88, branches: 75 },
    './contexts/player/':      { lines: 86, statements: 86, functions: 82, branches: 80 },
    './server/':               { lines: 85, statements: 85, functions: 80, branches: 70 }
  };
}

module.exports = config;
