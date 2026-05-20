import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}
  @Get() getAll(@Request() req) { return this.reportsService.getUserReports(req.user.id); }
  @Get(':id') getOne(@Request() req, @Param('id') id: string) { return this.reportsService.getReport(id, req.user.id); }
  @Post() create(@Request() req, @Body() body: { symbol: string; title: string; content: any }) {
    return this.reportsService.createReport(req.user.id, body.symbol, body.title, body.content);
  }
  @Get(':symbol/prompts') getPrompts(@Param('symbol') symbol: string, @Body() data: any) {
    return this.reportsService.generateAnalystPrompts(symbol, data);
  }
}
