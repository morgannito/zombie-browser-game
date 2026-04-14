/**
 * ESLint Configuration (Flat Config - ESLint 9+)
 * SSS Quality: Code style uniformity enforcement
 */

const js = require('@eslint/js');

module.exports = [
  // Recommended base config
  js.configs.recommended,

  // Global ignores
  {
    ignores: ['node_modules/**', 'data/**', 'uploads/**', 'dist/**', '**/*.min.js']
  },

  // Server-side JavaScript (Node.js)
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'commonjs',
      globals: {
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        require: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly'
      }
    },
    rules: {
      // indent: disabled — prettier is the source of truth for indentation
      // and they disagree on nested array/object spreads.
      indent: 'off',
      'linebreak-style': ['error', 'unix'],
      quotes: ['error', 'single', { avoidEscape: true }],
      semi: ['error', 'always'],
      'no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }
      ],
      'no-console': 'off',
      'no-var': 'error',
      'prefer-const': 'error',
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],
      complexity: ['warn', { max: 10 }],
      'max-lines-per-function': ['warn', { max: 25, skipBlankLines: true, skipComments: true }],
      'brace-style': ['error', '1tbs'],
      'comma-dangle': ['error', 'never'],
      'no-trailing-spaces': 'error',
      'max-len': ['warn', { code: 220, ignoreComments: true }],
      'no-multiple-empty-lines': ['error', { max: 2 }],
      'space-before-blocks': 'error',
      'keyword-spacing': 'error',
      'arrow-spacing': 'error'
    }
  },

  // Client-side JavaScript (Browser)
  {
    files: ['public/**/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'script',
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        performance: 'readonly',
        CustomEvent: 'readonly',
        io: 'readonly',
        socket: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        fetch: 'readonly',
        AbortController: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        prompt: 'readonly',
        console: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        Image: 'readonly',
        Audio: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        OffscreenCanvas: 'readonly',
        HTMLCanvasElement: 'readonly',
        CanvasRenderingContext2D: 'readonly',
        MutationObserver: 'readonly',
        KeyboardEvent: 'readonly',
        Event: 'readonly',
        Gamepad: 'readonly',
        getComputedStyle: 'readonly',
        queueMicrotask: 'readonly',
        URL: 'readonly',
        CONSTANTS: 'readonly',
        MathUtils: 'readonly',
        AssetManager: 'readonly',
        ProfessionalAssetGenerator: 'readonly',
        DemoAssetGenerator: 'readonly',
        ToastManager: 'readonly',
        GameEngine: 'readonly',
        GameStateManager: 'readonly',
        SessionManager: 'readonly',
        PerformanceSettingsManager: 'readonly',
        InputManager: 'readonly',
        CameraManager: 'readonly',
        NetworkManager: 'readonly',
        UIManager: 'readonly',
        AccountProgressionManager: 'readonly',
        AdvancedAudioManager: 'readonly',
        AudioManager: 'readonly',
        OptimizedSoundEffects: 'readonly',
        WeaponAudioSystem: 'readonly',
        ComboSystem: 'readonly',
        LeaderboardSystem: 'readonly',
        AdvancedEffectsManager: 'readonly',
        SkinManager: 'readonly',
        EnhancedUIManager: 'readonly',
        ScreenEffectsManager: 'readonly',
        ParallaxBackground: 'readonly',
        StaticPropsSystem: 'readonly',
        DynamicPropsSystem: 'readonly',
        MobileControlsManager: 'readonly',
        PlayerController: 'readonly',
        Renderer: 'readonly',
        NicknameManager: 'readonly',
        initInstructionsToggle: 'readonly',
        initMinimapToggle: 'readonly',
        initCameraRecenter: 'readonly',
        logger: 'readonly',
        storageManager: 'readonly'
      }
    },
    rules: {
      'no-redeclare': 'off'
    }
  },

  // Test files (Jest)
  {
    files: ['**/__tests__/**/*.js', '**/*.test.js'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        test: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly',
        URL: 'readonly',
        window: 'readonly',
        document: 'readonly'
      }
    }
  },

  // Playwright E2E (e2e/**/*.spec.js)
  {
    files: ['e2e/**/*.js'],
    languageOptions: {
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        URL: 'readonly'
      }
    }
  }
];
