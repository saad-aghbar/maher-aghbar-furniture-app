import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { useLocationMapVisibility } from '@/components/maps/LocationMapVisibility';
import { useCodeScannerState } from '@/components/scan/CodeScannerProvider';
import { SheetPanel } from '@/components/sheets/BottomSheetPanel';
import { useSheetOverlayYield } from '@/components/sheets/SheetOverlayYield';
import { useAccessoryCameraState } from '@/features/inventory/components/AccessoryCameraProvider';
import { localeRow, pinStart, useLocale } from '@/i18n';
import { AnimatedPressable, durations, easingBezier, haptics, useReducedMotion, withMotionDuration } from '@/motion';
import { useTheme } from '@/theme';
import { useMaherDensity } from './density';
import { subscribeEscape } from './escapeKey';
import { resolveOverlayMode, type OverlayIntent, type OverlayMode } from './resolveOverlayMode';
import { useMaherLayout } from './useMaherLayout';
import { useWindowMetrics } from './windowMetrics';

export type AdaptiveOverlayProps = {
  open: boolean;
  onClose: () => void;
  /** Fires after the close motion finishes and the host Modal is gone (same contract as BottomSheet). */
  onClosed?: () => void;
  title?: string;
  children: ReactNode;
  /** Drives presentation per window class. */
  intent: OverlayIntent;
  /** BottomSheet pass-through (used in `sheet` mode). */
  sheetHeight?: number;
  fitContent?: boolean;
  maxHeight?: number;
  expandable?: boolean;
  expandedHeight?: number;
  onExpandedChange?: (expanded: boolean) => void;
  /** Stacked on another overlay — host yields while this one is open. */
  overlay?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Large-screen sizing overrides. */
  dialogMaxWidth?: number;
  panelWidth?: number;
  /**
   * Body scrolling in dialog/panel mode. `auto` wraps content-sized bodies
   * (`fitContent`) in a ScrollView and leaves fill bodies to scroll themselves.
   */
  bodyScroll?: 'auto' | 'always' | 'never';
  /** Force a mode — dev gallery and tests only. */
  modeOverride?: OverlayMode;
  testID?: string;
};

/**
 * Intent-driven overlay. COMPACT always renders the canonical BottomSheet;
 * larger windows render a Maher dialog or side panel with the same children.
 *
 * Keep form state in the host component (the one rendering AdaptiveOverlay),
 * not inside `children`: switching sheet → dialog on resize swaps the
 * presenter and remounts children, exactly like BottomSheet remounts on close.
 */
export function AdaptiveOverlay(props: AdaptiveOverlayProps) {
  const { windowClass } = useMaherLayout();
  const mode = props.modeOverride ?? resolveOverlayMode(props.intent, windowClass);

  if (mode === 'sheet') {
    return (
      <SheetPanel
        open={props.open}
        onClose={props.onClose}
        onClosed={props.onClosed}
        title={props.title}
        sheetHeight={props.sheetHeight}
        fitContent={props.fitContent}
        maxHeight={props.maxHeight}
        expandable={props.expandable}
        expandedHeight={props.expandedHeight}
        onExpandedChange={props.onExpandedChange}
        overlay={props.overlay}
        style={props.style}
      >
        {props.children}
      </SheetPanel>
    );
  }

  return <AdaptiveOverlayFrame {...props} mode={mode} />;
}

type FrameProps = AdaptiveOverlayProps & { mode: 'dialog' | 'panel' };

function AdaptiveOverlayFrame({
  open,
  onClose,
  onClosed,
  title,
  children,
  fitContent = false,
  overlay = false,
  style,
  dialogMaxWidth,
  panelWidth,
  bodyScroll = 'auto',
  mode,
  testID,
}: FrameProps) {
  const { colors, theme, colorScheme } = useTheme();
  const { t, isRTL, locale } = useLocale();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const metrics = useWindowMetrics();
  const density = useMaherDensity();
  const { isScanning } = useCodeScannerState();
  const { isOpen: isAccessoryCamera } = useAccessoryCameraState();
  const { isOpen: isLocationMap } = useLocationMapVisibility();
  const { isOpen: isOverlayYield, acquire, release } = useSheetOverlayYield();

  const [mounted, setMounted] = useState(false);
  const [overlayModalVisible, setOverlayModalVisible] = useState(false);
  const progress = useSharedValue(0);
  const wasOpenRef = useRef(false);
  const yieldHeldRef = useRef(false);
  const onClosedRef = useRef(onClosed);
  onClosedRef.current = onClosed;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const closeMs = withMotionDuration(durations.sheet, reduce);

  const acquireYield = useCallback(() => {
    if (yieldHeldRef.current) return;
    yieldHeldRef.current = true;
    acquire();
  }, [acquire]);
  const releaseYield = useCallback(() => {
    if (!yieldHeldRef.current) return;
    yieldHeldRef.current = false;
    release();
  }, [release]);

  const hostBlocked =
    isScanning || isAccessoryCamera || isLocationMap || (!overlay && isOverlayYield);
  const modalVisible = overlay
    ? overlayModalVisible && !isAccessoryCamera && !isLocationMap && !isScanning
    : !hostBlocked;

  useEffect(() => {
    if (open) {
      const justOpened = !wasOpenRef.current;
      wasOpenRef.current = true;
      setMounted(true);
      if (!justOpened) return;
      progress.value = 0;
      const animateIn = () => {
        progress.value = reduce
          ? 1
          : withTiming(1, {
              duration: durations.sheet,
              easing: Easing.bezier(...easingBezier.emphasized),
            });
      };
      if (overlay) {
        acquireYield();
        setOverlayModalVisible(false);
        const timer = setTimeout(() => {
          setOverlayModalVisible(true);
          requestAnimationFrame(animateIn);
        }, 80);
        return () => clearTimeout(timer);
      }
      const id = requestAnimationFrame(animateIn);
      return () => cancelAnimationFrame(id);
    }

    if (!wasOpenRef.current) return;
    progress.value = reduce
      ? 0
      : withTiming(0, {
          duration: durations.sheet,
          easing: Easing.bezier(...easingBezier.standard),
        });
    const timer = setTimeout(() => {
      setMounted(false);
      if (overlay) {
        setOverlayModalVisible(false);
        releaseYield();
      }
      wasOpenRef.current = false;
      requestAnimationFrame(() => {
        setTimeout(() => onClosedRef.current?.(), 80);
      });
    }, closeMs + 40);
    return () => clearTimeout(timer);
  }, [open, overlay, reduce, closeMs, acquireYield, releaseYield, progress]);

  useEffect(() => () => releaseYield(), [releaseYield]);

  // Hardware Escape closes the top-most open overlay where the platform delivers it.
  useEffect(() => {
    if (!open || !mounted) return;
    return subscribeEscape(() => onCloseRef.current());
  }, [open, mounted]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value * 0.55,
  }));

  const resolvedPanelWidth = Math.min(
    panelWidth ?? density.panelWidth,
    Math.max(320, Math.round(metrics.width * 0.5)),
  );

  const containerAnim = useAnimatedStyle(() => {
    if (mode === 'panel') {
      const off = (1 - progress.value) * resolvedPanelWidth * (isRTL ? -1 : 1);
      return { transform: [{ translateX: off }], opacity: progress.value > 0.02 ? 1 : 0 };
    }
    return {
      opacity: progress.value,
      transform: [{ scale: 0.96 + progress.value * 0.04 }],
    };
  });

  if (!mounted) return null;

  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const dialogWidth = Math.min(
    dialogMaxWidth ?? density.dialogMaxWidth,
    Math.max(280, metrics.width - theme.spacing['2xl'] * 2),
  );
  const verticalInset = Math.max(insets.top, theme.spacing.xl) + Math.max(insets.bottom, theme.spacing.xl);
  const dialogMaxHeight = Math.max(240, metrics.height - verticalInset);
  const scrollBody = bodyScroll === 'always' || (bodyScroll === 'auto' && fitContent);

  const frameStyle: ViewStyle =
    mode === 'panel'
      ? {
          position: 'absolute',
          top: 0,
          bottom: 0,
          ...(isRTL ? { left: 0 } : { right: 0 }),
          width: resolvedPanelWidth,
          paddingTop: insets.top,
          paddingBottom: Math.max(insets.bottom, theme.spacing.md),
          backgroundColor: colors.surface,
          borderColor: colors.borderStrong,
          ...(isRTL ? { borderRightWidth: 1 } : { borderLeftWidth: 1 }),
          ...theme.elevation.raised,
        }
      : {
          width: dialogWidth,
          maxHeight: dialogMaxHeight,
          borderRadius: theme.radius.lg,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          backgroundColor: colors.surface,
          overflow: 'hidden',
          ...theme.elevation.raised,
        };

  const body = (
    <View
      testID="adaptive-overlay-body"
      style={{
        flexGrow: scrollBody ? 0 : 1,
        flexShrink: 1,
        minHeight: 0,
        paddingHorizontal: theme.spacing.lg,
        paddingTop: theme.spacing.md,
        paddingBottom: theme.spacing.md,
      }}
    >
      {children}
    </View>
  );

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      onRequestClose={() => {
        if (hostBlocked) return;
        onClose();
      }}
      statusBarTranslucent
      presentationStyle="overFullScreen"
    >
      <View style={styles.root}>
        <View
          style={StyleSheet.absoluteFillObject}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
        >
          <AnimatedBackdrop
            style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.overlay }, backdropStyle]}
            label={t('common.dismiss')}
            onPress={onClose}
          />
        </View>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          pointerEvents="box-none"
          style={mode === 'panel' ? styles.panelHost : styles.dialogHost}
        >
          <Animated.View
            testID={testID ?? `adaptive-overlay-${mode}`}
            accessibilityViewIsModal
            role="dialog"
            accessibilityLabel={title}
            style={[frameStyle, containerAnim, style]}
          >
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                width: 3,
                backgroundColor: colors.brand,
                opacity: 0.55,
                ...pinStart(isRTL),
              }}
            />
            <View
              style={{
                flexDirection: localeRow(isRTL),
                alignItems: 'center',
                gap: theme.spacing.sm,
                minHeight: theme.sizes.touch.min + theme.spacing.sm,
                paddingHorizontal: theme.spacing.lg,
                paddingVertical: theme.spacing.sm,
                backgroundColor: colors.surfaceSecondary,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                {title ? (
                  <AppText variant="heading" weight={titleWeight} numberOfLines={2}>
                    {title}
                  </AppText>
                ) : null}
              </View>
              <AnimatedPressable
                variant="button"
                accessibilityRole="button"
                accessibilityLabel={t('common.dismiss')}
                testID="adaptive-overlay-close"
                onPress={() => {
                  void haptics.selection();
                  onClose();
                }}
                style={{
                  width: theme.sizes.touch.min,
                  height: theme.sizes.touch.min,
                  borderRadius: theme.sizes.touch.min / 2,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colorScheme === 'dark' ? colors.brand : colors.brandSoft,
                  borderWidth: 1,
                  borderColor: colors.brand,
                }}
              >
                <Ionicons
                  name="close"
                  size={18}
                  color={colorScheme === 'dark' ? colors.onBrand : colors.brand}
                />
              </AnimatedPressable>
            </View>
            {scrollBody ? (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                style={{ flexGrow: 0, flexShrink: 1 }}
                contentContainerStyle={{ flexGrow: 0 }}
              >
                {body}
              </ScrollView>
            ) : (
              body
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const PressableAnimated = Animated.createAnimatedComponent(
  Pressable as never,
) as unknown as ComponentType<PressableProps & { style?: StyleProp<ViewStyle> }>;

function AnimatedBackdrop({
  style,
  label,
  onPress,
}: {
  style: StyleProp<ViewStyle>;
  label: string;
  onPress: () => void;
}) {
  return (
    <PressableAnimated
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={style}
    />
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  dialogHost: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelHost: {
    flex: 1,
  },
});
