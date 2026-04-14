const config = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'lib/**/*.js',
    'game/**/*.js',
    '!lib/**/*.test.js',
    '!game/**/*.test.js',
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
    }
  };
}

module.exports = config;
