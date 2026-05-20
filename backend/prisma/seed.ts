import { PrismaClient, UserRole, UserStatus, SignalType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ---- Admin user (auto-approved)
  const adminHash = await bcrypt.hash('Admin@123456', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'goeurybenjamin@gmail.com' },
    update: {},
    create: {
      email: 'goeurybenjamin@gmail.com',
      password: adminHash,
      name: 'Benjamin Goeury',
      role: UserRole.ADMIN,
      status: UserStatus.APPROVED,
    },
  });
  console.log(`✅ Admin user: ${admin.email}`);

  // ---- Demo user
  const demoHash = await bcrypt.hash('Demo@123456', 12);
  const demo = await prisma.user.upsert({
    where: { email: 'demo@quantgoeury.com' },
    update: {},
    create: {
      email: 'demo@quantgoeury.com',
      password: demoHash,
      name: 'Demo User',
      role: UserRole.USER,
      status: UserStatus.APPROVED,
    },
  });
  console.log(`✅ Demo user: ${demo.email}`);

  // ---- Seed stocks (S&P 500 sample)
  const stocks = [
    { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology', industry: 'Consumer Electronics', marketCap: 3100000000000, lastPrice: 196.45, priceChangePct: 0.82, avgVolume30d: 58000000 },
    { symbol: 'MSFT', name: 'Microsoft Corporation', sector: 'Technology', industry: 'Software', marketCap: 2900000000000, lastPrice: 414.67, priceChangePct: 0.54, avgVolume30d: 22000000 },
    { symbol: 'NVDA', name: 'NVIDIA Corporation', sector: 'Technology', industry: 'Semiconductors', marketCap: 2600000000000, lastPrice: 1065.78, priceChangePct: 2.14, avgVolume30d: 42000000 },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'Technology', industry: 'Internet Content', marketCap: 2100000000000, lastPrice: 170.23, priceChangePct: -0.31, avgVolume30d: 25000000 },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', sector: 'Consumer Cyclical', industry: 'Internet Retail', marketCap: 1950000000000, lastPrice: 185.12, priceChangePct: 1.02, avgVolume30d: 38000000 },
    { symbol: 'META', name: 'Meta Platforms Inc.', sector: 'Technology', industry: 'Internet Content', marketCap: 1400000000000, lastPrice: 530.44, priceChangePct: 0.78, avgVolume30d: 18000000 },
    { symbol: 'TSLA', name: 'Tesla Inc.', sector: 'Consumer Cyclical', industry: 'Auto Manufacturers', marketCap: 780000000000, lastPrice: 248.50, priceChangePct: -1.23, avgVolume30d: 95000000 },
    { symbol: 'JPM', name: 'JPMorgan Chase & Co.', sector: 'Financial Services', industry: 'Banks', marketCap: 560000000000, lastPrice: 195.34, priceChangePct: 0.21, avgVolume30d: 9500000 },
    { symbol: 'V', name: 'Visa Inc.', sector: 'Financial Services', industry: 'Credit Services', marketCap: 540000000000, lastPrice: 270.89, priceChangePct: 0.45, avgVolume30d: 7200000 },
    { symbol: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare', industry: 'Drug Manufacturers', marketCap: 380000000000, lastPrice: 157.22, priceChangePct: -0.15, avgVolume30d: 6800000 },
    { symbol: 'WMT', name: 'Walmart Inc.', sector: 'Consumer Defensive', industry: 'Discount Stores', marketCap: 510000000000, lastPrice: 63.45, priceChangePct: 0.33, avgVolume30d: 12000000 },
    { symbol: 'XOM', name: 'Exxon Mobil Corporation', sector: 'Energy', industry: 'Oil & Gas', marketCap: 450000000000, lastPrice: 112.67, priceChangePct: 0.67, avgVolume30d: 15000000 },
    { symbol: 'PLTR', name: 'Palantir Technologies', sector: 'Technology', industry: 'Software', marketCap: 52000000000, lastPrice: 24.78, priceChangePct: 3.45, avgVolume30d: 68000000 },
    { symbol: 'AMD', name: 'Advanced Micro Devices', sector: 'Technology', industry: 'Semiconductors', marketCap: 270000000000, lastPrice: 166.34, priceChangePct: 1.87, avgVolume30d: 55000000 },
    { symbol: 'SOFI', name: 'SoFi Technologies', sector: 'Financial Services', industry: 'Fintech', marketCap: 9800000000, lastPrice: 9.12, priceChangePct: 4.21, avgVolume30d: 48000000 },
  ];

  for (const s of stocks) {
    const stock = await prisma.stock.upsert({
      where: { symbol: s.symbol },
      update: { lastPrice: s.lastPrice, priceChangePct: s.priceChangePct },
      create: { ...s, priceChange: s.lastPrice * (s.priceChangePct / 100) },
    });

    // Seed a sample score for each stock
    const fundamentalScore = 4 + Math.random() * 5;
    const technicalScore   = 3 + Math.random() * 6;
    const sentimentScore   = 3 + Math.random() * 5;
    const institutionalScore = 4 + Math.random() * 5;
    const analystScore     = 3 + Math.random() * 6;
    const politicalScore   = 2 + Math.random() * 6;
    const macroScore       = 3 + Math.random() * 5;

    const weightedSum =
      fundamentalScore   * 2.5 +
      technicalScore     * 2.0 +
      sentimentScore     * 1.5 +
      institutionalScore * 2.0 +
      analystScore       * 1.0 +
      politicalScore     * 0.5 +
      macroScore         * 0.5;
    const maxPossible = 10 * (2.5 + 2.0 + 1.5 + 2.0 + 1.0 + 0.5 + 0.5);
    const finalScore = (weightedSum / maxPossible) * 10;
    const confidenceFactor = 0.75 + Math.random() * 0.35;
    const anomalyScore = Math.random() * 0.8;
    const rankingScore = finalScore + 1.5 * anomalyScore + Math.random() * 0.5;

    await prisma.stockScore.create({
      data: {
        stockId: stock.id,
        fundamentalScore, technicalScore, sentimentScore,
        institutionalScore, analystScore, politicalScore, macroScore,
        finalScore: parseFloat((finalScore * confidenceFactor).toFixed(3)),
        confidenceFactor: parseFloat(confidenceFactor.toFixed(3)),
        anomalyScore: parseFloat(anomalyScore.toFixed(3)),
        rankingScore: parseFloat(rankingScore.toFixed(3)),
      },
    });

    // Seed signals for high-anomaly stocks
    if (anomalyScore > 0.5) {
      const types: SignalType[] = ['ACCUMULATION', 'MOMENTUM_IGNITION', 'SMART_MONEY_ENTRY'];
      await prisma.stockSignal.create({
        data: {
          stockId: stock.id,
          signalType: types[Math.floor(Math.random() * types.length)],
          strength: anomalyScore,
          earlyFlag: anomalyScore > 0.65,
          description: `Unusual activity detected on ${s.symbol}`,
          drivers: ['volume_spike', 'sentiment_velocity', 'institutional_shift'],
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        },
      });
    }
    console.log(`  📊 ${s.symbol} seeded (score: ${(finalScore * confidenceFactor).toFixed(2)})`);
  }

  console.log('\n✅ Seed complete!');
  console.log('   Admin login:  goeurybenjamin@gmail.com / Admin@123456');
  console.log('   Demo login:   demo@quantgoeury.com / Demo@123456');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
