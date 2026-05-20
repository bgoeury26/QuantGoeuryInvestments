import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { MacroService } from "./macro.service";
@ApiTags("macro") @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller("macro")
export class MacroController {
  constructor(private m: MacroService) {}
  @Get("dashboard") dashboard() { return this.m.getMacroDashboard(); }
  @Get("series/:id") series(@Param("id") id: string) { return this.m.getFredSeries(id); }
}
