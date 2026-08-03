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
  Put,
  Query,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import {
  CurrentPrincipal,
  PublicRoute,
  RequirePermissions,
} from '../identity/identity.decorators.js';
import type { AuthenticatedPrincipal } from '../identity/authentication.types.js';
import { PERMISSION } from '../identity/permissions.js';
import { presentPaginated } from '../http/response/response.presenter.js';
import { SensitiveResponseInterceptor } from '../http/response/sensitive-response.interceptor.js';
import {
  CreateTourDto,
  ListToursQueryDto,
  ReplaceGuideTeamDto,
  UpdateTourDto,
} from './tours.dto.js';
import { ToursService } from './tours.service.js';

@Controller('tours')
@ApiTags('tours')
export class ToursController {
  constructor(private readonly tours: ToursService) {}

  @Get()
  @PublicRoute()
  @ApiOkResponse({ description: 'Active public tour catalog.' })
  @ApiQuery({ type: ListToursQueryDto })
  async list(@Query() query: ListToursQueryDto) {
    validateRanges(query);
    const result = await this.tours.publicList(query);
    return presentPaginated(result.items, {
      page: query.page,
      perPage: query.limit,
      totalItems: result.total,
      path: '/api/v1/tours',
      query: { ...query },
    });
  }

  @Get(':slug')
  @PublicRoute()
  @ApiOkResponse({ description: 'Active public tour detail.' })
  @ApiParam({ name: 'slug', type: String })
  detail(@Param('slug') slug: string) {
    return this.tours.publicDetail(slug);
  }

  @Post()
  @ApiBearerAuth('bearerAuth')
  @RequirePermissions(PERMISSION.toursCreate)
  @UseInterceptors(SensitiveResponseInterceptor)
  @ApiCreatedResponse({ description: 'Tour created.' })
  @ApiBody({ type: CreateTourDto })
  create(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: CreateTourDto,
    @Req() request: Request,
  ) {
    const { leadGuideId, guideIds, ...tour } = body;
    return this.tours.create(principal.userId, tour, { leadGuideId, guideIds }, requestId(request));
  }

  @Patch(':tourId')
  @ApiBearerAuth('bearerAuth')
  @RequirePermissions(PERMISSION.toursUpdate)
  @UseInterceptors(SensitiveResponseInterceptor)
  @ApiParam({ format: 'uuid', name: 'tourId' })
  @ApiBody({ type: UpdateTourDto })
  update(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('tourId', ParseUUIDPipe) tourId: string,
    @Body() body: UpdateTourDto,
    @Req() request: Request,
  ) {
    if (Object.keys(body).length === 0)
      throw new BadRequestException('At least one field is required.');
    return this.tours.update(principal.userId, tourId, body, requestId(request));
  }

  @Put(':tourId/guide-team')
  @ApiBearerAuth('bearerAuth')
  @RequirePermissions(PERMISSION.toursUpdate)
  @UseInterceptors(SensitiveResponseInterceptor)
  @ApiParam({ format: 'uuid', name: 'tourId' })
  @ApiBody({ type: ReplaceGuideTeamDto })
  replaceTeam(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('tourId', ParseUUIDPipe) tourId: string,
    @Body() body: ReplaceGuideTeamDto,
    @Req() request: Request,
  ) {
    return this.tours.replaceGuideTeam(principal.userId, tourId, body, requestId(request));
  }

  @Delete(':tourId')
  @ApiBearerAuth('bearerAuth')
  @RequirePermissions(PERMISSION.toursDelete)
  @UseInterceptors(SensitiveResponseInterceptor)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Tour soft deleted.' })
  @ApiParam({ format: 'uuid', name: 'tourId' })
  delete(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('tourId', ParseUUIDPipe) tourId: string,
    @Req() request: Request,
  ) {
    return this.tours.delete(principal.userId, tourId, requestId(request));
  }
}

@Controller('admin/tours')
@ApiTags('tours')
@ApiBearerAuth('bearerAuth')
@UseInterceptors(SensitiveResponseInterceptor)
export class OperatorToursController {
  constructor(private readonly tours: ToursService) {}
  @Get(':tourId')
  @RequirePermissions(PERMISSION.toursUpdate)
  @ApiOperation({ summary: 'Get operator tour detail' })
  @ApiParam({ format: 'uuid', name: 'tourId' })
  detail(@Param('tourId', ParseUUIDPipe) tourId: string) {
    return this.tours.operatorDetail(tourId);
  }
}

function requestId(request: Request): string | undefined {
  return typeof request.id === 'string' || typeof request.id === 'number'
    ? String(request.id)
    : undefined;
}

function validateRanges(query: ListToursQueryDto): void {
  const ranges = [
    [query.minPrice, query.maxPrice],
    [query.minDuration, query.maxDuration],
    [query.minGroupSize, query.maxGroupSize],
    [query.minRating, query.maxRating],
  ];
  if (
    ranges.some(
      ([minimum, maximum]) => minimum !== undefined && maximum !== undefined && minimum > maximum,
    )
  ) {
    throw new BadRequestException('A minimum filter cannot exceed its maximum.');
  }
}
