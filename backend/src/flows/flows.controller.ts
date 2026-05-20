import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FlowsService } from './flows.service';

@ApiTags('flows') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('flows')
export class FlowsController {
  constructor(private s: FlowsService) {}
  @Get(':symbol/institutional') getInst(@Param('symbol') sym: string) { return this.s.getInstitutional(sym); }
  @Get(':symbol/insider') getInsider(@Param('symbol') sym: string) { return this.s.getInsiderTrades(sym); }
  @Get(':symbol/political') getPolitical(@Param('symbol') sym: string) { return this.s.getPoliticalTrades(sym); }
  @Get(':symbol/summary') getSummary(@Param('symbol') sym: string) { return this.s.getFlowSummary(sym); }
}
