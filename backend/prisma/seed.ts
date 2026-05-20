import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash('Admin@QuantGoeury2024!', 12);
  await prisma.user.upsert({
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
  console.log('✅ Admin user seeded: goeurybenjamin@gmail.com');

  const stocks = [
    { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology' },
    { symbol: 'MSFT', name: 'Microsoft Corporation', sector: 'Technology' },
    { symbol: 'NVDA', name: 'NVIDIA Corporation', sector: 'Technology' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'Technology' },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', sector: 'Consumer Cyclical' },
    { symbol: 'META', name: 'Meta Platforms Inc.', sector: 'Technology' },
    { symbol: 'TSLA', name: 'Tesla Inc.', sector: 'Consumer Cyclical' },
    { symbol: 'JPM', name: 'JPMorgan Chase & Co.', sector: 'Financial Services' },
    { symbol: 'V', name: 'Visa Inc.', sector: 'Financial Services' },
    { symbol: 'UNH', name: 'UnitedHealth Group', sector: 'Healthcare' },
    { symbol: 'XOM', name: 'Exxon Mobil Corporation', sector: 'Energy' },
    { symbol: 'LLY', name: 'Eli Lilly and Company', sector: 'Healthcare' },
    { symbol: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare' },
    { symbol: 'PG', name: 'Procter & Gamble Co.', sector: 'Consumer Defensive' },
    { symbol: 'MA', name: 'Mastercard Inc.', sector: 'Financial Services' },
    { symbol: 'HD', name: 'The Home Depot Inc.', sector: 'Consumer Cyclical' },
    { symbol: 'AVGO', name: 'Broadcom Inc.', sector: 'Technology' },
    { symbol: 'MRK', name: 'Merck & Co. Inc.', sector: 'Healthcare' },
    { symbol: 'CVX', name: 'Chevron Corporation', sector: 'Energy' },
    { symbol: 'COST', name: 'Costco Wholesale', sector: 'Consumer Defensive' },
  ];

  for (const stock of stocks) {
    await prisma.stock.upsert({
      where: { symbol: stock.symbol },
      update: {},
      create: stock,
    });
  }
  console.log(`✅ Seeded ${stocks.length} stocks`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
