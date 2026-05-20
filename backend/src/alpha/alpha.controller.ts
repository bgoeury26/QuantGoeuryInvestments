import { Controller, Get, Param, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AlphaService } from './alpha.service';

@ApiTags('alpha')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('alpha')
export class AlphaController {
  constructor(private a: AlphaService) {}

  /** GET /alpha/signals/:stockId — signals for a specific stock DB id */
  @Get('signals/:id')
  byId(@Param('id') id: string) {
    return this.a.getLatestSignals(id);
  }

  /** GET /alpha/signals/recent — most recent signals across all stocks (dashboard) */
  @Get('signals/recent')
  recent(@Query('limit') limit = '20') {
    return this.a.getRecentSignals(parseInt(limit));
  }

  /** GET /alpha/early-opportunities — stocks with earlyFlag=true */
  @Get('early-opportunities')
  early() {
    return this.a.getEarlyOpportunities();
  }

  /** GET /alpha/anomaly/:symbol — compute on-the-fly anomaly for a symbol */
  @Get('anomaly/:symbol')
  anomaly(@Param('symbol') symbol: string) {
    return this.a.getAnomalyBySymbol(symbol);
  }
}
