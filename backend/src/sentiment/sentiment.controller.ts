import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { SentimentService } from "./sentiment.service";
@ApiTags("sentiment") @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller("sentiment")
export class SentimentController {
  constructor(private s: SentimentService) {}
  @Get(":sym/news") news(@Param("sym") s: string) { return this.s.getNewsSentiment(s); }
  @Get(":sym/reddit") reddit(@Param("sym") s: string) { return this.s.getRedditSentiment(s); }
  @Get(":sym/gdelt") gdelt(@Param("sym") s: string) { return this.s.getGdeltSentiment(s); }
  @Get(":sym/aggregated") aggregated(@Param("sym") s: string) { return this.s.getAggregated(s, s); }
}
