jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(async () => undefined),
  impactAsync: jest.fn(async () => undefined),
  notificationAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
  NotificationFeedbackType: { Success: 'Success', Error: 'Error', Warning: 'Warning' },
}));

/* eslint-disable import/first -- jest.mock must precede imports */
import * as ExpoHaptics from 'expo-haptics';
import { haptics } from '../haptics';

const selectionAsync = ExpoHaptics.selectionAsync as jest.Mock;
const impactAsync = ExpoHaptics.impactAsync as jest.Mock;
const notificationAsync = ExpoHaptics.notificationAsync as jest.Mock;

describe('haptics helpers', () => {
  beforeEach(() => {
    selectionAsync.mockClear();
    impactAsync.mockClear();
    notificationAsync.mockClear();
  });

  it('maps selection / confirm / complete / error', async () => {
    await haptics.selection();
    await haptics.confirmLight();
    await haptics.confirmMedium();
    await haptics.completeStrong();
    await haptics.error();

    expect(selectionAsync).toHaveBeenCalledTimes(1);
    expect(impactAsync).toHaveBeenCalledWith('Light');
    expect(impactAsync).toHaveBeenCalledWith('Medium');
    expect(notificationAsync).toHaveBeenCalledWith('Success');
    expect(notificationAsync).toHaveBeenCalledWith('Error');
  });
});
