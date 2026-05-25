import { Module } from '@nestjs/common';
import { ScoringService } from './scoring.service';
import { ScoringRefreshService } from './scoring-refresh.service';
import { ScoringController } from './scoring.controller';
import { StocksModule } from '../stocks/stocks.module';
import { SentimentModule } from '../sentiment/sentiment.module';
import { FlowsModule } from '../flows/flows.module';
import { MacroModule } from '../macro/macro.module';
import { AlphaModule } from '../alpha/alpha.module';

@Module({
  imports: [StocksModule, SentimentModule, FlowsModule, MacroModule, AlphaModule],
  controllers: [ScoringController],
  providers: [ScoringService, ScoringRefreshService],
  exports: [ScoringService, ScoringRefreshService],
})
export class ScoringModule {}
