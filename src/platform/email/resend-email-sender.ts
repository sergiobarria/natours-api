import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';
import { AppConfigService } from '../../config/app-config.service.js';
import type { EmailMessage, EmailSender } from './email-sender.js';

@Injectable()
export class ResendEmailSender implements EmailSender {
  private readonly resend: Resend;

  constructor(private readonly config: AppConfigService) {
    this.resend = new Resend(config.resendApiKey);
  }

  async send(message: EmailMessage): Promise<void> {
    const { error } = await this.resend.emails.send(
      {
        from: `${this.config.mailFromName} <${this.config.mailFromAddress}>`,
        html: message.html,
        subject: message.subject,
        text: message.text,
        to: message.recipient,
      },
      { idempotencyKey: message.idempotencyKey },
    );
    if (error) throw new Error(`Email provider rejected the request: ${error.name}`);
  }
}
