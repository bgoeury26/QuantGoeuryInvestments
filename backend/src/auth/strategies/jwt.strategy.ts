import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private users: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') || 'fallback-dev-secret-change-me',
    });
  }

  async validate(payload: { sub: string; email: string; role: string; status?: string }) {
    // Fast-path: reject non-APPROVED tokens immediately
    if (payload.status && payload.status !== 'APPROVED') {
      throw new UnauthorizedException('Account not approved');
    }

    // DB check — catches status changes after token issuance
    const user = await this.users.findById(payload.sub);
    if (!user) throw new UnauthorizedException('User not found');
    if (user.status !== 'APPROVED') throw new UnauthorizedException('Account not approved');

    return {
      sub: payload.sub,
      email: payload.email,
      role: user.role,
      status: user.status,
    };
  }
}
