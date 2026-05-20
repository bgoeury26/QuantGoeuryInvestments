import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OpportunitiesService } from './opportunities.service';

@ApiTags('opportunities') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('opportunities')
export class OpportunitiesController {
  constructor(private s: OpportunitiesService) {}
  @Get('top') getTop() { return this.s.getTopOpportunities(10); }
  @Get('early-signals') getEarlySignals() { return this.s.getEarlySignals(); }
}
