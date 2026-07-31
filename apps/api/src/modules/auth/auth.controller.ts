import { Body, Controller, Delete, Get, Param, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import {
  ForgotPasswordDto,
  InviteUserDto,
  LoginDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import { Public, RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '@maher/types';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.login(dto, res, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Public()
  @Post('refresh')
  refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token =
      (req.cookies as { refresh_token?: string } | undefined)?.refresh_token ??
      (req.body as { refreshToken?: string })?.refreshToken;
    return this.auth.refresh(token, res, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Public()
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Public()
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.newPassword);
  }

  @Post('logout')
  logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user?: AuthUser,
  ) {
    const token = (req.cookies as { refresh_token?: string } | undefined)?.refresh_token;
    return this.auth.logout(token, user?.id, res);
  }

  @Post('logout-all')
  logoutAll(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    return this.auth.logoutAll(user.id, res);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  @Get('sessions')
  sessions(@CurrentUser() user: AuthUser) {
    return this.auth.listSessions(user.id);
  }

  @Delete('sessions/:id')
  revokeSession(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.auth.revokeSession(user.id, id);
  }

  @Post('invite')
  @RequirePermissions('user.manage')
  invite(@Body() dto: InviteUserDto, @CurrentUser() user: AuthUser) {
    return this.auth.invite(dto, user.id);
  }

  @Post('mfa/enable')
  enableMfa(@CurrentUser() user: AuthUser) {
    return this.auth.enableMfa(user.id);
  }

  @Post('mfa/disable')
  disableMfa(@CurrentUser() user: AuthUser) {
    return this.auth.disableMfa(user.id);
  }
}
