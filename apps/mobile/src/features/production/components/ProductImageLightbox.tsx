import { Image, Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { haptics, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  uri: string | null;
  open: boolean;
  onClose: () => void;
  title?: string;
};

/** Full-bleed product photo viewer — tap image or close to dismiss. */
export function ProductImageLightbox({ uri, open, onClose, title }: Props) {
  const { t } = useLocale();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduce = useReducedMotion();

  if (!uri) return null;

  return (
    <Modal
      visible={open}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View
        entering={reduce ? undefined : FadeIn.duration(220)}
        exiting={reduce ? undefined : FadeOut.duration(160)}
        style={[
          StyleSheet.absoluteFillObject,
          {
            backgroundColor: 'rgba(30,26,27,0.94)',
            justifyContent: 'center',
            alignItems: 'center',
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={() => {
            void haptics.selection();
            onClose();
          }}
          style={[
            StyleSheet.absoluteFillObject,
            { zIndex: 0 },
          ]}
        />

        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            top: insets.top + 8,
            left: 16,
            right: 16,
            zIndex: 2,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <AppText
            variant="caption"
            weight="medium"
            numberOfLines={1}
            style={{ flex: 1, color: colors.onBrand }}
          >
            {title ?? ''}
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            hitSlop={12}
            onPress={() => {
              void haptics.selection();
              onClose();
            }}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255,255,255,0.12)',
            }}
          >
            <Ionicons name="close" size={22} color={colors.onBrand} />
          </Pressable>
        </View>

        <Animated.View
          entering={reduce ? undefined : ZoomIn.duration(280).springify().damping(18)}
          style={{ zIndex: 1 }}
        >
          <Pressable
            onPress={() => {
              void haptics.selection();
              onClose();
            }}
          >
            <Image
              source={{ uri }}
              style={{
                width: width - 32,
                height: Math.min(height * 0.72, width - 32),
                borderRadius: 16,
              }}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
