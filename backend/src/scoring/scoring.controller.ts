import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ScoringService } from './scoring.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('scoring')
export class ScoringController {
  constructor(private readonly scoringService: ScoringService) {}

  @Get(':symbol')
  async getScore(@Param('symbol') symbol: string) {
    return this.scoringService.computeScore(symbol);
  }

  @Get(':symbol/confidence')
  async getConfidence(@Param('symbol') symbol: string) {
    return this.scoringService.getConfidence(symbol);
  }
}
