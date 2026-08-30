import { useEffect, useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

export type UserStatusFilter = '' | 'true' | 'false';

export type UsersFilterDraft = {
  isActive: UserStatusFilter;
  stageDefinitionId: string;
};

type SkillOption = { id: string; label: string };

type CombinedProps = {
  open: boolean;
  onClose: () => void;
  value: UsersFilterDraft;
  skills: SkillOption[];
  onApply: (next: UsersFilterDraft) => void;
};

const STATUS_OPTIONS: Array<{ value: UserStatusFilter; labelKey: string }> = [
  { value: '', labelKey: 'common.all' },
  { value: 'true', labelKey: 'users.active' },
  { value: 'false', labelKey: 'users.inactive' },
];

/**
 * Combined users filter — status chips + stage skill list, Apply / Clear.
 * No bounce-in motion on sections (keeps the sheet calm).
 */
export function UsersFilterSheet({ open, onClose, value, skills, onApply }: CombinedProps) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const [draft, setDraft] = useState<UsersFilterDraft>(value);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  const showSkills = skills.length > 0;
  const chipRow = {
    flexDirection: (isRTL ? 'row-reverse' : 'row') as 'row' | 'row-reverse',
    flexWrap: 'wrap' as const,
    gap: theme.spacing.sm,
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={t('users.filterTitle')} sheetHeight={520}>
      <View style={{ flex: 1, gap: theme.spacing.md }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.md }}
        >
          <FilterSection
            icon="pulse-outline"
            title={t('users.filterStatus')}
            accent={draft.isActive ? colors.brand : undefined}
          >
            <View style={chipRow}>
              {STATUS_OPTIONS.map((opt) => {
                const active = draft.isActive === opt.value;
                return (
                  <FloorChip
                    key={opt.value || 'all'}
                    label={t(opt.labelKey)}
                    active={active}
                    onPress={() => {
                      void haptics.selection();
                      setDraft((d) => ({ ...d, isActive: opt.value }));
                    }}
                  />
                );
              })}
            </View>
          </FilterSection>

          {showSkills ? (
            <FilterSection
              icon="construct-outline"
              title={t('users.filterSkill')}
              accent={draft.stageDefinitionId ? colors.brand : undefined}
            >
              <AppText
                variant="caption"
                color="muted"
                style={{
                  marginBottom: theme.spacing.sm,
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {t('users.filterSkillHint')}
              </AppText>
              <View style={{ gap: theme.spacing.sm }}>
                <SkillRow
                  label={t('users.filterSkillAll')}
                  active={!draft.stageDefinitionId}
                  titleWeight={titleWeight}
                  onPress={() => {
                    void haptics.selection();
                    setDraft((d) => ({ ...d, stageDefinitionId: '' }));
                  }}
                />
                {skills.map((skill) => (
                  <SkillRow
                    key={skill.id}
                    label={skill.label}
                    active={draft.stageDefinitionId === skill.id}
                    titleWeight={titleWeight}
                    onPress={() => {
                      void haptics.selection();
                      setDraft((d) => ({ ...d, stageDefinitionId: skill.id }));
                    }}
                  />
                ))}
              </View>
            </FilterSection>
          ) : null}
        </ScrollView>

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: theme.spacing.sm,
            paddingTop: theme.spacing.xs,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <SecondaryButton
            label={t('users.filterClear')}
            onPress={() => {
              void haptics.selection();
              const cleared: UsersFilterDraft = { isActive: '', stageDefinitionId: '' };
              setDraft(cleared);
              onApply(cleared);
              onClose();
            }}
            style={{
              flex: 1,
              borderRadius: theme.radius.full,
              minHeight: theme.sizes.touch.min,
              paddingVertical: 0,
            }}
          />
          <PrimaryButton
            label={t('users.filterApply')}
            onPress={() => {
              void haptics.confirmLight();
              onApply(draft);
              onClose();
            }}
            style={{
              flex: 1.4,
              borderRadius: theme.radius.full,
              minHeight: theme.sizes.touch.min,
              paddingVertical: 0,
              ...orderBoardShadow(colorScheme),
            }}
          />
        </View>
      </View>
    </BottomSheet>
  );
}

type RoleSheetProps = {
  open: boolean;
  onClose: () => void;
  roles: Array<{ id: string; code: string; label: string }>;
  value: string;
  onApply: (roleCode: string) => void;
  titleKey?: string;
  allLabelKey?: string;
};

/** Staff-type (and similar) single-select sheet. */
export function UsersRoleFilterSheet({
  open,
  onClose,
  roles,
  value,
  onApply,
  titleKey = 'users.filterRole',
  allLabelKey = 'common.all',
}: RoleSheetProps) {
  const { t, locale } = useLocale();
  const { theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <BottomSheet open={open} onClose={onClose} title={t(titleKey)} sheetHeight={420}>
      <View style={{ gap: theme.spacing.md, flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.md }}
        >
          <SkillRow
            label={t(allLabelKey)}
            active={!value}
            titleWeight={titleWeight}
            onPress={() => {
              void haptics.selection();
              onApply('');
              onClose();
            }}
          />
          {roles.map((role) => (
            <SkillRow
              key={role.id}
              label={role.label}
              active={value === role.code}
              titleWeight={titleWeight}
              onPress={() => {
                void haptics.selection();
                onApply(role.code);
                onClose();
              }}
            />
          ))}
        </ScrollView>
        <SecondaryButton
          label={t('common.cancel')}
          onPress={onClose}
          style={{
            borderRadius: theme.radius.full,
            minHeight: theme.sizes.touch.min,
            paddingVertical: 0,
            ...orderBoardShadow(colorScheme),
          }}
        />
      </View>
    </BottomSheet>
  );
}

function FilterSection({
  icon,
  title,
  accent,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  accent?: string;
  children: ReactNode;
}) {
  const { isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
        }}
      >
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: accent ? colors.brandSoft : colors.surfaceSecondary,
            borderWidth: 1,
            borderColor: accent ?? colors.border,
          }}
        >
          <Ionicons name={icon} size={14} color={accent ?? colors.textSecondary} />
        </View>
        <AppText
          variant="caption"
          weight={titleWeight}
          style={{
            flex: 1,
            color: accent ?? colors.textSecondary,
            letterSpacing: locale === 'ar' ? 0 : 0.5,
            textTransform: locale === 'ar' ? 'none' : 'uppercase',
            fontSize: 11,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {title}
        </AppText>
      </View>
      {children}
    </View>
  );
}

function FloorChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm + 2,
        borderRadius: theme.radius.full,
        borderWidth: 1.5,
        borderColor: active ? colors.brand : colors.borderStrong,
        backgroundColor: active ? colors.brandSoft : colors.surface,
        ...orderBoardShadow(colorScheme),
      }}
    >
      <AppText
        variant="caption"
        weight={active ? titleWeight : 'medium'}
        color={active ? 'brand' : 'secondary'}
        style={{ textAlign: isRTL ? 'right' : 'left' }}
      >
        {label}
      </AppText>
    </AnimatedPressable>
  );
}

function SkillRow({
  label,
  active,
  titleWeight,
  onPress,
}: {
  label: string;
  active: boolean;
  titleWeight: 'medium' | 'semibold';
  onPress: () => void;
}) {
  const { isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();

  return (
    <AnimatedPressable
      variant="card"
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.md - 2,
        borderRadius: theme.radius.lg,
        borderWidth: 1.5,
        borderColor: active ? colors.brand : colors.border,
        backgroundColor: active ? colors.brandSoft : colors.surfaceSecondary,
        ...orderBoardShadow(colorScheme),
      }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          borderWidth: 1.5,
          borderColor: active ? colors.brand : colors.borderStrong,
          backgroundColor: active ? colors.brand : colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {active ? <Ionicons name="checkmark" size={14} color={colors.onBrand} /> : null}
      </View>
      <AppText
        variant="label"
        weight={active ? titleWeight : 'medium'}
        color={active ? 'brand' : 'primary'}
        numberOfLines={2}
        style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}
      >
        {label}
      </AppText>
    </AnimatedPressable>
  );
}
