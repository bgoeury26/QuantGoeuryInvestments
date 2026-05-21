import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ScoringService } from './scoring.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('scoring')
@UseGuards(JwtAuthGuard)
export class ScoringController {
  constructor(private readonly scoringService: ScoringService) {}

  @Get('score/:symbol')
  getScore(@Param('symbol') symbol: string) {
    return this.scoringService.computeScore(symbol);
  }

  @Get('top')
  getTopOpportunities() {
    return this.scoringService.getTopOpportunities();
  }

  @Get('confidence/:symbol')
  async getConfidence(@Param('symbol') symbol: string) {
    const score = await this.scoringService.computeScore(symbol);
    return { symbol, confidence: score.confidence };
  }
}
