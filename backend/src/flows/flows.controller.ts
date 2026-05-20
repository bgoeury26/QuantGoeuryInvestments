import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { FlowsService } from "./flows.service";

@ApiTags("flows")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("flows")
export class FlowsController {
  constructor(private f: FlowsService) {}
  @Get(":symbol/institutional") inst(@Param("symbol") s: string) { return this.f.getInstitutionalHoldings(s); }
  @Get(":symbol/insider") insider(@Param("symbol") s: string) { return this.f.getInsiderTrades(s); }
  @Get(":symbol/political") political(@Param("symbol") s: string) { return this.f.getPoliticalTrades(s); }
  @Get(":symbol/summary") summary(@Param("symbol") s: string) { return this.f.getFlowSummary(s); }
}
