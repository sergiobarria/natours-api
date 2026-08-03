import { IsEmail, IsIn, IsString, Length, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { APPLICATION_ROLES, type ApplicationRole } from '../database/schema/identity.js';

export class UpdateProfileDto {
  @ApiProperty({ maxLength: 100, type: String })
  @IsString()
  @Length(1, 100)
  name!: string;
}

export class ChangePasswordDto {
  @ApiProperty({ format: 'password', maxLength: 128, minLength: 8, type: String, writeOnly: true })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  currentPassword!: string;

  @ApiProperty({ format: 'password', maxLength: 128, minLength: 8, type: String, writeOnly: true })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}

export class ChangeEmailDto {
  @ApiProperty({ format: 'password', maxLength: 128, minLength: 8, type: String, writeOnly: true })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  currentPassword!: string;

  @ApiProperty({ format: 'email', type: String })
  @IsEmail()
  newEmail!: string;
}

export class ConfirmPasswordDto {
  @ApiProperty({ format: 'password', maxLength: 128, minLength: 8, type: String, writeOnly: true })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  currentPassword!: string;
}

export class UpdateRoleDto {
  @ApiProperty({ enum: APPLICATION_ROLES, type: String })
  @IsIn(APPLICATION_ROLES)
  role!: ApplicationRole;
}
