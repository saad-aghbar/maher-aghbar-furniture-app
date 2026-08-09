import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

const LOCALES = ['ar', 'en', 'he'] as const;

export class LoginDto {
  @ApiProperty({ minLength: 2, example: 'admin' })
  @IsString()
  @MinLength(2)
  username!: string;

  @ApiProperty({ minLength: 1, example: '123' })
  @IsString()
  @MinLength(1)
  password!: string;

  /** Required when the account has MFA enabled. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mfaCode?: string;

  /** web keeps cookie-only JSON; mobile also receives tokens in the body */
  @ApiPropertyOptional({ enum: ['web', 'mobile'] })
  @IsOptional()
  @IsIn(['web', 'mobile'])
  client?: 'web' | 'mobile';
}

/** Cookie-free mobile login (username + password). */
export class MobileLoginDto {
  @ApiProperty({ minLength: 2, example: 'admin' })
  @IsString()
  @MinLength(2)
  username!: string;

  @ApiProperty({ minLength: 1, example: '123' })
  @IsString()
  @MinLength(1)
  password!: string;

  @ApiPropertyOptional({ description: 'Required when MFA is enabled on the account' })
  @IsOptional()
  @IsString()
  mfaCode?: string;
}

export class ConfirmMfaDto {
  @ApiProperty({ minLength: 6 })
  @IsString()
  @MinLength(6)
  code!: string;
}

export class RefreshDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  refreshToken?: string;

  @ApiPropertyOptional({ enum: ['web', 'mobile'] })
  @IsOptional()
  @IsIn(['web', 'mobile'])
  client?: 'web' | 'mobile';
}

export class MobileRefreshDto {
  @ApiProperty({ description: 'Opaque refresh token from login or prior refresh' })
  @IsString()
  @MinLength(32)
  refreshToken!: string;
}

export class LogoutDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

export class MobileLogoutDto {
  @ApiProperty({ description: 'Refresh token to revoke' })
  @IsString()
  @MinLength(32)
  refreshToken!: string;
}

export class ForgotPasswordDto {
  @ApiProperty()
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  token!: string;

  @ApiProperty({ minLength: 1 })
  @IsString()
  @MinLength(1)
  newPassword!: string;
}

export class InviteUserDto {
  @ApiProperty({ minLength: 2 })
  @IsString()
  @MinLength(2)
  username!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty()
  @IsString()
  firstName!: string;

  @ApiProperty()
  @IsString()
  lastName!: string;

  @ApiProperty()
  @IsString()
  roleCode!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;
}

export class UpdateMeDto {
  @ApiPropertyOptional({ minLength: 1 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  firstName?: string;

  @ApiPropertyOptional({ minLength: 1 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ enum: LOCALES })
  @IsOptional()
  @IsIn([...LOCALES])
  preferredLanguage?: (typeof LOCALES)[number];
}

export class ChangePasswordDto {
  @ApiProperty({ minLength: 1 })
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @ApiProperty({ minLength: 1 })
  @IsString()
  @MinLength(1)
  newPassword!: string;
}
