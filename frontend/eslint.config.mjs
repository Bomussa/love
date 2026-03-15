import js from '@eslint/js';
import globals from 'globals';
import reactPlugin from 'eslint-plugin-react';

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'public/**',
      'coverage/**',
      '*.config.js',
      'src/assets/**',
      'src/_archived/**',
      'src/lib/routingManager.js'
    ]
  },
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true }
      },
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    plugins: {
      react: reactPlugin
    },
    settings: {
      react: { version: 'detect' }
    },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'off',
'no-empty': 'off',
      'no-case-declarations': 'off',
      'no-prototype-builtins': 'off',
      'preserve-caught-error': 'off',
      'no-dupe-keys': 'off',
    }
  }
];
