import { Controller, Get, Query, Param, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { StocksService } from "./stocks.service";
@ApiTags("stocks") @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller("stocks")
export class StocksController {
  constructor(private s: StocksService) {}
  @Get() getAll() { return this.s.getAll(); }
  @Get("search") search(@Query("q") q: string) { return this.s.searchStocks(q); }
  @Get(":symbol") getBySymbol(@Param("symbol") symbol: string) { return this.s.getBySymbol(symbol); }
  @Get(":symbol/quote") getQuote(@Param("symbol") s: string) { return this.s.getQuote(s); }
  @Get(":symbol/fundamentals") getFundamentals(@Param("symbol") s: string) { return this.s.getFundamentals(s); }
  @Get(":symbol/technicals") getTechnicals(@Param("symbol") s: string) { return this.s.getTechnicals(s); }
  @Get(":symbol/analyst") getAnalyst(@Param("symbol") s: string) { return this.s.getAnalystRatings(s); }
  @Get(":symbol/history") getHistory(@Param("symbol") s: string) { return this.s.getHistoricalPrices(s); }
}
