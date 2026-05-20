import { Controller, Get, Post, Body, UseGuards, Request } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { SettingsService } from "./settings.service";

@ApiTags("settings")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("settings")
export class SettingsController {
  constructor(private s: SettingsService) {}
  @Get() get(@Request() req) { return this.s.getSettings(req.user.id); }
  @Post() save(@Request() req, @Body() body: any) { return this.s.saveSettings(req.user.id, body); }
}
