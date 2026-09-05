/**
 * Bridge to the canonical release for the SO-FB1042 fabric UAT order.
 *
 * The fabric fixture can seed the order, its procurements and its holding lots,
 * but a production order may only be created by the real release path, which
 * lives in the API and cannot be imported from this package. So we hand off to
 * `@maher/api demo:fabric-uat`, which boots the API's own module graph, calls
 * `OrderProductionSetupService.release`, and asserts the resulting world.
 *
 * This runs from inside the reset rather than being chained after it, so every
 * caller of `demo:reset` gets the same deterministic demo state.
 */
import { spawnSync } from 'child_process';
import { resolve } from 'path';

const REPO_ROOT = resolve(__dirname, '../../../..');

export function releaseFabricUatSubject(): void {
  const run = spawnSync('pnpm', ['--filter', '@maher/api', 'demo:fabric-uat'], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    // pnpm is a shell shim on Windows and in some CI images.
    shell: process.platform === 'win32',
  });

  if (run.error) {
    throw new Error(
      `Could not run the fabric UAT release step: ${run.error.message}. ` +
        'Run "pnpm --filter @maher/api demo:fabric-uat" manually to finish the reset.',
    );
  }
  if (run.status !== 0) {
    throw new Error(
      `Fabric UAT release step failed (exit ${run.status ?? 'unknown'}). ` +
        'SO-FB1042 has no production subject, so Production Detail and Worker Task are untestable.',
    );
  }
}
