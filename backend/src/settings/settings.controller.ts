import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private settingsService: SettingsService) {}
  @Get() getSettings(@Request() req) { return this.settingsService.getSettings(req.user.id); }
  @Post() saveSettings(@Request() req, @Body() dto: any) { return this.settingsService.saveSettings(req.user.id, dto); }
}
