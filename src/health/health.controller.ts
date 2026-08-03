import { Controller, Get, Inject, VERSION_NEUTRAL, Version } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { HTTP_ROUTES } from '../http/http.constants.js';
import { NativeResponse } from '../http/response/native-response.decorator.js';

@ApiExcludeController()
@NativeResponse()
@Controller(HTTP_ROUTES.health)
export class HealthController {
  constructor(@Inject(HealthCheckService) private readonly health: HealthCheckService) {}

  @Get()
  @Version(VERSION_NEUTRAL)
  @HealthCheck()
  check() {
    return this.health.check([]);
  }
}
