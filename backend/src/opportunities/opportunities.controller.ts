import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { OpportunitiesService } from "./opportunities.service";

@ApiTags("opportunities")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("opportunities")
export class OpportunitiesController {
  constructor(private o: OpportunitiesService) {}
  @Get("top") getTop10() { return this.o.getTop10(); }
  @Get("early-signals") getEarly() { return this.o.getEarlySignals(); }
}
