// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'
import prettierPlugin from 'eslint-plugin-prettier'
import eslintConfigPrettier from 'eslint-config-prettier'
import tsParser from '@typescript-eslint/parser'

export default withNuxt(
  {
    ignores: ['app/api/generated/**'],
  },
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tsParser,
      },
    },
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
    },
  },
  {
    files: ['**/*.ts', '**/*.vue'],
    rules: {
      // TypeScript's own checks supersede `no-undef` (which false-positives on DOM/TS types)
      'no-undef': 'off',
    },
  },
  {
    plugins: { prettier: prettierPlugin },
    rules: {
      ...eslintConfigPrettier.rules,
      'prettier/prettier': 'error',
      semi: ['error', 'never'],
    },
  },
)
