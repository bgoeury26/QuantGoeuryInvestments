import { Injectable, UnauthorizedException, ForbiddenException, ConflictException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { UsersService } from "../users/users.service";
import * as bcrypt from "bcrypt";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";

@Injectable()
export class AuthService {
  constructor(private usersService: UsersService, private jwtService: JwtService) {}

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) throw new ConflictException("Email already registered");
    const hash = await bcrypt.hash(dto.password, 12);
    const user = await this.usersService.create({ email: dto.email, password: hash, name: dto.name });
    return { message: "Registration successful. Your account is pending admin approval.", status: user.status };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException("Invalid credentials");
    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException("Invalid credentials");
    if (user.status === "PENDING") throw new ForbiddenException("Account pending admin approval.");
    if (user.status === "REJECTED") throw new ForbiddenException("Account access rejected.");
    if (user.status === "SUSPENDED") throw new ForbiddenException("Account suspended.");
    const token = this.jwtService.sign({ sub: user.id, email: user.email, role: user.role });
    return { access_token: token, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
  }
}
