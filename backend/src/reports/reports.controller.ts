import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReportsService } from './reports.service';

@ApiTags('reports') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('reports')
export class ReportsController {
  constructor(private r:ReportsService) {}
  @Get() getAll(@Request() req){return this.r.getAll(req.user.id);}
  @Post() create(@Request() req,@Body() dto:{symbol:string;content:any}){return this.r.create(req.user.id,dto.symbol,dto.content);}
  @Get('prompts/bullish') bullish(@Body() d:any){return{prompt:this.r.generateBullishPrompt(d)};}
  @Get('prompts/bearish') bearish(@Body() d:any){return{prompt:this.r.generateBearishPrompt(d)};}
  @Get('prompts/neutral') neutral(@Body() d:any){return{prompt:this.r.generateNeutralPrompt(d)};}
}
