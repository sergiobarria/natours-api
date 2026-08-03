import 'dotenv/config';
import { Global, Module } from '@nestjs/common';
import { AppConfigService } from './app-config.service.js';
import { validateEnvironment } from './environment.js';

@Global()
@Module({
  providers: [
    {
      provide: AppConfigService,
      useFactory: () => new AppConfigService(validateEnvironment(process.env)),
    },
  ],
  exports: [AppConfigService],
})
export class AppConfigModule {}
