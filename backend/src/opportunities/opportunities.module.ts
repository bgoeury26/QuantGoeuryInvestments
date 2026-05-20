import { Module } from '@nestjs/common';
import { OpportunitiesService } from './opportunities.service';
import { OpportunitiesController } from './opportunities.controller';
import { ScoringModule } from '../scoring/scoring.module';
import { AlphaModule } from '../alpha/alpha.module';
@Module({ imports: [ScoringModule, AlphaModule], controllers: [OpportunitiesController], providers: [OpportunitiesService], exports: [OpportunitiesService] })
export class OpportunitiesModule {}
