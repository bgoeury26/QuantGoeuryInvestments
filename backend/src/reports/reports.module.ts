import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { StocksModule } from '../stocks/stocks.module';
import { ScoringModule } from '../scoring/scoring.module';
@Module({ imports:[StocksModule,ScoringModule], controllers:[ReportsController], providers:[ReportsService] })
export class ReportsModule {}
