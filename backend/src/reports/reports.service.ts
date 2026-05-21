import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScoringService, ScoreResult } from '../scoring/scoring.service';
import { AlphaService, AnomalyResult } from '../alpha/alpha.service';
import { SignalType } from '@prisma/client';

export interface AIAnalystView {
  recommendation: string;
  confidence: number;
  reasoning: string;
}

export interface AIAnalysis {
  bullish: AIAnalystView;
  bearish: AIAnalystView;
  neutral: AIAnalystView;
}

export interface ReportPayload {
  id: string;
  userId: string;
  symbol: string;
  title: string;
  content: unknown;
  pdfPath: string | null;
  createdAt: Date;
  ai: AIAnalysis;
  score: ScoreResult;
  anomaly: AnomalyResult;
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scoringService: ScoringService,
    private readonly alphaService: AlphaService,
  ) {}

  async generateReport(symbol: string, userId: string): Promise<ReportPayload> {
    const [score, anomaly] = await Promise.all([
      this.scoringService.computeScore(symbol),
      this.alphaService.detectAnomaly(symbol),
    ]);

    const ai = this.generateAIAnalysis(score, anomaly);

    const report = await this.prisma.report.create({
      data: {
        user: { connect: { id: userId } },
        symbol,
        title: `${symbol} — AI Research Report`,
        content: {
          finalScore: score.finalScore,
          confidence: score.confidence,
          fundamental: score.fundamental,
          technical: score.technical,
          sentiment: score.sentiment,
          institutional: score.institutional,
          analyst: score.analyst,
          political: score.political,
          macro: score.macro,
          anomalyScore: anomaly.anomalyScore,
          signalType: anomaly.signalType,
          drivers: anomaly.drivers,
          isEarlyOpportunity: anomaly.isEarlyOpportunity,
          aiBullish: ai.bullish.recommendation,
          aiBullishConf: ai.bullish.confidence,
          aiBearish: ai.bearish.recommendation,
          aiBearishConf: ai.bearish.confidence,
          aiNeutral: ai.neutral.recommendation,
          aiNeutralConf: ai.neutral.confidence,
        },
      },
    });

    return { ...report, ai, score, anomaly };
  }

  async getReport(id: string) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundException(`Report ${id} not found`);
    return report;
  }

  async getUserReports(userId: string) {
    return this.prisma.report.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async downloadReport(id: string): Promise<Buffer> {
    const report = await this.getReport(id);
    try {
      let puppeteer: any = null;
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        puppeteer = require('puppeteer');
      } catch {
        puppeteer = null;
      }
      if (puppeteer) {
        const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
        const page = await browser.newPage();
        await page.setContent(this.buildReportHtml(report));
        const pdf = await page.pdf({ format: 'A4', printBackground: true });
        await browser.close();
        return Buffer.from(pdf);
      }
    } catch (e) {
      this.logger.warn(`PDF generation failed: ${e}`);
    }
    return Buffer.from(JSON.stringify(report, null, 2), 'utf-8');
  }

  private generateAIAnalysis(score: ScoreResult, anomaly: AnomalyResult): AIAnalysis {
    const bullishConf = Math.min((score.finalScore / 10) * 0.8 + 0.2, 0.95);
    const bearishConf = Math.max(1 - bullishConf - 0.1, 0.15);
    return {
      bullish: {
        recommendation: score.finalScore >= 6
          ? `Strong BUY — composite score ${score.finalScore.toFixed(1)}/10`
          : `Cautious BUY — score ${score.finalScore.toFixed(1)}/10, monitor for confirmation`,
        confidence: bullishConf,
        reasoning: `Fundamental ${score.fundamental.toFixed(1)}, Technical ${score.technical.toFixed(1)}. Drivers: ${anomaly.drivers.join(', ')}.`,
      },
      bearish: {
        recommendation: score.finalScore < 4
          ? `SELL — risk/reward unfavourable at score ${score.finalScore.toFixed(1)}/10`
          : `HOLD with caution — limited upside`,
        confidence: bearishConf,
        reasoning: `Sentiment ${score.sentiment.toFixed(1)}, anomaly ${anomaly.anomalyScore.toFixed(2)}. Signal: ${anomaly.signalType}.`,
      },
      neutral: {
        recommendation: `HOLD — balanced risk. Score ${score.finalScore.toFixed(1)}/10`,
        confidence: 0.5,
        reasoning: `Macro ${score.macro.toFixed(1)}, Analyst ${score.analyst.toFixed(1)}, Political ${score.political.toFixed(1)}.`,
      },
    };
  }

  private buildReportHtml(report: any): string {
    const c = report.content as any;
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${report.symbol} Report</title>
    <style>body{font-family:sans-serif;padding:40px;background:#0f0f0f;color:#fff}h1{color:#4f98a3}</style></head>
    <body><h1>QuantGoeuryInvestments — ${report.symbol}</h1>
    <p>Final Score: <strong>${c?.finalScore ?? 'N/A'}</strong> / 10</p>
    <p>Signal: <strong>${c?.signalType ?? 'N/A'}</strong></p>
    <p>Generated: ${new Date(report.createdAt).toLocaleString()}</p>
    </body></html>`;
  }
}
