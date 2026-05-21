import { Controller, Get, Post, Param, Body, Res, UseGuards, Request } from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post('generate')
  async generateReport(@Body() body: { symbol: string }, @Request() req: any) {
    return this.reportsService.generateReport(body.symbol, req.user.sub);
  }

  @Get()
  async getUserReports(@Request() req: any) {
    return this.reportsService.getUserReports(req.user.sub);
  }

  @Get(':id')
  async getReport(@Param('id') id: string) {
    return this.reportsService.getReport(id);
  }

  @Get(':id/download')
  async downloadReport(@Param('id') id: string, @Res() res: Response) {
    const buffer = await this.reportsService.downloadReport(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="report-${id}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
