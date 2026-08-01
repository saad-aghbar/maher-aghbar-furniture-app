import { IsEmail, IsIn, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

export class LoginDto {
  @ValidateIf((o: LoginDto) => !o.phone)
  @IsEmail()
  email?: string;

  @ValidateIf((o: LoginDto) => !o.email)
  @IsString()
  phone?: string;

  @IsString()
  @MinLength(8)
  password!: string;

  /** web keeps cookie-only JSON; mobile also receives tokens in the body */
  @IsOptional()
  @IsIn(['web', 'mobile'])
  client?: 'web' | 'mobile';
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
  @IsEmail()
  email!: string;

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
