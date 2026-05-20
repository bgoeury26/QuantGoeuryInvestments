import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { MacroService } from "./macro.service";

@ApiTags("macro")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("macro")
export class MacroController {
  constructor(private m: MacroService) {}
  @Get("environment") getEnv() { return this.m.getMacroEnvironment(); }
}
