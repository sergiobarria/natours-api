import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import type { AuthenticatedPrincipal } from '../identity/authentication.types.js';
import {
  CurrentPrincipal,
  PublicRoute,
  RequirePermissions,
} from '../identity/identity.decorators.js';
import { PERMISSION } from '../identity/permissions.js';
import { SensitiveResponseInterceptor } from '../http/response/sensitive-response.interceptor.js';
import { CreateDepartureDto, UpdateDepartureDto } from './departures.dto.js';
import { DeparturesService } from './departures.service.js';

@Controller('tours/:tourId/start-dates')
@ApiTags('departures')
@ApiParam({ format: 'uuid', name: 'tourId' })
export class DeparturesController {
  constructor(private readonly departures: DeparturesService) {}

  @Get()
  @PublicRoute()
  @ApiOkResponse({ description: 'Chronological upcoming active departures.' })
  list(@Param('tourId', ParseUUIDPipe) tourId: string) {
    return this.departures.publicList(tourId);
  }

  @Post()
  @ApiBearerAuth('bearerAuth')
  @RequirePermissions(PERMISSION.toursManageStartDates)
  @UseInterceptors(SensitiveResponseInterceptor)
  @ApiCreatedResponse({ description: 'Departure created.' })
  create(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('tourId', ParseUUIDPipe) tourId: string,
    @Body() body: CreateDepartureDto,
    @Req() request: Request,
  ) {
    return this.departures.create(principal.userId, tourId, body, requestId(request));
  }

  @Patch(':departureId')
  @ApiBearerAuth('bearerAuth')
  @RequirePermissions(PERMISSION.toursManageStartDates)
  @UseInterceptors(SensitiveResponseInterceptor)
  @ApiParam({ format: 'uuid', name: 'departureId' })
  @ApiOkResponse({ description: 'Departure updated.' })
  update(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('tourId', ParseUUIDPipe) tourId: string,
    @Param('departureId', ParseUUIDPipe) departureId: string,
    @Body() body: UpdateDepartureDto,
    @Req() request: Request,
  ) {
    if (Object.keys(body).length === 0)
      throw new BadRequestException('At least one field is required.');
    return this.departures.update(principal.userId, tourId, departureId, body, requestId(request));
  }

  @Delete(':departureId')
  @ApiBearerAuth('bearerAuth')
  @RequirePermissions(PERMISSION.toursManageStartDates)
  @UseInterceptors(SensitiveResponseInterceptor)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Departure soft deleted.' })
  @ApiParam({ format: 'uuid', name: 'departureId' })
  delete(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('tourId', ParseUUIDPipe) tourId: string,
    @Param('departureId', ParseUUIDPipe) departureId: string,
    @Req() request: Request,
  ) {
    return this.departures.delete(principal.userId, tourId, departureId, requestId(request));
  }
}

function requestId(request: Request): string | undefined {
  return typeof request.id === 'string' || typeof request.id === 'number'
    ? String(request.id)
    : undefined;
}
