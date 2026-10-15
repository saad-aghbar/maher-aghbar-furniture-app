const path = require('node:path');

const reactRoot = path.dirname(require.resolve('react/package.json'));
const nativeRoot = path.dirname(require.resolve('react-native/package.json'));

module.exports = {
  preset: 'jest-expo',
  maxWorkers: 2,
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: ['**/__tests__/**/*.test.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  moduleNameMapper: {
    // Workspace web packages use a different React version. All native tests and
    // Expo dependencies must share the mobile app's React and native mocks.
    '^react$': require.resolve('react'),
    '^react/(.*)$': `${reactRoot}/$1`,
    '^react-native$': require.resolve('react-native'),
    '^react-native/(.*)$': `${nativeRoot}/$1`,
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
