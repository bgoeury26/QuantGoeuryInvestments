import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { OpportunitiesService } from './opportunities.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('opportunities')
@UseGuards(JwtAuthGuard)
export class OpportunitiesController {
  constructor(private readonly svc: OpportunitiesService) {}

  @Get('top')
  async getTop(@Query('limit') limit = 10) {
    return this.svc.getTopOpportunities(Number(limit));
  }

  @Get('early')
  async getEarly() {
    return this.svc.getEarlySignals();
  }

  @Get('signals')
  async recentSignals(@Query('limit') limit = 20) {
    return this.svc.getRecentSignals(Number(limit));
  }
}
