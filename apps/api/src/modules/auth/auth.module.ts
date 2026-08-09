import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthMobileController } from './auth-mobile.controller';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController, AuthMobileController],
  providers: [AuthService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
