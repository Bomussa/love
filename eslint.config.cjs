const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/.next/**',
      '**/frontend/src/assets/**',
      '**/frontend/public/**',
      '**/frontend/src/_archived/**',
      '**/*.min.js',
      'frontend/src/lib/supabase-client.js'
    ]
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    rules: {
      'no-async-promise-executor': 'warn',
      'no-shadow': 'off',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'consistent-return': 'warn',
      'no-console': 'off',
      'no-undef': 'warn',
      'no-empty': 'warn',
      'no-useless-catch': 'warn',
      'no-dupe-keys': 'warn',
      'preserve-caught-error': 'warn'
    }
  }
];
