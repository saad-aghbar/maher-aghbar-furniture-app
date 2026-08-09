import { Body, Controller, Delete, Get, Param, Patch, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  InviteUserDto,
  LoginDto,
  LogoutDto,
  ConfirmMfaDto,
  RefreshDto,
  ResetPasswordDto,
  UpdateMeDto,
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
  @ApiOperation({ summary: 'Web (cookie) login; optional client=mobile also returns tokens in body' })
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
  @ApiOperation({ summary: 'Refresh session via cookie or body refreshToken' })
  refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token =
      (req.cookies as { refresh_token?: string } | undefined)?.refresh_token ?? dto.refreshToken;
    return this.auth.refresh(
      token,
      res,
      {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      },
      dto.client,
    );
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
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Web logout; clears cookies and revokes refresh' })
  logout(
    @Body() dto: LogoutDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user?: AuthUser,
  ) {
    const token =
      (req.cookies as { refresh_token?: string } | undefined)?.refresh_token ?? dto.refreshToken;
    return this.auth.logout(token, user?.id, res);
  }

  @Post('logout-all')
  @ApiBearerAuth()
  logoutAll(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    return this.auth.logoutAll(user.id, res);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Current user',
    description: 'Requires Bearer access token (mobile) or access_token cookie (web).',
  })
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  @Patch('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user profile (self-service)' })
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateMeDto) {
    return this.auth.updateMe(user.id, dto);
  }

  @Post('change-password')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change current user password' })
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user.id, dto.currentPassword, dto.newPassword);
  }

  @Get('sessions')
  @ApiBearerAuth()
  sessions(@CurrentUser() user: AuthUser) {
    return this.auth.listSessions(user.id);
  }

  @Delete('sessions/:id')
  @ApiBearerAuth()
  revokeSession(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.auth.revokeSession(user.id, id);
  }

  @Post('invite')
  @ApiBearerAuth()
  @RequirePermissions('user.manage')
  invite(@Body() dto: InviteUserDto, @CurrentUser() user: AuthUser) {
    return this.auth.invite(dto, user.id);
  }

  @Post('mfa/enable')
  @ApiBearerAuth()
  enableMfa(@CurrentUser() user: AuthUser) {
    return this.auth.enableMfa(user.id);
  }

  @Post('mfa/confirm')
  @ApiBearerAuth()
  confirmMfa(@CurrentUser() user: AuthUser, @Body() dto: ConfirmMfaDto) {
    return this.auth.confirmMfa(user.id, dto.code);
  }

  @Post('mfa/disable')
  @ApiBearerAuth()
  disableMfa(@CurrentUser() user: AuthUser) {
    return this.auth.disableMfa(user.id);
  }
}
