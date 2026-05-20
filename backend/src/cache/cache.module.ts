import { Module, Global } from '@nestjs/common';
import { CacheService } from './cache.service';
import { PrismaService } from '../prisma/prisma.service';

@Global()
@Module({
  providers: [CacheService, PrismaService],
  exports: [CacheService],
})
export class CacheModule {}
