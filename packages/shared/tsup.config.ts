import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/types/index.ts',
    'src/types/expenses.ts',
    'src/types/api.ts',
    'src/validation/index.ts',
    'src/validation/expenses.ts',
    'src/constants/index.ts',
  ],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
});
