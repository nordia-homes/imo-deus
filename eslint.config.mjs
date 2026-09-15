import { defineConfig, globalIgnores } from 'eslint/config';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  ...nextCoreWebVitals,
  {
    // Next 16 enables the React Compiler advisory rules for the whole legacy
    // application. Keep the existing backlog visible without turning the
    // ESLint CLI migration itself into a repository-wide blocking change.
    files: ['**/*.{js,jsx,mjs,ts,tsx,mts,cts}'],
    plugins: nextCoreWebVitals[0].plugins,
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/use-memo': 'warn',
      'react/no-unescaped-entities': 'warn',
      'react/jsx-key': 'warn',
    },
  },
  globalIgnores([
    '.next/**',
    'desktop-dist-app/**',
    'dist-desktop/**',
    'node_modules/**',
    '.tmp/**',
    'tmp/**',
  ]),
]);
