import { Controller, Get, VERSION_NEUTRAL, Version } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';

@ApiExcludeController()
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthCheckService) {}

  @Get()
  @Version(VERSION_NEUTRAL)
  @HealthCheck()
  check() {
    return this.health.check([]);
  }
}
