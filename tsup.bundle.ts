import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['packages/cli/src/index.ts'],
    format: ['cjs'],
    outDir: 'dist',
    clean: true,
    // Bundle all dependencies
    noExternal: [/.*/],
    target: 'node20',
    shims: true,
});
