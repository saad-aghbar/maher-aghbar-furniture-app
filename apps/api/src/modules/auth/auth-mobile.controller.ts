import { Body, Controller, Post, Req } from '@nestjs/common';
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from '../../common/decorators/auth.decorators';
import { AuthService } from './auth.service';
import { MobileLoginDto, MobileLogoutDto, MobileRefreshDto } from './dto/auth.dto';

/**
 * Cookie-free mobile auth. Prefer these over `client: 'mobile'` on shared `/auth/*` routes.
 * Web cookie login is unchanged on `/auth/login`.
 */
@ApiTags('auth-mobile')
@Controller('auth/mobile')
export class AuthMobileController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @ApiOperation({
    summary: 'Mobile login',
    description:
      'Username + password authentication. Returns short-lived access JWT and rotating opaque refresh token in the JSON body. Does not set cookies.',
  })
  @ApiBody({ type: MobileLoginDto })
  @ApiOkResponse({
    description: 'Authenticated; store accessToken and refreshToken securely (e.g. SecureStore).',
  })
  @ApiUnauthorizedResponse({
    description: 'INVALID_CREDENTIALS | ACCOUNT_LOCKED | ACCOUNT_SUSPENDED | MFA_REQUIRED | MFA_INVALID',
  })
  login(@Body() dto: MobileLoginDto, @Req() req: Request) {
    return this.auth.loginMobile(dto, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @ApiOperation({
    summary: 'Mobile refresh',
    description:
      'Rotates the refresh token (old session revoked). Rejects suspended accounts. Persist the new refresh token.',
  })
  @ApiBody({ type: MobileRefreshDto })
  @ApiOkResponse({ description: 'New access + refresh tokens' })
  @ApiUnauthorizedResponse({ description: 'UNAUTHORIZED | ACCOUNT_SUSPENDED' })
  refresh(@Body() dto: MobileRefreshDto, @Req() req: Request) {
    return this.auth.refreshMobile(dto.refreshToken, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('logout')
  @ApiOperation({
    summary: 'Mobile logout',
    description: 'Revokes the given refresh session server-side. Access tokens expire naturally (15m).',
  })
  @ApiBody({ type: MobileLogoutDto })
  @ApiOkResponse({ description: '{ ok: true }' })
  logout(@Body() dto: MobileLogoutDto) {
    return this.auth.logoutMobile(dto.refreshToken);
  }
}
