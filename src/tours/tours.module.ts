import { Module } from '@nestjs/common';
import { SensitiveResponseInterceptor } from '../http/response/sensitive-response.interceptor.js';
import { OperatorToursController, ToursController } from './tours.controller.js';
import { ToursService } from './tours.service.js';

@Module({
  controllers: [ToursController, OperatorToursController],
  providers: [ToursService, SensitiveResponseInterceptor],
})
export class ToursModule {}
