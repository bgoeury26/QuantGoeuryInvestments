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
    return this.renderPdf(report);
  }

  /**
   * Render a branded one-pager PDF using PDFKit (pure-JS, no Chrome dependency).
   * Layout: header strip, ticker block, composite score bars, alpha signal, AI
   * three-view (bullish/bearish/neutral), disclaimer footer.
   */
  private async renderPdf(report: any): Promise<Buffer> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));

    const c = (report.content ?? {}) as any;
    const ai = {
      bullish: { reco: c.aiBullish, conf: c.aiBullishConf },
      bearish: { reco: c.aiBearish, conf: c.aiBearishConf },
      neutral: { reco: c.aiNeutral, conf: c.aiNeutralConf },
    };

    // ── Header strip ────────────────────────────────────────────────────
    doc.rect(0, 0, 595, 60).fill('#0f1419');
    doc.fillColor('#4f98a3').fontSize(18).font('Helvetica-Bold')
       .text('QuantGoeuryInvestments', 40, 22);
    doc.fillColor('#888').fontSize(9).font('Helvetica')
       .text('AI Research Report', 40, 42);
    doc.fillColor('#fff').fontSize(11).font('Helvetica')
       .text(new Date(report.createdAt).toLocaleString(), 0, 22, { align: 'right', width: 555 });
    doc.fillColor('#888').fontSize(9)
       .text(`Report ID: ${report.id}`, 0, 42, { align: 'right', width: 555 });

    // ── Ticker block ────────────────────────────────────────────────────
    doc.fillColor('#000').fontSize(36).font('Helvetica-Bold')
       .text(report.symbol, 40, 85);
    doc.fillColor('#444').fontSize(11).font('Helvetica')
       .text(report.title ?? '', 40, 132);

    // ── Composite score bars ─────────────────────────────────────────────
    let y = 170;
    doc.fillColor('#0f1419').fontSize(13).font('Helvetica-Bold').text('Composite Score', 40, y);
    y += 22;
    const dims: [string, number | undefined][] = [
      ['Fundamental',   c.fundamental],
      ['Technical',     c.technical],
      ['Sentiment',     c.sentiment],
      ['Institutional', c.institutional],
      ['Analyst',       c.analyst],
      ['Political',     c.political],
      ['Macro',         c.macro],
    ];
    for (const [label, v] of dims) {
      const value = typeof v === 'number' ? v : 0;
      doc.fillColor('#333').fontSize(10).font('Helvetica').text(label, 40, y, { width: 95 });
      doc.rect(145, y + 1, 300, 10).fill('#eee');
      const color = value >= 7.5 ? '#22c55e' : value >= 5 ? '#eab308' : '#ef4444';
      doc.rect(145, y + 1, (value / 10) * 300, 10).fill(color);
      doc.fillColor('#111').fontSize(10).font('Helvetica-Bold')
         .text(value.toFixed(1) + ' / 10', 460, y, { width: 95, align: 'right' });
      y += 18;
    }
    y += 6;
    doc.moveTo(40, y).lineTo(555, y).strokeColor('#ddd').stroke();
    y += 14;
    doc.fillColor('#0f1419').fontSize(13).font('Helvetica-Bold')
       .text(`Final Score: ${Number(c.finalScore ?? 0).toFixed(1)} / 10`, 40, y);
    doc.fillColor('#666').fontSize(10).font('Helvetica')
       .text(`Confidence: ${((c.confidence ?? 1) * 100).toFixed(0)}%`, 0, y + 2, { align: 'right', width: 555 });
    y += 30;

    // ── Alpha signal ────────────────────────────────────────────────────
    doc.fillColor('#0f1419').fontSize(13).font('Helvetica-Bold').text('Alpha Signal', 40, y);
    y += 20;
    doc.fillColor('#333').fontSize(10).font('Helvetica')
       .text(`Type: `, 40, y, { continued: true })
       .font('Helvetica-Bold').text(c.signalType ?? 'N/A');
    y += 16;
    doc.font('Helvetica').text(`Anomaly score: `, 40, y, { continued: true })
       .font('Helvetica-Bold').text(`${((c.anomalyScore ?? 0) * 100).toFixed(0)}%`);
    y += 16;
    doc.font('Helvetica').text(`Early opportunity: `, 40, y, { continued: true })
       .font('Helvetica-Bold').text(c.isEarlyOpportunity ? 'Yes' : 'No');
    y += 16;
    if (Array.isArray(c.drivers) && c.drivers.length) {
      doc.font('Helvetica').text('Drivers:', 40, y);
      y += 14;
      for (const d of c.drivers) {
        doc.fillColor('#555').text(`  • ${d}`, 40, y);
        y += 13;
      }
    }
    y += 10;

    // ── AI three-view ───────────────────────────────────────────────────
    doc.fillColor('#0f1419').fontSize(13).font('Helvetica-Bold').text('AI Three-View Analysis', 40, y);
    y += 20;
    const renderView = (title: string, accent: string, reco: any, conf: any) => {
      doc.rect(40, y, 515, 50).fill('#fafafa').stroke('#e5e5e5');
      doc.fillColor(accent).fontSize(11).font('Helvetica-Bold').text(title, 50, y + 8);
      doc.fillColor('#666').fontSize(9).font('Helvetica')
         .text(`Confidence: ${((conf ?? 0) * 100).toFixed(0)}%`, 0, y + 8, { align: 'right', width: 545 });
      doc.fillColor('#222').fontSize(10).font('Helvetica')
         .text(String(reco ?? '—'), 50, y + 24, { width: 495 });
      y += 56;
    };
    renderView('Bullish view', '#22c55e', ai.bullish.reco, ai.bullish.conf);
    renderView('Bearish view', '#ef4444', ai.bearish.reco, ai.bearish.conf);
    renderView('Neutral view', '#888888', ai.neutral.reco, ai.neutral.conf);

    // ── Footer disclaimer ───────────────────────────────────────────────
    doc.fillColor('#999').fontSize(8).font('Helvetica')
       .text(
         'This report is generated for research purposes only and does not constitute investment advice. ' +
         'Data is aggregated from public APIs (SEC EDGAR, FMP, Polygon, Finnhub, NewsAPI, Reddit, GDELT) ' +
         'and may be incomplete or delayed.',
         40, 790, { width: 515, align: 'center' },
       );

    doc.end();
    await new Promise<void>((resolve) => doc.on('end', () => resolve()));
    return Buffer.concat(chunks);
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
