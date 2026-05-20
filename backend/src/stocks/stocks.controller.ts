import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StocksService } from './stocks.service';

@ApiTags('stocks') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('stocks')
export class StocksController {
  constructor(private s: StocksService) {}
  @Get() getAll() { return this.s.getAll(); }
  @Get('search') search(@Query('q') q: string) { return this.s.searchStocks(q); }
  @Get(':symbol') getBySymbol(@Param('symbol') sym: string) { return this.s.getBySymbol(sym); }
  @Get(':symbol/quote') getQuote(@Param('symbol') sym: string) { return this.s.getQuote(sym); }
  @Get(':symbol/fundamentals') getFundamentals(@Param('symbol') sym: string) { return this.s.getFundamentals(sym); }
  @Get(':symbol/technicals') getTechnicals(@Param('symbol') sym: string) { return this.s.getTechnicals(sym); }
  @Get(':symbol/analyst') getAnalyst(@Param('symbol') sym: string) { return this.s.getAnalystRatings(sym); }
  @Get(':symbol/history') getHistory(@Param('symbol') sym: string) { return this.s.getHistoricalPrices(sym); }
}
