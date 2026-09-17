import type { MaherWindowClass } from './layoutTypes';

/**
 * What the overlay is for. Presentation is derived from intent + window class;
 * business content never changes.
 *
 * action    short action list / menu
 * confirm   yes-no with optional reason
 * picker    choose from a list (filters, dealers, dates)
 * editor    create / edit a record
 * inspector read-mostly detail of a selected entity
 */
export type OverlayIntent = 'action' | 'confirm' | 'picker' | 'editor' | 'inspector';

/**
 * sheet   existing BottomSheet (canonical phone implementation)
 * dialog  centered Maher dialog
 * panel   side panel anchored to the reading-end edge
 */
export type OverlayMode = 'sheet' | 'dialog' | 'panel';

export function resolveOverlayMode(intent: OverlayIntent, windowClass: MaherWindowClass): OverlayMode {
  if (windowClass === 'compact') return 'sheet';
  if (windowClass === 'medium') {
    switch (intent) {
      case 'confirm':
      case 'picker':
        return 'dialog';
      case 'action':
      case 'editor':
      case 'inspector':
        return 'sheet';
    }
  }
  // expanded / wide
  switch (intent) {
    case 'confirm':
    case 'action':
    case 'picker':
      return 'dialog';
    case 'editor':
    case 'inspector':
      return 'panel';
  }
}
