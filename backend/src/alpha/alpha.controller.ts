import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AlphaService } from "./alpha.service";

@ApiTags("alpha")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("alpha")
export class AlphaController {
  constructor(private alpha: AlphaService) {}
  @Get("signals/:stockId") getSignals(@Param("stockId") id: string) { return this.alpha.getLatestSignals(id); }
  @Get("early-opportunities") getEarly() { return this.alpha.getEarlyOpportunities(); }
}
