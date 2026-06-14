const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const vendors = await p.user.findMany({
    where: { role: 'VENDOR' },
    select: { email: true }
  });
  console.log(JSON.stringify(vendors, null, 2));
  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
