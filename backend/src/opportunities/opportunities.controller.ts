import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { OpportunitiesService } from './opportunities.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('opportunities')
export class OpportunitiesController {
  constructor(private readonly opportunitiesService: OpportunitiesService) {}

  @Get()
  async getOpportunities(
    @Query('limit') limit?: string,
    @Query('minScore') minScore?: string,
  ) {
    return this.opportunitiesService.getTopOpportunities(
      limit ? parseInt(limit) : 10,
      minScore ? parseFloat(minScore) : 0,
    );
  }

  @Get('ranked')
  async getRanked(@Query('limit') limit?: string) {
    return this.opportunitiesService.getRankedOpportunities(limit ? parseInt(limit) : 10);
  }
}
