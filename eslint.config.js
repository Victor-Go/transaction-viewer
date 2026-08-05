import eslint from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/node_modules/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: [
      'apps/api/**/*.ts',
      'packages/contracts/**/*.ts',
      'tests/e2e/**/*.ts',
      'playwright.config.ts',
      'apps/web/vite.config.ts',
      '*.{js,ts}',
    ],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
  {
    files: ['apps/web/src/**/*.tsx'],
    ignores: ['apps/web/src/**/*.test.tsx', 'apps/web/src/app/main.tsx'],
    plugins: {
      'react-refresh': reactRefresh,
    },
    rules: {
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  {
    files: [
      '**/*.test.{ts,tsx}',
      '**/*.spec.{ts,tsx}',
      'tests/e2e/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message:
            'Tests must use an explicit date or an injected application clock.',
        },
        {
          selector:
            "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message:
            'Tests must use a fixed application clock; use performance.now() only for bounded elapsed-time checks.',
        },
        {
          selector:
            "CallExpression[callee.object.type='MemberExpression'][callee.object.property.name='clock'][callee.property.name='install'][arguments.length=0]",
          message: 'Playwright clocks must install an explicit fixed time.',
        },
        {
          selector: "CallExpression[callee.property.name='waitForTimeout']",
          message:
            'Wait for observable state instead of adding a Playwright wall-clock sleep.',
        },
      ],
    },
  },
);
