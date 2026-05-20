import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { UsersService } from '../users/users.service';

@ApiTags('admin') @ApiBearerAuth() @UseGuards(JwtAuthGuard, AdminGuard) @Controller('admin')
export class AdminController {
  constructor(private users: UsersService) {}
  @Get('users') getAll() { return this.users.findAll(); }
  @Patch('users/:id/status') updateStatus(@Param('id') id:string, @Body() body:{status:string}) {
    return this.users.updateStatus(id, body.status);
  }
}
