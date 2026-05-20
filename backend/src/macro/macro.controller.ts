import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MacroService } from './macro.service';

@ApiTags('macro') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('macro')
export class MacroController {
  constructor(private s: MacroService) {}
  @Get('dashboard') getDashboard() { return this.s.getMacroDashboard(); }
  @Get('series/:id') getSeries(@Param('id') id: string) { return this.s.getSeries(id); }
}
