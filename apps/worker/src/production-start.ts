import { createLogger } from '@maher/logging';

const logger = createLogger('production-start');

/**
 * Former day-tick that auto-promoted Ready → In Production on planned start date.
 * Disabled permanently: In Production only after first executable task actual start.
 */
export function startProductionStartPoller() {
  logger.info(
    '[production-start] poller DISABLED — date must never auto-move Ready for Factory → In Production',
  );
}
