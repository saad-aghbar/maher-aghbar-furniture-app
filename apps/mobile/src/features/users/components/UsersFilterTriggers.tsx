import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  showDepartment?: boolean;
  departmentLabel: string | null;
  onOpenDepartment: () => void;
  onClearDepartment?: () => void;
  statusLabel: string;
  statusActive: boolean;
  onOpenStatus: () => void;
  showRole?: boolean;
  roleLabel: string | null;
  onOpenRole?: () => void;
  onClearRole?: () => void;
  showStaffType?: boolean;
  staffTypeLabel?: string | null;
  onOpenStaffType?: () => void;
  onClearStaffType?: () => void;
};

/**
 * Floor filter triggers under search — department / status / role.
 */
export function UsersFilterTriggers({
  showDepartment = false,
  departmentLabel,
  onOpenDepartment,
  onClearDepartment,
  statusLabel,
  statusActive,
  onOpenStatus,
  showRole = false,
  roleLabel,
  onOpenRole,
  onClearRole,
  showStaffType = false,
  staffTypeLabel = null,
  onOpenStaffType,
  onClearStaffType,
}: Props) {
  const { isRTL } = useLocale();

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        flexWrap: 'wrap',
        gap: 10,
        alignItems: 'stretch',
      }}
    >
      {showDepartment ? (
        <FloorTrigger
          flex={1}
          icon="business-outline"
          label={departmentLabel}
          fallbackKey="users.allDepartments"
          active={Boolean(departmentLabel)}
          onPress={onOpenDepartment}
          onClear={departmentLabel && onClearDepartment ? onClearDepartment : undefined}
        />
      ) : null}
      <FloorTrigger
        flex={1}
        icon="options-outline"
        label={statusLabel}
        fallbackKey="users.filterStatus"
        active={statusActive}
        onPress={onOpenStatus}
      />
      {showRole && onOpenRole ? (
        <FloorTrigger
          flex={1}
          icon="shield-outline"
          label={roleLabel}
          fallbackKey="users.filterRole"
          active={Boolean(roleLabel)}
          onPress={onOpenRole}
          onClear={roleLabel && onClearRole ? onClearRole : undefined}
        />
      ) : null}
      {showStaffType && onOpenStaffType ? (
        <FloorTrigger
          flex={1}
          icon="briefcase-outline"
          label={staffTypeLabel}
          fallbackKey="users.staffTypeFilterAll"
          active={Boolean(staffTypeLabel)}
          onPress={onOpenStaffType}
          onClear={staffTypeLabel && onClearStaffType ? onClearStaffType : undefined}
        />
      ) : null}
    </View>
  );
}

function FloorTrigger({
  flex,
  icon,
  label,
  fallbackKey,
  active,
  onPress,
  onClear,
}: {
  flex?: number;
  icon: keyof typeof Ionicons.glyphMap;
  label: string | null;
  fallbackKey: string;
  active: boolean;
  onPress: () => void;
  onClear?: () => void;
}) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const text = label?.trim() || t(fallbackKey);

  return (
    <View
      style={{
        flex,
        minWidth: '46%',
        borderRadius: theme.radius.xl,
        backgroundColor: active ? colors.brandSoft : colors.surfaceSecondary,
        borderWidth: 1.5,
        borderColor: active ? colors.brand : colors.borderStrong,
        overflow: 'hidden',
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        ...orderBoardShadow(colorScheme),
      }}
    >
      <AnimatedPressable
        variant="button"
        accessibilityRole="button"
        accessibilityLabel={text}
        onPress={() => {
          void haptics.selection();
          onPress();
        }}
        style={{
          flex: 1,
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.md,
          minHeight: theme.sizes.touch.min,
        }}
      >
        <Ionicons name={icon} size={16} color={active ? colors.brand : colors.textSecondary} />
        <AppText
          variant="caption"
          weight={active ? titleWeight : 'medium'}
          color={active ? 'brand' : 'secondary'}
          numberOfLines={1}
          style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}
        >
          {text}
        </AppText>
      </AnimatedPressable>
      {onClear ? (
        <AnimatedPressable
          variant="button"
          accessibilityRole="button"
          accessibilityLabel={t('common.none')}
          onPress={() => {
            void haptics.selection();
            onClear();
          }}
          hitSlop={8}
          style={{ paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.md }}
        >
          <Ionicons name="close-circle" size={18} color={colors.textMuted} />
        </AnimatedPressable>
      ) : null}
    </View>
  );
}
