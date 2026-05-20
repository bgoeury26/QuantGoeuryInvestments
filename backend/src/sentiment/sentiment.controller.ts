import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SentimentService } from './sentiment.service';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Sentiment')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sentiment')
export class SentimentController {
  constructor(private svc: SentimentService) {}

  @Get(':symbol')
  get(@Param('symbol') symbol: string) { return this.svc.getSentiment(symbol); }

  @Get(':symbol/news')
  news(@Param('symbol') symbol: string) { return this.svc.getNewsArticles(symbol); }

  @Get(':symbol/social')
  social(@Param('symbol') symbol: string) { return this.svc.getSocialMentions(symbol); }

  @Get(':symbol/velocity')
  velocity(@Param('symbol') symbol: string) { return this.svc.getVelocity(symbol); }
}
