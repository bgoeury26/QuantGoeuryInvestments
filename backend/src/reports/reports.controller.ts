import { Controller, Get, Post, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReportsService } from './reports.service';

@ApiTags('reports') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('reports')
export class ReportsController {
  constructor(private s: ReportsService) {}
  @Get() getUserReports(@Request() req) { return this.s.getUserReports(req.user.id); }
  @Post() createReport(@Request() req, @Body() body: { symbol: string; title: string; content: any }) {
    return this.s.createReport(req.user.id, body.symbol, body.title, body.content);
  }
  @Get(':id') getReport(@Param('id') id: string) { return this.s.getReport(id); }
  @Post(':id/pdf') generatePdf(@Param('id') id: string) { return this.s.generatePdf(id); }
}
