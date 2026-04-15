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
  testPathIgnorePatterns: ['/node_modules/', '__tests__/integration/testServerFactory\\.js', '/e2e/'],
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
    './contexts/leaderboard/': { lines: 50, statements: 50, functions: 35, branches: 40 },
    './contexts/session/':     { lines: 30, statements: 30, functions: 30, branches: 20 },
    './contexts/wave/':        { lines: 20, statements: 20, functions: 15, branches: 5 },
    './contexts/zombie/':      { lines: 30, statements: 30, functions: 45, branches: 25 },
    './contexts/weapons/':     { lines: 4,  statements: 4,  functions: 3,  branches: 0 },
    './contexts/player/':      { lines: 5,  statements: 5,  functions: 5,  branches: 1 }
  };
}

module.exports = config;
