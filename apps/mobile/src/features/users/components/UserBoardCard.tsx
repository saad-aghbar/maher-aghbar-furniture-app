import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import type { UserRow } from '@/api/modules/users';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import {
  localizedDepartmentName,
  userDisplayName,
  userRoleLabels,
  userShowsDepartment,
} from '../display';

type Props = {
  user: UserRow;
  showDepartment: boolean;
  onEdit: () => void;
  onToggleActive: () => void;
  onSetPassword: () => void;
  onDelete?: () => void;
};

/**
 * User account floor card — identity, roles/dept/login, action footer.
 */
export function UserBoardCard({
  user,
  showDepartment,
  onEdit,
  onToggleActive,
  onSetPassword,
  onDelete,
}: Props) {
  const { t, locale, isRTL, formatDateTime } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const name = userDisplayName(user);
  const username = user.username?.trim() || '—';
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  const status = user.isActive ? 'ACTIVE' : 'INACTIVE';
  const lastLogin = user.lastLoginAt
    ? formatDateTime(user.lastLoginAt)
    : t('users.never');
  const hideDept = !showDepartment || !userShowsDepartment(user);

  return (
    <View
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: user.isActive ? colors.borderStrong : colors.border,
        backgroundColor: colors.surface,
        overflow: 'hidden',
        ...orderBoardShadow(colorScheme),
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          ...(isRTL ? { right: 0 } : { left: 0 }),
          width: 3,
          backgroundColor: user.isActive ? colors.brand : colors.textMuted,
          opacity: user.isActive ? 0.55 : 0.35,
        }}
      />

      <View
        style={{
          padding: theme.spacing.lg,
          gap: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.lg + 4 }
            : { paddingLeft: theme.spacing.lg + 4 }),
        }}
      >
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'flex-start',
            gap: theme.spacing.md,
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.brandSoft,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <AppText weight="semibold" style={{ color: colors.brand, fontSize: 18 }}>
              {initial}
            </AppText>
          </View>

          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <AppText
              variant="label"
              weight={titleWeight}
              numberOfLines={2}
              style={{ textAlign: isRTL ? 'right' : 'left', fontSize: 17 }}
            >
              {name}
            </AppText>
            <AppText
              variant="caption"
              color="secondary"
              dir="ltr"
              numberOfLines={1}
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {username}
            </AppText>
          </View>

          <StatusBadge status={status} dot />
        </View>

        <View
          style={{
            borderRadius: theme.radius.lg,
            backgroundColor: colors.surfaceSecondary,
            borderWidth: 1,
            borderColor: colors.border,
            padding: theme.spacing.md,
            gap: theme.spacing.sm,
          }}
        >
          <MetaRow label={t('users.roles')} value={userRoleLabels(user, locale)} />
          {!hideDept ? (
            <MetaRow
              label={t('users.department')}
              value={localizedDepartmentName(user.department, locale)}
            />
          ) : null}
          <MetaRow label={t('users.lastLogin')} value={lastLogin} ltr />
        </View>
      </View>

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'flex-start',
          flexWrap: 'nowrap',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.md,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.surfaceSecondary,
        }}
      >
        <FooterChip
          label={t('common.edit')}
          icon="create-outline"
          onPress={onEdit}
          emphasis
        />
        <FooterChip
          label={user.isActive ? t('users.deactivate') : t('users.activate')}
          icon={user.isActive ? 'pause-circle-outline' : 'play-circle-outline'}
          onPress={onToggleActive}
          danger={user.isActive}
        />
        <FooterChip
          label={t('users.newPassword')}
          icon="key-outline"
          onPress={onSetPassword}
        />
        {onDelete ? (
          <AnimatedPressable
            variant="button"
            accessibilityRole="button"
            accessibilityLabel={t('common.delete')}
            onPress={() => {
              void haptics.selection();
              onDelete();
            }}
            style={{
              marginStart: isRTL ? 0 : 'auto',
              width: 36,
              height: 36,
              borderRadius: theme.radius.lg,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.errorSoft,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Ionicons name="trash-outline" size={16} color={colors.error} />
          </AnimatedPressable>
        ) : null}
      </View>
    </View>
  );
}

function MetaRow({
  label,
  value,
  ltr,
}: {
  label: string;
  value: string;
  ltr?: boolean;
}) {
  const { isRTL, locale } = useLocale();
  const { colors } = useTheme();

  return (
    <View style={{ gap: 2 }}>
      <AppText
        variant="caption"
        color="muted"
        style={{
          textAlign: isRTL ? 'right' : 'left',
          fontSize: 10,
          letterSpacing: locale === 'ar' ? 0 : 0.4,
          textTransform: locale === 'ar' ? 'none' : 'uppercase',
        }}
      >
        {label}
      </AppText>
      <AppText
        variant="bodySecondary"
        weight="medium"
        dir={ltr ? 'ltr' : 'auto'}
        style={{ textAlign: isRTL ? 'right' : 'left', color: colors.textPrimary }}
      >
        {value}
      </AppText>
    </View>
  );
}

function FooterChip({
  label,
  icon,
  onPress,
  emphasis,
  danger,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  emphasis?: boolean;
  danger?: boolean;
}) {
  const { colors, theme } = useTheme();
  const { isRTL } = useLocale();

  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        minHeight: theme.sizes.touch.min - 8,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        borderRadius: theme.radius.full,
        borderWidth: 1,
        borderColor: danger ? colors.error : emphasis ? colors.brand : colors.borderStrong,
        backgroundColor: emphasis ? colors.surface : 'transparent',
      }}
    >
      <Ionicons
        name={icon}
        size={14}
        color={danger ? colors.error : emphasis ? colors.brand : colors.textSecondary}
      />
      <AppText
        variant="caption"
        weight={emphasis ? 'semibold' : 'medium'}
        numberOfLines={1}
        style={{
          color: danger ? colors.error : emphasis ? colors.brand : colors.textSecondary,
        }}
      >
        {label}
      </AppText>
    </AnimatedPressable>
  );
}
