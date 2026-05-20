import { Controller, Get, Patch, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AdminService } from './admin.service';

@ApiTags('admin') @ApiBearerAuth() @UseGuards(JwtAuthGuard, AdminGuard) @Controller('admin')
export class AdminController {
  constructor(private s: AdminService) {}
  @Get('users') getAll() { return this.s.getAllUsers(); }
  @Get('users/pending') getPending() { return this.s.getPendingUsers(); }
  @Patch('users/:id/approve') approve(@Param('id') id: string) { return this.s.approveUser(id); }
  @Patch('users/:id/reject') reject(@Param('id') id: string) { return this.s.rejectUser(id); }
  @Patch('users/:id/suspend') suspend(@Param('id') id: string) { return this.s.suspendUser(id); }
  @Get('stats') getStats() { return this.s.getStats(); }
}
