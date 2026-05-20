import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ScoringService } from '../scoring/scoring.service';
import { AlphaService } from '../alpha/alpha.service';

@ApiTags('opportunities') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('opportunities')
export class OpportunitiesController {
  constructor(private scoring:ScoringService, private alpha:AlphaService) {}

  @Get('top')
  async getTop() {
    const [top, early]=await Promise.all([this.scoring.getTopOpportunities(10),this.alpha.getEarlyOpportunities()]);
    return { top, early, generatedAt:new Date().toISOString() };
  }

  @Get('early')
  getEarly() { return this.alpha.getEarlyOpportunities(); }
}
