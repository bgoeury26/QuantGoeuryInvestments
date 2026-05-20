import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FlowsService } from './flows.service';

@ApiTags('flows')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('flows')
export class FlowsController {
  constructor(private f: FlowsService) {}

  /** GET /flows/:sym/institutional — 13F filings */
  @Get(':sym/institutional')
  institutional(@Param('sym') sym: string) {
    return this.f.getInstitutional(sym);
  }

  /** GET /flows/:sym/insider — Form 4 insider trades */
  @Get(':sym/insider')
  insider(@Param('sym') sym: string) {
    return this.f.getInsider(sym);
  }

  /** GET /flows/:sym/political — FEC / Congress trades */
  @Get(':sym/political')
  political(@Param('sym') sym: string) {
    return this.f.getPolitical(sym);
  }

  /** GET /flows/:sym/summary — aggregated flows summary for dashboard */
  @Get(':sym/summary')
  summary(@Param('sym') sym: string) {
    return this.f.getSummary(sym);
  }

  /** GET /flows/summary — global flows summary (top movers) for dashboard */
  @Get('summary')
  globalSummary(@Query('symbols') symbols?: string) {
    const list = symbols ? symbols.split(',') : ['AAPL','NVDA','MSFT','TSLA','META','AMZN','GOOGL','JPM','V','SPY'];
    return this.f.getGlobalSummary(list);
  }

  /** GET /flows/insider-trades — latest insider trades across all symbols */
  @Get('insider-trades')
  recentInsider(@Query('limit') limit = '20') {
    return this.f.getRecentInsiderTrades(parseInt(limit));
  }

  /** GET /flows/political — global political signals */
  @Get('political')
  globalPolitical() {
    return this.f.getRecentPolitical();
  }
}
