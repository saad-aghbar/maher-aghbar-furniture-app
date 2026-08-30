import {
  NOTIFICATION_LTR_TREE,
  notificationLeadEdge,
  notificationRowDirection,
  notificationStartAlign,
  notificationStartBandPad,
} from '../notificationLayout';

describe('notificationLayout', () => {
  it('freezes Yoga direction so locale isRTL can mirror without double-flip', () => {
    expect(NOTIFICATION_LTR_TREE.direction).toBe('ltr');
  });

  it('places the back chip and accent on the start edge', () => {
    expect(notificationLeadEdge(false)).toEqual({ left: 0 });
    expect(notificationLeadEdge(true)).toEqual({ right: 0 });
  });

  it('leads All from the right in RTL via row-reverse', () => {
    expect(notificationRowDirection(false)).toBe('row');
    expect(notificationRowDirection(true)).toBe('row-reverse');
  });

  it('start-aligns kicker, date, title, body, and Open', () => {
    expect(notificationStartAlign(false)).toBe('left');
    expect(notificationStartAlign(true)).toBe('right');
  });

  it('pads the start band so the accent does not clip type', () => {
    expect(notificationStartBandPad(false, 20)).toEqual({ paddingLeft: 20 });
    expect(notificationStartBandPad(true, 20)).toEqual({ paddingRight: 20 });
  });
});
