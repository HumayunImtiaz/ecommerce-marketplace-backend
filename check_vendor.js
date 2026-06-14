const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const vendors = await p.vendor.findMany({
    select: { id: true, businessName: true, commissionRate: true, status: true }
  });
  
  vendors.forEach(v => {
    console.log('---');
    console.log('ID:', v.id);
    console.log('Business:', v.businessName);
    console.log('Commission Rate (raw):', v.commissionRate);
    console.log('Commission Rate (type):', typeof v.commissionRate);
    console.log('Commission Rate (JSON):', JSON.stringify(v.commissionRate));
    console.log('Commission Rate (toString):', v.commissionRate?.toString());
    console.log('Commission Rate (Number):', Number(v.commissionRate));
    console.log('Status:', v.status);
  });
  
  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
