import { Controller, Get, Inject, VERSION_NEUTRAL, Version } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { HTTP_ROUTES } from '../http/http.constants.js';
import { NativeResponse } from '../http/response/native-response.decorator.js';
import { BypassRateLimit } from '../rate-limit/rate-limit.decorators.js';
import { ReadinessService } from './readiness.service.js';

@ApiExcludeController()
@AllowAnonymous()
@NativeResponse()
@Controller(HTTP_ROUTES.health)
@BypassRateLimit()
export class HealthController {
  constructor(@Inject(HealthCheckService) private readonly health: HealthCheckService) {}

  @Get()
  @Version(VERSION_NEUTRAL)
  @HealthCheck()
  check() {
    return this.health.check([]);
  }
}

@ApiExcludeController()
@AllowAnonymous()
@NativeResponse()
@BypassRateLimit()
@Controller(HTTP_ROUTES.ready)
export class ReadinessController {
  constructor(
    @Inject(HealthCheckService) private readonly health: HealthCheckService,
    @Inject(ReadinessService) private readonly readiness: ReadinessService,
  ) {}

  @Get()
  @Version(VERSION_NEUTRAL)
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.readiness.postgres(),
      () => this.readiness.redisProbe(),
      () => this.readiness.heartbeat('worker'),
      () => this.readiness.heartbeat('scheduler'),
    ]);
  }
}
