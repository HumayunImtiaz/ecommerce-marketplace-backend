const fs = require('fs');
const path = require('path');

function replaceStr(file, searchStr, replacement) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    let replaced = content.split(searchStr).join(replacement);
    console.log(file, content === replaced ? 'unmodified' : 'replaced')
    fs.writeFileSync(file, replaced, 'utf8');
  }
}

// User App
replaceStr('d:/cmit/Task13/frontend/user/app/api/categories/route.ts', '\/api/"', '\/api/categories"');
replaceStr('d:/cmit/Task13/frontend/user/app/api/products/route.ts', '\/api/"', '\/api/products"');
replaceStr('d:/cmit/Task13/frontend/user/app/api/products/[slug]/route.ts', '\/api/$', '\/api/products/$');
replaceStr('d:/cmit/Task13/frontend/user/app/api/settings/route.ts', '\/api/"', '\/api/settings"');
replaceStr('d:/cmit/Task13/frontend/user/app/api/cart/route.ts', '\/api/"', '\/api/cart"');
replaceStr('d:/cmit/Task13/frontend/user/app/api/wishlist/route.ts', '\/api/"', '\/api/wishlist"');
replaceStr('d:/cmit/Task13/frontend/user/app/api/orders/route.ts', '\/api/"', '\/api/orders"');

// Wait... in my previous command I replaced /api/auth/(categories|products|cart|wishlist|settings|orders) with /api/.
// I must recursively go through all of them and restore the missing part from the filepath!
function walkAndFix(dir) {
    if (!fs.existsSync(dir)) return;
    const list = fs.readdirSync(dir);
    for (const file of list) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walkAndFix(fullPath);
        } else if (fullPath.endsWith('.ts')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let newContent = content;
            
            // Re-apply by looking at the path. 
            // e.g. path ".../api/categories/route.ts" usually fetches "/api/categories"
            // If we find /api/ or /api/? or /api/$  or /api/", let's carefully restore them.
            // Actually let's just write a generic matcher that uses the directory name!
            
            // For now, I'll manually replace the literal broken parts
            newContent = newContent.replace(/\$\\{API_BASE_URL\\}\/api\/'/g, '\$\\{API_BASE_URL\\}/api/'+path.basename(path.dirname(fullPath))+"'");
            newContent = newContent.replace(/\$\\{API_BASE_URL\\}\/api\/"/g, '\$\\{API_BASE_URL\\}/api/'+path.basename(path.dirname(fullPath))+'"');
            newContent = newContent.replace(/\$\\{API_BASE_URL\\}\/api\/\?/g, '\$\\{API_BASE_URL\\}/api/'+path.basename(path.dirname(fullPath))+'?');
            newContent = newContent.replace(/\$\\{API_BASE_URL\\}\/api\/\$\{/g, '\$\\{API_BASE_URL\\}/api/'+path.basename(path.dirname(fullPath))+'/\$\{');

            // Admin fixes
            newContent = newContent.replace(/\$\\{API_BASE_URL\\}\/api\/auth\/admin\/'/g, '\$\\{API_BASE_URL\\}/api/auth/admin/'+path.basename(path.dirname(fullPath))+"'");
            newContent = newContent.replace(/\$\\{API_BASE_URL\\}\/api\/auth\/admin\/"/g, '\$\\{API_BASE_URL\\}/api/auth/admin/'+path.basename(path.dirname(fullPath))+'"');
            newContent = newContent.replace(/\$\\{API_BASE_URL\\}\/api\/auth\/admin\/\?/g, '\$\\{API_BASE_URL\\}/api/auth/admin/'+path.basename(path.dirname(fullPath))+'?');
            newContent = newContent.replace(/\$\\{API_BASE_URL\\}\/api\/auth\/admin\/\$\{/g, '\$\\{API_BASE_URL\\}/api/auth/admin/'+path.basename(path.dirname(fullPath))+'/\$\{');

            if (content !== newContent) {
                console.log('Restored', fullPath);
                fs.writeFileSync(fullPath, newContent, 'utf8');
            }
        }
    }
}
walkAndFix('d:/cmit/Task13/frontend/user/app/api');
walkAndFix('d:/cmit/Task13/frontend/app/app/api');
