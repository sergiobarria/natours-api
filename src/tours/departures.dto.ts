import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsInt, IsOptional, Matches, Min } from 'class-validator';

export class CreateDepartureDto {
  @ApiProperty({ format: 'date-time', type: String })
  @IsDateString({ strict: true, strictSeparator: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/, { message: 'startAt must include a UTC offset.' })
  startAt!: string;

  @ApiProperty({ minimum: 0, type: Number })
  @IsInt()
  @Min(0)
  availableSpots!: number;

  @ApiPropertyOptional({ default: true, type: Boolean })
  @IsOptional()
  @IsBoolean()
  isActive = true;
}

export class UpdateDepartureDto extends PartialType(CreateDepartureDto) {}
