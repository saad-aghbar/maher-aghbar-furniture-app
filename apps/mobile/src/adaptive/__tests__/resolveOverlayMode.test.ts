import { resolveOverlayMode, type OverlayIntent } from '../resolveOverlayMode';

const INTENTS: OverlayIntent[] = ['action', 'confirm', 'picker', 'editor', 'inspector'];

describe('resolveOverlayMode', () => {
  it('COMPACT is always the canonical BottomSheet', () => {
    for (const intent of INTENTS) {
      expect(resolveOverlayMode(intent, 'compact')).toBe('sheet');
    }
  });

  it('MEDIUM: short confirms and pickers become dialogs; actions, editors and inspectors stay sheets', () => {
    expect(resolveOverlayMode('confirm', 'medium')).toBe('dialog');
    expect(resolveOverlayMode('picker', 'medium')).toBe('dialog');
    expect(resolveOverlayMode('action', 'medium')).toBe('sheet');
    expect(resolveOverlayMode('editor', 'medium')).toBe('sheet');
    expect(resolveOverlayMode('inspector', 'medium')).toBe('sheet');
  });

  it.each(['expanded', 'wide'] as const)('%s: dialogs for confirm/action/picker, side panels for editor/inspector', (wc) => {
    expect(resolveOverlayMode('confirm', wc)).toBe('dialog');
    expect(resolveOverlayMode('action', wc)).toBe('dialog');
    expect(resolveOverlayMode('picker', wc)).toBe('dialog');
    expect(resolveOverlayMode('editor', wc)).toBe('panel');
    expect(resolveOverlayMode('inspector', wc)).toBe('panel');
  });
});
