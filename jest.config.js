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
    './contexts/zombie/':      { lines: 72, statements: 72, functions: 74, branches: 60 },
    './contexts/weapons/':     { lines: 62, statements: 62, functions: 66, branches: 52 },
    './contexts/player/':      { lines: 70, statements: 70, functions: 65, branches: 60 },
    './server/':               { lines: 85, statements: 85, functions: 80, branches: 70 }
  };
}

module.exports = config;
