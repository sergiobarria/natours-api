import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController, ReadinessController } from './health.controller.js';
import { ReadinessService } from './readiness.service.js';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController, ReadinessController],
  providers: [ReadinessService],
})
export class HealthModule {}
