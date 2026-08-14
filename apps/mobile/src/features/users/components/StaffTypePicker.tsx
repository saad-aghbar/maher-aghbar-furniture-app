import { useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import type { StaffTypeRow } from '@/api/modules/users';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import { localizedRoleName } from '../display';
import { groupedCodes } from '../permissionLabels';
import { staffTypeIcon } from '../staffIcon';

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
 * Staff type cards for Add/Edit User — select one type; optional read-only permission preview.
 */
export function StaffTypePicker({ types, value, onChange, loading }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const reduce = useReducedMotion();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
        const expanded = expandedId === type.id;
        const description =
          locale === 'ar'
            ? type.descriptionAr
            : locale === 'he'
              ? type.descriptionHe
              : type.descriptionEn;
        const groups = groupedCodes(codes, locale);

        return (
          <View key={type.id} style={{ gap: theme.spacing.xs }}>
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

            {codes.length > 0 ? (
              <AnimatedPressable
                variant="button"
                onPress={() => {
                  void haptics.selection();
                  setExpandedId(expanded ? null : type.id);
                }}
                style={{ paddingHorizontal: theme.spacing.sm, paddingVertical: 4 }}
              >
                <AppText
                  variant="caption"
                  color="brand"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {expanded ? t('users.hidePermissions') : t('users.viewPermissions')}
                </AppText>
              </AnimatedPressable>
            ) : null}

            {expanded ? (
              <Animated.View
                entering={reduce ? undefined : FadeIn.duration(180)}
                exiting={reduce ? undefined : FadeOut.duration(120)}
                style={{
                  padding: theme.spacing.md,
                  borderRadius: theme.radius.lg,
                  backgroundColor: colors.surfaceSecondary,
                  gap: theme.spacing.sm,
                }}
              >
                {groups.map((group) => (
                  <View key={group.group} style={{ gap: 4 }}>
                    <AppText variant="caption" weight={titleWeight} color="brand">
                      {group.label}
                    </AppText>
                    {group.items.map((item) => (
                      <AppText key={item.code} variant="caption" color="secondary">
                        {item.name}
                      </AppText>
                    ))}
                  </View>
                ))}
              </Animated.View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
