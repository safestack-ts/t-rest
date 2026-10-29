import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import tseslint from 'typescript-eslint'

export default [
  {
    ignores: [
      '**/node_modules/',
      '**/dist/',
      '**/build/',
      '**/__test__/',
      '.husky/',
      '.vscode/',
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
    // type tests declare values only to inspect their types
    files: ['**/*.type.test.ts'],
    rules: { '@typescript-eslint/no-unused-vars': 'off' },
  },
]
