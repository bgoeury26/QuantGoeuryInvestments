import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SentimentService } from './sentiment.service';

@ApiTags('sentiment')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sentiment')
export class SentimentController {
  constructor(private sentimentService: SentimentService) {}
  @Get(':symbol/news') getNews(@Param('symbol') s: string) { return this.sentimentService.getNewsSentiment(s); }
  @Get(':symbol/reddit') getReddit(@Param('symbol') s: string) { return this.sentimentService.getRedditSentiment(s); }
  @Get(':symbol/gdelt') getGdelt(@Param('symbol') s: string) { return this.sentimentService.getGdeltSentiment(s); }
}
