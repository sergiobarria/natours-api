import { Global, Module, Provider } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service.js';
import { EMAIL_SENDER, FakeEmailSender, type EmailSender } from '../platform/email/email-sender.js';
import { ResendEmailSender } from '../platform/email/resend-email-sender.js';
import { PlatformJobsModule } from '../platform/jobs/platform-jobs.module.js';
import { AuthEmailJob } from './auth-email.job.js';
import { AuthEmailOutbox } from './auth-email-outbox.js';

const emailSenderProvider: Provider<EmailSender> = {
  provide: EMAIL_SENDER,
  inject: [AppConfigService],
  useFactory(config: AppConfigService): EmailSender {
    return config.emailProvider === 'fake' ? new FakeEmailSender() : new ResendEmailSender(config);
  },
};

@Global()
@Module({
  imports: [PlatformJobsModule],
  providers: [emailSenderProvider, AuthEmailJob, AuthEmailOutbox],
  exports: [EMAIL_SENDER, AuthEmailOutbox],
})
export class IdentityEmailModule {}
