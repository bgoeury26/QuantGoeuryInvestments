import { Controller, Get, Post, Delete, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService } from './users.service';

@ApiTags('users') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('users')
export class UsersController {
  constructor(private u: UsersService) {}
  @Get('me') getMe(@Request() req) { const {password,...u}=req.user; return u; }
  @Get('watchlist') getWatchlist(@Request() req) { return this.u.getWatchlist(req.user.id); }
  @Post('watchlist/:id') add(@Request() req,@Param('id') id:string) { return this.u.addToWatchlist(req.user.id,id); }
  @Delete('watchlist/:id') remove(@Request() req,@Param('id') id:string) { return this.u.removeFromWatchlist(req.user.id,id); }
}
