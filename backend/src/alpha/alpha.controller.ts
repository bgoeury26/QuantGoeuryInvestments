import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AlphaService } from "./alpha.service";
@ApiTags("alpha") @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller("alpha")
export class AlphaController {
  constructor(private a: AlphaService) {}
  @Get("signals/:id") getSignals(@Param("id") id: string) { return this.a.getLatestSignals(id); }
  @Get("early") getEarly() { return this.a.getEarlyOpportunities(); }
}
