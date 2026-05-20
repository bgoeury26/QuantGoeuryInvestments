import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { HealthController } from './health.controller';
import { PrismaService } from './prisma/prisma.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { StocksModule } from './stocks/stocks.module';
import { ScoringModule } from './scoring/scoring.module';
import { AlphaModule } from './alpha/alpha.module';
import { FlowsModule } from './flows/flows.module';
import { SentimentModule } from './sentiment/sentiment.module';
import { MacroModule } from './macro/macro.module';
import { OpportunitiesModule } from './opportunities/opportunities.module';
import { AdminModule } from './admin/admin.module';
import { SettingsModule } from './settings/settings.module';
import { ReportsModule } from './reports/reports.module';
import { AiModule } from './ai/ai.module';
import { CacheModule } from './cache/cache.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    StocksModule,
    ScoringModule,
    AlphaModule,
    FlowsModule,
    SentimentModule,
    MacroModule,
    OpportunitiesModule,
    AdminModule,
    SettingsModule,
    ReportsModule,
    AiModule,
    CacheModule,
  ],
  controllers: [HealthController],
  providers: [PrismaService],
})
export class AppModule {}
