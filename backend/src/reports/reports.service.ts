import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScoringService, ScoreResult } from '../scoring/scoring.service';
import { AlphaService, AnomalyResult } from '../alpha/alpha.service';

interface AIAnalysis {
  bullish: { recommendation: string; confidence: number; reasoning: string };
  bearish: { recommendation: string; confidence: number; reasoning: string };
  neutral: { recommendation: string; confidence: number; reasoning: string };
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scoringService: ScoringService,
    private readonly alphaService: AlphaService,
  ) {}

  async generateReport(symbol: string) {
    const [score, anomaly] = await Promise.all([
      this.scoringService.computeScore(symbol),
      this.alphaService.detectAnomaly(symbol),
    ]);

    const ai = this.generateAIAnalysis(score, anomaly);

    const reportData = {
      symbol,
      finalScore: score.finalScore,
      anomalyScore: anomaly.anomalyScore,
      fundamental: score.fundamental,
      technical: score.technical,
      sentiment: score.sentiment,
      signalType: anomaly.signalType,
      drivers: anomaly.drivers,
      aiBullish: ai.bullish.recommendation,
      aiBullishConf: ai.bullish.confidence,
      aiBearish: ai.bearish.recommendation,
      aiBearishConf: ai.bearish.confidence,
      aiNeutral: ai.neutral.recommendation,
      aiNeutralConf: ai.neutral.confidence,
    };

    const report = await this.prisma.report.create({
      data: reportData,
    });

    return { ...report, ai };
  }

  async getReport(id: string) {
    const report = await this.prisma.report.findUnique({
      where: { id },
    });
    if (!report) throw new NotFoundException(`Report ${id} not found`);
    return report;
  }

  async downloadReport(id: string): Promise<Buffer> {
    const report = await this.getReport(id);

    // Try Puppeteer PDF generation, fall back to plain JSON buffer
    try {
      const puppeteer = await import('puppeteer').catch(() => null) as any;
      if (puppeteer) {
        const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        const html = this.buildReportHtml(report);
        await page.setContent(html);
        const pdf = await page.pdf({ format: 'A4', printBackground: true });
        await browser.close();
        return Buffer.from(pdf);
      }
    } catch (e) {
      this.logger.warn(`Puppeteer PDF failed, returning JSON: ${e}`);
    }

    return Buffer.from(JSON.stringify(report, null, 2), 'utf-8');
  }

  private generateAIAnalysis(score: ScoreResult, anomaly: AnomalyResult): AIAnalysis {
    const bullishConf = Math.min(score.finalScore / 10 * 0.8 + 0.2, 0.95);
    const bearishConf = Math.max(1 - bullishConf - 0.1, 0.15);

    return {
      bullish: {
        recommendation: score.finalScore >= 6
          ? `Strong BUY — composite score ${score.finalScore}/10 with ${(bullishConf * 100).toFixed(0)}% confidence`
          : `Cautious BUY — score ${score.finalScore}/10, monitor for confirmation`,
        confidence: bullishConf,
        reasoning: `Fundamental score ${score.fundamental.toFixed(1)}, Technical ${score.technical.toFixed(1)}. Drivers: ${anomaly.drivers.join(', ')}.`,
      },
      bearish: {
        recommendation: score.finalScore < 4
          ? `SELL — risk/reward unfavourable at score ${score.finalScore}/10`
          : `HOLD with caution — limited upside at current valuation`,
        confidence: bearishConf,
        reasoning: `Sentiment score ${score.sentiment.toFixed(1)}, anomaly ${anomaly.anomalyScore.toFixed(2)}. Signal: ${anomaly.signalType}.`,
      },
      neutral: {
        recommendation: `HOLD — balanced risk. Score ${score.finalScore}/10, anomaly ${anomaly.anomalyScore.toFixed(2)}`,
        confidence: 0.5,
        reasoning: `Macro score ${score.macro.toFixed(1)}, Analyst ${score.analyst.toFixed(1)}, Political ${score.political.toFixed(1)}.`,
      },
    };
  }

  private buildReportHtml(report: any): string {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Report ${report.symbol}</title>
    <style>body{font-family:sans-serif;padding:40px;background:#0f0f0f;color:#fff}
    h1{color:#4f98a3}table{border-collapse:collapse;width:100%}td,th{border:1px solid #333;padding:8px}</style></head>
    <body><h1>QuantGoeuryInvestments — ${report.symbol}</h1>
    <p>Final Score: <strong>${report.finalScore}</strong> / 10</p>
    <p>Anomaly Score: <strong>${report.anomalyScore}</strong></p>
    <p>Signal Type: <strong>${report.signalType}</strong></p>
    <p>Generated: ${new Date(report.createdAt).toLocaleString()}</p>
    </body></html>`;
  }
}
