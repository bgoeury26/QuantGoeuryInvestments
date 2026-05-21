import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { CacheModule } from './cache/cache.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { StocksModule } from './stocks/stocks.module';
import { ScoringModule } from './scoring/scoring.module';
import { AlphaModule } from './alpha/alpha.module';
import { OpportunitiesModule } from './opportunities/opportunities.module';
import { FlowsModule } from './flows/flows.module';
import { SentimentModule } from './sentiment/sentiment.module';
import { MacroModule } from './macro/macro.module';
import { ReportsModule } from './reports/reports.module';
import { SettingsModule } from './settings/settings.module';
import { AdminModule } from './admin/admin.module';
import { AiModule } from './ai/ai.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HttpModule.register({ timeout: 10000, maxRedirects: 3 }),
    ScheduleModule.forRoot(),
    PrismaModule,
    CacheModule,
    AuthModule,
    UsersModule,
    StocksModule,
    ScoringModule,
    AlphaModule,
    OpportunitiesModule,
    FlowsModule,
    SentimentModule,
    MacroModule,
    ReportsModule,
    SettingsModule,
    AdminModule,
    AiModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
