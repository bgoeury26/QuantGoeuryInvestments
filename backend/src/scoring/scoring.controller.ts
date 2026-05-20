import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ScoringService } from './scoring.service';

@ApiTags('scoring') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('scoring')
export class ScoringController {
  constructor(private scoringService: ScoringService) {}
  @Get('stock/:stockId') getScore(@Param('stockId') id: string) { return this.scoringService.getLatestScore(id); }
  @Get('opportunities') getTopOpportunities() { return this.scoringService.getTopOpportunities(10); }
}
