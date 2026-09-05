/**
 * Personal Apple teams cannot provision Push Notifications.
 * Run after expo-notifications so leftover aps-environment / remote-notification
 * are stripped from an already-generated ios/ tree (incremental prebuild).
 *
 * EAS preview/production must not load this plugin.
 */
const { withEntitlementsPlist, withInfoPlist } = require('expo/config-plugins');

function withPersonalTeamIosCapabilities(config) {
  config = withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults['aps-environment'];
    return cfg;
  });
  config = withInfoPlist(config, (cfg) => {
    const modes = cfg.modResults.UIBackgroundModes;
    if (Array.isArray(modes)) {
      cfg.modResults.UIBackgroundModes = modes.filter((mode) => mode !== 'remote-notification');
      if (cfg.modResults.UIBackgroundModes.length === 0) {
        delete cfg.modResults.UIBackgroundModes;
      }
    }
    return cfg;
  });
  return config;
}

module.exports = withPersonalTeamIosCapabilities;
