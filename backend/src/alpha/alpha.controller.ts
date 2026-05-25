import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AlphaService } from './alpha.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('alpha')
@UseGuards(JwtAuthGuard)
export class AlphaController {
  constructor(private readonly alphaService: AlphaService) {}

  @Get('anomaly/:symbol')
  analyzeSymbol(@Param('symbol') symbol: string) {
    return this.alphaService.detectAnomaly(symbol);
  }

  @Get('opportunities')
  getTopOpportunities(@Query('limit') limit?: string) {
    return this.alphaService.getEarlyOpportunities();
  }

  /** Most recent signals across the entire universe (Dashboard widget). */
  // NOTE: must be declared BEFORE /signals/:symbol so Nest's router doesn't
  // interpret "recent" as the symbol parameter.
  @Get('signals/recent')
  getRecentSignals(@Query('limit') limit?: string) {
    return this.alphaService.getRecentSignals(limit ? parseInt(limit) : 8);
  }

  @Get('signals/:symbol')
  getSignals(@Param('symbol') symbol: string) {
    return this.alphaService.getLatestSignals(symbol);
  }
}
