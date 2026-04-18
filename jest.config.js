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
    './contexts/leaderboard/': { lines: 94, statements: 94, functions: 100, branches: 84 },
    './contexts/session/':     { lines: 93, statements: 93, functions: 100, branches: 75 },
    './contexts/wave/':        { lines: 92, statements: 92, functions: 95, branches: 81 },
    './contexts/zombie/':      { lines: 87, statements: 87, functions: 78, branches: 77 },
    './contexts/weapons/':     { lines: 80, statements: 80, functions: 88, branches: 75 },
    './contexts/player/':      { lines: 86, statements: 86, functions: 82, branches: 80 },
    './server/':               { lines: 76, statements: 76, functions: 73, branches: 58 }
  };
}

module.exports = config;
