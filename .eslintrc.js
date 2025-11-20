module.exports = {
  env: {
    node: true,
    es2021: true,
    browser: false
  },
  extends: [
    'eslint:recommended',
    'plugin:prettier/recommended'
  ],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'commonjs'
  },
  rules: {
    // Error handling
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

    // Code quality
    'prefer-const': 'error',
    'no-var': 'error',
    'eqeqeq': ['error', 'always', { null: 'ignore' }],
    'curly': ['error', 'all'],
    'no-throw-literal': 'error',

    // Best practices
    'require-atomic-updates': 'error',
    'no-async-promise-executor': 'error',
    'no-await-in-loop': 'warn',

    // Async/await
    'prefer-promise-reject-errors': 'error',

    // Prettier integration
    'prettier/prettier': ['error', {
      singleQuote: true,
      semi: true,
      trailingComma: 'none',
      printWidth: 100,
      tabWidth: 2,
      useTabs: false
    }]
  },
  overrides: [
    {
      // Client-side JavaScript files
      files: ['public/**/*.js'],
      env: {
        browser: true,
        node: false
      },
      globals: {
        io: 'readonly'
      }
    }
  ]
};
