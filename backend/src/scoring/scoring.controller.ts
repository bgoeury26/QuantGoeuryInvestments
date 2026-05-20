import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ScoringService } from './scoring.service';

@ApiTags('scoring') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('scoring')
export class ScoringController {
  constructor(private s: ScoringService) {}
  @Get('stock/:id') score(@Param('id') id:string) { return this.s.getLatestScore(id); }
  @Get('opportunities') top() { return this.s.getTopOpportunities(10); }
}
