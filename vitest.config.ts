import { defineConfig } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
  test: {
    include: ['test/unit/**/*.test.ts'],
    alias: {
      vscode: path.resolve(__dirname, 'test/unit/vscodeMock.ts')
    }
  }
});
