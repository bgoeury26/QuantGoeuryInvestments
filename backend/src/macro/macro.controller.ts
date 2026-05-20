import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MacroService } from './macro.service';

@ApiTags('macro')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('macro')
export class MacroController {
  constructor(private macroService: MacroService) {}
  @Get('dashboard') getDashboard() { return this.macroService.getMacroDashboard(); }
  @Get(':seriesId') getIndicator(@Param('seriesId') id: string) { return this.macroService.getMacroIndicator(id); }
}
