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
    './contexts/leaderboard/': { lines: 85, statements: 85, functions: 95, branches: 90 },
    './contexts/session/':     { lines: 85, statements: 85, functions: 95, branches: 70 },
    './contexts/wave/':        { lines: 85, statements: 85, functions: 90, branches: 75 },
    './contexts/zombie/':      { lines: 80, statements: 80, functions: 80, branches: 65 },
    './contexts/weapons/':     { lines: 70, statements: 70, functions: 80, branches: 65 },
    './contexts/player/':      { lines: 70, statements: 70, functions: 65, branches: 60 },
    './server/':               { lines: 65, statements: 65, functions: 60, branches: 50 }
  };
}

module.exports = config;
