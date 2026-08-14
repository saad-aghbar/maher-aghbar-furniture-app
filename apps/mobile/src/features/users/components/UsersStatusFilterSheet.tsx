import { ScrollView, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

export type UserStatusFilter = '' | 'true' | 'false';

type StatusProps = {
  open: boolean;
  onClose: () => void;
  value: UserStatusFilter;
  onApply: (value: UserStatusFilter) => void;
};

const STATUS_OPTIONS: Array<{ value: UserStatusFilter; labelKey: string }> = [
  { value: '', labelKey: 'common.all' },
  { value: 'true', labelKey: 'users.active' },
  { value: 'false', labelKey: 'users.inactive' },
];

export function UsersStatusFilterSheet({ open, onClose, value, onApply }: StatusProps) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <BottomSheet open={open} onClose={onClose} title={t('users.filterStatus')} fitContent>
      <View style={{ gap: theme.spacing.md }}>
        <View style={{ gap: theme.spacing.sm }}>
          {STATUS_OPTIONS.map((opt) => {
            const active = value === opt.value;
            return (
              <AnimatedPressable
                key={opt.value || 'all'}
                variant="card"
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  void haptics.selection();
                  onApply(opt.value);
                  onClose();
                }}
                style={{
                  padding: theme.spacing.md,
                  borderRadius: theme.radius.xl,
                  borderWidth: 1.5,
                  borderColor: active ? colors.brand : colors.borderStrong,
                  backgroundColor: active ? colors.brandSoft : colors.surface,
                  ...orderBoardShadow(colorScheme),
                }}
              >
                <AppText
                  variant="label"
                  weight={active ? titleWeight : 'medium'}
                  color={active ? 'brand' : 'primary'}
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {t(opt.labelKey)}
                </AppText>
              </AnimatedPressable>
            );
          })}
        </View>
        <SecondaryButton
          label={t('common.cancel')}
          onPress={onClose}
          style={{
            borderRadius: theme.radius.full,
            minHeight: theme.sizes.touch.min,
            paddingVertical: 0,
          }}
        />
      </View>
    </BottomSheet>
  );
}

type RoleProps = {
  open: boolean;
  onClose: () => void;
  roles: Array<{ id: string; code: string; label: string }>;
  value: string;
  onApply: (roleCode: string) => void;
  titleKey?: string;
  allLabelKey?: string;
};

export function UsersRoleFilterSheet({
  open,
  onClose,
  roles,
  value,
  onApply,
  titleKey = 'users.filterRole',
  allLabelKey = 'common.all',
}: RoleProps) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <BottomSheet open={open} onClose={onClose} title={t(titleKey)} sheetHeight={420}>
      <View style={{ gap: theme.spacing.md, flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.md }}
        >
          <AnimatedPressable
            variant="card"
            onPress={() => {
              void haptics.selection();
              onApply('');
              onClose();
            }}
            style={{
              padding: theme.spacing.md,
              borderRadius: theme.radius.xl,
              borderWidth: 1.5,
              borderColor: !value ? colors.brand : colors.borderStrong,
              backgroundColor: !value ? colors.brandSoft : colors.surface,
              ...orderBoardShadow(colorScheme),
            }}
          >
            <AppText
              variant="label"
              weight={!value ? titleWeight : 'medium'}
              color={!value ? 'brand' : 'primary'}
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {t(allLabelKey)}
            </AppText>
          </AnimatedPressable>
          {roles.map((role) => {
            const active = value === role.code;
            return (
              <AnimatedPressable
                key={role.id}
                variant="card"
                onPress={() => {
                  void haptics.selection();
                  onApply(role.code);
                  onClose();
                }}
                style={{
                  padding: theme.spacing.md,
                  borderRadius: theme.radius.xl,
                  borderWidth: 1.5,
                  borderColor: active ? colors.brand : colors.borderStrong,
                  backgroundColor: active ? colors.brandSoft : colors.surface,
                  ...orderBoardShadow(colorScheme),
                }}
              >
                <AppText
                  variant="label"
                  weight={active ? titleWeight : 'medium'}
                  color={active ? 'brand' : 'primary'}
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {role.label}
                </AppText>
              </AnimatedPressable>
            );
          })}
        </ScrollView>
        <SecondaryButton
          label={t('common.cancel')}
          onPress={onClose}
          style={{
            borderRadius: theme.radius.full,
            minHeight: theme.sizes.touch.min,
            paddingVertical: 0,
          }}
        />
      </View>
    </BottomSheet>
  );
}
