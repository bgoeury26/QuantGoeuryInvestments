import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
const prisma = new PrismaClient();
async function main() {
  const hash = await bcrypt.hash('Admin@QuantGoeury2024!', 12);
  await prisma.user.upsert({ where:{email:'goeurybenjamin@gmail.com'}, update:{}, create:{email:'goeurybenjamin@gmail.com',password:hash,name:'Benjamin Goeury',role:UserRole.ADMIN,status:UserStatus.APPROVED} });
  const stocks=[
    {symbol:'AAPL',name:'Apple Inc.',sector:'Technology'},{symbol:'MSFT',name:'Microsoft Corporation',sector:'Technology'},
    {symbol:'NVDA',name:'NVIDIA Corporation',sector:'Technology'},{symbol:'GOOGL',name:'Alphabet Inc.',sector:'Technology'},
    {symbol:'AMZN',name:'Amazon.com Inc.',sector:'Consumer Cyclical'},{symbol:'META',name:'Meta Platforms Inc.',sector:'Technology'},
    {symbol:'TSLA',name:'Tesla Inc.',sector:'Consumer Cyclical'},{symbol:'JPM',name:'JPMorgan Chase',sector:'Financial Services'},
    {symbol:'V',name:'Visa Inc.',sector:'Financial Services'},{symbol:'UNH',name:'UnitedHealth Group',sector:'Healthcare'},
    {symbol:'XOM',name:'Exxon Mobil',sector:'Energy'},{symbol:'LLY',name:'Eli Lilly',sector:'Healthcare'},
    {symbol:'AVGO',name:'Broadcom Inc.',sector:'Technology'},{symbol:'HD',name:'Home Depot',sector:'Consumer Cyclical'},
    {symbol:'PG',name:'Procter & Gamble',sector:'Consumer Defensive'},{symbol:'MA',name:'Mastercard',sector:'Financial Services'},
    {symbol:'JNJ',name:'Johnson & Johnson',sector:'Healthcare'},{symbol:'CVX',name:'Chevron',sector:'Energy'},
    {symbol:'MRK',name:'Merck & Co.',sector:'Healthcare'},{symbol:'COIN',name:'Coinbase Global',sector:'Financial Services'},
  ];
  for(const s of stocks) await prisma.stock.upsert({where:{symbol:s.symbol},update:{},create:s});
  console.log('✅ Seed complete');
}
main().catch(console.error).finally(()=>prisma.$disconnect());
