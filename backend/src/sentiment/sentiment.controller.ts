import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SentimentService } from './sentiment.service';

@ApiTags('sentiment') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('sentiment')
export class SentimentController {
  constructor(private s:SentimentService) {}
  @Get(':sym/news') news(@Param('sym') sym:string){return this.s.getNews(sym);}
  @Get(':sym/reddit') reddit(@Param('sym') sym:string){return this.s.getReddit(sym);}
  @Get(':sym/gdelt') gdelt(@Param('sym') sym:string){return this.s.getGdelt(sym);}
}
