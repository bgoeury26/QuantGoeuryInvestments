import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const user = ctx.switchToHttp().getRequest().user;
    if (!user || user.role !== 'ADMIN') throw new ForbiddenException('Admin only');
    return true;
  }
}
