import js from '@eslint/js'
import svelte from 'eslint-plugin-svelte'
import globals from 'globals'
import ts from 'typescript-eslint'

export default ts.config(
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs['flat/recommended'],
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parserOptions: { parser: ts.parser },
    },
  },
  {
    // Composants shadcn-svelte générés : vendored, non maintenus à la main.
    ignores: [
      '.svelte-kit/',
      'build/',
      'node_modules/',
      'src/lib/components/ui/',
      'src/lib/utils/cn.ts',
    ],
  },
)
