import { PrismaClient, UserRole, UserStatus, SignalType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'goeurybenjamin@gmail.com' },
    update: {},
    create: {
      email: 'goeurybenjamin@gmail.com',
      password: adminPassword,
      name: 'Benjamin Goeury',
      role: UserRole.ADMIN,
      status: UserStatus.APPROVED,
    },
  });
  console.log('✅ Admin user created:', admin.email);

  // Create test user
  const userPassword = await bcrypt.hash('user123!', 12);
  const testUser = await prisma.user.upsert({
    where: { email: 'test@quantgoeury.com' },
    update: {},
    create: {
      email: 'test@quantgoeury.com',
      password: userPassword,
      name: 'Test User',
      role: UserRole.USER,
      status: UserStatus.APPROVED,
    },
  });
  console.log('✅ Test user created:', testUser.email);

  // Seed stocks
  const stocks = [
    { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology', marketCap: 3000000000000 },
    { symbol: 'MSFT', name: 'Microsoft Corporation', sector: 'Technology', marketCap: 2800000000000 },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'Technology', marketCap: 1900000000000 },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', sector: 'Consumer Cyclical', marketCap: 1800000000000 },
    { symbol: 'NVDA', name: 'NVIDIA Corporation', sector: 'Technology', marketCap: 2200000000000 },
    { symbol: 'META', name: 'Meta Platforms Inc.', sector: 'Technology', marketCap: 1200000000000 },
    { symbol: 'TSLA', name: 'Tesla Inc.', sector: 'Consumer Cyclical', marketCap: 800000000000 },
    { symbol: 'BRK.B', name: 'Berkshire Hathaway', sector: 'Financial Services', marketCap: 900000000000 },
    { symbol: 'JPM', name: 'JPMorgan Chase', sector: 'Financial Services', marketCap: 600000000000 },
    { symbol: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare', marketCap: 450000000000 },
  ];

  for (const stockData of stocks) {
    const stock = await prisma.stock.upsert({
      where: { symbol: stockData.symbol },
      update: {},
      create: stockData,
    });

    // Seed a sample signal for each stock
    await prisma.stockSignal.create({
      data: {
        stock: { connect: { id: stock.id } },
        signalType: SignalType.ACCUMULATION,
        anomalyScore: Math.random() * 0.8 + 0.1,
        volumeAnomaly: Math.random() * 0.9,
        sentimentVelocity: Math.random() * 0.7,
        insiderActivity: Math.random() * 0.5,
        institutionalShift: Math.random() * 0.6,
        isEarlyOpportunity: Math.random() > 0.6,
        priceAtSignal: Math.random() * 500 + 50,
      },
    });
  }
  console.log('✅ Stocks seeded:', stocks.length);

  console.log('🎉 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
