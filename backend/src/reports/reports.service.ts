import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { ScoringService } from '../scoring/scoring.service';
import { AlphaService } from '../alpha/alpha.service';

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private ai: AiService,
    private scoring: ScoringService,
    private alpha: AlphaService,
  ) {}

  async generateReport(symbol: string, userId: string) {
    // Upsert stock
    let stock = await this.prisma.stock.findUnique({ where: { symbol } });
    if (!stock) {
      stock = await this.prisma.stock.create({
        data: { symbol, name: symbol },
      });
    }

    // Get latest score
    const score = await this.scoring.computeScore(symbol);

    // Get alpha signals
    const anomaly = await this.alpha.detectAnomaly(symbol);

    // Save or upsert opportunity
    await this.prisma.opportunity.upsert({
      where: { stockId: stock.id },
      update: {
        finalScore: score.finalScore,
        anomalyScore: anomaly.anomalyScore,
        rankingScore: score.finalScore + anomaly.anomalyScore * 2,
        signalType: anomaly.signalType,
        earlyFlag: anomaly.earlySignal,
        drivers: anomaly.drivers,
      },
      create: {
        stockId: stock.id,
        finalScore: score.finalScore,
        anomalyScore: anomaly.anomalyScore,
        rankingScore: score.finalScore + anomaly.anomalyScore * 2,
        signalType: anomaly.signalType,
        earlyFlag: anomaly.earlySignal,
        drivers: anomaly.drivers,
      },
    });

    // Build AI payload - ensure drivers is string[]
    const latestOpp = await this.prisma.opportunity.findUnique({
      where: { stockId: stock.id },
      include: { stock: true },
    });

    const driversArr: string[] = Array.isArray(latestOpp?.drivers)
      ? (latestOpp!.drivers as unknown as string[])
      : [];

    const aiPayload = {
      symbol,
      finalScore: score.finalScore,
      anomalyScore: anomaly.anomalyScore,
      fundamental: score.fundamental,
      technical: score.technical,
      sentiment: score.sentiment,
      signalType: anomaly.signalType,
      drivers: driversArr.join(', '),
    };

    const [bullishRes, bearishRes, neutralRes] = await Promise.allSettled([
      this.ai.analyzeStock({ ...aiPayload, perspective: 'bullish' }),
      this.ai.analyzeStock({ ...aiPayload, perspective: 'bearish' }),
      this.ai.analyzeStock({ ...aiPayload, perspective: 'neutral' }),
    ]);

    const bullish =
      bullishRes.status === 'fulfilled' ? bullishRes.value : null;
    const bearish =
      bearishRes.status === 'fulfilled' ? bearishRes.value : null;
    const neutral =
      neutralRes.status === 'fulfilled' ? neutralRes.value : null;

    // Save report
    const report = await this.prisma.report.create({
      data: {
        userId,
        stockId: stock.id,
        symbol,
        title: `${symbol} Analysis Report`,
        content: {
          score,
          anomaly,
          ai: { bullish, bearish, neutral },
        },
      },
    });

    return report;
  }

  async getReport(id: string, userId: string) {
    const report = await this.prisma.report.findFirst({
      where: { id, userId },
      include: { stock: true },
    });
    if (!report) throw new NotFoundException('Report not found');
    return report;
  }

  async listReports(userId: string) {
    return this.prisma.report.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async downloadReport(id: string): Promise<Buffer> {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');

    // Attempt puppeteer PDF generation — falls back to JSON buffer if unavailable
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const puppeteer = await import('puppeteer').catch(() => null);
      if (!puppeteer) {
        return Buffer.from(JSON.stringify(report.content, null, 2));
      }
      const browser = await (puppeteer as any).launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      const page = await browser.newPage();
      const html = buildReportHtml(report as any);
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({ format: 'A4', printBackground: true });
      await browser.close();
      return pdf as unknown as Buffer;
    } catch (_) {
      return Buffer.from(JSON.stringify(report.content, null, 2));
    }
  }
}

function buildReportHtml(report: {
  title: string;
  symbol: string;
  content: any;
  createdAt: Date;
}): string {
  const c = report.content || {};
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${report.title}</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 40px; color: #1a1a2e; }
    h1 { color: #01696f; }
    .section { margin-bottom: 24px; }
    .label { font-weight: 600; color: #555; font-size: 12px; text-transform: uppercase; }
    .value { font-size: 18px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; }
    td, th { padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px; }
  </style>
</head>
<body>
  <h1>${report.title}</h1>
  <p>Generated: ${new Date(report.createdAt).toLocaleDateString()}</p>
  <div class="section">
    <div class="label">Final Score</div>
    <div class="value">${c.score?.finalScore?.toFixed(2) ?? 'N/A'} / 10</div>
  </div>
  <div class="section">
    <div class="label">Anomaly Score</div>
    <div class="value">${((c.anomaly?.anomalyScore ?? 0) * 100).toFixed(0)}%</div>
  </div>
  <div class="section">
    <div class="label">Signal Type</div>
    <div class="value">${c.anomaly?.signalType ?? 'N/A'}</div>
  </div>
  <div class="section">
    <div class="label">Key Drivers</div>
    <p>${(c.anomaly?.drivers ?? []).join(', ') || 'None'}</p>
  </div>
  <div class="section">
    <div class="label">AI Analysis</div>
    <p><strong>Bullish:</strong> ${c.ai?.bullish?.recommendation ?? 'N/A'}</p>
    <p><strong>Bearish:</strong> ${c.ai?.bearish?.recommendation ?? 'N/A'}</p>
    <p><strong>Neutral:</strong> ${c.ai?.neutral?.recommendation ?? 'N/A'}</p>
  </div>
</body>
</html>`;
}
