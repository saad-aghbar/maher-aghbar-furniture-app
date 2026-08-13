const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

// SDK 54+ monorepo: watch workspace + resolve pnpm-linked packages (e.g. expo-clipboard).
const config = getDefaultConfig(projectRoot);

config.watchFolders = Array.from(
  new Set([...(config.watchFolders ?? []), workspaceRoot]),
);

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

config.resolver.disableHierarchicalLookup = false;

// Release builds must not ship /dev galleries (or the fixture modules they pull in).
// The __DEV__ redirect in app/dev/_layout.tsx is a second guard for accidental navigation.
if (process.env.NODE_ENV === 'production') {
  const extra = /[\\/]app[\\/]dev[\\/].*/;
  const existing = config.resolver.blockList;
  if (existing instanceof RegExp) {
    config.resolver.blockList = new RegExp(
      `(?:${existing.source})|(?:${extra.source})`,
      existing.flags,
    );
  } else if (Array.isArray(existing)) {
    config.resolver.blockList = [...existing, extra];
  } else if (typeof existing === 'function') {
    const prev = existing;
    config.resolver.blockList = (filePath) =>
      extra.test(filePath) || prev(filePath);
  } else {
    config.resolver.blockList = extra;
  }
}

module.exports = config;
