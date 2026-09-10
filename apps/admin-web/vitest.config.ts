import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'src/lib/stage-graph-layout.test.ts',
      'src/lib/workflow-rewire.test.ts',
      'src/lib/production-preview-label.test.ts',
      'src/lib/can-see-nav.test.ts',
      'src/lib/purchase-order-payload.test.ts',
      'src/lib/low-stock-review.test.ts',
      'src/lib/live-task-progress.test.ts',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
