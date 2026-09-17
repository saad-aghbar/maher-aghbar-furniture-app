import { type ReactNode } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import { AdaptiveOverlay } from '@/adaptive/AdaptiveOverlay';
import type { OverlayIntent } from '@/adaptive/resolveOverlayMode';

export { resolveSheetHeightCap } from './BottomSheetPanel';

type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  onClosed?: () => void;
  title?: string;
  children: ReactNode;
  sheetHeight?: number;
  fitContent?: boolean;
  maxHeight?: number;
  expandable?: boolean;
  expandedHeight?: number;
  style?: StyleProp<ViewStyle>;
  overlay?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  /**
   * Overlay intent. Defaults to `editor` so existing hosts become a side
   * panel on EXPANDED/WIDE without per-file churn. Pass `picker` / `confirm`
   * / `inspector` / `action` when the host knows its job.
   */
  intent?: OverlayIntent;
};

/**
 * Adaptive host wrapper. COMPACT is the canonical SheetPanel; larger windows
 * follow `intent` via AdaptiveOverlay. Camera and complex touch flows that
 * must stay full-screen should keep using a dedicated screen, not this.
 */
export function BottomSheet({
  open,
  onClose,
  onClosed,
  title,
  children,
  sheetHeight,
  fitContent,
  maxHeight,
  expandable,
  expandedHeight,
  style,
  overlay,
  onExpandedChange,
  intent = 'editor',
}: BottomSheetProps) {
  return (
    <AdaptiveOverlay
      intent={intent}
      open={open}
      onClose={onClose}
      onClosed={onClosed}
      title={title}
      sheetHeight={sheetHeight}
      fitContent={fitContent}
      maxHeight={maxHeight}
      expandable={expandable}
      expandedHeight={expandedHeight}
      onExpandedChange={onExpandedChange}
      overlay={overlay}
      style={style}
    >
      {children}
    </AdaptiveOverlay>
  );
}
