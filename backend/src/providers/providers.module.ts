import { Module } from '@nestjs/common';
import { TwelveDataService } from './twelvedata.service';
import { MarketstackService } from './marketstack.service';
import { TiingoService } from './tiingo.service';
import { StocktwitsService } from './stocktwits.service';
import { QuoteConsensusService } from './quote-consensus.service';

@Module({
  providers: [
    TwelveDataService,
    MarketstackService,
    TiingoService,
    StocktwitsService,
    QuoteConsensusService,
  ],
  exports: [
    TwelveDataService,
    MarketstackService,
    TiingoService,
    StocktwitsService,
    QuoteConsensusService,
  ],
})
export class ProvidersModule {}
