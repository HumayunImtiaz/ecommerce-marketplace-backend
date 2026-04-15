const fs = require('fs');
const path = require('path');

function replaceAll(file, searchStr, replacement) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    let replaced = content;
    // split-join behaves like string replace global
    replaced = replaced.split(searchStr).join(replacement);
    if (content !== replaced) {
      console.log('Fixed', file)
      fs.writeFileSync(file, replaced, 'utf8');
    }
  }
}

// User App fix leftover
replaceAll('d:/cmit/Task13/frontend/user/app/api/contact/route.ts', '${API_BASE_URL}/api/auth/contact', '${API_BASE_URL}/api/contact');
replaceAll('d:/cmit/Task13/frontend/user/app/api/newsletter/route.ts', '${API_BASE_URL}/api/auth/newsletter', '${API_BASE_URL}/api/newsletter');
replaceAll('d:/cmit/Task13/frontend/user/app/api/orders/coupons/public/route.ts', '${API_BASE_URL}/api/auth/orders/coupons/public', '${API_BASE_URL}/api/orders/coupons/public');

// Admin App fix broken endpoints
const adminMap = {
  'categories/route.ts': 'categories',
  'categories/[id]/route.ts': 'categories',
  'customers/[id]/orders/route.ts': 'users',
  'orders/route.ts': 'orders',
  'orders/[id]/route.ts': 'orders',
  'orders/[id]/status/route.ts': 'orders',
  'products/route.ts': 'products',
  'products/[id]/route.ts': 'products',
  'products/create/route.ts': 'products',
  'products/bulk/route.ts': 'products',
  'settings/route.ts': 'settings',
  'customers/route.ts': 'users',
  'dashboard/route.ts': 'dashboard-stats',
  'analytics/route.ts': 'analytics',
  'inquiries/route.ts': 'contact',
  'messages/conversations/route.ts' : 'messages/conversations',
  'coupons/route.ts': 'coupons',
};

for (const [f, ent] of Object.entries(adminMap)) {
  let p = 'd:/cmit/Task13/frontend/app/app/api/' + f;
  // Replace the broken paths that lack entity 
  replaceAll(p, '${API_BASE_URL}/api//', '${API_BASE_URL}/api/auth/admin/' + ent + '/');
  replaceAll(p, '${API_BASE_URL}/api/"', '${API_BASE_URL}/api/auth/admin/' + ent + '"');
  replaceAll(p, '${API_BASE_URL}/api/`', '${API_BASE_URL}/api/auth/admin/' + ent + '`');
  
  // also fix if they have /api/auth/ent instead of /api/auth/admin/ent
  replaceAll(p, '${API_BASE_URL}/api/auth/' + ent, '${API_BASE_URL}/api/auth/admin/' + ent);

  // just in case they have /api/${... string templates
  replaceAll(p, '${API_BASE_URL}/api/${', '${API_BASE_URL}/api/auth/admin/' + ent + '/${');
}
