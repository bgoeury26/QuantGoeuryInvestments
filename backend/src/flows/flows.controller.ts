import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { FlowsService } from "./flows.service";
@ApiTags("flows") @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller("flows")
export class FlowsController {
  constructor(private f: FlowsService) {}
  @Get(":s/institutional") inst(@Param("s") s: string) { return this.f.getInstitutionalHoldings(s); }
  @Get(":s/insider") insider(@Param("s") s: string) { return this.f.getInsiderTrades(s); }
  @Get(":s/political") political(@Param("s") s: string) { return this.f.getPoliticalTrades(s); }
  @Get(":s/summary") summary(@Param("s") s: string) { return this.f.getFlowSummary(s); }
}
