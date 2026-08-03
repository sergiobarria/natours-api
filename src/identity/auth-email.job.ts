import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { EMAIL_SENDER, type EmailSender } from '../platform/email/email-sender.js';
import { AUTH_EMAIL_TYPE } from './identity.constants.js';

const authEmailSchema = z.object({
  expiresInSeconds: z.number().int().positive(),
  idempotencyKey: z.string().min(1).max(256),
  recipient: z.email(),
  type: z.enum(AUTH_EMAIL_TYPE),
  url: z.url(),
});

export type AuthEmailPayload = z.infer<typeof authEmailSchema>;

export function parseAuthEmailPayload(payload: unknown): AuthEmailPayload {
  return authEmailSchema.parse(payload);
}

@Injectable()
export class AuthEmailJob {
  constructor(@Inject(EMAIL_SENDER) private readonly sender: EmailSender) {}

  async execute(payload: AuthEmailPayload): Promise<void> {
    const content = this.content(payload);
    await this.sender.send({
      html: `<p>${content.introduction}</p><p><a href="${payload.url}">${content.action}</a></p><p>This link expires in ${Math.ceil(payload.expiresInSeconds / 60)} minutes.</p>`,
      idempotencyKey: payload.idempotencyKey,
      recipient: payload.recipient,
      subject: content.subject,
      text: `${content.introduction}\n\n${payload.url}\n\nThis link expires in ${Math.ceil(payload.expiresInSeconds / 60)} minutes.`,
    });
  }

  private content(payload: AuthEmailPayload): {
    action: string;
    introduction: string;
    subject: string;
  } {
    switch (payload.type) {
      case AUTH_EMAIL_TYPE.passwordReset:
        return {
          action: 'Reset password',
          introduction: 'A password reset was requested for your Natours account.',
          subject: 'Reset your Natours password',
        };
      case AUTH_EMAIL_TYPE.emailChange:
        return {
          action: 'Verify email',
          introduction: 'Verify this address to finish changing your Natours account email.',
          subject: 'Verify your new Natours email',
        };
      default:
        return {
          action: 'Verify email',
          introduction: 'Verify your email address to activate your Natours account.',
          subject: 'Verify your Natours email',
        };
    }
  }
}
