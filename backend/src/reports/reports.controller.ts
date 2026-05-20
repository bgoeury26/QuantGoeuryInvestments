import { Controller, Get, Post, Param, Request, Res, UseGuards, HttpCode } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReportsService } from './reports.service';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private svc: ReportsService) {}

  @Get()
  list(@Request() req: any) { return this.svc.listReports(req.user.sub); }

  @Post(':symbol')
  @HttpCode(200)
  async generate(@Param('symbol') symbol: string, @Request() req: any) {
    return this.svc.generateReport(symbol.toUpperCase(), req.user.sub);
  }

  @Get(':id/download')
  async download(@Param('id') id: string, @Res() res: Response) {
    const buf = await this.svc.downloadReport(id);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="report-${id}.pdf"` });
    res.send(buf);
  }
}
