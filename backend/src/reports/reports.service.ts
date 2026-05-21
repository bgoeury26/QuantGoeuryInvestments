import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScoringService } from '../scoring/scoring.service';
import { AlphaService } from '../alpha/alpha.service';
import { AiService } from '../ai/ai.service';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class ReportsService {
  constructor(
    private prisma:   PrismaService,
    private scoring:  ScoringService,
    private alpha:    AlphaService,
    private ai:       AiService,
  ) {}

  async listReports(userId: string) {
    return this.prisma.report.findMany({
      where:   { userId },
      orderBy: { createdAt: 'desc' },
      select:  { id: true, symbol: true, title: true, createdAt: true, pdfPath: true },
    });
  }

  async generateReport(symbol: string, userId: string) {
    const sym = symbol.toUpperCase();

    const [scoreRes, signalsRes] = await Promise.allSettled([
      this.scoring.computeScore(sym),
      this.alpha.getSignals(sym),
    ]);

    const score   = scoreRes.status   === 'fulfilled' ? scoreRes.value   : null;
    const signals = signalsRes.status === 'fulfilled' ? signalsRes.value : [];

    const topSignal = Array.isArray(signals) && signals.length > 0 ? signals[0] : null;

    const drivers: string[] = Array.isArray(topSignal?.drivers)
      ? (topSignal.drivers as unknown[]).filter((d): d is string => typeof d === 'string')
      : [];

    const aiPayload = {
      symbol:       sym,
      finalScore:   ((score as any)?.finalScore         ?? 5)  as number,
      anomalyScore: ((score as any)?.anomalyScore        ?? 0)  as number,
      fundamental:  ((score as any)?.fundamentalScore    ?? 5)  as number,
      technical:    ((score as any)?.technicalScore      ?? 5)  as number,
      sentiment:    ((score as any)?.sentimentScore      ?? 5)  as number,
      signalType:   (topSignal?.signalType ?? 'NEUTRAL') as string,
      drivers,
    };

    const aiRes  = await Promise.allSettled([this.ai.analyzeStock(aiPayload)]);
    const analysis = aiRes[0].status === 'fulfilled' ? aiRes[0].value : null;

    const content = {
      symbol:      sym,
      generatedAt: new Date().toISOString(),
      score,
      signals,
      analysis,
    };

    const report = await this.prisma.report.create({
      data: {
        userId,
        symbol: sym,
        title:  `${sym} Research Report — ${new Date().toLocaleDateString('en-GB')}`,
        content,
      },
    });

    try {
      const pdfBuffer = await this.generatePdf(sym, content);
      const dir = path.join(process.cwd(), 'reports');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const filePath = path.join(dir, `${report.id}.pdf`);
      fs.writeFileSync(filePath, pdfBuffer);
      await this.prisma.report.update({ where: { id: report.id }, data: { pdfPath: filePath } });
      return { ...report, pdfPath: filePath };
    } catch {
      return report;
    }
  }

  async getReport(id: string, userId: string) {
    return this.prisma.report.findFirst({ where: { id, userId } });
  }

  async getPdf(id: string, userId: string): Promise<Buffer> {
    const report = await this.prisma.report.findFirst({ where: { id, userId } });
    if (!report?.pdfPath) throw new Error('PDF not available');
    return fs.readFileSync(report.pdfPath);
  }

  async downloadReport(id: string): Promise<Buffer> {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) throw new Error('Report not found');
    if (report.pdfPath && fs.existsSync(report.pdfPath)) {
      return fs.readFileSync(report.pdfPath);
    }
    try {
      return await this.generatePdf(report.symbol, report.content as any);
    } catch {
      return Buffer.from(`Report ${id} — PDF not available`, 'utf-8');
    }
  }

  // ── PDF generation ──────────────────────────────────────────────────

  private async generatePdf(symbol: string, content: any): Promise<Buffer> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let puppeteerMod: any;
    try {
      // Dynamic require avoids TS module-not-found error when puppeteer is optional
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      puppeteerMod = require('puppeteer');
    } catch {
      throw new Error('puppeteer not installed — skipping PDF generation');
    }
    const browser = await puppeteerMod.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setContent(this.buildHtmlReport(symbol, content), { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', margin: { top: '24px', right: '24px', bottom: '24px', left: '24px' } });
    await browser.close();
    return Buffer.from(pdf);
  }

  private buildHtmlReport(symbol: string, content: any): string {
    const score = content.score;
    const rows = [
      ['Final Score',     score?.finalScore?.toFixed(2)         ?? 'N/A'],
      ['Confidence',      score ? (score.confidenceFactor * 100).toFixed(0) + '%' : 'N/A'],
      ['Fundamental',     score?.fundamentalScore?.toFixed(2)   ?? 'N/A'],
      ['Technical',       score?.technicalScore?.toFixed(2)     ?? 'N/A'],
      ['Sentiment',       score?.sentimentScore?.toFixed(2)     ?? 'N/A'],
      ['Institutional',   score?.institutionalScore?.toFixed(2) ?? 'N/A'],
      ['Analyst',         score?.analystScore?.toFixed(2)       ?? 'N/A'],
      ['Political',       score?.politicalScore?.toFixed(2)     ?? 'N/A'],
      ['Macro',           score?.macroScore?.toFixed(2)         ?? 'N/A'],
      ['Anomaly Score',   score?.anomalyScore?.toFixed(2)       ?? 'N/A'],
      ['Ranking Score',   score?.rankingScore?.toFixed(2)       ?? 'N/A'],
    ];
    const signalRows = (content.signals ?? []).map((s: any) =>
      `<tr><td>${s.signalType}</td><td>${(s.strength * 100).toFixed(0)}%</td><td>${s.earlyFlag ? '⚡ Early' : '—'}</td></tr>`
    ).join('');
    const ai = content.analysis;
    const scoreVal   = score?.finalScore ?? 0;
    const scoreColor = scoreVal >= 7 ? '#16a34a' : scoreVal >= 5 ? '#d97706' : '#dc2626';
    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
  body{font-family:'Helvetica Neue',sans-serif;color:#1a1a1a;background:#fff;font-size:13px}
  h1{font-size:22px;margin-bottom:4px}h2{font-size:14px;margin:18px 0 6px;border-bottom:1px solid #e5e5e5;padding-bottom:4px}
  table{width:100%;border-collapse:collapse;margin-bottom:12px}th,td{padding:5px 8px;text-align:left;border:1px solid #e5e5e5}
  th{background:#f5f5f5;font-size:11px;text-transform:uppercase;letter-spacing:.05em}
  .score{font-size:28px;font-weight:700;color:${scoreColor}}
  .footer{margin-top:32px;font-size:10px;color:#999;border-top:1px solid #e5e5e5;padding-top:8px}
</style></head><body>
  <h1>${symbol} — Research Report</h1>
  <p style="color:#666">Generated ${content.generatedAt}</p>
  <h2>Composite Score</h2>
  <p class="score">${scoreVal.toFixed(2)} <span style="font-size:14px;color:#999">/10</span></p>
  <h2>Score Breakdown</h2>
  <table><thead><tr><th>Factor</th><th>Value</th></tr></thead><tbody>
    ${rows.map(([k, v]) => `<tr><td>${k}</td><td><strong>${v}</strong></td></tr>`).join('')}
  </tbody></table>
  ${signalRows ? `<h2>Active Signals</h2><table><thead><tr><th>Type</th><th>Strength</th><th>Flag</th></tr></thead><tbody>${signalRows}</tbody></table>` : ''}
  ${ai ? `<h2>AI Analysis</h2>
    ${ai.bullish?.analysis ? `<p><strong>🐂 Bullish (${ai.bullish.recommendation}):</strong> ${ai.bullish.analysis}</p>` : ''}
    ${ai.bearish?.analysis ? `<p><strong>🐻 Bearish (${ai.bearish.recommendation}):</strong> ${ai.bearish.analysis}</p>` : ''}
    ${ai.neutral?.analysis ? `<p><strong>⚖️ Neutral (${ai.neutral.recommendation}):</strong> ${ai.neutral.analysis}</p>` : ''}` : ''}
  <div class="footer">QuantGoeuryInvestments — For informational purposes only. Not financial advice.</div>
</body></html>`;
  }
}
