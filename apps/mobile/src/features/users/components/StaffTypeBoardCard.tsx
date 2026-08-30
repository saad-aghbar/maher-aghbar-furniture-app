import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { StaffTypeRow } from '@/api/modules/users';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { localizedRoleName } from '../display';
import { staffTypeIcon } from '../staffIcon';

type Props = {
  item: StaffTypeRow;
  onView: () => void;
  onDuplicate: () => void;
  onDeactivate?: () => void;
  onDelete?: () => void;
};

/**
 * Staff-type floor card — icon, kind, assignment stats, chip footer.
 */
export function StaffTypeBoardCard({ item, onView, onDuplicate, onDeactivate, onDelete }: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const users = item._count?.users ?? 0;
  const perms = item._count?.permissions ?? item.permissions?.length ?? 0;
  const description =
    locale === 'ar' ? item.descriptionAr : locale === 'he' ? item.descriptionHe : item.descriptionEn;
  const active = item.isActive !== false;

  return (
    <View
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: active ? colors.borderStrong : colors.border,
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
          backgroundColor: active ? colors.brand : colors.textMuted,
          opacity: active ? 0.55 : 0.35,
        }}
      />

      <AnimatedPressable
        variant="card"
        accessibilityRole="button"
        accessibilityLabel={localizedRoleName(item, locale)}
        onPress={() => {
          void haptics.selection();
          onView();
        }}
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
              width: 48,
              height: 48,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.brandSoft,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Ionicons name={staffTypeIcon(item.iconKey)} size={22} color={colors.brand} />
          </View>

          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <AppText
              variant="label"
              weight={titleWeight}
              numberOfLines={2}
              style={{ textAlign: isRTL ? 'right' : 'left', fontSize: 17 }}
            >
              {localizedRoleName(item, locale)}
            </AppText>
            {description ? (
              <AppText
                variant="caption"
                color="secondary"
                numberOfLines={2}
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {description}
              </AppText>
            ) : null}
            <View
              style={{
                alignSelf: isRTL ? 'flex-end' : 'flex-start',
                marginTop: 2,
                paddingHorizontal: theme.spacing.sm,
                paddingVertical: 3,
                borderRadius: theme.radius.full,
                backgroundColor: colors.surfaceSecondary,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <AppText
                variant="caption"
                color="muted"
                weight={locale === 'ar' ? 'regular' : 'medium'}
                style={{
                  fontSize: 10,
                  letterSpacing: isRTL ? 0 : 0.2,
                }}
              >
                {item.isSystem ? t('users.systemPreset') : t('users.custom')}
              </AppText>
            </View>
          </View>

          <StatusBadge status={active ? 'ACTIVE' : 'INACTIVE'} dot />
        </View>

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            borderRadius: theme.radius.lg,
            backgroundColor: colors.surfaceSecondary,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
          }}
        >
          <StatCell label={t('users.assignedShort')} value={String(users)} />
          <View style={{ width: 1, backgroundColor: colors.border }} />
          <StatCell label={t('users.permissions')} value={String(perms)} />
        </View>
      </AnimatedPressable>

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          flexWrap: 'nowrap',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.md,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.surfaceSecondary,
        }}
      >
        <FooterChip label={t('users.view')} icon="open-outline" onPress={onView} emphasis />
        <FooterChip label={t('users.duplicate')} icon="copy-outline" onPress={onDuplicate} />
        {onDeactivate ? (
          <FooterChip
            label={t('common.deactivate')}
            icon="pause-circle-outline"
            onPress={onDeactivate}
            danger
          />
        ) : null}
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

function StatCell({ label, value }: { label: string; value: string }) {
  const { isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();

  return (
    <View style={{ flex: 1, paddingVertical: theme.spacing.md, paddingHorizontal: theme.spacing.md, gap: 2 }}>
      <AppText
        variant="caption"
        color="muted"
        weight={locale === 'ar' ? 'regular' : 'medium'}
        style={{
          textAlign: isRTL ? 'right' : 'left',
          fontSize: 10,
          letterSpacing: isRTL ? 0 : 0.2,
        }}
      >
        {label}
      </AppText>
      <AppText
        variant="heading"
        weight="semibold"
        dir="ltr"
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
