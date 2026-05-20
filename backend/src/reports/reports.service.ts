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
    private prisma: PrismaService,
    private scoring: ScoringService,
    private alpha: AlphaService,
    private ai: AiService,
  ) {}

  async listReports(userId: string) {
    return this.prisma.report.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, symbol: true, title: true, createdAt: true, pdfPath: true },
    });
  }

  async generateReport(symbol: string, userId: string) {
    // Gather all data concurrently
    const [score, signals, aiAnalysis] = await Promise.allSettled([
      this.scoring.computeScore(symbol),
      this.alpha.getSignals(symbol),
      this.ai.analyzeStock(symbol),
    ]);

    const content = {
      symbol,
      generatedAt: new Date().toISOString(),
      score:     score.status     === 'fulfilled' ? score.value     : null,
      signals:   signals.status   === 'fulfilled' ? signals.value   : [],
      analysis:  aiAnalysis.status === 'fulfilled' ? aiAnalysis.value : null,
    };

    // Save report to DB
    const report = await this.prisma.report.create({
      data: {
        userId,
        symbol: symbol.toUpperCase(),
        title: `${symbol.toUpperCase()} Research Report — ${new Date().toLocaleDateString()}`,
        content,
      },
    });

    // Attempt PDF generation if Puppeteer available
    let pdfBuffer: Buffer | null = null;
    try {
      pdfBuffer = await this.generatePdf(symbol, content);
      const dir = path.join(process.cwd(), 'reports');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const filePath = path.join(dir, `${report.id}.pdf`);
      fs.writeFileSync(filePath, pdfBuffer);
      await this.prisma.report.update({ where: { id: report.id }, data: { pdfPath: filePath } });
    } catch { /* PDF optional — JSON report always saved */ }

    return { report, pdf: !!pdfBuffer };
  }

  async downloadReport(reportId: string): Promise<Buffer> {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (report?.pdfPath && fs.existsSync(report.pdfPath)) {
      return fs.readFileSync(report.pdfPath);
    }
    // Return JSON as fallback
    return Buffer.from(JSON.stringify(report?.content ?? {}, null, 2));
  }

  private async generatePdf(symbol: string, content: any): Promise<Buffer> {
    const puppeteer = await import('puppeteer').catch(() => null);
    if (!puppeteer) throw new Error('Puppeteer not available');

    const score = content.score;
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', sans-serif; background: #0f1117; color: #e2e8f0; padding: 40px; }
    h1 { color: #4f98a3; font-size: 28px; margin-bottom: 4px; }
    .subtitle { color: #6b7280; font-size: 14px; margin-bottom: 32px; }
    .section { background: #1c1b19; border: 1px solid #393836; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
    .section h2 { color: #4f98a3; font-size: 16px; margin: 0 0 12px; }
    .score-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .score-item { background: #0f1117; padding: 12px; border-radius: 6px; text-align: center; }
    .score-item .val { font-size: 24px; font-weight: 700; color: #4f98a3; }
    .score-item .lbl { font-size: 11px; color: #6b7280; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    td, th { padding: 8px 12px; border-bottom: 1px solid #262523; text-align: left; }
    th { color: #6b7280; font-weight: 500; }
    .signal-badge { background: #1e3a2f; color: #4ade80; padding: 2px 8px; border-radius: 12px; font-size: 11px; }
    .footer { margin-top: 40px; font-size: 11px; color: #4b5563; text-align: center; }
  </style>
</head>
<body>
  <h1>QuantGoeuryInvestments</h1>
  <div class="subtitle">AI Research Report &mdash; ${symbol.toUpperCase()} &mdash; ${new Date().toLocaleDateString('en-GB')}</div>

  <div class="section">
    <h2>Scoring Engine V2</h2>
    <div class="score-grid">
      <div class="score-item"><div class="val">${score?.finalScore?.toFixed(2) ?? 'N/A'}</div><div class="lbl">Final Score</div></div>
      <div class="score-item"><div class="val">${score?.rankingScore?.toFixed(2) ?? 'N/A'}</div><div class="lbl">Ranking Score</div></div>
      <div class="score-item"><div class="val">${score?.anomalyScore?.toFixed(2) ?? 'N/A'}</div><div class="lbl">Anomaly Score</div></div>
      <div class="score-item"><div class="val">${((score?.confidenceFactor ?? 1) * 100).toFixed(0)}%</div><div class="lbl">Confidence</div></div>
    </div>
  </div>

  <div class="section">
    <h2>Score Breakdown</h2>
    <table>
      <tr><th>Dimension</th><th>Score</th><th>Weight</th></tr>
      <tr><td>Fundamental</td><td>${score?.fundamentalScore?.toFixed(2) ?? '-'}</td><td>2.5</td></tr>
      <tr><td>Technical</td><td>${score?.technicalScore?.toFixed(2) ?? '-'}</td><td>2.0</td></tr>
      <tr><td>Sentiment</td><td>${score?.sentimentScore?.toFixed(2) ?? '-'}</td><td>1.5</td></tr>
      <tr><td>Institutional</td><td>${score?.institutionalScore?.toFixed(2) ?? '-'}</td><td>2.0</td></tr>
      <tr><td>Analyst</td><td>${score?.analystScore?.toFixed(2) ?? '-'}</td><td>1.0</td></tr>
      <tr><td>Political</td><td>${score?.politicalScore?.toFixed(2) ?? '-'}</td><td>0.5</td></tr>
      <tr><td>Macro</td><td>${score?.macroScore?.toFixed(2) ?? '-'}</td><td>0.5</td></tr>
    </table>
  </div>

  <div class="section">
    <h2>Active Signals</h2>
    ${(content.signals ?? []).length === 0
      ? '<p style="color:#6b7280">No active signals detected.</p>'
      : (content.signals as any[]).map((s: any) => `<div style="margin-bottom:8px"><span class="signal-badge">${s.signalType}</span> &nbsp; Strength: ${(s.strength * 100).toFixed(0)}% ${s.earlyFlag ? '&nbsp;<span style="color:#f59e0b">⚡ EARLY</span>' : ''}</div>`).join('')}
  </div>

  <div class="section">
    <h2>AI Analysis Summary</h2>
    <p style="color:#6b7280;font-size:13px">${content.analysis?.outlook ?? 'AI analysis not available.'}</p>
    <p style="margin-top:12px"><strong>Recommendation:</strong> <span style="color:#4f98a3">${content.analysis?.recommendation ?? 'N/A'}</span> &nbsp; Confidence: ${((content.analysis?.confidence ?? 0) * 100).toFixed(0)}%</p>
  </div>

  <div class="footer">Generated by QuantGoeuryInvestments &bull; ${new Date().toISOString()} &bull; Not financial advice.</div>
</body>
</html>`;

    const browser = await (puppeteer as any).launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'], headless: true });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' } });
    await browser.close();
    return Buffer.from(pdf);
  }
}
