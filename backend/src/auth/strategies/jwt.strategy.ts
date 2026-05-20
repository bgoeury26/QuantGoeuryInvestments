import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private users: UsersService) {
    super({
      jwtFromRequest:   ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:      config.get<string>('JWT_SECRET') || 'fallback-dev-secret-change-me',
    });
  }

  /**
   * Validate the decoded JWT payload.
   *
   * We use the `status` claim embedded at login time for a fast path check
   * (avoids one DB round-trip per request in the common case).
   * On every request we still hit the DB to catch revocations / status changes
   * that happened after the token was issued.
   */
  async validate(payload: { sub: string; email: string; role: string; status?: string }) {
    // Fast-path: if the token itself carries a non-APPROVED status, reject now.
    if (payload.status && payload.status !== 'APPROVED')
      throw new UnauthorizedException('Account not approved');

    // Full DB check — catches status changes after token issuance.
    const user = await this.users.findById(payload.sub);
    if (!user) throw new UnauthorizedException('User not found');
    if (user.status !== 'APPROVED') throw new UnauthorizedException('Account not approved');

    return {
      sub:    payload.sub,
      email:  payload.email,
      role:   user.role,    // always use DB role (prevent privilege escalation)
      status: user.status,
    };
  }
}
