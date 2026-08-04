import type { InboundEmailReader } from './types';
import { MockInboundEmailReader } from './mock-inbound.provider';
import { ImapInboundEmailReader } from './imap-inbound.provider';
import { isInboundEmailConfigured, readInboundEmailConfig } from './types';

export function createInboundEmailReader(env: NodeJS.ProcessEnv = process.env): InboundEmailReader {
  const config = readInboundEmailConfig(env);
  if (isInboundEmailConfigured(config)) {
    return new ImapInboundEmailReader(config);
  }
  return new MockInboundEmailReader();
}

export {
  readInboundEmailConfig,
  isInboundEmailConfigured,
  type InboundEmailAttachment,
  type InboundEmailConfig,
  type InboundEmailMessage,
  type InboundEmailPollResult,
  type InboundEmailReader,
} from './types';
export { MockInboundEmailReader } from './mock-inbound.provider';
export { ImapInboundEmailReader } from './imap-inbound.provider';
