import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AlphaService } from './alpha.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('alpha')
export class AlphaController {
  constructor(private readonly alphaService: AlphaService) {}

  @Get('signals/:symbol')
  async getSignals(@Param('symbol') symbol: string) {
    return this.alphaService.analyzeSymbol(symbol);
  }

  @Get('opportunities')
  async getOpportunities(@Query('limit') limit?: string) {
    return this.alphaService.getTopOpportunities(limit ? parseInt(limit) : 10);
  }

  @Get('anomaly/:symbol')
  async getAnomaly(@Param('symbol') symbol: string) {
    return this.alphaService.detectAnomaly(symbol);
  }
}
