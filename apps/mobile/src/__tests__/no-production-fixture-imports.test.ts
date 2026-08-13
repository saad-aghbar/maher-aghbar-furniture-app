import fs from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '..');
const APP = path.resolve(__dirname, '../../app');
const MOBILE_ROOT = path.resolve(__dirname, '../..');

const FORBIDDEN_IMPORT =
  /from\s+['"][^'"]*\/(fixtures|detailFixtures|demoConversation)['"]|from\s+['"]\.\/(fixtures|detailFixtures|demoConversation)['"]/;

const FORBIDDEN_IDS =
  /\b(adminOrdersFixture|dealerOrdersFixture|catalogProductsFixture|catalogCategoriesFixture|openTasksFixture|completedTasksFixture|taskDetailFixture|adminOrderDetailFixture|dealerOrderDetailFixture|buildDemoConversation|demoReplyForPrompt)\b/;

function walk(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    if (name === '__tests__' || name === 'node_modules' || name === 'dev') continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (/\.(tsx?)$/.test(name)) acc.push(p);
  }
  return acc;
}

function rel(file: string) {
  return path.relative(MOBILE_ROOT, file);
}

describe('production screens do not import fixtures', () => {
  const productionFiles = [
    ...walk(path.join(SRC, 'features')),
    ...walk(path.join(APP, '(app)')),
  ].filter((file) => {
    const base = path.basename(file);
    return base !== 'fixtures.ts' && base !== 'detailFixtures.ts';
  });

  it('does not import fixtures, detailFixtures, or demoConversation', () => {
    const hits: string[] = [];
    for (const file of productionFiles) {
      const text = fs.readFileSync(file, 'utf8');
      if (FORBIDDEN_IMPORT.test(text)) hits.push(rel(file));
    }
    expect(hits).toEqual([]);
  });

  it('does not reference bundled fixture identifiers or dead demo helpers', () => {
    const hits: string[] = [];
    for (const file of productionFiles) {
      const text = fs.readFileSync(file, 'utf8');
      if (FORBIDDEN_IDS.test(text)) hits.push(rel(file));
    }
    expect(hits).toEqual([]);
  });

  it('does not fall back to a named fixture when forceState is set', () => {
    const hits: string[] = [];
    for (const file of productionFiles) {
      const text = fs.readFileSync(file, 'utf8');
      if (/\?\?\s*\w*Fixture\b/.test(text)) hits.push(rel(file));
    }
    expect(hits).toEqual([]);
  });
});

describe('production Metro keeps /dev out of release', () => {
  const metroSrc = fs.readFileSync(
    path.join(MOBILE_ROOT, 'metro.config.js'),
    'utf8',
  );

  it('blocklists app/dev when NODE_ENV is production', () => {
    expect(metroSrc).toContain("NODE_ENV === 'production'");
    expect(metroSrc).toContain('blockList');
    expect(metroSrc).toContain('app[\\\\/]dev');
  });
});

describe('chat message factories are not business records', () => {
  it('does not embed order or invoice numbers', () => {
    const src = fs.readFileSync(
      path.join(SRC, 'features/ai-chatbot/chatMessageFactories.ts'),
      'utf8',
    );
    expect(src).not.toMatch(/ORD-|SO-|INV-|PT-/);
  });
});
