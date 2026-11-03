import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import tseslint from 'typescript-eslint'

export default [
  {
    ignores: [
      '**/node_modules/',
      '**/dist/',
      // generated public API snapshots, see scripts/api-snapshot.mjs
      'packages/*/api/',
      '**/build/',
      '**/__test__/',
      '.husky/',
      '.vscode/',
      '.claude/',
      '.worktrees/',
      '**/.env',
    ],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      sourceType: 'module',
    },
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      ...js.configs.recommended.rules,
      ...prettier.rules, // disables rules that conflict with prettier
      'no-multiple-empty-lines': ['error', { max: 1, maxEOF: 1, maxBOF: 0 }],
      'comma-dangle': [
        'error',
        {
          arrays: 'always-multiline',
          objects: 'always-multiline',
          imports: 'ignore',
          exports: 'ignore',
          functions: 'ignore',
        },
      ],
      'no-duplicate-imports': ['error', { includeExports: true }],
      'no-unused-vars': 'off', // @typescript-eslint/no-unused-vars does the job
      'no-redeclare': 'off',
      'no-undef': 'off',
      'no-extra-parens': 'off',
      'no-import-assign': 'error',
      'no-useless-escape': 'off',
      'no-unreachable': 'off',
      'no-dupe-class-members': 'off',
      'require-atomic-updates': 'off',
      'no-inner-declarations': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // targets differ only in the capability table, so no other writer file names one
    files: ['packages/open-api-generator/src/writer/**/*.ts'],
    ignores: ['packages/open-api-generator/src/writer/capabilities.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...[
          'Literal[value=/^3\\.[012]$/]',
          'TemplateElement[value.cooked=/^3\\.[012]$/]',
        ].map((selector) => ({
          selector,
          message:
            'Do not branch on an OpenAPI target. Add or read a column of CAPABILITIES in writer/capabilities.ts.',
        })),
      ],
    },
  },
  {
    // type tests declare values only to inspect their types
    files: ['**/*.type.test.ts'],
    rules: { '@typescript-eslint/no-unused-vars': 'off' },
  },
]
