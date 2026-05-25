import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/**
 * Seed only what's needed for a flow-driven universe:
 *   - One admin user
 *   - Benchmark indices (SPY, QQQ) so macro/relative-strength always has reference points
 *
 * Every other ticker enters the DB one of two ways:
 *   1. The daily DiscoveryService finds it in Form 4 cluster buys (8 AM ET)
 *   2. The user types it into the research box → /analysis/<SYM> page upserts
 *      a Stock row and runs computeScore on demand
 */
const BENCHMARKS: { symbol: string; name: string; sector: string }[] = [
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust', sector: 'Index' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust',      sector: 'Index' },
];

async function main() {
  console.log('🌱 Seeding database (flow-driven mode)...');

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

  for (const s of BENCHMARKS) {
    await prisma.stock.upsert({
      where: { symbol: s.symbol },
      update: { name: s.name, sector: s.sector },
      create: { symbol: s.symbol, name: s.name, sector: s.sector },
    });
  }
  console.log(`✅ Seeded ${BENCHMARKS.length} benchmark indices`);
  console.log('   Universe will populate via daily discovery (8 AM ET) or search-triggered scoring.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
