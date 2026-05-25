import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { ScoringModule } from '../scoring/scoring.module';
import { DiscoveryModule } from '../discovery/discovery.module';

@Module({
  imports: [ScoringModule, DiscoveryModule],
  controllers: [AdminController],
  providers: [AdminService, PrismaService],
  exports: [AdminService],
})
export class AdminModule {}
