const fs = require('fs');

function fixSrc(file, searchStr, replacement) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    let replaced = content.split(searchStr).join(replacement);
    if (content !== replaced) {
      console.log('Fixed src', file)
      fs.writeFileSync(file, replaced, 'utf8');
    }
  }
}

const resolveUrlFunc = `
const resolveAvatar = (url) => {
  if (!url) return "/placeholder.svg";
  if (url.startsWith("http")) return url;
  if (url.startsWith("/")) return url;
  return \`\${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000"}/uploads/\${url}\`;
};
`;

function injectResolveAndFix(file, replacerFunc) {
    if (!fs.existsSync(file)) return;
    let content = fs.readFileSync(file, 'utf8');
    
    // Inject function if not exists
    if (!content.includes('resolveAvatar')) {
        // inject after imports
        const lastImportIndex = content.lastIndexOf('import ');
        let endOfLastImport = content.indexOf('\n', lastImportIndex) + 1;
        content = content.slice(0, endOfLastImport) + resolveUrlFunc + content.slice(endOfLastImport);
    }
    
    let replaced = replacerFunc(content);
    if (content !== replaced) {
        console.log('Fixed Avatar Injection', file);
        fs.writeFileSync(file, replaced, 'utf8');
    }
}

// 1. recent-activity.tsx
injectResolveAndFix('d:/cmit/Task13/frontend/app/components/recent-activity.tsx', c => {
    return c.replace(/src=\{activity\.avatar \|\| "\/placeholder\.svg"\}/g, 'src={resolveAvatar(activity.avatar)}');
});

// 2. customers-table.tsx
injectResolveAndFix('d:/cmit/Task13/frontend/app/components/customers-table.tsx', c => {
    return c.replace(/src=\{customer\.avatar \|\| "\/placeholder\.svg"\}/g, 'src={resolveAvatar(customer.avatar)}');
});

// 3. categories-table.tsx
injectResolveAndFix('d:/cmit/Task13/frontend/app/components/categories-table.tsx', c => {
    return c.replace(/src=\{category\.image \|\| "\/placeholder\.svg"\}/g, 'src={resolveAvatar(category.image)}');
});

// 4. customers/[id]/page.tsx
injectResolveAndFix('d:/cmit/Task13/frontend/app/app/admin/customers/[id]/page.tsx', c => {
    return c.replace(/src=\{customer\.avatar \|\| "\/placeholder\.svg"\}/g, 'src={resolveAvatar(customer.avatar)}');
});

// 5. inbox/page.tsx
injectResolveAndFix('d:/cmit/Task13/frontend/app/app/admin/inbox/page.tsx', c => {
    return c.replace(/src=\{convo\.user\.avatar\}/g, 'src={resolveAvatar(convo.user.avatar)}');
});

// 6. admin-profile-client.tsx
// It already uses a manual check. Let's just fix the avatarPreview init:
// initialData.avatar ? (initialData.avatar.startsWith("http") ? ...
// Actually we can just leave it or replace it. I'll replace the raw check.
const profileClient = 'd:/cmit/Task13/frontend/app/components/admin-profile-client.tsx';
if (fs.existsSync(profileClient)) {
    let content = fs.readFileSync(profileClient, 'utf8');
    const b = '`${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000"}/uploads/${initialData.avatar}`';
    let before = 'initialData.avatar ? (initialData.avatar.startsWith("http") ? initialData.avatar : ' + b + ') : null';
    let after = 'initialData.avatar ? (initialData.avatar.startsWith("http") || initialData.avatar.startsWith("/") ? initialData.avatar : ' + b + ') : null';
    
    // Also the cancel handler
    // It's duplicated there.
    let re = /initialData\.avatar \? \(initialData\.avatar\.startsWith\("http"\) \? initialData\.avatar : `\$\{process\.env\.NEXT_PUBLIC_API_BASE_URL \|\| "http:\/\/localhost:5000"\}\/uploads\/\$\{initialData\.avatar\}`\) : null/g;
    
    let replaced = content.replace(re, 'initialData.avatar ? (initialData.avatar.startsWith("http") || initialData.avatar.startsWith("/") ? initialData.avatar : `${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000"}/uploads/${initialData.avatar}`) : null');
    
    if (replaced !== content) {
        console.log('Fixed admin-profile-client.tsx');
        fs.writeFileSync(profileClient, replaced, 'utf8');
    }
}
