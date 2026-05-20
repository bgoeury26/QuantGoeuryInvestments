import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StocksService } from './stocks.service';

@ApiTags('stocks') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('stocks')
export class StocksController {
  constructor(private s:StocksService) {}
  @Get() getAll() { return this.s.getAll(); }
  @Get('search') search(@Query('q') q:string) { return this.s.search(q); }
  @Get(':sym') get(@Param('sym') sym:string) { return this.s.getBySymbol(sym); }
  @Get(':sym/quote') quote(@Param('sym') sym:string) { return this.s.getQuote(sym); }
  @Get(':sym/fundamentals') fund(@Param('sym') sym:string) { return this.s.getFundamentals(sym); }
  @Get(':sym/technicals') tech(@Param('sym') sym:string) { return this.s.getTechnicals(sym); }
  @Get(':sym/analyst') analyst(@Param('sym') sym:string) { return this.s.getAnalystRatings(sym); }
  @Get(':sym/history') history(@Param('sym') sym:string) { return this.s.getHistory(sym); }
}
