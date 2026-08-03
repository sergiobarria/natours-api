import { FakeClock } from '../clock/clock.js';
import { FakeEmailSender } from '../email/email-sender.js';
import { stableJobId } from './job-id.js';

describe('platform job contracts', () => {
  it('derives stable BullMQ-safe job ids', () => {
    const first = stableJobId('email.send', 'user:123');
    expect(first).toBe(stableJobId('email.send', 'user:123'));
    expect(first).not.toBe(stableJobId('email.send', 'user:124'));
    expect(first).toMatch(/^job-[a-f0-9]{64}$/);
  });

  it('provides deterministic clock and email fakes', async () => {
    const clock = new FakeClock(new Date('2026-08-03T00:00:00.000Z'));
    const email = new FakeEmailSender();
    expect(clock.now().toISOString()).toBe('2026-08-03T00:00:00.000Z');
    clock.set(new Date('2026-08-04T00:00:00.000Z'));
    expect(clock.now().toISOString()).toBe('2026-08-04T00:00:00.000Z');

    await email.send({
      idempotencyKey: 'verification:user-id',
      recipient: 'user@example.com',
      subject: 'Verify',
      text: 'Message',
    });
    expect(email.messages).toHaveLength(1);
  });
});
