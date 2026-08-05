import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

const UTC_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class AnalyticsRangeQueryDto {
  @ApiProperty({ example: '2026-01-01', description: 'Inclusive UTC calendar date.' })
  @IsString()
  @Matches(UTC_DATE)
  @MaxLength(10)
  from!: string;

  @ApiProperty({ example: '2027-01-01', description: 'Exclusive UTC calendar date.' })
  @IsString()
  @Matches(UTC_DATE)
  @MaxLength(10)
  to!: string;
}

export class RankingsQueryDto extends AnalyticsRangeQueryDto {
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class MonthlyPlanQueryDto {
  @ApiProperty({ example: 2027, minimum: 2000, maximum: 2100 })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;
}
