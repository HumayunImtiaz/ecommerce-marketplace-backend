const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

async function main() {
  const p = new PrismaClient();
  
  // Find an admin user
  const admin = await p.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) { console.log('No admin found'); return; }
  console.log('Admin ID:', admin.id);
  
  // Generate a token
  const token = jwt.sign({ id: admin.id, email: admin.email, role: 'ADMIN' }, 'humayun123', { expiresIn: '1d' });
  
  // Find the vendor
  const vendor = await p.vendor.findFirst({ where: { businessName: 'Turbo' } });
  if (!vendor) { console.log('No vendor found'); return; }
  console.log('Vendor ID:', vendor.id);
  console.log('Vendor commissionRate (raw from prisma):', vendor.commissionRate);
  
  // Call the actual API
  const res = await fetch(`http://localhost:5000/api/vendors/admin/vendors/${vendor.id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  
  console.log('\n=== FULL API RESPONSE ===');
  console.log(JSON.stringify(data, null, 2));
  
  console.log('\n=== commissionRate field specifically ===');
  console.log('Value:', data?.data?.commissionRate);
  console.log('Type:', typeof data?.data?.commissionRate);
  console.log('Keys in data.data:', Object.keys(data?.data || {}));
  
  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
