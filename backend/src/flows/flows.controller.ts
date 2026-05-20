import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FlowsService } from './flows.service';

@ApiTags('flows')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('flows')
export class FlowsController {
  constructor(private flowsService: FlowsService) {}
  @Get(':symbol/institutional') getInstitutional(@Param('symbol') s: string) { return this.flowsService.getInstitutionalHoldings(s); }
  @Get(':symbol/insider') getInsider(@Param('symbol') s: string) { return this.flowsService.getInsiderTrades(s); }
  @Get(':symbol/political') getPolitical(@Param('symbol') s: string) { return this.flowsService.getPoliticalTrades(s); }
  @Get(':symbol/summary') getSummary(@Param('symbol') s: string) { return this.flowsService.getFlowSummary(s); }
}
