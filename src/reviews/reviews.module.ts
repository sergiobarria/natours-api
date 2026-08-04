import { Module } from '@nestjs/common';
import { ReviewCustomerGuard } from './review-customer.guard.js';
import { ReviewsController } from './reviews.controller.js';
import { ReviewsService } from './reviews.service.js';

@Module({
  controllers: [ReviewsController],
  providers: [ReviewsService, ReviewCustomerGuard],
})
export class ReviewsModule {}
