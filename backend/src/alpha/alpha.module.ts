import { Module } from '@nestjs/common';
import { AlphaService } from './alpha.service';
import { AlphaController } from './alpha.controller';
import { StocksModule } from '../stocks/stocks.module';
import { SentimentModule } from '../sentiment/sentiment.module';
import { FlowsModule } from '../flows/flows.module';

@Module({
  imports: [StocksModule, SentimentModule, FlowsModule],
  controllers: [AlphaController],
  providers: [AlphaService],
  exports: [AlphaService],
})
export class AlphaModule {}
