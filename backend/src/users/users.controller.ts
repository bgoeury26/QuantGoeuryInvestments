import { Controller, Get, Post, Delete, Param, UseGuards, Request } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { UsersService } from "./users.service";

@ApiTags("users")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("users")
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get("me") getMe(@Request() req) { const { password, ...u } = req.user; return u; }
  @Get("watchlist") getWatchlist(@Request() req) { return this.usersService.getWatchlist(req.user.id); }
  @Post("watchlist/:stockId") addWatch(@Request() req, @Param("stockId") id: string) { return this.usersService.addToWatchlist(req.user.id, id); }
  @Delete("watchlist/:stockId") removeWatch(@Request() req, @Param("stockId") id: string) { return this.usersService.removeFromWatchlist(req.user.id, id); }
}
