import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AlphaService } from './alpha.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('alpha')
@UseGuards(JwtAuthGuard)
export class AlphaController {
  constructor(private readonly svc: AlphaService) {}

  @Get(':symbol')
  async byId(@Param('symbol') symbol: string) {
    return this.svc.getAnomalyBySymbol(symbol);
  }

  @Get('signals/recent')
  async recent() {
    return this.svc.getRecentSignals();
  }
}
