import { Controller, Get, Post, Body, Param, UseGuards, Request } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ReportsService } from "./reports.service";

@ApiTags("reports")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("reports")
export class ReportsController {
  constructor(private r: ReportsService) {}
  @Get() getAll(@Request() req) { return this.r.getUserReports(req.user.id); }
  @Get(":id") get(@Param("id") id: string) { return this.r.getReport(id); }
  @Post() create(@Request() req, @Body() body: { symbol: string; content: any }) { return this.r.createReport(req.user.id, body.symbol, body.content); }
}
