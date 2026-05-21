import { PrismaClient, UserRole, UserStatus, $Enums } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const STOCKS = [
  { symbol: 'AAPL',  name: 'Apple Inc.',                  sector: 'Technology',         industry: 'Consumer Electronics' },
  { symbol: 'MSFT',  name: 'Microsoft Corporation',        sector: 'Technology',         industry: 'Software—Infrastructure' },
  { symbol: 'NVDA',  name: 'NVIDIA Corporation',           sector: 'Technology',         industry: 'Semiconductors' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.',                sector: 'Communication',      industry: 'Internet Content & Information' },
  { symbol: 'AMZN',  name: 'Amazon.com Inc.',              sector: 'Consumer Cyclical',  industry: 'Internet Retail' },
  { symbol: 'META',  name: 'Meta Platforms Inc.',          sector: 'Communication',      industry: 'Internet Content & Information' },
  { symbol: 'TSLA',  name: 'Tesla Inc.',                   sector: 'Consumer Cyclical',  industry: 'Auto Manufacturers' },
  { symbol: 'JPM',   name: 'JPMorgan Chase & Co.',         sector: 'Financial',          industry: 'Banks—Diversified' },
  { symbol: 'V',     name: 'Visa Inc.',                    sector: 'Financial',          industry: 'Credit Services' },
  { symbol: 'JNJ',   name: 'Johnson & Johnson',            sector: 'Healthcare',         industry: 'Drug Manufacturers' },
  { symbol: 'WMT',   name: 'Walmart Inc.',                 sector: 'Consumer Defensive', industry: 'Discount Stores' },
  { symbol: 'XOM',   name: 'Exxon Mobil Corporation',      sector: 'Energy',             industry: 'Oil & Gas Integrated' },
  { symbol: 'UNH',   name: 'UnitedHealth Group Inc.',      sector: 'Healthcare',         industry: 'Healthcare Plans' },
  { symbol: 'MA',    name: 'Mastercard Incorporated',      sector: 'Financial',          industry: 'Credit Services' },
  { symbol: 'AVGO',  name: 'Broadcom Inc.',                sector: 'Technology',         industry: 'Semiconductors' },
  { symbol: 'CVX',   name: 'Chevron Corporation',          sector: 'Energy',             industry: 'Oil & Gas Integrated' },
  { symbol: 'HD',    name: 'The Home Depot Inc.',          sector: 'Consumer Cyclical',  industry: 'Home Improvement Retail' },
  { symbol: 'ABBV',  name: 'AbbVie Inc.',                  sector: 'Healthcare',         industry: 'Drug Manufacturers' },
  { symbol: 'BAC',   name: 'Bank of America Corporation',  sector: 'Financial',          industry: 'Banks—Diversified' },
  { symbol: 'KO',    name: 'The Coca-Cola Company',        sector: 'Consumer Defensive', industry: 'Beverages—Non-Alcoholic' },
  { symbol: 'PFE',   name: 'Pfizer Inc.',                  sector: 'Healthcare',         industry: 'Drug Manufacturers' },
  { symbol: 'ORCL',  name: 'Oracle Corporation',           sector: 'Technology',         industry: 'Software—Infrastructure' },
  { symbol: 'AMD',   name: 'Advanced Micro Devices Inc.',  sector: 'Technology',         industry: 'Semiconductors' },
  { symbol: 'CRM',   name: 'Salesforce Inc.',              sector: 'Technology',         industry: 'Software—Application' },
  { symbol: 'SPY',   name: 'SPDR S&P 500 ETF Trust',       sector: 'ETF',                industry: 'Broad Market' },
];

async function main() {
  console.log('🌱  Seeding database...');

  // ── Admin user ────────────────────────────────────────────────
  const adminEmail = process.env.ADMIN_EMAIL ?? 'goeurybenjamin@gmail.com';
  const adminHash  = await bcrypt.hash('ChangeMe123!', 12);

  const admin = await prisma.user.upsert({
    where:  { email: adminEmail },
    update: { role: UserRole.ADMIN, status: UserStatus.APPROVED },
    create: {
      email:    adminEmail,
      name:     'Benjamin Goeury',
      password: adminHash,
      role:     UserRole.ADMIN,
      status:   UserStatus.APPROVED,
    },
  });
  console.log(`✅  Admin user: ${admin.email}`);

  // ── Stock universe ────────────────────────────────────────────
  for (const s of STOCKS) {
    await prisma.stock.upsert({
      where:  { symbol: s.symbol },
      update: { name: s.name, sector: s.sector, industry: s.industry },
      create: s,
    });
  }
  console.log(`✅  Seeded ${STOCKS.length} stocks`);

  // ── Demo seed scores ─────────────────────────────────────────────
  const stocksInDb = await prisma.stock.findMany();
  const now        = new Date();
  const expires    = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  let scoreCount  = 0;
  let signalCount = 0;

  type DemoEntry = {
    f: number; t: number; s: number; i: number;
    a: number; p: number; m: number;
    signal: $Enums.SignalType;
    early: boolean;
  };

  const DEMO: Record<string, DemoEntry> = {
    NVDA: { f: 8.5, t: 8.0, s: 8.2, i: 7.8, a: 8.5, p: 0.6, m: 0.5, signal: $Enums.SignalType.SMART_MONEY_ENTRY, early: true  },
    AAPL: { f: 7.8, t: 7.2, s: 6.5, i: 7.5, a: 7.0, p: 0.5, m: 0.5, signal: $Enums.SignalType.ACCUMULATION,      early: false },
    MSFT: { f: 8.2, t: 7.5, s: 7.0, i: 7.8, a: 8.0, p: 0.5, m: 0.5, signal: $Enums.SignalType.ACCUMULATION,      early: false },
    META: { f: 7.5, t: 8.2, s: 7.8, i: 6.8, a: 7.5, p: 0.4, m: 0.5, signal: $Enums.SignalType.MOMENTUM_IGNITION, early: true  },
    AMZN: { f: 7.0, t: 6.8, s: 6.2, i: 6.5, a: 7.2, p: 0.5, m: 0.5, signal: $Enums.SignalType.NEUTRAL,           early: false },
    TSLA: { f: 5.5, t: 6.5, s: 6.8, i: 5.2, a: 4.5, p: 0.8, m: 0.5, signal: $Enums.SignalType.SENTIMENT_PUMP,    early: false },
    AMD:  { f: 7.2, t: 7.8, s: 7.5, i: 6.8, a: 7.8, p: 0.5, m: 0.5, signal: $Enums.SignalType.MOMENTUM_IGNITION, early: true  },
  };

  for (const stock of stocksInDb) {
    const d = DEMO[stock.symbol];
    if (!d) continue;

    const conf     = 0.8 + Math.random() * 0.3;
    const weighted = (d.f * 2.5 + d.t * 2.0 + d.s * 1.5 + d.i * 2.0 + d.a * 1.0 + d.p * 0.5 + d.m * 0.5) / 10;
    const final    = Math.min(10, weighted * conf);
    const anomaly  = d.early ? 0.55 + Math.random() * 0.2 : 0.1 + Math.random() * 0.2;
    const ranking  = final + 2.0 * anomaly + (d.t > 7 ? 0.5 : 0);

    await prisma.stockScore.create({
      data: {
        stockId:            stock.id,
        fundamentalScore:   d.f,
        technicalScore:     d.t,
        sentimentScore:     d.s,
        institutionalScore: d.i,
        analystScore:       d.a,
        politicalScore:     d.p,
        macroScore:         d.m,
        finalScore:         parseFloat(final.toFixed(2)),
        confidenceFactor:   parseFloat(conf.toFixed(3)),
        anomalyScore:       parseFloat(anomaly.toFixed(3)),
        rankingScore:       parseFloat(ranking.toFixed(2)),
      },
    });
    scoreCount++;

    await prisma.stockSignal.create({
      data: {
        stockId:   stock.id,
        signalType: d.signal,
        strength:   anomaly,
        earlyFlag:  d.early,
        drivers:    d.early ? ['volume_spike', 'institutional_rotation'] : ['technical_crossover'],
        expiresAt:  expires,
      },
    });
    signalCount++;
  }

  console.log(`✅  Seeded ${scoreCount} scores, ${signalCount} signals`);
  console.log('🎉  Seed complete.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
