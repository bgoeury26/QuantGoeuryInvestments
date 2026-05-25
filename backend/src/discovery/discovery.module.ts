import { Module } from '@nestjs/common';
import { DiscoveryService } from './discovery.service';
import { DailyDiscoveryJob } from './daily-discovery.job';
import { ScoringModule } from '../scoring/scoring.module';
import { AlphaModule } from '../alpha/alpha.module';

@Module({
  imports: [ScoringModule, AlphaModule],
  providers: [DiscoveryService, DailyDiscoveryJob],
  exports: [DiscoveryService, DailyDiscoveryJob],
})
export class DiscoveryModule {}
