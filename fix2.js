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

const map = {
  'categories/route.ts': 'categories',
  'products/route.ts': 'products',
  'products/[slug]/route.ts': 'products',
  'settings/route.ts': 'settings',
  'cart/route.ts': 'cart',
  'wishlist/route.ts': 'wishlist',
  'orders/route.ts': 'orders'
};

for (const [f, ent] of Object.entries(map)) {
  let file = 'd:/cmit/Task13/frontend/user/app/api/' + f;
  replaceAll(file, '${API_BASE_URL}/api/', '${API_BASE_URL}/api/' + ent + '/');
  replaceAll(file, '${API_BASE_URL}/api/"', '${API_BASE_URL}/api/' + ent + '"');
  replaceAll(file, '${API_BASE_URL}/api/?', '${API_BASE_URL}/api/' + ent + '?');
  replaceAll(file, '${API_BASE_URL}/api/`', '${API_BASE_URL}/api/' + ent + '`');
}

const adminMap = {
  'customers/[id]/orders/route.ts': 'customers',
  'orders/route.ts': 'orders',
  'orders/[id]/route.ts': 'orders',
  'orders/[id]/status/route.ts': 'orders',
  'products/route.ts': 'products',
  'products/[id]/route.ts': 'products',
  'products/create/route.ts': 'products',
  'products/bulk/route.ts': 'products',
  'categories/route.ts': 'categories',
  'categories/[id]/route.ts': 'categories',
  'settings/route.ts': 'settings'
};

for (const [f, ent] of Object.entries(adminMap)) {
  let p = 'd:/cmit/Task13/frontend/app/app/api/' + f;
  let brokenStr = '/api/auth/admin/';
  let correctStr = '/api/auth/admin/' + ent + '/';
  
  // since $1 was empty, it became /api/auth/admin/. We just need to append the entity name where appropriate.
  // actually wait! The ones I replaced earlier were:
  // content.replace(/\/api\/auth\/(customers|users|dashboard-stats|analytics)/g, '/api/auth/admin/$1');
  // because $1 was empty, it literally became "/api/auth/admin/" !
  
  replaceAll(p, '${API_BASE_URL}/api/auth/admin/"', '${API_BASE_URL}/api/auth/admin/' + ent + '"');
  replaceAll(p, '${API_BASE_URL}/api/auth/admin/`', '${API_BASE_URL}/api/auth/admin/' + ent + '`');
  replaceAll(p, '${API_BASE_URL}/api/auth/admin/?', '${API_BASE_URL}/api/auth/admin/' + ent + '?');
  replaceAll(p, '${API_BASE_URL}/api/auth/admin/', '${API_BASE_URL}/api/auth/admin/' + ent + '/');
}
