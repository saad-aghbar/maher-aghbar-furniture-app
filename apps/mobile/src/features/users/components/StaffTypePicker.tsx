import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { StaffTypeRow } from '@/api/modules/users';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { localizedRoleName } from '../display';
import { staffTypeIcon } from '../staffIcon';
import { PermissionBoard } from './PermissionBoard';

type Props = {
  types: StaffTypeRow[];
  value: string;
  onChange: (id: string) => void;
  loading?: boolean;
};

function permissionCodes(type: StaffTypeRow): string[] {
  if (type.permissions?.length) {
    return type.permissions.map((p) => p.permission.code);
  }
  return [];
}

/**
 * Staff type cards for Add/Edit User — select one type; read-only permission preview.
 */
export function StaffTypePicker({ types, value, onChange, loading }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  if (loading) {
    return (
      <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
        {t('common.loading')}
      </AppText>
    );
  }

  if (!types.length) {
    return (
      <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
        {t('users.noStaffTypesYet')}
      </AppText>
    );
  }

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {types.map((type) => {
        const selected = value === type.id;
        const codes = permissionCodes(type);
        const description =
          locale === 'ar'
            ? type.descriptionAr
            : locale === 'he'
              ? type.descriptionHe
              : type.descriptionEn;

        return (
          <View key={type.id} style={{ gap: theme.spacing.sm }}>
            <AnimatedPressable
              variant="card"
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => {
                void haptics.selection();
                onChange(type.id);
              }}
              style={{
                padding: theme.spacing.md,
                borderRadius: theme.radius.xl,
                borderWidth: 1.5,
                borderColor: selected ? colors.brand : colors.borderStrong,
                backgroundColor: selected ? colors.brandSoft : colors.surface,
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: theme.spacing.md,
                ...orderBoardShadow(colorScheme),
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.surfaceSecondary,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Ionicons name={staffTypeIcon(type.iconKey)} size={20} color={colors.brand} />
              </View>
              <View style={{ flex: 1, gap: 2, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
                <AppText variant="label" weight={titleWeight} numberOfLines={1}>
                  {localizedRoleName(type, locale)}
                </AppText>
                {description ? (
                  <AppText variant="caption" color="muted" numberOfLines={2}>
                    {description}
                  </AppText>
                ) : null}
                <AppText variant="caption" color="muted">
                  {t('users.permissionCount', { n: codes.length || type._count?.permissions || 0 })}
                </AppText>
              </View>
              <Ionicons
                name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                size={22}
                color={selected ? colors.brand : colors.textMuted}
              />
            </AnimatedPressable>

            {selected ? (
              <View
                style={{
                  padding: theme.spacing.md,
                  borderRadius: theme.radius.xl,
                  borderWidth: 1,
                  borderColor: colors.borderStrong,
                  backgroundColor: colors.surface,
                  gap: theme.spacing.sm,
                  ...orderBoardShadow(colorScheme),
                }}
              >
                <AppText
                  variant="caption"
                  weight={titleWeight}
                  color="brand"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {t('users.staffAccessPreview')}
                </AppText>
                <PermissionBoard selected={codes} selectedOnly />
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
