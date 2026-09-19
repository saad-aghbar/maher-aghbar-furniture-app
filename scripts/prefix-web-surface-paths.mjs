#!/usr/bin/env node
/**
 * One-shot: prefix in-app hrefs after folding three Next apps into /admin /dealer /worker.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const WEB = path.join(ROOT, 'apps/web/src');

const ADMIN_SEGS = [
  'dashboard',
  'orders',
  'requests',
  'quotations',
  'sales-orders',
  'deliveries',
  'products',
  'categories',
  'materials',
  'fabrics',
  'spec-options',
  'spec-option-values',
  'customers',
  'production',
  'inventory',
  'purchasing',
  'invoices',
  'reports',
  'employees',
  'users',
  'returns',
  'ai-chat',
  'settings',
  'notifications',
  'warehouses',
  'suppliers',
  'payments',
  'quality',
  'contracts',
  'documents',
  'ai-intake',
  'departments',
  'roles',
  'audit',
  'units',
  'colors',
  'raw-materials',
  'production-stages',
];

const DEALER_SEGS = [
  'dashboard',
  'catalog',
  'basket',
  'orders',
  'quotations',
  'deliveries',
  'ai-chat',
  'invoices',
  'payments',
  'statement',
  'contracts',
  'documents',
  'returns',
  'profile',
  'requests',
  'notifications',
  'order',
];

const WORKER_SEGS = [
  'dashboard',
  'tasks',
  'deliveries',
  'lane',
  'orders',
  'notifications',
  'profile',
];

function prefixContent(content, prefix, segments) {
  const seg = segments.join('|');
  const already = new RegExp(`^/${prefix}/`);
  const patterns = [
    new RegExp(`(href=\\{\`)/(${seg})(/|[\`])`, 'g'),
    new RegExp(`(href=["'])/(${seg})(/|["'])`, 'g'),
    new RegExp(`(href:\\s*["'])/(${seg})(/|["'])`, 'g'),
    new RegExp(`(parentHref:\\s*["'])/(${seg})(/|["'])`, 'g'),
    new RegExp(`(push\\(["'\`])/(${seg})(/|["'\`])`, 'g'),
    new RegExp(`(replace\\(["'\`])/(${seg})(/|["'\`])`, 'g'),
    new RegExp(`(assign\\(["'\`])/(${seg})(/|["'\`])`, 'g'),
    new RegExp(`(redirect\\(["'\`])/(${seg})(/|["'\`])`, 'g'),
    new RegExp(`(startsWith\\(["'])/(${seg})(/|["'])`, 'g'),
    new RegExp(`(===\\s*["'])/(${seg})(["'])`, 'g'),
  ];

  let next = content;
  for (const re of patterns) {
    next = next.replace(re, (full, lead, name, trail, maybeEnd) => {
      const rest = typeof maybeEnd === 'string' ? `${trail}${maybeEnd}` : trail;
      const built = `/${prefix}/${name}`;
      if (full.includes(built)) return full;
      return `${lead}${built}${rest}`;
    });
  }
  return next;
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) files.push(full);
  }
  return files;
}

const jobs = [
  { dir: path.join(WEB, 'app/[locale]/admin'), prefix: 'admin', segs: ADMIN_SEGS },
  { dir: path.join(WEB, 'app/[locale]/dealer'), prefix: 'dealer', segs: DEALER_SEGS },
  { dir: path.join(WEB, 'app/[locale]/worker'), prefix: 'worker', segs: WORKER_SEGS },
  { dir: path.join(WEB, 'components/dealer'), prefix: 'dealer', segs: DEALER_SEGS },
  { dir: path.join(WEB, 'components/worker'), prefix: 'worker', segs: WORKER_SEGS },
  { dir: path.join(WEB, 'components/nav-items.ts'), prefix: 'admin', segs: ADMIN_SEGS, file: true },
  { dir: path.join(WEB, 'components/sales-orders'), prefix: 'admin', segs: ADMIN_SEGS },
  { dir: path.join(WEB, 'components/workflow'), prefix: 'admin', segs: ADMIN_SEGS },
  { dir: path.join(WEB, 'components/cost-performance'), prefix: 'admin', segs: ADMIN_SEGS },
  { dir: path.join(WEB, 'components/production'), prefix: 'admin', segs: ADMIN_SEGS },
  { dir: path.join(WEB, 'components/scheduling'), prefix: 'admin', segs: ADMIN_SEGS },
  { dir: path.join(WEB, 'components/inventory'), prefix: 'admin', segs: ADMIN_SEGS },
  { dir: path.join(WEB, 'components/returns'), prefix: 'admin', segs: ADMIN_SEGS },
  { dir: path.join(WEB, 'components/admin'), prefix: 'admin', segs: ADMIN_SEGS },
  { dir: path.join(WEB, 'components/catalog'), prefix: 'admin', segs: ADMIN_SEGS },
  { dir: path.join(WEB, 'components/global-search.tsx'), prefix: 'admin', segs: ADMIN_SEGS, file: true },
  { dir: path.join(WEB, 'components/sidebar.tsx'), prefix: 'admin', segs: ADMIN_SEGS, file: true },
  { dir: path.join(WEB, 'components/topbar.tsx'), prefix: 'admin', segs: ADMIN_SEGS, file: true },
  { dir: path.join(WEB, 'components/nested-nav.tsx'), prefix: 'admin', segs: ADMIN_SEGS, file: true },
  { dir: path.join(WEB, 'components/app-shell.tsx'), prefix: 'admin', segs: ADMIN_SEGS, file: true },
];

let changed = 0;
for (const job of jobs) {
  const files = job.file ? [job.dir] : walk(job.dir);
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const before = fs.readFileSync(file, 'utf8');
    const after = prefixContent(before, job.prefix, job.segs);
    if (after !== before) {
      fs.writeFileSync(file, after);
      changed += 1;
    }
  }
}

console.log(`rewrote ${changed} files`);
