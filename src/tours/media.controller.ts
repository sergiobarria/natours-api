import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import type { AuthenticatedPrincipal } from '../identity/authentication.types.js';
import { CurrentPrincipal, RequirePermissions } from '../identity/identity.decorators.js';
import { PERMISSION } from '../identity/permissions.js';
import { SensitiveResponseInterceptor } from '../http/response/sensitive-response.interceptor.js';
import { MediaService } from './media.service.js';

@Controller('tours/:tourId/images')
@ApiTags('images')
@ApiBearerAuth('bearerAuth')
@ApiParam({ format: 'uuid', name: 'tourId' })
@UseInterceptors(SensitiveResponseInterceptor)
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post()
  @RequirePermissions(PERMISSION.toursManageImages)
  @UseInterceptors(FilesInterceptor('images', 10, { limits: { fileSize: 10 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['images'],
      properties: {
        images: {
          type: 'array',
          maxItems: 10,
          minItems: 1,
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Tour images uploaded and converted.' })
  upload(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('tourId', ParseUUIDPipe) tourId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() request: Request,
  ) {
    return this.media.upload(principal.userId, tourId, files ?? [], requestId(request));
  }

  @Delete(':imageId')
  @RequirePermissions(PERMISSION.toursManageImages)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Tour image deleted.' })
  @ApiParam({ format: 'uuid', name: 'imageId' })
  delete(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('tourId', ParseUUIDPipe) tourId: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @Req() request: Request,
  ) {
    return this.media.delete(principal.userId, tourId, imageId, requestId(request));
  }
}

function requestId(request: Request): string | undefined {
  return typeof request.id === 'string' || typeof request.id === 'number'
    ? String(request.id)
    : undefined;
}
