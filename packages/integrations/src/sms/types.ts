export interface SmsMessage {
  to: string;
  body: string;
}

export interface SmsProvider {
  readonly name: string;
  send(message: SmsMessage): Promise<{ ok: boolean; id?: string }>;
}
