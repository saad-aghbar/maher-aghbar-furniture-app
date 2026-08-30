import { Pressable, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';

export type SemiStageOption = {
  code: string;
  nameEn: string;
  nameAr: string;
  nameHe: string | null;
  count: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  stages: SemiStageOption[];
  selectedCode: string | null;
  onSelect: (code: string | null) => void;
};

function stageLabel(stage: SemiStageOption, locale: string): string {
  if (locale === 'ar') return stage.nameAr || stage.nameEn;
  if (locale === 'he') return stage.nameHe || stage.nameEn;
  return stage.nameEn;
}

/**
 * Industrial stage picker — large board rows, not chip wrap.
 */
export function InventorySemiStagePickerSheet({
  open,
  onClose,
  stages,
  selectedCode,
  onSelect,
}: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  function pick(code: string | null) {
    void haptics.selection();
    onSelect(code);
    onClose();
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.inventory.semiStagePickerTitle')}
      fitContent
      maxHeight={560}
    >
      <ScrollView
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.md }}
      >
        <AppText variant="caption" color="muted">
          {t('mobile.inventory.semiStagePickerHint')}
        </AppText>

        <Pressable
          accessibilityRole="button"
          onPress={() => pick(null)}
          style={{
            borderRadius: theme.radius.xl,
            borderWidth: 1,
            borderColor: selectedCode == null ? colors.brand : colors.borderStrong,
            backgroundColor: selectedCode == null ? colors.brandSoft : colors.surface,
            overflow: 'hidden',
            ...orderBoardShadow(colorScheme),
          }}
        >
          <StageRow
            title={t('mobile.inventory.semiStageAll')}
            subtitle={t('mobile.inventory.semiStageAllHint')}
            count={stages.reduce((n, s) => n + s.count, 0)}
            selected={selectedCode == null}
            isRTL={isRTL}
            titleWeight={titleWeight}
          />
        </Pressable>

        {stages.map((stage) => {
          const selected = selectedCode === stage.code;
          return (
            <Pressable
              key={stage.code}
              accessibilityRole="button"
              onPress={() => pick(stage.code)}
              style={{
                borderRadius: theme.radius.xl,
                borderWidth: 1,
                borderColor: selected ? colors.info : colors.borderStrong,
                backgroundColor: selected ? colors.infoSoft : colors.surface,
                overflow: 'hidden',
                ...orderBoardShadow(colorScheme),
              }}
            >
              <StageRow
                title={stageLabel(stage, locale)}
                subtitle={stage.code}
                count={stage.count}
                selected={selected}
                isRTL={isRTL}
                titleWeight={titleWeight}
                accent={colors.info}
              />
            </Pressable>
          );
        })}
      </ScrollView>
    </BottomSheet>
  );
}

function StageRow({
  title,
  subtitle,
  count,
  selected,
  isRTL,
  titleWeight,
  accent,
}: {
  title: string;
  subtitle: string;
  count: number;
  selected: boolean;
  isRTL: boolean;
  titleWeight: 'medium' | 'semibold';
  accent?: string;
}) {
  const { colors, theme } = useTheme();
  const rail = accent ?? colors.brand;

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.md,
        ...(isRTL
          ? { paddingRight: theme.spacing.md + 4 }
          : { paddingLeft: theme.spacing.md + 4 }),
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
          backgroundColor: rail,
          opacity: selected ? 0.95 : 0.45,
        }}
      />
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surfaceSecondary,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Ionicons
          name={selected ? 'checkmark-circle' : 'construct-outline'}
          size={18}
          color={selected ? rail : colors.brand}
        />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="body" weight={titleWeight} numberOfLines={1}>
          {title}
        </AppText>
        <AppText variant="caption" color="muted" numberOfLines={1} dir="ltr">
          {subtitle}
        </AppText>
      </View>
      <View
        style={{
          minWidth: 36,
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: theme.radius.full,
          backgroundColor: colors.surfaceSecondary,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: 'center',
        }}
      >
        <AppText variant="caption" weight="semibold" dir="ltr">
          {count}
        </AppText>
      </View>
    </View>
  );
}
