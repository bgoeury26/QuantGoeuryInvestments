import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async createReport(userId: string, symbol: string, content: any) {
    return this.prisma.report.create({
      data: { userId, symbol, title: `${symbol} Analysis — ${new Date().toLocaleDateString()}`, content },
    });
  }

  async getUserReports(userId: string) {
    return this.prisma.report.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async getReport(id: string) {
    return this.prisma.report.findUnique({ where: { id } });
  }
}
