import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MacroService } from './macro.service';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Macro')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('macro')
export class MacroController {
  constructor(private macro: MacroService) {}

  @Get('dashboard')
  dashboard() { return this.macro.getDashboard(); }

  @Get('indicators/:id')
  indicator(@Param('id') id: string) { return this.macro.getIndicator(id); }

  @Get('calendar')
  calendar() { return this.macro.getCalendar(); }
}
