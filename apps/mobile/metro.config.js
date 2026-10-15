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

/**
 * pnpm keeps a separate copy of these packages for every peer hash.
 * The iOS bundle was pulling React 18 next to React 19 (and a second
 * Reanimated). Hermes then crashes during GC on launch. Collapse every
 * copy onto the one the mobile app resolves.
 */
const singletonDirs = {
  react: fs.realpathSync(pkgDir('react')),
  'react-native': fs.realpathSync(pkgDir('react-native')),
  'expo-router': expoRouterDir,
  'react-native-reanimated': fs.realpathSync(pkgDir('react-native-reanimated')),
  'react-native-worklets': fs.realpathSync(pkgDir('react-native-worklets')),
  'expo-modules-core': fs.realpathSync(
    path.dirname(
      require.resolve('expo-modules-core/package.json', {
        paths: [pkgDir('expo')],
      }),
    ),
  ),
};

const singletonNames = Object.keys(singletonDirs).sort((a, b) => b.length - a.length);

function canonicalizeSingletonPath(filePath) {
  if (!filePath) return filePath;
  const posix = filePath.replace(/\\/g, '/');
  for (const name of singletonNames) {
    const marker = `/node_modules/${name}/`;
    const idx = posix.lastIndexOf(marker);
    if (idx === -1) continue;
    const rest = posix.slice(idx + marker.length);
    return rest ? path.join(singletonDirs[name], rest) : singletonDirs[name];
  }
  return filePath;
}

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  'expo-audio': pkgDir('expo-audio'),
  'expo-speech': pkgDir('expo-speech'),
  'expo-router': expoRouterDir,
  react: singletonDirs.react,
  'react-native': singletonDirs['react-native'],
  'expo-modules-core': singletonDirs['expo-modules-core'],
  'react-native-reanimated': singletonDirs['react-native-reanimated'],
  'react-native-worklets': singletonDirs['react-native-worklets'],
};

const upstreamResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolved = upstreamResolve
    ? upstreamResolve(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
  if (resolved?.type === 'sourceFile' && resolved.filePath) {
    const next = canonicalizeSingletonPath(resolved.filePath);
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
