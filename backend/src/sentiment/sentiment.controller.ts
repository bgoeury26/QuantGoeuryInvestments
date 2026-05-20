import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SentimentService } from './sentiment.service';

@ApiTags('sentiment') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('sentiment')
export class SentimentController {
  constructor(private s: SentimentService) {}
  @Get(':symbol/news') getNews(@Param('symbol') sym: string) { return this.s.getNewsSentiment(sym); }
  @Get(':symbol/reddit') getReddit(@Param('symbol') sym: string) { return this.s.getRedditSentiment(sym); }
  @Get(':symbol/gdelt') getGdelt(@Param('symbol') sym: string) { return this.s.getGdeltSentiment(sym); }
  @Get(':symbol/aggregated') getAggregated(@Param('symbol') sym: string) { return this.s.getAggregated(sym, sym); }
}
