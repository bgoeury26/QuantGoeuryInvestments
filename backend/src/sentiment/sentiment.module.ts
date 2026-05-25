import { Module } from '@nestjs/common';
import { SentimentController } from './sentiment.controller';
import { SentimentService } from './sentiment.service';
import { CacheModule } from '../cache/cache.module';
import { ProvidersModule } from '../providers/providers.module';

@Module({
  imports: [CacheModule, ProvidersModule],
  controllers: [SentimentController],
  providers: [SentimentService],
  exports: [SentimentService],
})
export class SentimentModule {}
