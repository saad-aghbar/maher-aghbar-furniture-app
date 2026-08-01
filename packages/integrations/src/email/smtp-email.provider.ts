import nodemailer from 'nodemailer';
import type { EmailMessage, EmailProvider } from './types';

export class SmtpEmailProvider implements EmailProvider {
  readonly name = 'smtp';

  constructor(private readonly smtpUrl: string) {}

  async send(message: EmailMessage) {
    const transport = nodemailer.createTransport(this.smtpUrl);
    const info = await transport.sendMail({
      from: process.env.SMTP_FROM ?? process.env.COMPANY_EMAIL ?? 'noreply@maher-erp.local',
      to: message.to,
      subject: message.subject,
      text: message.body,
      html: message.html ?? message.body.replace(/\n/g, '<br/>'),
    });
    return { ok: true, id: info.messageId };
  }
}
