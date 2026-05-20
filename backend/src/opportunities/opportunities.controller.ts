import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { OpportunitiesService } from "./opportunities.service";
@ApiTags("opportunities") @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller("opportunities")
export class OpportunitiesController {
  constructor(private o: OpportunitiesService) {}
  @Get("top") top() { return this.o.getTopOpportunities(10); }
  @Get("early") early() { return this.o.getEarlyOpportunities(); }
}
