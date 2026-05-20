import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OpportunitiesService } from './opportunities.service';

@ApiTags('opportunities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('opportunities')
export class OpportunitiesController {
  constructor(private opService: OpportunitiesService) {}
  @Get('top') getTop(@Query('limit') limit = 10) { return this.opService.getTopOpportunities(+limit); }
  @Get('early') getEarly() { return this.opService.getEarlyOpportunities(); }
}
