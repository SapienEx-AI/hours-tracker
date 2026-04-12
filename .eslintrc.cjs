module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  plugins: ['@typescript-eslint', 'react', 'react-refresh', 'local-rules'],
  settings: { react: { version: '18.3' } },
  ignorePatterns: [
    'dist',
    'node_modules',
    'coverage',
    'eslint-rules',
    'eslint-local-rules.cjs',
    'postcss.config.js',
    '.eslintrc.cjs',
    'tailwind.config.ts',
    'vite.config.ts',
  ],
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    '@typescript-eslint/consistent-type-imports': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'local-rules/no-float-money': 'error',
    complexity: ['warn', 10],
    'max-lines': ['warn', { max: 300, skipBlankLines: true, skipComments: true }],
    'max-lines-per-function': ['warn', { max: 80, skipBlankLines: true, skipComments: true }],
  },
  overrides: [
    {
      files: ['tests/**/*.ts', 'tests/**/*.tsx'],
      rules: {
        'max-lines-per-function': 'off',
        'local-rules/no-float-money': 'off',
      },
    },
    {
      // Screens are view-heavy components by nature — lots of JSX in one
      // function. The 80-line limit applies to calc/data/etc. where small
      // focused functions matter most. Raise the cap for screens but keep
      // complexity bounded to force control-flow decomposition.
      files: ['src/ui/screens/**/*.tsx', 'src/ui/layout/**/*.tsx'],
      rules: {
        'max-lines-per-function': ['warn', { max: 200, skipBlankLines: true, skipComments: true }],
        complexity: ['warn', 15],
      },
    },
    {
      // One-shot import / ops scripts may have loose-parse code that is
      // inherently branchy. Runtime code under src/ keeps the tight limits.
      files: ['scripts/**/*.ts'],
      rules: {
        complexity: ['warn', 15],
        'max-lines-per-function': 'off',
      },
    },
  ],
};
