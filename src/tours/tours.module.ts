import { Module } from '@nestjs/common';
import { SensitiveResponseInterceptor } from '../http/response/sensitive-response.interceptor.js';
import { OperatorToursController, ToursController } from './tours.controller.js';
import { ToursService } from './tours.service.js';
import { DeparturesController } from './departures.controller.js';
import { DeparturesService } from './departures.service.js';
import { MediaController } from './media.controller.js';
import { MediaService } from './media.service.js';

@Module({
  controllers: [ToursController, OperatorToursController, DeparturesController, MediaController],
  providers: [ToursService, DeparturesService, MediaService, SensitiveResponseInterceptor],
})
export class ToursModule {}
