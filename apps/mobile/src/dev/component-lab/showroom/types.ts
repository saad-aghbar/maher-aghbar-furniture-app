import type { ComponentType, ReactNode } from 'react';
import type { LabRole } from '../registry/types';

export type ShowroomLayout = 'full' | 'compact-grid' | 'horizontal';

export type ShowroomMode = 'inline' | 'sheet' | 'screen' | 'represented';

export type ShowroomItem = {
  id: string;
  componentName: string;
  section: string;
  role: LabRole;
  sourceFile: string;
  usedIn: string[];
  description: string;
  layout: ShowroomLayout;
  mode: ShowroomMode;
  /** Search tags */
  tags: string[];
  contains?: string[];
  /** Parent id when mode === 'represented' — scrolls/search maps to parent demo */
  representedIn?: string;
  /**
   * Inline preview component (must be a ComponentType so hooks are valid).
   * Required when mode === 'inline'.
   */
  render?: ComponentType;
  /** For sheet mode — open real sheet */
  renderSheet?: (args: { open: boolean; onClose: () => void }) => ReactNode;
  /** For screen mode — expo href */
  screenHref?: string;
  /** Multiple labeled variants rendered stacked */
  variants?: Array<{ label: string; render: ComponentType }>;
};

/** Module-level scroll memory for showroom (survives Coverage /dev navigations). */
let savedScrollY = 0;
let savedFocusId: string | null = null;

export function saveShowroomScroll(y: number, focusId?: string | null) {
  savedScrollY = y;
  if (focusId !== undefined) savedFocusId = focusId;
}

export function peekShowroomScroll(): { y: number; focusId: string | null } {
  return { y: savedScrollY, focusId: savedFocusId };
}

export function clearShowroomFocus() {
  savedFocusId = null;
}
