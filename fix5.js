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

// Fix notifications
replaceAll('d:/cmit/Task13/frontend/app/app/api/notifications/route.ts', '${API_BASE_URL}/api/auth/notifications', '${API_BASE_URL}/api/notifications');
replaceAll('d:/cmit/Task13/frontend/app/app/api/notifications/[id]/route.ts', '${API_BASE_URL}/api/auth/notifications', '${API_BASE_URL}/api/notifications');
replaceAll('d:/cmit/Task13/frontend/app/app/api/notifications/read-all/route.ts', '${API_BASE_URL}/api/auth/notifications', '${API_BASE_URL}/api/notifications');

