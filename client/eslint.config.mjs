import tseslint from 'typescript-eslint';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
  // Global ignores
  {
    ignores: [
      'dist/**',
      'build/**',
      'node_modules/**',
      'playwright-report/**',
      'eslint.config.mjs',
    ],
  },

  // TypeScript + TSX files: accessibility-focused linting
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      'jsx-a11y': jsxA11y,
      'react-hooks': reactHooks,
    },
    rules: {
      // Primary purpose: jsx-a11y recommended accessibility rules.
      ...jsxA11y.configs.recommended.rules,

      // Register react-hooks so the inline `// eslint-disable-next-line
      // react-hooks/exhaustive-deps` comments in src/ don't error as unknown
      // rules. rules-of-hooks is off to avoid false positives on third-party
      // APIs (e.g. cytoscape.use()).
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];
