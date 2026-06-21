// @ts-check
import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Allow intentional omit-destructures and discards: `const { x: _x, ...rest }`.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { varsIgnorePattern: '^_', argsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },
  {
    // Importer tool parses external source data; non-null assertions on
    // freshly-built maps and validated event shapes are intentional.
    files: ['tools/importer/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    // Tests legitimately use non-null assertions on known-good fixtures and
    // omit-destructures like `const { version: _v, ...rest }`.
    files: ['**/test/**/*.ts', '**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
    },
  },
  {
    // The SvelteKit PWA is type-checked by svelte-check; ESLint's type-aware
    // rules fight UI idioms (numbers in templates) and the $service-worker
    // virtual module, so disable the type-checked layer for the app.
    files: ['apps/reader/**/*.ts'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/.svelte-kit/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/*.config.*',
    ],
  },
)
