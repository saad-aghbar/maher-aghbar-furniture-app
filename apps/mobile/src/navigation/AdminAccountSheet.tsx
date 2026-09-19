import { useRef } from 'react';
import { View } from 'react-native';
import type { Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { DestructiveButton } from '@/components/buttons/DestructiveButton';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { MoreBoard } from '@/features/more/components/MoreBoard';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { AdminAccountSheetItem } from './adminSideNavItems';

type Props = {
  open: boolean;
  onClose: () => void;
  items: readonly AdminAccountSheetItem[];
  onNavigate: (href: Href) => void;
  onLogout: () => void;
};

/**
 * Pinned sidebar/rail account menu — same parchment CTAs as More preferences.
 */
export function AdminAccountSheet({ open, onClose, items, onNavigate, onLogout }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const pendingRef = useRef<(() => void) | null>(null);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      onClosed={() => {
        const run = pendingRef.current;
        pendingRef.current = null;
        run?.();
      }}
      title={t('mobile.more.accountEyebrow')}
      intent="action"
      fitContent
    >
      <View testID="admin-account-sheet" style={{ gap: theme.spacing.md }}>
        <MoreBoard
          style={{
            padding: theme.spacing.lg,
            paddingLeft: isRTL ? theme.spacing.lg : theme.spacing.lg + 4,
            paddingRight: isRTL ? theme.spacing.lg + 4 : theme.spacing.lg,
            gap: theme.spacing.sm,
          }}
        >
          {items.map((item, index) => (
            <HubCta
              key={item.key}
              testID={`admin-account-sheet-${item.key}`}
              icon={item.icon}
              label={t(item.labelKey)}
              isRTL={isRTL}
              titleWeight={titleWeight}
              primary={index === 0}
              onPress={() => {
                void haptics.selection();
                pendingRef.current = () => onNavigate(item.href);
                onClose();
              }}
            />
          ))}
        </MoreBoard>
        <DestructiveButton
          testID="admin-account-sheet-logout"
          label={t('auth.logout')}
          haptic="selection"
          onPress={() => {
            pendingRef.current = onLogout;
            onClose();
          }}
          style={{ borderRadius: theme.radius.xl }}
        />
      </View>
    </BottomSheet>
  );
}

function HubCta({
  icon,
  label,
  isRTL,
  titleWeight,
  primary,
  onPress,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  isRTL: boolean;
  titleWeight: 'medium' | 'semibold';
  primary: boolean;
  onPress: () => void;
  testID: string;
}) {
  const { colors, theme } = useTheme();
  const fg = primary ? colors.onBrand : colors.brand;
  const bg = primary ? colors.brand : colors.brandSoft;

  return (
    <AnimatedPressable
      variant="button"
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        minHeight: 48,
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.brand,
        backgroundColor: bg,
        paddingHorizontal: theme.spacing.lg,
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        ...(primary ? theme.elevation.card : null),
      }}
    >
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
        }}
      >
        <Ionicons name={icon} size={18} color={fg} />
        <AppText variant="label" weight={titleWeight} style={{ color: fg }}>
          {label}
        </AppText>
      </View>
      <Ionicons name={isRTL ? 'arrow-back' : 'arrow-forward'} size={18} color={fg} />
    </AnimatedPressable>
  );
}
