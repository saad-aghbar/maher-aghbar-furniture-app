/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'watch',
  name: 'MaherWatch',
  bundleIdentifier: `${config.ios?.bundleIdentifier ?? 'jo.maheraghbar.furniture'}.watchkitapp`,
  deploymentTarget: '10.0',
  icon: '../../assets/icon.png',
  colors: {
    $accent: '#C4A574',
  },
});
