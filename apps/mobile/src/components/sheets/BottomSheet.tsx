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
import { runOnJS, useSharedValue, withSpring } from 'react-native-reanimated';
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
  style?: StyleProp<ViewStyle>;
  /**
   * Stacked on top of another sheet. Host Modals yield while this overlay is open.
   */
  overlay?: boolean;
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
  style,
  overlay = false,
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
  /** Overlay Modal gate — false until host has yielded; stays true through exit motion. */
  const [overlayModalVisible, setOverlayModalVisible] = useState(false);

  const wasOpenRef = useRef(false);
  const onClosedRef = useRef(onClosed);
  onClosedRef.current = onClosed;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const reduceMotion = useReducedMotion();
  const dragY = useSharedValue(0);
  const dragging = useSharedValue(0);
  const heightSV = useSharedValue(360);
  const reduceSV = useSharedValue(0);

  const hostBlocked =
    isScanning || isAccessoryCamera || isLocationMap || (!overlay && isOverlayYield);

  const sheetModalVisible = overlay
    ? overlayModalVisible && !isScanning && !isAccessoryCamera && !isLocationMap
    : !hostBlocked;

  const heightCap = useMemo(() => {
    const windowH = Dimensions.get('window').height;
    const cap = maxHeight ?? Math.round(windowH * 0.7);
    if (keyboardHeight <= 0) return cap;
    return Math.min(cap, Math.max(240, windowH - keyboardHeight));
  }, [maxHeight, keyboardHeight]);

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
      wasOpenRef.current = true;
      setMounted(true);
      setProgress(1);

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

    // Closing — keep overlay Modal visible so the slide-down can play.
    setProgress(1);
    const t = setTimeout(() => {
      setMounted(false);
      if (overlay) {
        setOverlayModalVisible(false);
        setOverlayYield(false);
      }
      if (wasOpenRef.current) {
        wasOpenRef.current = false;
        // Defer past React commit + native Modal teardown so ImagePicker /
        // CameraView can present (iOS flash-dismiss / no-op otherwise).
        requestAnimationFrame(() => {
          setTimeout(() => {
            onClosedRef.current?.();
          }, 80);
        });
      }
    }, closeMs);
    return () => clearTimeout(t);
  }, [open, overlay, closeMs, setOverlayYield]);

  /** Soft slide-in when a host sheet returns after an overlay dismisses. */
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
  const windowH = Dimensions.get('window').height;
  const visibleSheetHeight = fitContent
    ? animHeight
    : keyboardOpen
      ? Math.min(sheetHeight, Math.max(240, windowH - keyboardHeight))
      : sheetHeight;
  const resolvedAnimHeight = visibleSheetHeight;
  const bottomPad = keyboardOpen
    ? theme.spacing.md
    : Math.max(insets.bottom, theme.spacing.md) + theme.spacing.sm;

  const onSheetLayout = (e: LayoutChangeEvent) => {
    if (!fitContent) return;
    const next = Math.min(Math.ceil(e.nativeEvent.layout.height), heightCap);
    setAnimHeight((prev) => (Math.abs(prev - next) > 2 ? next : prev));
  };

  useEffect(() => {
    heightSV.value = resolvedAnimHeight;
  }, [heightSV, resolvedAnimHeight]);

  useEffect(() => {
    reduceSV.value = reduceMotion ? 1 : 0;
  }, [reduceMotion, reduceSV]);

  useEffect(() => {
    if (!open) return;
    dragY.value = 0;
    dragging.value = 0;
  }, [dragY, dragging, open]);

  const closeFromHandle = useCallback(() => {
    closeRef.current();
  }, []);

  const dismissPan = useMemo(
    () =>
      Gesture.Pan()
        .maxPointers(1)
        .activeOffsetY(10)
        .failOffsetX([-24, 24])
        .onStart(() => {
          dragging.value = 1;
        })
        .onUpdate((e) => {
          if (reduceSV.value) return;
          dragY.value = Math.max(0, e.translationY);
        })
        .onEnd((e) => {
          const y = Math.max(0, e.translationY);
          const v = e.velocityY;
          const h = heightSV.value;
          dragging.value = 0;
          if (shouldDismissSheet(y, v, h)) {
            runOnJS(closeFromHandle)();
            return;
          }
          if (reduceSV.value) {
            dragY.value = 0;
            return;
          }
          dragY.value = withSpring(0, springs.snappy);
        })
        .onFinalize((_e, success) => {
          dragging.value = 0;
          if (success) return;
          if (reduceSV.value) {
            dragY.value = 0;
            return;
          }
          dragY.value = withSpring(0, springs.snappy);
        }),
    [closeFromHandle, dragY, dragging, heightSV, reduceSV],
  );

  if (!mounted) return null;

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
            sheetHeight={resolvedAnimHeight}
            onBackdropPress={onClose}
            dragY={dragY}
            dragging={dragging}
          >
            <View
              accessibilityViewIsModal
              onLayout={fitContent ? onSheetLayout : undefined}
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
                  ...(fitContent
                    ? { maxHeight: heightCap, alignSelf: 'stretch' as const }
                    : { height: visibleSheetHeight, maxHeight: '100%' as const }),
                },
                style,
              ]}
            >
              <GestureDetector gesture={dismissPan}>
                <View
                  collapsable={false}
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
                </View>
              </GestureDetector>
              <View style={fitContent ? styles.fitBody : styles.fillBody}>{children}</View>
            </View>
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
