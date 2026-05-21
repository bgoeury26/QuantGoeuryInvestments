import { PrismaClient, UserRole, UserStatus, SignalType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Admin user
  const adminHash = await bcrypt.hash('Admin123!', 12);
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

  // Demo stocks
  const stocks = [
    { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology' },
    { symbol: 'NVDA', name: 'NVIDIA Corporation', sector: 'Technology' },
    { symbol: 'MSFT', name: 'Microsoft Corporation', sector: 'Technology' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'Technology' },
    { symbol: 'TSLA', name: 'Tesla Inc.', sector: 'Consumer Discretionary' },
    { symbol: 'META', name: 'Meta Platforms', sector: 'Technology' },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', sector: 'Consumer Discretionary' },
    { symbol: 'JPM', name: 'JPMorgan Chase', sector: 'Financials' },
  ];

  for (const s of stocks) {
    const stock = await prisma.stock.upsert({
      where: { symbol: s.symbol },
      update: {},
      create: {
        symbol: s.symbol,
        name: s.name,
        sector: s.sector,
        lastPrice: 100 + Math.random() * 400,
        priceChangePct: (Math.random() - 0.5) * 6,
        volume: Math.floor(Math.random() * 50_000_000) + 1_000_000,
        avgVolume30d: Math.floor(Math.random() * 30_000_000) + 5_000_000,
      },
    });

    // StockScore — uses correct field names from schema
    await prisma.stockScore.create({
      data: {
        stockId: stock.id,
        fundamentalScore: Math.random() * 4 + 4,
        technicalScore: Math.random() * 4 + 3,
        sentimentScore: Math.random() * 4 + 3,
        institutionalScore: Math.random() * 4 + 4,
        analystScore: Math.random() * 3 + 5,
        politicalScore: Math.random() * 2 + 4,
        macroScore: Math.random() * 2 + 4,
        finalScore: Math.random() * 3 + 5,
        confidenceFactor: Math.random() * 0.5 + 0.7,
        rankingScore: Math.random() * 4 + 5,
        anomalyScore: Math.random() * 0.8 + 0.1,
      },
    });

    // StockSignal — uses correct field names: strength (not anomalyScore)
    const signalTypes = Object.values(SignalType);
    await prisma.stockSignal.create({
      data: {
        stockId: stock.id,
        signalType: signalTypes[Math.floor(Math.random() * signalTypes.length)],
        strength: Math.random() * 0.8 + 0.1,
        description: `Signal detected for ${s.symbol}`,
        drivers: ['Volume spike', 'Sentiment acceleration'] as any,
        earlyFlag: Math.random() > 0.7,
      },
    });

    console.log(`  📊 Seeded ${s.symbol}`);
  }

  console.log('✅ Seed complete!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
