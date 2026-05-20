import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async createReport(userId: string, symbol: string, title: string, content: any) {
    return this.prisma.report.create({ data: { userId, symbol, title, content } });
  }

  getUserReports(userId: string) {
    return this.prisma.report.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 });
  }

  getReport(id: string) {
    return this.prisma.report.findUnique({ where: { id } });
  }

  // PDF generation stub — requires Puppeteer running on server
  async generatePdf(reportId: string): Promise<string> {
    const report = await this.getReport(reportId);
    if (!report) throw new Error('Report not found');
    // Puppeteer PDF generation — implemented when running on full server
    // const browser = await puppeteer.launch({ executablePath: process.env.PUPPETEER_EXECUTABLE_PATH });
    // const page = await browser.newPage();
    // await page.setContent(generateHtml(report));
    // const pdf = await page.pdf({ format: 'A4', printBackground: true });
    // await browser.close();
    // return savePdfPath;
    return `/reports/${reportId}.pdf`;
  }
}
