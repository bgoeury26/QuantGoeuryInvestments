import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StocksService } from './stocks.service';

@ApiTags('stocks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('stocks')
export class StocksController {
  constructor(private stocksService: StocksService) {}

  @Get() getAll() { return this.stocksService.getAll(); }
  @Get('search') search(@Query('q') q: string) { return this.stocksService.searchStocks(q); }
  @Get(':symbol') getBySymbol(@Param('symbol') s: string) { return this.stocksService.getBySymbol(s); }
  @Get(':symbol/quote') getQuote(@Param('symbol') s: string) { return this.stocksService.getQuote(s); }
  @Get(':symbol/fundamentals') getFundamentals(@Param('symbol') s: string) { return this.stocksService.getFundamentals(s); }
  @Get(':symbol/technicals') getTechnicals(@Param('symbol') s: string) { return this.stocksService.getTechnicals(s); }
  @Get(':symbol/analyst') getAnalyst(@Param('symbol') s: string) { return this.stocksService.getAnalystRatings(s); }
  @Get(':symbol/history') getHistory(@Param('symbol') s: string) { return this.stocksService.getHistoricalPrices(s); }
}
