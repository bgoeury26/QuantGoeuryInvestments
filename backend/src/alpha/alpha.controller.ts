import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AlphaService } from './alpha.service';

@ApiTags('alpha')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('alpha')
export class AlphaController {
  constructor(private alphaService: AlphaService) {}

  @Get('signals/:stockId')
  getSignals(@Param('stockId') stockId: string) {
    return this.alphaService.getLatestSignals(stockId);
  }

  @Get('early-opportunities')
  getEarlyOpportunities() {
    return this.alphaService.getEarlyOpportunities();
  }
}
