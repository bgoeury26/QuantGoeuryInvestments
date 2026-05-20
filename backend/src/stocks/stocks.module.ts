import { Module } from '@nestjs/common';
import { StocksService } from './stocks.service';
import { StocksController } from './stocks.controller';
import { ScoringModule } from '../scoring/scoring.module';
import { AlphaModule } from '../alpha/alpha.module';
@Module({ imports: [ScoringModule, AlphaModule], controllers: [StocksController], providers: [StocksService], exports: [StocksService] })
export class StocksModule {}
