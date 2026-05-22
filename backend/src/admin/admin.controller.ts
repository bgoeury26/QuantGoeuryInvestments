import { Controller, Get, Post, Delete, Param, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AdminService } from './admin.service';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private svc: AdminService) {}

  @Get('users')
  users() { return this.svc.getUsers(); }

  @Post('users/:id/approve')
  approve(@Param('id') id: string, @Request() req: any) { return this.svc.approveUser(id, req.user.email); }

  @Post('users/:id/reject')
  reject(@Param('id') id: string, @Request() req: any) { return this.svc.rejectUser(id, req.user.email); }

  @Post('users/:id/suspend')
  suspend(@Param('id') id: string) { return this.svc.suspendUser(id); }

  @Get('metrics')
  metrics() { return this.svc.getMetrics(); }

  // ─── Cache Management ────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Get cache statistics (total, alive, expired, by endpoint)' })
  @Get('cache/stats')
  cacheStats() { return this.svc.getCacheStats(); }

  @ApiOperation({ summary: 'Bust cache for a specific symbol (e.g. TSLA)' })
  @Delete('cache/symbol/:symbol')
  bustSymbol(@Param('symbol') symbol: string) { return this.svc.bustSymbol(symbol); }

  @ApiOperation({ summary: 'Wipe all cache entries' })
  @Delete('cache/all')
  bustAll() { return this.svc.bustAll(); }

  @ApiOperation({ summary: 'Remove only expired cache entries (housekeeping)' })
  @Delete('cache/expired')
  bustExpired() { return this.svc.bustExpired(); }
}
