import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    sourcemap: true,
    splitting: false,
  },
  {
    entry: ['src/cli/index.ts'],
    format: ['esm'],
    outDir: 'dist/cli',
    banner: { js: '#!/usr/bin/env node' },
    clean: false,
    sourcemap: true,
    splitting: false,
  },
])
