import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { StocksModule } from "./stocks/stocks.module";
import { ScoringModule } from "./scoring/scoring.module";
import { AlphaModule } from "./alpha/alpha.module";
import { FlowsModule } from "./flows/flows.module";
import { SentimentModule } from "./sentiment/sentiment.module";
import { MacroModule } from "./macro/macro.module";
import { OpportunitiesModule } from "./opportunities/opportunities.module";
import { ReportsModule } from "./reports/reports.module";
import { SettingsModule } from "./settings/settings.module";
import { CacheModule } from "./cache/cache.module";
import { AdminModule } from "./admin/admin.module";
import { AiModule } from "./ai/ai.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    CacheModule,
    AuthModule,
    UsersModule,
    StocksModule,
    ScoringModule,
    AlphaModule,
    FlowsModule,
    SentimentModule,
    MacroModule,
    OpportunitiesModule,
    ReportsModule,
    SettingsModule,
    AdminModule,
    AiModule,
  ],
})
export class AppModule {}
