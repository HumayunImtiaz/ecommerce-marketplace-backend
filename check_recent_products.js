const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      vendor: true
    }
  });
  console.log(JSON.stringify(products, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
