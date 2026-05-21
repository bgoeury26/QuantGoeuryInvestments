import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ScoringService, ScoreResult } from './scoring.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('scoring')
@UseGuards(JwtAuthGuard)
export class ScoringController {
  constructor(private readonly s: ScoringService) {}

  @Get(':stockId')
  async score(@Param('stockId') id: string): Promise<ScoreResult | null> {
    return this.s.getLatestScore(id);
  }
}
