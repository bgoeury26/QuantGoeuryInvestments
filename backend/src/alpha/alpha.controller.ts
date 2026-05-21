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

  @Get('signals/:symbol')
  getSignals(@Param('symbol') symbol: string) {
    return this.alphaService.getLatestSignals(symbol);
  }
}
