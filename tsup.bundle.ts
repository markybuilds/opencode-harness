import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['packages/cli/src/index.ts'],
    format: ['esm'],
    outDir: 'dist',
    clean: true,
    // Bundle all dependencies
    noExternal: [/.*/],
    target: 'es2022',
    banner: {
        js: '#!/usr/bin/env node',
    },
});
