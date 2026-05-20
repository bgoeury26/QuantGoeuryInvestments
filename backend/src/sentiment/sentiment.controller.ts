import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { SentimentService } from "./sentiment.service";

@ApiTags("sentiment")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("sentiment")
export class SentimentController {
  constructor(private s: SentimentService) {}
  @Get(":symbol/news") news(@Param("symbol") sym: string) { return this.s.getNewsSentiment(sym); }
  @Get(":symbol/reddit") reddit(@Param("symbol") sym: string) { return this.s.getRedditSentiment(sym); }
  @Get(":symbol/gdelt") gdelt(@Param("symbol") sym: string) { return this.s.getGdeltSentiment(sym); }
  @Get(":symbol/aggregated") agg(@Param("symbol") sym: string, @Query("company") co: string) { return this.s.getAggregated(sym, co || sym); }
}
