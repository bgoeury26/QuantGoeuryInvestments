import { Controller, Get, Post, Delete, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  getMe(@Request() req) {
    const { password, ...user } = req.user;
    return user;
  }

  @Get('watchlist')
  getWatchlist(@Request() req) {
    return this.usersService.getWatchlist(req.user.id);
  }

  @Post('watchlist/:stockId')
  addToWatchlist(@Request() req, @Param('stockId') stockId: string) {
    return this.usersService.addToWatchlist(req.user.id, stockId);
  }

  @Delete('watchlist/:stockId')
  removeFromWatchlist(@Request() req, @Param('stockId') stockId: string) {
    return this.usersService.removeFromWatchlist(req.user.id, stockId);
  }
}
