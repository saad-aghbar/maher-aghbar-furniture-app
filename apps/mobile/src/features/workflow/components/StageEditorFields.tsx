import { Switch, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

export type StageScheduleMode = 'WORKER_CONSTRAINED' | 'RESOURCE_CONSTRAINED';

export function StageToggleRow({
  icon,
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint: string;
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  const { isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();

  return (
    <AnimatedPressable
      variant="card"
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={label}
      onPress={() => {
        if (disabled) return;
        void haptics.selection();
        onChange(!value);
      }}
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        padding: theme.spacing.md,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: value ? colors.brand : colors.border,
        backgroundColor: value ? colors.brandSoft : colors.surfaceSecondary,
        opacity: disabled ? 0.55 : 1,
        ...(value && !disabled ? orderBoardShadow(colorScheme) : null),
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Ionicons name={icon} size={16} color={value ? colors.brand : colors.textSecondary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText
          variant="label"
          weight="semibold"
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {label}
        </AppText>
        <AppText
          variant="caption"
          color="muted"
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {hint}
        </AppText>
      </View>
      <Switch
        value={value}
        disabled={disabled}
        pointerEvents="none"
        trackColor={{ false: colors.border, true: colors.brand }}
        thumbColor={colors.surface}
      />
    </AnimatedPressable>
  );
}

export function StageScheduleModePicker({
  value,
  onChange,
  disabled,
}: {
  value: StageScheduleMode;
  onChange: (next: StageScheduleMode) => void;
  disabled?: boolean;
}) {
  const { t, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();

  const options: {
    mode: StageScheduleMode;
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    hint: string;
  }[] = [
    {
      mode: 'WORKER_CONSTRAINED',
      icon: 'people',
      title: t('mobile.production.workflow.scheduleByWorkers'),
      hint: t('mobile.production.workflow.scheduleByWorkersHint'),
    },
    {
      mode: 'RESOURCE_CONSTRAINED',
      icon: 'cube',
      title: t('mobile.production.workflow.scheduleByResource'),
      hint: t('mobile.production.workflow.scheduleByResourceHint'),
    },
  ];

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {options.map((option) => {
        const active = value === option.mode;
        return (
          <AnimatedPressable
            key={option.mode}
            variant="card"
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityState={{ selected: active, disabled }}
            accessibilityLabel={option.title}
            onPress={() => {
              if (disabled || active) return;
              void haptics.selection();
              onChange(option.mode);
            }}
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'flex-start',
              gap: theme.spacing.md,
              padding: theme.spacing.md,
              borderRadius: theme.radius.xl,
              borderWidth: active ? 1.5 : 1,
              borderColor: active ? colors.brand : colors.border,
              backgroundColor: active ? colors.brandSoft : colors.surface,
              opacity: disabled ? 0.55 : 1,
              ...(active && !disabled ? orderBoardShadow(colorScheme) : null),
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: active ? colors.brand : colors.surfaceSecondary,
                borderWidth: 1,
                borderColor: active ? colors.brand : colors.border,
              }}
            >
              <Ionicons
                name={option.icon}
                size={18}
                color={active ? colors.onBrand : colors.brand}
              />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <AppText
                variant="label"
                weight="semibold"
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {option.title}
              </AppText>
              <AppText
                variant="caption"
                color="secondary"
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {option.hint}
              </AppText>
            </View>
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                marginTop: 2,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1.5,
                borderColor: active ? colors.brand : colors.borderStrong,
                backgroundColor: active ? colors.brand : colors.surface,
              }}
            >
              {active ? <Ionicons name="checkmark" size={13} color={colors.onBrand} /> : null}
            </View>
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

export function StageSlotStepper({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const n = Math.max(1, Math.min(20, Number(value) || 1));

  function step(delta: number) {
    if (disabled) return;
    const next = Math.max(1, Math.min(20, n + delta));
    void haptics.selection();
    onChange(String(next));
  }

  return (
    <View
      style={{
        gap: theme.spacing.sm,
        padding: theme.spacing.md,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: colors.brand,
        backgroundColor: colors.brandSoft,
      }}
    >
      <AppText
        variant="label"
        weight="semibold"
        style={{ textAlign: isRTL ? 'right' : 'left' }}
      >
        {t('mobile.production.workflow.resourceSlots')}
      </AppText>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing.lg,
        }}
      >
        <StepperButton
          icon="remove"
          disabled={disabled || n <= 1}
          label={`${t('mobile.production.workflow.resourceSlots')} −`}
          onPress={() => step(-1)}
        />
        <AppText variant="title" weight="semibold" style={{ minWidth: 36, textAlign: 'center' }}>
          {n}
        </AppText>
        <StepperButton
          icon="add"
          disabled={disabled || n >= 20}
          label={`${t('mobile.production.workflow.resourceSlots')} +`}
          onPress={() => step(1)}
        />
      </View>
      <AppText variant="caption" color="secondary" style={{ textAlign: isRTL ? 'right' : 'left' }}>
        {t('mobile.production.workflow.resourceSlotsHint')}
      </AppText>
    </View>
  );
}

function StepperButton({
  icon,
  disabled,
  onPress,
  label,
}: {
  icon: 'add' | 'remove';
  disabled?: boolean;
  onPress: () => void;
  label: string;
}) {
  const { colors, theme } = useTheme();
  return (
    <AnimatedPressable
      variant="button"
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        width: theme.sizes.touch.min,
        height: theme.sizes.touch.min,
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: disabled ? colors.disabledFill : colors.brand,
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <Ionicons name={icon} size={20} color={disabled ? colors.disabled : colors.onBrand} />
    </AnimatedPressable>
  );
}

export function StageQuietDelete({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { colors, theme } = useTheme();
  return (
    <AnimatedPressable
      variant="button"
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        if (disabled) return;
        void haptics.selection();
        onPress();
      }}
      style={{
        minHeight: theme.sizes.touch.min,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: theme.spacing.sm,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <AppText variant="caption" weight="semibold" style={{ color: colors.error }}>
        {label}
      </AppText>
    </AnimatedPressable>
  );
}
