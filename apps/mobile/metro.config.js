const fs = require('fs');
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
config.resolver.unstable_enableSymlinks = true;

/** pnpm does not hoist these to the workspace root; pin them so Metro always finds them. */
function pkgDir(name) {
  return path.dirname(
    require.resolve(`${name}/package.json`, { paths: [projectRoot] }),
  );
}

const expoRouterDir = fs.realpathSync(pkgDir('expo-router'));

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  'expo-audio': pkgDir('expo-audio'),
  'expo-speech': pkgDir('expo-speech'),
  'expo-router': expoRouterDir,
};

/**
 * pnpm keeps two expo-router@6.0.24 peer-hash folders. Expo Go may still request
 * the old entry URL after install. Collapse every copy onto the app's realpath
 * so Route + LinkPreview React contexts stay the same instance as `Stack`.
 */
function canonicalizeExpoRouterPath(filePath) {
  if (!filePath) return filePath;
  const posix = filePath.replace(/\\/g, '/');
  const marker = '/node_modules/expo-router/';
  const idx = posix.lastIndexOf(marker);
  if (idx === -1) return filePath;
  const rest = posix.slice(idx + marker.length);
  return rest ? path.join(expoRouterDir, rest) : expoRouterDir;
}

const upstreamResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolved = upstreamResolve
    ? upstreamResolve(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
  if (resolved?.type === 'sourceFile' && resolved.filePath) {
    const next = canonicalizeExpoRouterPath(resolved.filePath);
    if (next !== resolved.filePath) {
      return { ...resolved, filePath: next };
    }
  }
  return resolved;
};

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
