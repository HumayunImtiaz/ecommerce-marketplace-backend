const fs = require('fs');
const path = require('path');

function replaceAll(file, searchStr, replacement) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    let replaced = content.split(searchStr).join(replacement);
    if (content !== replaced) {
      console.log('Fixed', file)
      fs.writeFileSync(file, replaced, 'utf8');
    }
  }
}

const adminMapGeneral = {
  'categories/route.ts': 'categories',
  'categories/[id]/route.ts': 'categories',
  'orders/route.ts': 'orders',
  'orders/[id]/route.ts': 'orders',
  'orders/[id]/status/route.ts': 'orders',
  'products/route.ts': 'products',
  'products/[id]/route.ts': 'products',
  'products/create/route.ts': 'products',
  'products/bulk/route.ts': 'products',
  'settings/route.ts': 'settings',
  'inquiries/route.ts': 'contact',
  'messages/conversations/route.ts' : 'messages',
};

// These belong directly at /api/ (e.g. /api/products, /api/settings)
for (const [f, ent] of Object.entries(adminMapGeneral)) {
  let p = 'd:/cmit/Task13/frontend/app/app/api/' + f;
  
  // Previous script erroneously set them to /api/auth/admin/products
  // So we replace /api/auth/admin/products with /api/products
  // Also if they have /api/auth/products
  
  replaceAll(p, '${API_BASE_URL}/api/auth/admin/' + ent, '${API_BASE_URL}/api/' + ent);
  replaceAll(p, '${API_BASE_URL}/api/auth/' + ent, '${API_BASE_URL}/api/' + ent);
}

// These are strictly under /api/auth/admin/ (e.g. /api/auth/admin/users, analytics, dashboard-stats, coupons)
const adminAuthMap = {
  'customers/route.ts': 'users',
  'customers/[id]/orders/route.ts': 'users',
  'dashboard/route.ts': 'dashboard-stats',
  'analytics/route.ts': 'analytics',
  'coupons/route.ts': 'coupons',
};

for (const [f, ent] of Object.entries(adminAuthMap)) {
  let p = 'd:/cmit/Task13/frontend/app/app/api/' + f;
  // Make sure they are /api/auth/admin/users
  // if they are /api/auth/users -> convert
  replaceAll(p, '${API_BASE_URL}/api/auth/' + ent, '${API_BASE_URL}/api/auth/admin/' + ent);
  
  // Actually, wait! The previous script set them correctly to /api/auth/admin/users if they were empty.
  // We can just assure that they are mapped to the correct entity.
}
