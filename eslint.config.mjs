import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/database.types.ts',
      '**/next-env.d.ts',
      'supabase/functions/_shared/vendor/**',
      '**/.next/**',
      '**/dist/**',
      '**/.expo/**',
      'apps/mobile/public/**',
      'apps/mobile/android/**',
      'apps/mobile/ios/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['scripts/**/*', 'evals/**/*'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        fetch: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: [
      '**/*.cjs',
      '**/*.config.js',
      '**/babel.config.js',
      '**/metro.config.js',
      '**/tailwind.config.js',
    ],
    languageOptions: {
      globals: {
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        process: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['apps/mobile/**/*'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
);
