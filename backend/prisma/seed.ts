import { PrismaClient, SignalType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const DEMO_SIGNALS: Array<{
  symbol: string;
  name: string;
  signal: string;
  strength: number;
  earlyFlag: boolean;
  drivers: string[];
}> = [
  {
    symbol: 'NVDA',
    name: 'NVIDIA Corporation',
    signal: 'ACCUMULATION',
    strength: 0.87,
    earlyFlag: true,
    drivers: ['Volume spike +340%', 'Insider cluster buy', 'Institutional rotation'],
  },
  {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    signal: 'SMART_MONEY_ENTRY',
    strength: 0.72,
    earlyFlag: false,
    drivers: ['13F filings increase', 'Analyst upgrades x3'],
  },
  {
    symbol: 'TSLA',
    name: 'Tesla Inc.',
    signal: 'MOMENTUM_IGNITION',
    strength: 0.65,
    earlyFlag: true,
    drivers: ['Reddit mentions +520%', 'News velocity burst'],
  },
  {
    symbol: 'MSFT',
    name: 'Microsoft Corporation',
    signal: 'SMART_MONEY_ENTRY',
    strength: 0.79,
    earlyFlag: false,
    drivers: ['Price-volume divergence', 'Institutional accumulation'],
  },
  {
    symbol: 'AMZN',
    name: 'Amazon.com Inc.',
    signal: 'ACCUMULATION',
    strength: 0.68,
    earlyFlag: false,
    drivers: ['Congressional trades detected', 'Volume above avg'],
  },
];

async function main() {
  console.log('🌱 Seeding database...');

  // Admin user
  const adminHash = await bcrypt.hash('admin123!', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'goeurybenjamin@gmail.com' },
    update: {},
    create: {
      email: 'goeurybenjamin@gmail.com',
      passwordHash: adminHash,
      name: 'Benjamin Goeury',
      status: 'APPROVED',
      isAdmin: true,
    },
  });
  console.log('✅ Admin user:', admin.email);

  // Demo stocks + signals
  for (const d of DEMO_SIGNALS) {
    const stock = await prisma.stock.upsert({
      where: { symbol: d.symbol },
      update: { name: d.name },
      create: { symbol: d.symbol, name: d.name, sector: 'Technology' },
    });

    // Cast signal string to SignalType enum
    await prisma.stockSignal.create({
      data: {
        stockId: stock.id,
        signalType: d.signal as SignalType,
        strength: d.strength,
        earlyFlag: d.earlyFlag,
        drivers: d.drivers,
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      },
    });

    console.log(`✅ Seeded ${d.symbol}`);
  }

  console.log('✅ Seed complete');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
