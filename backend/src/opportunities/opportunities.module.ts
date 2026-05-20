import { Module } from '@nestjs/common';
import { OpportunitiesController } from './opportunities.controller';
import { ScoringModule } from '../scoring/scoring.module';
import { AlphaModule } from '../alpha/alpha.module';
@Module({ imports:[ScoringModule,AlphaModule], controllers:[OpportunitiesController] })
export class OpportunitiesModule {}
