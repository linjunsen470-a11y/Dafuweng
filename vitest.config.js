import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Bound worker pressure in four-core cloud environments; retain all assertions.
    maxWorkers: 2,
    hookTimeout: 60000,
    testTimeout: 60000
  }
});
