import { Module } from '@nestjs/common';
import { OpportunitiesController } from './opportunities.controller';
import { OpportunitiesService } from './opportunities.service';
import { ScoringModule } from '../scoring/scoring.module';
import { AlphaModule } from '../alpha/alpha.module';

@Module({
  imports: [ScoringModule, AlphaModule],
  controllers: [OpportunitiesController],
  providers: [OpportunitiesService],
  exports: [OpportunitiesService],
})
export class OpportunitiesModule {}
