try {
  require('react-native-gesture-handler/jestSetup');
} catch {
  // Optional in environments without the jest helper.
}

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

jest.mock('expo-system-ui', () => ({
  setBackgroundColorAsync: jest.fn(async () => {}),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => {}),
  removeItem: jest.fn(async () => {}),
}));

jest.mock('@react-native-community/netinfo', () => {
  const state = {
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
    details: { isConnectionExpensive: false },
  };
  return {
    __esModule: true,
    default: {
      addEventListener: jest.fn(() => jest.fn()),
      fetch: jest.fn(async () => state),
      useNetInfo: () => state,
    },
    addEventListener: jest.fn(() => jest.fn()),
    fetch: jest.fn(async () => state),
    useNetInfo: () => state,
  };
});
