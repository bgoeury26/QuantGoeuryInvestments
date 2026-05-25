import { Controller, Get, Post, Delete, Param, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AdminService } from './admin.service';
import { ScoringRefreshService } from '../scoring/scoring-refresh.service';
import { DiscoveryService } from '../discovery/discovery.service';
import { DailyDiscoveryJob } from '../discovery/daily-discovery.job';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private svc: AdminService,
    private refresh: ScoringRefreshService,
    private discovery: DiscoveryService,
    private discoveryJob: DailyDiscoveryJob,
  ) {}

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

  // ─── Scoring refresh ────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Status of the scoring-refresh job (last run, counts).' })
  @Get('refresh-scores/status')
  refreshStatus() { return this.refresh.status(); }

  @ApiOperation({ summary: 'Trigger a full scoring refresh across all stocks (runs in background).' })
  @Post('refresh-scores')
  async refreshScores() {
    // Fire-and-forget so the HTTP call doesn't hang for the entire scan.
    // Use the status endpoint to poll for completion.
    this.refresh.refreshAll().catch(() => undefined);
    return { ok: true, message: 'Refresh started. Poll /admin/refresh-scores/status to track progress.' };
  }

  // ─── Daily flow-driven discovery ────────────────────────────────────────────

  @ApiOperation({ summary: 'Status of the daily flow-driven discovery job.' })
  @Get('discover/status')
  discoverStatus() { return this.discoveryJob.status(); }

  @ApiOperation({ summary: 'Manually trigger the discovery + scoring pipeline (runs in background).' })
  @Post('discover-now')
  async discoverNow() {
    this.discoveryJob.runDiscovery().catch(() => undefined);
    return { ok: true, message: 'Discovery started. Poll /admin/discover/status to track progress.' };
  }

  @ApiOperation({ summary: 'Preview cluster-buy candidates without upserting or scoring.' })
  @Get('discover/preview')
  async discoverPreview() {
    return { candidates: await this.discovery.discoverClusterBuys() };
  }
}
