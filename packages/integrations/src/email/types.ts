export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
  html?: string;
}

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<{ ok: boolean; id?: string }>;
}
