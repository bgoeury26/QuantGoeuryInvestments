import { Injectable, UnauthorizedException, ForbiddenException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(private users: UsersService, private jwt: JwtService) {}

  async register(dto: { email: string; password: string; name: string }) {
    if (await this.users.findByEmail(dto.email)) throw new ConflictException('Email already registered');
    const hash = await bcrypt.hash(dto.password, 12);
    const user = await this.users.create({ ...dto, password: hash });
    return { message: 'Registration successful. Pending admin approval.', status: user.status };
  }

  async login(dto: { email: string; password: string }) {
    const user = await this.users.findByEmail(dto.email);
    if (!user || !(await bcrypt.compare(dto.password, user.password))) throw new UnauthorizedException('Invalid credentials');
    if (user.status === 'PENDING') throw new ForbiddenException('Account pending admin approval.');
    if (user.status === 'REJECTED') throw new ForbiddenException('Account access rejected.');
    if (user.status === 'SUSPENDED') throw new ForbiddenException('Account suspended.');
    const token = this.jwt.sign({ sub: user.id, email: user.email, role: user.role });
    return { access_token: token, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
  }
}
