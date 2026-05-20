import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma:PrismaService) {}

  async getAll(userId:string) {
    return this.prisma.report.findMany({ where:{userId}, orderBy:{createdAt:'desc'}, take:50 });
  }

  async create(userId:string, symbol:string, content:any) {
    return this.prisma.report.create({ data:{ userId, symbol, title:`${symbol} Analysis — ${new Date().toLocaleDateString()}`, content } });
  }

  // AI Analysis prompts — multi-agent style
  generateBullishPrompt(data:any):string {
    return `You are a bullish equity analyst. Given this data for ${data.symbol}:\nPrice: $${data.price}, Score: ${data.score}/10, RSI: ${data.rsi}, Revenue Growth: ${data.revenueGrowth}%, Institutional buying: ${data.institutionalBuying}\n\nWrite a compelling 3-paragraph BULLISH investment thesis. Be specific, cite the data, argue logically. End with: Recommendation, Target Price, and Confidence (%)`.trim();
  }

  generateBearishPrompt(data:any):string {
    return `You are a bearish equity analyst. Given this data for ${data.symbol}:\nPrice: $${data.price}, Score: ${data.score}/10, RSI: ${data.rsi}, Debt/Equity: ${data.debtToEquity}, Short interest: ${data.shortInterest}%\n\nWrite a compelling 3-paragraph BEARISH investment thesis. Identify risks, headwinds, overvaluation. End with: Recommendation, Stop Loss, and Risk Rating`.trim();
  }

  generateNeutralPrompt(data:any):string {
    return `You are a neutral equity analyst. Given this data for ${data.symbol}, present a balanced 3-paragraph analysis considering both bull and bear cases. End with: Probabilistic outlook (Bull/Bear/Neutral %) and Key catalysts to watch`.trim();
  }
}
