/**
 * Phone stays portrait. Tablets (sw600dp+) may rotate landscape.
 * Resource qualifier — never device-model detection.
 *
 * Expo `orientation: 'portrait'` writes android:screenOrientation="portrait" on
 * MainActivity. Tablets that ignore orientation requests then letterbox the
 * activity. Unlock the manifest and set the real lock in onCreate from sw600dp.
 */
const {
  withDangerousMod,
  withMainActivity,
  withAndroidManifest,
} = require('expo/config-plugins');
const { mkdirSync, writeFileSync } = require('fs');
const { join } = require('path');

const BOOLS_PHONE = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <bool name="maher_allow_landscape">false</bool>
</resources>
`;

const BOOLS_TABLET = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <bool name="maher_allow_landscape">true</bool>
</resources>
`;

const KOTLIN_INJECT = `super.onCreate(null)
    if (getResources().getBoolean(R.bool.maher_allow_landscape)) {
      setRequestedOrientation(android.content.pm.ActivityInfo.SCREEN_ORIENTATION_FULL_USER)
    } else {
      setRequestedOrientation(android.content.pm.ActivityInfo.SCREEN_ORIENTATION_PORTRAIT)
    }`;

function writeBools(projectRoot, folder, contents) {
  const dir = join(projectRoot, 'android', 'app', 'src', 'main', 'res', folder);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'bools.xml'), contents);
}

function withAndroidTabletOrientation(config) {
  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      const root = cfg.modRequest.projectRoot;
      writeBools(root, 'values', BOOLS_PHONE);
      writeBools(root, 'values-sw600dp', BOOLS_TABLET);
      return cfg;
    },
  ]);

  config = withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    const activities = app?.activity ?? [];
    for (const act of activities) {
      const name = act.$?.['android:name'] ?? '';
      if (name === '.MainActivity' || name.endsWith('.MainActivity')) {
        act.$['android:screenOrientation'] = 'unspecified';
        act.$['android:resizeableActivity'] = 'true';
      }
    }
    return cfg;
  });

  config = withMainActivity(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (src.includes('maher_allow_landscape')) return cfg;
    if (!src.includes('super.onCreate(null)')) return cfg;
    src = src.replace(/super\.onCreate\(null\);?/, KOTLIN_INJECT);
    cfg.modResults.contents = src;
    return cfg;
  });

  return config;
}

module.exports = withAndroidTabletOrientation;
