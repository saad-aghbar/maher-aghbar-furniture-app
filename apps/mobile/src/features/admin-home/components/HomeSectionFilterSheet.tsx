import { ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, ListItemEnter, softFadeDown, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import {
  HOME_SECTION_IDS,
  type HomeSectionId,
  type HomeSectionVisibility,
} from '../homeSectionVisibility';

const SECTION_LABEL_KEY: Record<HomeSectionId, string> = {
  attention: 'mobile.adminHome.mgmt.attention',
  today: 'mobile.adminHome.mgmt.today',
  factoryFlow: 'mobile.adminHome.mgmt.factoryFlow',
  production: 'mobile.adminHome.mgmt.production',
  outbound: 'mobile.adminHome.mgmt.outbound',
  materials: 'mobile.adminHome.mgmt.materials',
  inventory: 'mobile.adminHome.mgmt.inventory',
  quality: 'mobile.adminHome.mgmt.quality',
  exceptions: 'mobile.adminHome.mgmt.exceptions',
  workers: 'mobile.adminHome.mgmt.workers',
  late: 'mobile.adminHome.mgmt.late',
  money: 'mobile.adminHome.mgmt.money',
  manufacturing: 'mobile.adminHome.mgmt.manufacturing',
  activity: 'mobile.adminHome.mgmt.activity',
};

function sectionIcon(id: HomeSectionId): keyof typeof Ionicons.glyphMap {
  switch (id) {
    case 'attention':
      return 'flash-outline';
    case 'today':
      return 'sunny-outline';
    case 'factoryFlow':
      return 'git-branch-outline';
    case 'production':
      return 'construct-outline';
    case 'outbound':
      return 'airplane-outline';
    case 'materials':
      return 'cube-outline';
    case 'inventory':
      return 'layers-outline';
    case 'quality':
      return 'shield-checkmark-outline';
    case 'exceptions':
      return 'alert-circle-outline';
    case 'workers':
      return 'people-outline';
    case 'late':
      return 'time-outline';
    case 'money':
      return 'wallet-outline';
    case 'manufacturing':
      return 'calculator-outline';
    case 'activity':
      return 'pulse-outline';
    default:
      return 'grid-outline';
  }
}

type Props = {
  open: boolean;
  onClose: () => void;
  map: HomeSectionVisibility;
  onToggle: (id: HomeSectionId, visible: boolean) => void;
  onShowAll: () => void;
};

export function HomeSectionFilterSheet({ open, onClose, map, onToggle, onShowAll }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const reduce = useReducedMotion();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const visibleCount = HOME_SECTION_IDS.filter((id) => map[id] !== false).length;
  const allOn = visibleCount === HOME_SECTION_IDS.length;
  const Intro = reduce ? View : Animated.View;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.adminHome.sectionFilter.title')}
      fitContent
      maxHeight={580}
    >
      <View style={{ gap: theme.spacing.md }}>
        <Intro entering={reduce ? undefined : softFadeDown(40)}>
          <View
            style={{
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              backgroundColor: colors.surface,
              overflow: 'hidden',
              ...orderBoardShadow(colorScheme),
            }}
          >
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: theme.spacing.md,
                padding: theme.spacing.lg,
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 16,
                  backgroundColor: colors.brandSoft,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="grid-outline" size={22} color={colors.brand} />
              </View>
              <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
                <AppText variant="bodySecondary" color="secondary">
                  {t('mobile.adminHome.sectionFilter.hint')}
                </AppText>
                <AppText variant="caption" weight="semibold" style={{ color: colors.brand }}>
                  {visibleCount}/{HOME_SECTION_IDS.length}
                </AppText>
              </View>
            </View>
          </View>
        </Intro>

        <AnimatedPressable
          variant="button"
          accessibilityRole="button"
          accessibilityLabel={t('mobile.adminHome.sectionFilter.showAll')}
          onPress={() => {
            void haptics.selection();
            onShowAll();
          }}
          style={{
            borderRadius: theme.radius.full,
            borderWidth: 1,
            borderColor: allOn ? colors.brand : colors.borderStrong,
            backgroundColor: allOn ? colors.brandSoft : colors.surface,
            paddingVertical: theme.spacing.md,
            paddingHorizontal: theme.spacing.lg,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            ...orderBoardShadow(colorScheme),
          }}
        >
          <Ionicons
            name={allOn ? 'checkmark-done-outline' : 'apps-outline'}
            size={18}
            color={colors.brand}
          />
          <AppText variant="label" weight="semibold" style={{ color: colors.brand }}>
            {t('mobile.adminHome.sectionFilter.showAll')}
          </AppText>
        </AnimatedPressable>

        <ScrollView
          style={{ maxHeight: 380 }}
          contentContainerStyle={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.lg }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {HOME_SECTION_IDS.map((id, index) => {
            const on = map[id] !== false;
            return (
              <ListItemEnter key={id} index={index}>
                <AnimatedPressable
                  variant="card"
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={t(SECTION_LABEL_KEY[id])}
                  onPress={() => {
                    void haptics.selection();
                    onToggle(id, !on);
                  }}
                  style={{
                    borderRadius: theme.radius.xl,
                    borderWidth: 1,
                    borderColor: on ? colors.borderStrong : colors.border,
                    backgroundColor: colors.surface,
                    overflow: 'hidden',
                    opacity: on ? 1 : 0.72,
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
                      backgroundColor: on ? colors.brand : colors.border,
                      opacity: on ? 0.7 : 0.35,
                    }}
                  />

                  <View
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      alignItems: 'center',
                      gap: theme.spacing.md,
                      paddingVertical: theme.spacing.md,
                      paddingHorizontal: theme.spacing.lg,
                      ...(isRTL
                        ? { paddingRight: theme.spacing.lg + 4 }
                        : { paddingLeft: theme.spacing.lg + 4 }),
                    }}
                  >
                    <View
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 14,
                        backgroundColor: on ? colors.brandSoft : colors.surfaceSecondary,
                        borderWidth: 1,
                        borderColor: colors.border,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons
                        name={sectionIcon(id)}
                        size={20}
                        color={on ? colors.brand : colors.textMuted}
                      />
                    </View>

                    <AppText
                      variant="body"
                      weight={on ? titleWeight : 'regular'}
                      style={{ flex: 1, color: on ? colors.textPrimary : colors.textMuted }}
                      numberOfLines={1}
                    >
                      {t(SECTION_LABEL_KEY[id])}
                    </AppText>

                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        borderWidth: 1.5,
                        borderColor: on ? colors.brand : colors.borderStrong,
                        backgroundColor: on ? colors.brand : colors.surfaceSecondary,
                        alignItems: 'center',
                        justifyContent: 'center',
                        ...theme.elevation.raised,
                      }}
                    >
                      {on ? (
                        <Ionicons name="checkmark" size={16} color={colors.onBrand} />
                      ) : null}
                    </View>
                  </View>
                </AnimatedPressable>
              </ListItemEnter>
            );
          })}
        </ScrollView>
      </View>
    </BottomSheet>
  );
}
