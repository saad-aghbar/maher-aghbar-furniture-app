import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Platform,
  type NativeSyntheticEvent,
  type StyleProp,
  type TextInputContentSizeChangeEventData,
  type TextStyle,
  StyleSheet,
} from 'react-native';

/** Empty / short notes stay compact; grows a few lines, then scrolls. */
export const NOTES_FIELD_MIN_HEIGHT = 88;
export const NOTES_FIELD_MAX_HEIGHT = 180;

type Options = {
  multiline?: boolean;
  /** Explicit opt-out: `false`. Default max when multiline. */
  growMaxHeight?: number | false;
  growMinHeight?: number;
  style?: StyleProp<TextStyle>;
  value?: string;
  /**
   * Vertical padding already applied on the TextInput (top + bottom).
   * RN contentSize is text-only; height must include this or text clips.
   */
  contentPadding?: number;
  onContentSizeChange?: (
    e: NativeSyntheticEvent<TextInputContentSizeChangeEventData>,
  ) => void;
};

/**
 * Auto-grow multiline TextInput height up to a cap, then scroll in-place
 * so the caret / current line stays visible.
 */
export function useGrowingMultilineInput({
  multiline,
  growMaxHeight,
  growMinHeight,
  style,
  value,
  contentPadding = 24,
  onContentSizeChange,
}: Options) {
  const flat = useMemo(() => StyleSheet.flatten(style) ?? {}, [style]);
  const styleMin =
    typeof flat.minHeight === 'number'
      ? flat.minHeight
      : typeof flat.height === 'number'
        ? flat.height
        : undefined;

  const enabled = Boolean(multiline) && growMaxHeight !== false;
  const minH = growMinHeight ?? styleMin ?? NOTES_FIELD_MIN_HEIGHT;
  const maxH =
    growMaxHeight === false
      ? Number.POSITIVE_INFINITY
      : (growMaxHeight ?? NOTES_FIELD_MAX_HEIGHT);

  const [contentH, setContentH] = useState(minH);

  useEffect(() => {
    if (!enabled) return;
    if (!value || String(value).length === 0) {
      setContentH(minH);
    }
  }, [enabled, value, minH]);

  const handleContentSizeChange = useCallback(
    (e: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) => {
      if (enabled) {
        // contentSize = text block; RN height is border-box (includes padding).
        const textH = Math.ceil(e.nativeEvent.contentSize.height);
        const next = Math.max(minH, textH + contentPadding);
        setContentH((prev) => {
          if (Math.abs(next - prev) < 1) return prev;
          return next;
        });
      }
      onContentSizeChange?.(e);
    },
    [enabled, minH, contentPadding, onContentSizeChange],
  );

  if (!enabled) {
    return {
      inputProps: {
        onContentSizeChange,
        textAlignVertical: multiline ? ('top' as const) : undefined,
      },
      inputStyle: undefined as TextStyle | undefined,
    };
  }

  const height = Math.min(Math.max(contentH, minH), maxH);

  /**
   * Always allow internal scroll once we use a capped height. If scroll is
   * off while content is taller than the box, text draws under the border
   * and the caret disappears.
   */
  return {
    inputProps: {
      onContentSizeChange: handleContentSizeChange,
      scrollEnabled: true,
      textAlignVertical: 'top' as const,
      nestedScrollEnabled: true,
    },
    inputStyle: {
      minHeight: minH,
      height,
      maxHeight: maxH,
      ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
    } satisfies TextStyle,
  };
}
