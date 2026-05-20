import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async createReport(userId: string, symbol: string, title: string, content: any) {
    return this.prisma.report.create({ data: { userId, symbol, title, content } });
  }

  async getUserReports(userId: string) {
    return this.prisma.report.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getReport(id: string, userId: string) {
    return this.prisma.report.findFirst({ where: { id, userId } });
  }

  // AI Analysis prompts — multi-agent style
  generateAnalystPrompts(symbol: string, data: any): { bullish: string; bearish: string; neutral: string } {
    const ctx = JSON.stringify(data, null, 2).slice(0, 2000);
    return {
      bullish: `You are a bullish equity analyst at a top-tier hedge fund. Analyze ${symbol} using the following data and build the strongest possible bull case. Focus on growth catalysts, competitive moats, undervalued metrics, and upcoming catalysts. Data: ${ctx}. Output: 3-5 bullet points, a price target, and confidence level (0-100%).`,
      bearish: `You are a bearish short-seller. Analyze ${symbol} using the following data and build the strongest possible bear case. Focus on overvaluation, risks, macro headwinds, and potential negative catalysts. Data: ${ctx}. Output: 3-5 bullet points, a downside target, and confidence level (0-100%).`,
      neutral: `You are a neutral quantitative analyst. Analyze ${symbol} using the following data objectively. Highlight contradictions between bull and bear cases, identify key uncertainties, and give a balanced probabilistic outlook. Data: ${ctx}. Output: probability distribution (bull/base/bear %), key risks, and recommended action.`,
    };
  }
}
