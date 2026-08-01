const { getDefaultConfig } = require('expo/metro-config');

// SDK 54+ auto-configures monorepo watchFolders / node module resolution.
const config = getDefaultConfig(__dirname);

module.exports = config;
