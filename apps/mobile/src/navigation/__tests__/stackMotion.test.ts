import { Platform } from 'react-native';
import { stackMotionOptionsFor, SWIPE_BACK_EDGE_RATIO } from '../stackMotion';

describe('stackMotionOptionsFor', () => {
  it('keeps LTR swipe animation from the right', () => {
    expect(stackMotionOptionsFor(false, 400)).toMatchObject({
      animation: 'slide_from_right',
      gestureEnabled: true,
      fullScreenGestureEnabled: true,
    });
  });

  it('limits swipe-back to the leading 20% of the screen width', () => {
    const width = 400;
    expect(stackMotionOptionsFor(false, width).gestureResponseDistance).toEqual({
      end: Math.round(width * SWIPE_BACK_EDGE_RATIO),
    });
    expect(stackMotionOptionsFor(true, width).gestureResponseDistance).toEqual({
      end: Math.round(width * SWIPE_BACK_EDGE_RATIO),
    });
  });

  it('uses left slide on Android RTL without changing iOS animation', () => {
    const options = stackMotionOptionsFor(true);
    if (Platform.OS === 'android') {
      expect(options.animation).toBe('slide_from_left');
    } else {
      // iOS relies on LocaleDirContext semantic RTL; SlideFromLeft would double-invert.
      expect(options.animation).toBe('slide_from_right');
    }
  });
});
