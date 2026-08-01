export interface WhatsAppMessage {
  to: string;
  body: string;
}

export interface WhatsAppProvider {
  readonly name: string;
  send(message: WhatsAppMessage): Promise<{ ok: boolean; id?: string }>;
}
