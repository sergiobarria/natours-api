import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsInt,
  IsPhoneNumber,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class TravelerDto {
  @ApiProperty({ maxLength: 160 }) @IsString() @MinLength(1) @MaxLength(160) fullName!: string;
  @ApiProperty({ format: 'email', maxLength: 320 }) @IsEmail() @MaxLength(320) email!: string;
  @ApiProperty({ example: '+12025550123', maxLength: 16 })
  @IsPhoneNumber()
  @MaxLength(16)
  phone!: string;
}

export class CreateBookingDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID('4') departureId!: string;
  @ApiProperty({ type: [TravelerDto], minItems: 1, maxItems: 10_000 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10_000)
  @ValidateNested({ each: true })
  @Type(() => TravelerDto)
  travelers!: TravelerDto[];
}

export class ListBookingsQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 }) @Type(() => Number) @IsInt() @Min(1) page = 1;
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
