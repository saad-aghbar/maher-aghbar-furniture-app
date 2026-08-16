import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { formatCompactHours, useLocale } from '@/i18n';
import { HoursOfText } from './HoursOfText';
import { AnimatedPressable, haptics, ProgressBar } from '@/motion';
import { useTheme } from '@/theme';
import {
  capacityStateLabelKey,
  type CapacityState,
  type CapacityWorkerView,
  type FactoryCapacityCardModel,
} from '../selectFactoryCapacity';

type Props = {
  open: boolean;
  onClose: () => void;
  card: FactoryCapacityCardModel | null;
};

function stateIcon(state: CapacityState): keyof typeof Ionicons.glyphMap {
  if (state === 'closed') return 'moon-outline';
  if (state === 'noEligibleWorkers' || state === 'unavailable') return 'warning-outline';
  if (state === 'full' || state === 'nearCapacity') return 'alert-circle-outline';
  if (state === 'moderate') return 'remove-circle-outline';
  return 'checkmark-circle-outline';
}

export function FactoryCapacityDetailSheet({ open, onClose, card }: Props) {
  const { user } = useAuth();
  const canManageUsers = can(user, 'user.manage');
  const router = useRouter();
  const { t, tPlural, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const { height } = useWindowDimensions();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const maxHeight = Math.round(height * 0.56);

  const blocked = card?.state === 'noEligibleWorkers';
  const closed = card?.state === 'closed';
  const full = card?.state === 'full';
  const alerted = Boolean(blocked || full || card?.state === 'unavailable');
  const accent = !card
    ? colors.brand
    : blocked || card.state === 'unavailable'
      ? colors.warning
      : full
        ? colors.error
        : card.state === 'nearCapacity'
          ? colors.warning
          : closed
            ? colors.borderStrong
            : colors.brand;
  const fill = !card
    ? colors.brand
    : closed
      ? colors.calendarLoadClosed
      : blocked || card.state === 'unavailable'
        ? colors.warning
        : full || card.state === 'nearCapacity'
          ? colors.calendarLoadBusy
          : card.state === 'moderate'
            ? colors.calendarLoadHalf
            : colors.calendarLoadLight;
  const pillBg =
    blocked || card?.state === 'unavailable' || card?.state === 'nearCapacity'
      ? colors.warningSoft
      : full
        ? colors.errorSoft
        : closed
          ? colors.surfaceSecondary
          : colors.brandSoft;
  const pillInk =
    blocked || card?.state === 'unavailable' || card?.state === 'nearCapacity'
      ? colors.warning
      : full
        ? colors.error
        : closed
          ? colors.textSecondary
          : colors.brand;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={card ? t('mobile.adminScheduling.capacity.detailTitle', { name: card.name }) : ''}
      fitContent
      maxHeight={maxHeight}
    >
      {card ? (
        <ScrollView
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          style={{ maxHeight: Math.max(180, maxHeight - 120) }}
          contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.sm }}
        >
          <View
            style={{
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: alerted ? accent : colors.borderStrong,
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
                backgroundColor: accent,
                opacity: alerted ? 1 : 0.55,
              }}
            />
            <View
              style={{
                gap: theme.spacing.sm,
                padding: theme.spacing.md,
                ...(isRTL
                  ? { paddingRight: theme.spacing.md + 4 }
                  : { paddingLeft: theme.spacing.md + 4 }),
              }}
            >
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: theme.spacing.sm,
                }}
              >
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: theme.radius.full,
                    backgroundColor: pillBg,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: pillInk,
                    maxWidth: '100%',
                  }}
                >
                  <Ionicons name={stateIcon(card.state)} size={12} color={pillInk} />
                  <AppText
                    variant="caption"
                    weight="semibold"
                    numberOfLines={1}
                    style={{ color: pillInk, fontSize: 11 }}
                  >
                    {t(capacityStateLabelKey(card.state))}
                  </AppText>
                </View>
              </View>

              {closed || blocked ? (
                <AppText
                  variant="caption"
                  color="muted"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {closed
                    ? t('mobile.adminScheduling.capacity.emptyClosed')
                    : t('mobile.adminScheduling.capacity.emptyNoWorkers')}
                </AppText>
              ) : (
                <View
                  style={{
                    borderRadius: theme.radius.lg,
                    backgroundColor: colors.surfaceSecondary,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: colors.border,
                    padding: theme.spacing.sm,
                    gap: theme.spacing.sm,
                  }}
                >
                  <ProgressBar
                    progress={card.utilizationPercent / 100}
                    height={7}
                    fillStyle={{ backgroundColor: fill }}
                  />
                  <MetaRow
                    label={t('common.status')}
                    value={t(capacityStateLabelKey(card.state))}
                  />
                  <MetaRow
                    label={t('mobile.adminScheduling.capacity.detailWorkersHeading')}
                    value={tPlural(
                      'mobile.adminScheduling.capacity.eligibleWorkers',
                      card.eligibleWorkerCount,
                    )}
                  />
                  <MetaRow
                    label={t('mobile.adminScheduling.capacity.available')}
                    value={formatCompactHours(locale, card.availableHours)}
                    ltr
                  />
                  <MetaRow
                    label={t('mobile.adminScheduling.capacity.allocated')}
                    value={
                      <HoursOfText
                        allocated={card.allocatedHours}
                        available={card.availableHours}
                      />
                    }
                  />
                  <MetaRow
                    label={t('mobile.adminScheduling.capacity.remaining')}
                    value={formatCompactHours(locale, card.remainingHours)}
                    ltr
                  />
                </View>
              )}
              {canManageUsers ? (
                <AnimatedPressable
                  variant="button"
                  accessibilityRole="button"
                  accessibilityLabel={t('mobile.adminScheduling.capacity.viewWorkers')}
                  onPress={() => {
                    void haptics.selection();
                    onClose();
                    router.push('/(app)/(admin)/users' as Href);
                  }}
                  style={{
                    alignSelf: isRTL ? 'flex-end' : 'flex-start',
                    minHeight: 36,
                    paddingHorizontal: theme.spacing.md,
                    borderRadius: theme.radius.full,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.brandSoft,
                    borderWidth: 1,
                    borderColor: colors.brand,
                  }}
                >
                  <AppText variant="caption" weight="semibold" style={{ color: colors.brand }}>
                    {t('mobile.adminScheduling.capacity.viewWorkers')}
                  </AppText>
                </AnimatedPressable>
              ) : null}
            </View>
          </View>

          <WorkerSection
            icon="people-outline"
            heading={t('mobile.adminScheduling.capacity.detailWorkersHeading')}
          >
            {card.workers.length === 0 ? (
              <AppText
                variant="caption"
                color="muted"
                style={{
                  padding: theme.spacing.sm,
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {t('mobile.adminScheduling.capacity.detailNoWorkers')}
              </AppText>
            ) : (
              card.workers.map((worker) => (
                <WorkerRow key={worker.employeeId} worker={worker} pairHours />
              ))
            )}
          </WorkerSection>

          {card.ineligibleWorkers.length > 0 ? (
            <WorkerSection
              icon="person-remove-outline"
              heading={t('mobile.adminScheduling.capacity.detailIneligibleHeading')}
              caption={t('mobile.adminScheduling.capacity.detailIneligibleCaption')}
            >
              {card.ineligibleWorkers.map((worker) => (
                <WorkerRow key={worker.employeeId} worker={worker} pairHours={false} />
              ))}
            </WorkerSection>
          ) : null}

          {card.unassignedAllocatedMinutes > 0 ? (
            <WorkerSection
              icon="help-circle-outline"
              heading={t('mobile.adminScheduling.capacity.detailUnassignedHeading')}
              caption={t('mobile.adminScheduling.capacity.detailUnassignedCaption')}
            >
              <View
                style={{
                  borderRadius: theme.radius.lg,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceSecondary,
                  paddingVertical: theme.spacing.sm,
                  paddingHorizontal: theme.spacing.md,
                }}
              >
                <AppText variant="caption" color="secondary">
                  {t('mobile.adminScheduling.capacity.workerAllocatedOnly', {
                    hours: formatCompactHours(locale, card.unassignedHours),
                  })}
                </AppText>
              </View>
            </WorkerSection>
          ) : null}
        </ScrollView>
      ) : null}
    </BottomSheet>
  );
}

function WorkerSection({
  icon,
  heading,
  caption,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  heading: string;
  caption?: string;
  children: ReactNode;
}) {
  const { isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  return (
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
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm + 2,
          backgroundColor: colors.surfaceSecondary,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        }}
      >
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.brandSoft,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
          }}
        >
          <Ionicons name={icon} size={14} color={colors.brand} />
        </View>
        <AppText
          variant="caption"
          weight={titleWeight}
          style={{
            flex: 1,
            color: colors.brand,
            fontSize: 11,
            letterSpacing: locale === 'ar' ? 0 : 0.55,
            textTransform: locale === 'ar' ? 'none' : 'uppercase',
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {heading}
        </AppText>
      </View>
      <View style={{ padding: theme.spacing.sm, gap: theme.spacing.sm }}>
        {caption ? (
          <AppText
            variant="caption"
            color="muted"
            style={{
              paddingHorizontal: theme.spacing.xs,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {caption}
          </AppText>
        ) : null}
        {children}
      </View>
    </View>
  );
}

function WorkerRow({ worker, pairHours }: { worker: CapacityWorkerView; pairHours: boolean }) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  return (
    <View
      style={{
        borderRadius: theme.radius.lg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: worker.full ? colors.warning : colors.border,
        backgroundColor: colors.surfaceSecondary,
        overflow: 'hidden',
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        gap: 2,
        ...(isRTL ? { paddingRight: theme.spacing.md + 4 } : { paddingLeft: theme.spacing.md + 4 }),
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
          backgroundColor: worker.full ? colors.warning : colors.brand,
          opacity: worker.full ? 1 : 0.45,
        }}
      />
      <AppText
        variant="label"
        weight={titleWeight}
        numberOfLines={1}
        style={{ textAlign: isRTL ? 'right' : 'left' }}
      >
        {worker.name}
      </AppText>
      {pairHours ? (
        worker.full ? (
          <AppText variant="caption" color="secondary">
            {t('mobile.adminScheduling.capacity.workerFull')}
          </AppText>
        ) : (
          <HoursOfText
            allocated={worker.allocatedHours}
            available={worker.availableHours}
            color="secondary"
            weight="regular"
          />
        )
      ) : (
        <AppText variant="caption" color="secondary">
          {t('mobile.adminScheduling.capacity.workerAllocatedOnly', {
            hours: formatCompactHours(locale, worker.allocatedHours),
          })}
        </AppText>
      )}
    </View>
  );
}

function MetaRow({
  label,
  value,
  ltr = false,
}: {
  label: string;
  value: string | ReactNode;
  ltr?: boolean;
}) {
  const { isRTL } = useLocale();
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
        width: '100%',
      }}
    >
      <AppText variant="caption" color="secondary" style={{ flex: 1 }}>
        {label}
      </AppText>
      {typeof value === 'string' ? (
        <AppText variant="caption" weight="semibold" dir={ltr ? 'ltr' : 'auto'}>
          {value}
        </AppText>
      ) : (
        <View style={{ flexShrink: 0 }}>{value}</View>
      )}
    </View>
  );
}
