module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo wires up the Reanimated/Worklets plugin automatically.
    presets: ['babel-preset-expo'],
  };
};
