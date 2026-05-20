import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OpportunitiesService } from './opportunities.service';
import { AlphaService } from '../alpha/alpha.service';

@ApiTags('opportunities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('opportunities')
export class OpportunitiesController {
  constructor(
    private opps: OpportunitiesService,
    private alpha: AlphaService,
  ) {}

  /** GET /opportunities/top?limit=10 — dynamically ranked opportunities */
  @Get('top')
  async getTop(@Query('limit') limit = '10') {
    return this.opps.getTopOpportunities(parseInt(limit));
  }

  /** GET /opportunities/early — early signal opportunities only */
  @Get('early')
  getEarly() {
    return this.alpha.getEarlyOpportunities();
  }

  /** GET /opportunities/signals/recent — recent signals for dashboard */
  @Get('signals/recent')
  recentSignals(@Query('limit') limit = '20') {
    return this.alpha.getRecentSignals(parseInt(limit));
  }
}
