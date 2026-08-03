export const EMAIL_SENDER = Symbol('EMAIL_SENDER');

export interface EmailMessage {
  html?: string;
  idempotencyKey: string;
  recipient: string;
  subject: string;
  text: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

export class FakeEmailSender implements EmailSender {
  readonly messages: EmailMessage[] = [];

  send(message: EmailMessage): Promise<void> {
    this.messages.push(structuredClone(message));
    return Promise.resolve();
  }
}
