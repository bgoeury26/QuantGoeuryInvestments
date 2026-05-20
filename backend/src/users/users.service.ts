import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}
  findAll() { return this.prisma.user.findMany({ select: { id:true,email:true,name:true,role:true,status:true,createdAt:true }, orderBy:{createdAt:'desc'} }); }
  findByEmail(email: string) { return this.prisma.user.findUnique({ where: { email } }); }
  findById(id: string) { return this.prisma.user.findUnique({ where: { id } }); }
  create(data: {email:string;password:string;name:string}) { return this.prisma.user.create({ data }); }
  updateStatus(id: string, status: string) { return this.prisma.user.update({ where:{id}, data:{status:status as any} }); }
  getWatchlist(userId: string) { return this.prisma.watchlist.findMany({ where:{userId}, include:{stock:true} }); }
  addToWatchlist(userId:string, stockId:string) { return this.prisma.watchlist.upsert({ where:{userId_stockId:{userId,stockId}}, update:{}, create:{userId,stockId} }); }
  removeFromWatchlist(userId:string, stockId:string) { return this.prisma.watchlist.deleteMany({ where:{userId,stockId} }); }
}
