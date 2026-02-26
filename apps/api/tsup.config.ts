import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  dts: false, // Disabled - API is not published as a library
  clean: true,
  sourcemap: true,
  splitting: false,
  target: 'node20',
});
