import { Controller, Get, Version } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('application')
@Controller()
export class AppController {
  @Get()
  @Version('1')
  @ApiOperation({ summary: 'Describe the API' })
  @ApiOkResponse({
    schema: {
      example: { name: 'natours-api', version: '1' },
    },
  })
  describe(): { name: string; version: string } {
    return { name: 'natours-api', version: '1' };
  }
}
