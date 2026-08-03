import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { TOUR_DIFFICULTIES, type TourDifficulty } from '../database/schema/tours.js';

export const TOUR_SORT_FIELDS = [
  'name',
  'price',
  'durationDays',
  'maximumGroupSize',
  'difficulty',
  'ratingAverage',
  'createdAt',
] as const;
export type TourSortField = (typeof TOUR_SORT_FIELDS)[number];

export class ListToursQueryDto {
  @ApiPropertyOptional({ maxLength: 160, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;
  @ApiPropertyOptional({ enum: TOUR_DIFFICULTIES, type: String })
  @IsOptional()
  @IsIn(TOUR_DIFFICULTIES)
  difficulty?: TourDifficulty;
  @ApiPropertyOptional({ minimum: 0, type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPrice?: number;
  @ApiPropertyOptional({ minimum: 0, type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPrice?: number;
  @ApiPropertyOptional({ minimum: 1, type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minDuration?: number;
  @ApiPropertyOptional({ minimum: 1, type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxDuration?: number;
  @ApiPropertyOptional({ minimum: 1, type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minGroupSize?: number;
  @ApiPropertyOptional({ minimum: 1, type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxGroupSize?: number;
  @ApiPropertyOptional({ maximum: 5, minimum: 1, type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5)
  minRating?: number;
  @ApiPropertyOptional({ maximum: 5, minimum: 1, type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5)
  maxRating?: number;
  @ApiPropertyOptional({ default: 'name', enum: TOUR_SORT_FIELDS, type: String })
  @IsOptional()
  @IsIn(TOUR_SORT_FIELDS)
  sortBy: TourSortField = 'name';
  @ApiPropertyOptional({ default: 'asc', enum: ['asc', 'desc'], type: String })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'asc';
  @ApiPropertyOptional({ default: 1, minimum: 1, type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;
  @ApiPropertyOptional({ default: 20, maximum: 100, minimum: 1, type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class TourLocationDto {
  @ApiProperty({ maxLength: 160, type: String })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;
  @ApiPropertyOptional({ maxLength: 300, nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  address?: string | null;
  @ApiProperty({ maximum: 90, minimum: -90, type: Number })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;
  @ApiProperty({ maximum: 180, minimum: -180, type: Number })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;
}

export class CreateTourDto {
  @ApiProperty({ maxLength: 160, type: String })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;
  @ApiProperty({ maxLength: 500, type: String })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  summary!: string;
  @ApiPropertyOptional({ maxLength: 10_000, nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(10_000)
  description?: string | null;
  @ApiProperty({ maximum: 3650, minimum: 1, type: Number })
  @IsInt()
  @Min(1)
  @Max(3650)
  durationDays!: number;
  @ApiProperty({ maximum: 10_000, minimum: 1, type: Number })
  @IsInt()
  @Min(1)
  @Max(10_000)
  maximumGroupSize!: number;
  @ApiProperty({ enum: TOUR_DIFFICULTIES, type: String })
  @IsIn(TOUR_DIFFICULTIES)
  difficulty!: TourDifficulty;
  @ApiProperty({ description: 'Price in USD cents.', minimum: 0, type: Number })
  @IsInt()
  @Min(0)
  price!: number;
  @ApiPropertyOptional({ maximum: 99.99, minimum: 0.01, nullable: true, type: Number })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99.99)
  discountPercentage?: number | null;
  @ApiProperty({ type: TourLocationDto })
  @ValidateNested()
  @Type(() => TourLocationDto)
  startLocation!: TourLocationDto;
  @ApiPropertyOptional({ default: false, type: Boolean })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
  @ApiProperty({ format: 'uuid', type: String })
  @IsUUID('4')
  leadGuideId!: string;
  @ApiPropertyOptional({ format: 'uuid', isArray: true, maxItems: 4, type: String })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(4)
  @IsUUID('4', { each: true })
  guideIds: string[] = [];
}

export class UpdateTourDto {
  @ApiPropertyOptional({ maxLength: 160, type: String })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name?: string;
  @ApiPropertyOptional({ maxLength: 500, type: String })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  summary?: string;
  @ApiPropertyOptional({ maxLength: 10_000, nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(10_000)
  description?: string | null;
  @ApiPropertyOptional({ maximum: 3650, minimum: 1, type: Number })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  durationDays?: number;
  @ApiPropertyOptional({ maximum: 10_000, minimum: 1, type: Number })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000)
  maximumGroupSize?: number;
  @ApiPropertyOptional({ enum: TOUR_DIFFICULTIES, type: String })
  @IsOptional()
  @IsIn(TOUR_DIFFICULTIES)
  difficulty?: TourDifficulty;
  @ApiPropertyOptional({ description: 'Price in USD cents.', minimum: 0, type: Number })
  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number;
  @ApiPropertyOptional({ maximum: 99.99, minimum: 0.01, nullable: true, type: Number })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99.99)
  discountPercentage?: number | null;
  @ApiPropertyOptional({ type: TourLocationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TourLocationDto)
  startLocation?: TourLocationDto;
  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ReplaceGuideTeamDto {
  @ApiProperty({ format: 'uuid', type: String })
  @IsUUID('4')
  leadGuideId!: string;
  @ApiProperty({ format: 'uuid', isArray: true, maxItems: 4, type: String })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(4)
  @IsUUID('4', { each: true })
  guideIds!: string[];
}
