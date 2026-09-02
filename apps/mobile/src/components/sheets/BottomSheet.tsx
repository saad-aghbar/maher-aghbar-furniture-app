import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Keyboard,
  Modal,
  StyleSheet,
  View,
  type KeyboardEvent,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { KeyboardDismissAccessory } from '@/components/forms/KeyboardDismissAccessory';
import { useCodeScannerState } from '@/components/scan/CodeScannerProvider';
import { useLocationMapVisibility } from '@/components/maps/LocationMapVisibility';
import { useSheetOverlayYield } from '@/components/sheets/SheetOverlayYield';
import { useAccessoryCameraState } from '@/features/inventory/components/AccessoryCameraProvider';
import { BottomSheetTransition, shouldDismissSheet } from '@/motion/BottomSheetTransition';
import { springs, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';

/** Soft settle for expand / collapse — less snappy than chrome springs. */
const SHEET_HEIGHT_SPRING = {
  damping: 28,
  stiffness: 210,
  mass: 1.05,
  overshootClamping: true,
} as const;

type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  /**
   * Fires after the sheet finishes its close animation and the host Modal unmounts.
   * Use before presenting another Modal (e.g. image library) to avoid iOS dismiss races.
   */
  onClosed?: () => void;
  title?: string;
  children: ReactNode;
  /** Fixed height when `fitContent` is false. */
  sheetHeight?: number;
  /**
   * Size the sheet to its content, capped at `maxHeight` (default ~70% of the window).
   * Prefer scrollable children when content may exceed the cap.
   */
  fitContent?: boolean;
  maxHeight?: number;
  /**
   * Swipe the handle up to nearly full-screen; swipe down to return to the
   * collapsed size. Downward dismiss still works from the collapsed size.
   */
  expandable?: boolean;
  /** Full-page height when expanded (default: window − top inset − 8). */
  expandedHeight?: number;
  style?: StyleProp<ViewStyle>;
  /**
   * Stacked on top of another sheet. Host Modals yield while this overlay is open.
   */
  overlay?: boolean;
  /** Called when the sheet expands or collapses via the handle. */
  onExpandedChange?: (expanded: boolean) => void;
};

/**
 * Modal bottom sheet composed with BottomSheetTransition drivers.
 */
export function BottomSheet({
  open,
  onClose,
  onClosed,
  title,
  children,
  sheetHeight = 360,
  fitContent = false,
  maxHeight,
  expandable = false,
  expandedHeight,
  style,
  overlay = false,
  onExpandedChange,
}: BottomSheetProps) {
  const { colors, theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { isScanning } = useCodeScannerState();
  const { isOpen: isAccessoryCamera } = useAccessoryCameraState();
  const { isOpen: isLocationMap } = useLocationMapVisibility();
  const { isOpen: isOverlayYield, setOpen: setOverlayYield } = useSheetOverlayYield();

  const closeMs = theme.motion.duration.slow + 40;

  const [mounted, setMounted] = useState(false);
  const [progress, setProgress] = useState(1);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [expanded, setExpanded] = useState(false);
  /** Overlay Modal gate — false until host has yielded; stays true through exit motion. */
  const [overlayModalVisible, setOverlayModalVisible] = useState(false);

  const wasOpenRef = useRef(false);
  const onClosedRef = useRef(onClosed);
  onClosedRef.current = onClosed;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const onExpandedChangeRef = useRef(onExpandedChange);
  onExpandedChangeRef.current = onExpandedChange;

  const reduceMotion = useReducedMotion();
  const dragY = useSharedValue(0);
  const dragging = useSharedValue(0);
  const heightSV = useSharedValue(360);
  const reduceSV = useSharedValue(0);
  const expandableSV = useSharedValue(expandable ? 1 : 0);
  const expandedSV = useSharedValue(0);
  const collapsedHSV = useSharedValue(360);
  const expandedHSV = useSharedValue(640);
  const dragStartH = useSharedValue(360);

  const hostBlocked =
    isScanning ||
    isAccessoryCamera ||
    isLocationMap ||
    (!overlay && isOverlayYield);

  const sheetModalVisible = overlay
    ? overlayModalVisible && !isAccessoryCamera && !isLocationMap && !isScanning
    : !hostBlocked;

  const windowH = Dimensions.get('window').height;
  const fullExpandedHeight = useMemo(
    () =>
      expandedHeight ??
      Math.max(320, Math.round(windowH - Math.max(insets.top, 12) - 8)),
    [expandedHeight, insets.top, windowH],
  );

  const heightCap = useMemo(() => {
    const cap = maxHeight ?? Math.round(windowH * 0.7);
    if (keyboardHeight <= 0) return cap;
    return Math.min(cap, Math.max(240, windowH - keyboardHeight));
  }, [maxHeight, keyboardHeight, windowH]);

  const [animHeight, setAnimHeight] = useState(() => Math.min(320, heightCap));

  useEffect(() => {
    if (!mounted) {
      setKeyboardHeight(0);
      return;
    }
    const onShow = (e: KeyboardEvent) => {
      const height = e.endCoordinates?.height ?? 0;
      if (height > 0) setKeyboardHeight(height);
    };
    const onHide = () => setKeyboardHeight(0);
    const willShow = Keyboard.addListener('keyboardWillShow', onShow);
    const didShow = Keyboard.addListener('keyboardDidShow', onShow);
    const willHide = Keyboard.addListener('keyboardWillHide', onHide);
    const didHide = Keyboard.addListener('keyboardDidHide', onHide);
    return () => {
      willShow.remove();
      didShow.remove();
      willHide.remove();
      didHide.remove();
    };
  }, [mounted]);

  useEffect(() => {
    if (open) {
      const justOpened = !wasOpenRef.current;
      wasOpenRef.current = true;
      setMounted(true);

      // Only play the enter animation on false → true. Re-running this effect
      // while already open (dependency churn) used to flash the sheet away.
      if (!justOpened) return;

      setProgress(1);
      setExpanded(false);
      expandedSV.value = 0;
      dragY.value = 0;

      if (overlay) {
        setOverlayYield(true);
        setOverlayModalVisible(false);
        const t = setTimeout(() => {
          setOverlayModalVisible(true);
          requestAnimationFrame(() => setProgress(0));
        }, 80);
        return () => clearTimeout(t);
      }

      const id = requestAnimationFrame(() => setProgress(0));
      return () => cancelAnimationFrame(id);
    }

    setProgress(1);
    const t = setTimeout(() => {
      setMounted(false);
      setExpanded(false);
      expandedSV.value = 0;
      if (overlay) {
        setOverlayModalVisible(false);
        setOverlayYield(false);
      }
      if (wasOpenRef.current) {
        wasOpenRef.current = false;
        requestAnimationFrame(() => {
          setTimeout(() => {
            onClosedRef.current?.();
          }, 80);
        });
      }
    }, closeMs);
    return () => clearTimeout(t);
  }, [open, overlay, closeMs, setOverlayYield, expandedSV, dragY]);

  const wasYieldingRef = useRef(false);
  useEffect(() => {
    if (overlay || !open || !mounted) return;
    if (hostBlocked) {
      wasYieldingRef.current = true;
      return;
    }
    if (!wasYieldingRef.current) return;
    wasYieldingRef.current = false;
    setProgress(1);
    const id = requestAnimationFrame(() => setProgress(0));
    return () => cancelAnimationFrame(id);
  }, [overlay, open, mounted, hostBlocked]);

  const keyboardOpen = keyboardHeight > 0;
  const collapsedHeight = fitContent
    ? animHeight
    : keyboardOpen
      ? Math.min(sheetHeight, Math.max(240, windowH - keyboardHeight))
      : sheetHeight;
  const targetExpandedHeight = Math.min(
    fullExpandedHeight,
    keyboardOpen ? Math.max(240, windowH - keyboardHeight) : fullExpandedHeight,
  );
  const bottomPad = keyboardOpen
    ? theme.spacing.md
    : Math.max(insets.bottom, theme.spacing.md) + theme.spacing.sm;

  const onSheetLayout = (e: LayoutChangeEvent) => {
    if (!fitContent || expanded) return;
    const next = Math.min(Math.ceil(e.nativeEvent.layout.height), heightCap);
    setAnimHeight((prev) => (Math.abs(prev - next) > 2 ? next : prev));
  };

  useEffect(() => {
    collapsedHSV.value = collapsedHeight;
    if (!expandable) {
      heightSV.value = collapsedHeight;
      return;
    }
    // Keep live height in sync when collapsed content size changes (not while expanded).
    if (expandedSV.value === 0 && dragging.value === 0) {
      heightSV.value = collapsedHeight;
    }
  }, [
    collapsedHeight,
    collapsedHSV,
    dragging,
    expandable,
    expandedSV,
    heightSV,
  ]);

  useEffect(() => {
    expandedHSV.value = targetExpandedHeight;
  }, [expandedHSV, targetExpandedHeight]);

  useEffect(() => {
    reduceSV.value = reduceMotion ? 1 : 0;
  }, [reduceMotion, reduceSV]);

  useEffect(() => {
    expandableSV.value = expandable ? 1 : 0;
  }, [expandable, expandableSV]);

  useEffect(() => {
    if (!open) return;
    dragY.value = 0;
    dragging.value = 0;
  }, [dragY, dragging, open]);

  const closeFromHandle = useCallback(() => {
    closeRef.current();
  }, []);

  const setExpandedFromHandle = useCallback((next: boolean) => {
    setExpanded(next);
    onExpandedChangeRef.current?.(next);
  }, []);

  const settleHeight = useCallback(
    (nextExpanded: boolean) => {
      'worklet';
      const target = nextExpanded ? expandedHSV.value : collapsedHSV.value;
      expandedSV.value = nextExpanded ? 1 : 0;
      if (reduceSV.value) {
        heightSV.value = target;
        dragY.value = 0;
        runOnJS(setExpandedFromHandle)(nextExpanded);
        return;
      }
      dragY.value = withSpring(0, springs.gentle);
      heightSV.value = withSpring(target, SHEET_HEIGHT_SPRING, (finished) => {
        if (finished) {
          runOnJS(setExpandedFromHandle)(nextExpanded);
        }
      });
    },
    [
      collapsedHSV,
      dragY,
      expandedHSV,
      expandedSV,
      heightSV,
      reduceSV,
      setExpandedFromHandle,
    ],
  );

  const dismissPan = useMemo(
    () =>
      Gesture.Pan()
        .maxPointers(1)
        .activeOffsetY([-12, 12])
        .failOffsetX([-28, 28])
        .onStart(() => {
          dragging.value = 1;
          dragStartH.value = heightSV.value;
        })
        .onUpdate((e) => {
          if (reduceSV.value) return;

          if (!expandableSV.value) {
            dragY.value = Math.max(0, e.translationY);
            return;
          }

          // Finger up → taller sheet; finger down → shorter.
          const next = dragStartH.value - e.translationY;
          const minH = collapsedHSV.value;
          const maxH = expandedHSV.value;

          if (next >= minH && next <= maxH) {
            heightSV.value = next;
            dragY.value = 0;
            return;
          }

          if (next > maxH) {
            // Soft rubber past full height
            const over = next - maxH;
            heightSV.value = maxH + over * 0.12;
            dragY.value = 0;
            return;
          }

          // Past collapsed: keep height at min and add dismiss drag
          heightSV.value = minH;
          dragY.value = minH - next;
        })
        .onEnd((e) => {
          const v = e.velocityY;
          const h = heightSV.value;
          const dismissPull = Math.max(0, dragY.value);
          dragging.value = 0;

          if (!expandableSV.value) {
            const y = Math.max(0, e.translationY);
            if (shouldDismissSheet(y, v, h)) {
              runOnJS(closeFromHandle)();
              return;
            }
            dragY.value = reduceSV.value ? 0 : withSpring(0, springs.gentle);
            return;
          }

          // Dismiss only from the collapsed detent with a clear downward pull
          if (
            expandedSV.value === 0 &&
            dismissPull > 0 &&
            shouldDismissSheet(dismissPull, v, collapsedHSV.value)
          ) {
            runOnJS(closeFromHandle)();
            return;
          }

          // Project resting height from velocity, then snap to nearest detent
          const projected = h - v * 0.18;
          const mid = (collapsedHSV.value + expandedHSV.value) * 0.5;
          const shouldExpand =
            v < -420 ? true : v > 420 ? false : projected >= mid;
          settleHeight(shouldExpand);
        })
        .onFinalize((_e, success) => {
          dragging.value = 0;
          if (success) return;
          if (expandableSV.value) {
            settleHeight(expandedSV.value === 1);
            return;
          }
          if (reduceSV.value) {
            dragY.value = 0;
            return;
          }
          dragY.value = withSpring(0, springs.gentle);
        }),
    [
      closeFromHandle,
      collapsedHSV,
      dragStartH,
      dragY,
      dragging,
      expandableSV,
      expandedHSV,
      expandedSV,
      heightSV,
      reduceSV,
      settleHeight,
    ],
  );

  const expandablePanelStyle = useAnimatedStyle(() => {
    if (!expandableSV.value) {
      return {};
    }
    return {
      height: heightSV.value,
      maxHeight: '100%' as unknown as number,
    };
  });

  if (!mounted) return null;

  const staticPanelStyle: ViewStyle = expandable
    ? {}
    : fitContent
      ? { maxHeight: heightCap, alignSelf: 'stretch' }
      : { height: collapsedHeight, maxHeight: '100%' };

  return (
    <Modal
      visible={sheetModalVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
      presentationStyle="overFullScreen"
    >
      <GestureHandlerRootView style={styles.root}>
        <View style={styles.root}>
          <BottomSheetTransition
            progress={progress}
            sheetHeight={expandable ? targetExpandedHeight : collapsedHeight}
            sheetHeightSV={expandable ? heightSV : undefined}
            onBackdropPress={onClose}
            dragY={dragY}
            dragging={dragging}
          >
            <Animated.View
              accessibilityViewIsModal
              onLayout={fitContent && !expanded ? onSheetLayout : undefined}
              style={[
                {
                  backgroundColor: colors.surface,
                  borderTopLeftRadius: theme.radius.xl,
                  borderTopRightRadius: theme.radius.xl,
                  borderTopWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: theme.spacing.lg,
                  paddingBottom: bottomPad,
                  marginBottom: keyboardHeight,
                  overflow: 'hidden',
                  ...theme.elevation.raised,
                },
                staticPanelStyle,
                expandable ? expandablePanelStyle : null,
                style,
              ]}
            >
              <GestureDetector gesture={dismissPan}>
                <Animated.View
                  collapsable={false}
                  accessibilityHint={
                    expandable
                      ? expanded
                        ? 'Swipe down to shrink'
                        : 'Swipe up to expand, or down to dismiss'
                      : undefined
                  }
                  style={{
                    marginHorizontal: -theme.spacing.lg,
                    paddingHorizontal: theme.spacing.lg,
                    paddingTop: theme.spacing.md,
                    minHeight: theme.sizes.touch.min,
                    alignItems: 'stretch',
                  }}
                >
                  <View
                    style={{
                      alignSelf: 'center',
                      width: 36,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: colors.borderStrong,
                      marginBottom: theme.spacing.md,
                    }}
                  />
                  {title ? (
                    <AppText
                      variant="heading"
                      style={{ marginBottom: theme.spacing.md, alignSelf: 'stretch' }}
                    >
                      {title}
                    </AppText>
                  ) : null}
                </Animated.View>
              </GestureDetector>
              <View style={expandable || !fitContent ? styles.fillBody : styles.fitBody}>
                {children}
              </View>
            </Animated.View>
          </BottomSheetTransition>
        </View>
        <KeyboardDismissAccessory inModal />
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  fillBody: {
    flex: 1,
    minHeight: 0,
  },
  fitBody: {
    flexGrow: 0,
    flexShrink: 1,
  },
});
