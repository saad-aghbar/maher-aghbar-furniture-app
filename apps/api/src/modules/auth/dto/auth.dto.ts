import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @MinLength(2)
  username!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  /** Required when the account has MFA enabled. */
  @IsOptional()
  @IsString()
  mfaCode?: string;

  /** web keeps cookie-only JSON; mobile also receives tokens in the body */
  @IsOptional()
  @IsIn(['web', 'mobile'])
  client?: 'web' | 'mobile';
}

export class ConfirmMfaDto {
  @IsString()
  @MinLength(6)
  code!: string;
}

export class RefreshDto {
  @IsOptional()
  @IsString()
  refreshToken?: string;

  @IsOptional()
  @IsIn(['web', 'mobile'])
  client?: 'web' | 'mobile';
}

export class LogoutDto {
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}

export class InviteUserDto {
  @IsString()
  @MinLength(2)
  username!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsString()
  roleCode!: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
