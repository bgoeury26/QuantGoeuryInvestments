import {
  Controller,
  Post,
  Get,
  Param,
  Res,
  UseGuards,
  Request,
} from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly svc: ReportsService) {}

  @Post(':symbol')
  async generate(
    @Param('symbol') symbol: string,
    @Request() req: any,
  ) {
    return this.svc.generateReport(symbol.toUpperCase(), req.user.sub);
  }

  @Get()
  async list(@Request() req: any) {
    return this.svc.listReports(req.user.sub);
  }

  @Get(':id')
  async getOne(@Param('id') id: string, @Request() req: any) {
    return this.svc.getReport(id, req.user.sub);
  }

  @Get(':id/pdf')
  async downloadPdf(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const buf = await this.svc.downloadReport(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="report-${id}.pdf"`,
      'Content-Length': buf.length,
    });
    res.end(buf);
  }
}
