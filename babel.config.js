module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    // react-native-worklets/plugin must be listed LAST.
    // Required by react-native-reanimated v4+.
    plugins: ['react-native-worklets/plugin'],
  };
};
