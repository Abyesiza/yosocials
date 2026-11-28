import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Each file boots the whole app on its own in-memory Postgres; under parallel load, password hashing alone can pass 5s.
    testTimeout: 20_000,
  },
});
