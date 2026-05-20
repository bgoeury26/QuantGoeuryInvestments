import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async createReport(userId: string, symbol: string, title: string, content: any) {
    return this.prisma.report.create({ data: { userId, symbol, title, content } });
  }

  async getUserReports(userId: string) {
    return this.prisma.report.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  }

  async getReport(id: string) {
    return this.prisma.report.findUnique({ where: { id } });
  }

  async generatePdfHtml(report: any): Promise<string> {
    return `<!DOCTYPE html><html><head><style>
      body { font-family: sans-serif; padding: 40px; background: #0a0a0a; color: #e0e0e0; }
      h1 { color: #00d4aa; } .score { font-size: 48px; font-weight: bold; color: #00d4aa; }
      .section { margin: 24px 0; padding: 16px; border: 1px solid #333; border-radius: 8px; }
      .grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; }
      .kpi { background: #1a1a1a; padding: 12px; border-radius: 6px; text-align: center; }
      .label { color: #888; font-size: 12px; } .value { font-size: 24px; font-weight: bold; color: #00d4aa; }
    </style></head><body>
      <h1>QuantGoeuryInvestments — ${report.symbol} Analysis</h1>
      <p>Generated: ${new Date().toLocaleString()}</p>
      <div class="section"><h2>Scores</h2>
        <div class="grid">
          ${Object.entries(report.content?.scores || {}).map(([k, v]) => `<div class="kpi"><div class="label">${k}</div><div class="value">${Number(v).toFixed(1)}</div></div>`).join("")}
        </div>
      </div>
      <div class="section"><h2>AI Analysis</h2><p>${JSON.stringify(report.content?.analysis || {}, null, 2)}</p></div>
      <div class="section"><h2>Signals</h2><p>${JSON.stringify(report.content?.signals || [], null, 2)}</p></div>
    </body></html>`;
  }
}
