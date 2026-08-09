import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { useCodeScannerState } from '@/components/scan/CodeScannerProvider';
import { useLocationMapVisibility } from '@/components/maps/LocationMapVisibility';
import { useSheetOverlayYield } from '@/components/sheets/SheetOverlayYield';
import { useAccessoryCameraState } from '@/features/inventory/components/AccessoryCameraProvider';
import { BottomSheetTransition } from '@/motion';
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
  /** Overlay Modal gate — false until host has yielded; stays true through exit motion. */
  const [overlayModalVisible, setOverlayModalVisible] = useState(false);

  const wasOpenRef = useRef(false);
  const onClosedRef = useRef(onClosed);
  onClosedRef.current = onClosed;

  const hostBlocked =
    isScanning || isAccessoryCamera || isLocationMap || (!overlay && isOverlayYield);

  const sheetModalVisible = overlay
    ? overlayModalVisible && !isScanning && !isAccessoryCamera && !isLocationMap
    : !hostBlocked;

  const heightCap = useMemo(() => {
    const windowH = Dimensions.get('window').height;
    return maxHeight ?? Math.round(windowH * 0.7);
  }, [maxHeight]);

  const [animHeight, setAnimHeight] = useState(() => Math.min(320, heightCap));

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

  const resolvedAnimHeight = fitContent ? animHeight : sheetHeight;
  const bottomPad = Math.max(insets.bottom, theme.spacing.md) + theme.spacing.sm;

  const onSheetLayout = (e: LayoutChangeEvent) => {
    if (!fitContent) return;
    const next = Math.min(Math.ceil(e.nativeEvent.layout.height), heightCap);
    setAnimHeight((prev) => (Math.abs(prev - next) > 2 ? next : prev));
  };

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
        <KeyboardAvoidingView
          style={styles.root}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          <BottomSheetTransition
            progress={progress}
            sheetHeight={resolvedAnimHeight}
            onBackdropPress={onClose}
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
                  paddingTop: theme.spacing.md,
                  paddingHorizontal: theme.spacing.lg,
                  paddingBottom: bottomPad,
                  overflow: 'hidden',
                  ...theme.elevation.raised,
                  ...(fitContent
                    ? { maxHeight: heightCap, alignSelf: 'stretch' as const }
                    : { height: sheetHeight, maxHeight: '100%' as const }),
                },
                style,
              ]}
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
              <View style={fitContent ? styles.fitBody : styles.fillBody}>{children}</View>
            </View>
          </BottomSheetTransition>
        </KeyboardAvoidingView>
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
