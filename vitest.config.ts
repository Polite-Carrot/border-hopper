import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Core game logic is plain TypeScript with no React Native imports,
    // so it runs directly in Node.
    include: ['src/core/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
  },
});
