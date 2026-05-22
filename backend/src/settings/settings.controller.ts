import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private svc: SettingsService) {}

  @Get()
  get(@Request() req: any) {
    return this.svc.getSettings(req.user.sub);
  }

  @Post()
  save(@Request() req: any, @Body() body: any) {
    return this.svc.saveSettings(req.user.sub, body);
  }

  @Post('test/:provider')
  test(@Param('provider') provider: string, @Request() req: any) {
    return this.svc.testProvider(provider, req.user.sub);
  }
}
