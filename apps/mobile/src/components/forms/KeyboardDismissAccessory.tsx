import { useEffect, useState, type ReactNode } from 'react';
import {
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type KeyboardEvent,
} from 'react-native';
import { FullWindowOverlay } from 'react-native-screens';
import { BlurView } from 'expo-blur';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { Locale } from '@maher/types';

const PILL_HEIGHT = 36;
const KEYBOARD_GAP = 8;
const EDGE_INSET = 12;

type Props = {
  /**
   * RN Modal is its own window. FullWindowOverlay attaches to the key window
   * and would sit *behind* the modal — use a plain overlay instead.
   */
  inModal?: boolean;
};

const FALLBACK_DONE: Record<Locale, string> = {
  en: 'Done',
  ar: 'تم',
  he: 'סיום',
};

function doneLabel(
  t: (key: string) => string,
  locale: Locale,
): string {
  const value = t('mobile.keyboardDone');
  return value === 'mobile.keyboardDone' ? FALLBACK_DONE[locale] : value;
}

function DonePill() {
  const { t, locale } = useLocale();
  const { theme } = useTheme();
  const label = doneLabel(t, locale);

  return (
    <View
      style={[
        styles.shadow,
        {
          alignSelf: 'flex-end',
          marginHorizontal: EDGE_INSET,
          marginBottom: KEYBOARD_GAP,
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        hitSlop={8}
        onPress={() => {
          void haptics.selection();
          Keyboard.dismiss();
        }}
        style={({ pressed }) => [styles.pill, { opacity: pressed ? 0.72 : 1 }]}
      >
        {Platform.OS === 'ios' ? (
          <BlurView
            intensity={48}
            tint="systemChromeMaterialDark"
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.androidFill]} />
        )}
        <View style={styles.pillFill} />
        <AppText
          variant="body"
          weight="semibold"
          style={{
            color: '#F5F1EA',
            fontSize: 17,
            lineHeight: 22,
            letterSpacing: locale === 'en' ? -0.4 : 0,
            paddingHorizontal: theme.spacing.md,
          }}
        >
          {label}
        </AppText>
      </Pressable>
    </View>
  );
}

function OverlayHost({
  inModal,
  children,
}: {
  inModal: boolean;
  children: ReactNode;
}) {
  if (!inModal && Platform.OS === 'ios') {
    return (
      <FullWindowOverlay unstable_accessibilityContainerViewIsModal={false}>
        <View style={styles.overlayRoot} pointerEvents="box-none">
          {children}
        </View>
      </FullWindowOverlay>
    );
  }
  return children;
}

/**
 * Compact Done control just above the software keyboard.
 * Native stack screens draw above RN siblings, so iOS uses FullWindowOverlay.
 * Do not attach a native inputAccessoryViewID — that reserves a blank beige bar.
 */
export function KeyboardDismissAccessory({ inModal = false }: Props) {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
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
  }, []);

  if (keyboardHeight <= 0) return null;

  return (
    <OverlayHost inModal={inModal}>
      <View pointerEvents="box-none" style={styles.host}>
        <View style={[styles.anchor, { bottom: keyboardHeight }]}>
          <DonePill />
        </View>
      </View>
    </OverlayHost>
  );
}

const styles = StyleSheet.create({
  overlayRoot: {
    ...StyleSheet.absoluteFillObject,
    flex: 1,
  },
  host: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    zIndex: 9999,
    elevation: 24,
  },
  anchor: {
    position: 'absolute',
    left: 0,
    right: 0,
    direction: 'ltr',
  },
  shadow: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 8,
  },
  pill: {
    minHeight: PILL_HEIGHT,
    minWidth: 44,
    borderRadius: PILL_HEIGHT / 2,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  pillFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(28, 28, 30, 0.42)',
  },
  androidFill: {
    backgroundColor: 'rgba(28, 28, 30, 0.92)',
  },
});
