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

// User App
replaceAll('d:/cmit/Task13/frontend/user/app/api/categories/route.ts', '\/api/', '\/api/categories/');
replaceAll('d:/cmit/Task13/frontend/user/app/api/categories/route.ts', '\/api/"', '\/api/categories"');
replaceAll('d:/cmit/Task13/frontend/user/app/api/categories/route.ts', '\/api/\"', '\/api/categories\"');
replaceAll('d:/cmit/Task13/frontend/user/app/api/categories/route.ts', '\/api/\$', '\/api/categories\$');
replaceAll('d:/cmit/Task13/frontend/user/app/api/categories/route.ts', '\/api/\?', '\/api/categories?');

replaceAll('d:/cmit/Task13/frontend/user/app/api/products/route.ts', '\/api/\', '\/api/products\');
replaceAll('d:/cmit/Task13/frontend/user/app/api/products/route.ts', '\/api/', '\/api/products/');
replaceAll('d:/cmit/Task13/frontend/user/app/api/products/route.ts', '\/api/\?', '\/api/products?');
replaceAll('d:/cmit/Task13/frontend/user/app/api/products/[slug]/route.ts', '\/api/', '\/api/products/');
replaceAll('d:/cmit/Task13/frontend/user/app/api/products/[slug]/route.ts', '\/api/\$\{', '\/api/products/\$\{');

replaceAll('d:/cmit/Task13/frontend/user/app/api/settings/route.ts', '\/api/\"', '\/api/settings\"');
replaceAll('d:/cmit/Task13/frontend/user/app/api/settings/route.ts', '\/api/"', '\/api/settings"');

replaceAll('d:/cmit/Task13/frontend/user/app/api/cart/route.ts', '\/api/\"', '\/api/cart\"');
replaceAll('d:/cmit/Task13/frontend/user/app/api/cart/route.ts', '\/api/"', '\/api/cart"');

replaceAll('d:/cmit/Task13/frontend/user/app/api/wishlist/route.ts', '\/api/\"', '\/api/wishlist\"');
replaceAll('d:/cmit/Task13/frontend/user/app/api/wishlist/route.ts', '\/api/"', '\/api/wishlist"');

replaceAll('d:/cmit/Task13/frontend/user/app/api/orders/route.ts', '\/api/\"', '\/api/orders\"');
replaceAll('d:/cmit/Task13/frontend/user/app/api/orders/route.ts', '\/api/"', '\/api/orders"');
replaceAll('d:/cmit/Task13/frontend/user/app/api/orders/route.ts', '\/api/\?', '\/api/orders?');

function fixAdminFile(file, entity) {
    let p = 'd:/cmit/Task13/frontend/app/app/api/' + file;
    // previous incorrectly replaced \/api/auth/customers with \/api/auth/admin/
    // wait I used newContent.replace(/\/api\/auth\/(customers|users|dashboard-stats|analytics)/g, '/api/auth/admin/');
    // So if the regex was \/api\/auth\/(customers... then it would evaluate to /api/auth/admin/, 
    // OH! The powershell  was empty! So /api/auth/customers became /api/auth/admin/ !!
    replaceAll(p, '\/api/auth/admin/"', '\/api/auth/admin/' + entity + '"');
    replaceAll(p, '\/api/auth/admin/\"', '\/api/auth/admin/' + entity + '\"');
    replaceAll(p, '\/api/auth/admin/?', '\/api/auth/admin/' + entity + '?');
    replaceAll(p, '\/api/auth/admin/', '\/api/auth/admin/' + entity + '/');
    replaceAll(p, '\/api/auth/admin/\$\{', '\/api/auth/admin/' + entity + '/\$\{');
}

fixAdminFile('customers/[id]/orders/route.ts', 'customers');
fixAdminFile('orders/route.ts', 'orders');
fixAdminFile('orders/[id]/route.ts', 'orders');
fixAdminFile('orders/[id]/status/route.ts', 'orders');
fixAdminFile('products/route.ts', 'products');
fixAdminFile('products/[id]/route.ts', 'products');
fixAdminFile('products/create/route.ts', 'products');
fixAdminFile('products/bulk/route.ts', 'products');
fixAdminFile('categories/route.ts', 'categories');
fixAdminFile('categories/[id]/route.ts', 'categories');
fixAdminFile('settings/route.ts', 'settings');
