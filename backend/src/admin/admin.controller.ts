import { Controller, Get, Patch, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AdminService } from './admin.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}
  @Get('users') getAllUsers() { return this.adminService.getAllUsers(); }
  @Get('users/pending') getPending() { return this.adminService.getPendingUsers(); }
  @Get('stats') getStats() { return this.adminService.getStats(); }
  @Patch('users/:id/approve') approve(@Param('id') id: string) { return this.adminService.approveUser(id); }
  @Patch('users/:id/reject') reject(@Param('id') id: string) { return this.adminService.rejectUser(id); }
  @Patch('users/:id/suspend') suspend(@Param('id') id: string) { return this.adminService.suspendUser(id); }
}
