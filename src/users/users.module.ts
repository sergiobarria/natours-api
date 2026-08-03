import { Module } from '@nestjs/common';
import { SensitiveResponseInterceptor } from '../http/response/sensitive-response.interceptor.js';
import { AccountSecurityService } from './account-security.service.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  controllers: [UsersController],
  providers: [AccountSecurityService, SensitiveResponseInterceptor, UsersService],
})
export class UsersModule {}
