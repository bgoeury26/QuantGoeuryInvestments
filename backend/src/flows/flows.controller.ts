import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FlowsService } from './flows.service';

@ApiTags('flows') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('flows')
export class FlowsController {
  constructor(private f:FlowsService) {}
  @Get(':sym/institutional') inst(@Param('sym') sym:string){return this.f.getInstitutional(sym);}
  @Get(':sym/insider') insider(@Param('sym') sym:string){return this.f.getInsider(sym);}
  @Get(':sym/political') pol(@Param('sym') sym:string){return this.f.getPolitical(sym);}
  @Get(':sym/summary') sum(@Param('sym') sym:string){return this.f.getSummary(sym);}
}
