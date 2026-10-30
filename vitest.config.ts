import { defineConfig } from 'vitest/config';
import path from 'node:path';
export default defineConfig({ resolve: { alias: { '@checkpoint/core': path.resolve('packages/core/src/index.ts'), '@checkpoint/twitch': path.resolve('packages/twitch/src/index.ts') } }, test: { include: ['packages/**/*.test.ts', 'apps/**/*.test.ts'], testTimeout: 15000 } });
