import type { InboundEmailPollResult, InboundEmailReader } from './types';

/** Local/dev reader — logs heartbeat, returns no messages. */
export class MockInboundEmailReader implements InboundEmailReader {
  readonly name = 'mock';

  async poll(): Promise<InboundEmailPollResult> {
    return { messages: [], provider: this.name };
  }
}
