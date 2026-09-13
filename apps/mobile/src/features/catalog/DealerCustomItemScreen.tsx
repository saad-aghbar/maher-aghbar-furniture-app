import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { can } from '@maher/permissions';
import { listSpecOptionGroups, listSpecOptionValues } from '@/api/modules/catalog';
import { queryKeys } from '@/api/queryKeys';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { useToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { AppScreen } from '@/components/layout/AppScreen';
import { FloatingActionDock } from '@/components/layout/FloatingActionDock';
import { ScreenBackLead } from '@/components/layout/ScreenBackLead';
import { stickyCtaBottomInset } from '@/components/layout/stickyCtaInset';
import { CatalogSectionBoard } from '@/features/catalog/components/CatalogSectionBoard';
import { DealerCustomPhotosBoard } from '@/features/catalog/components/DealerCustomPhotosBoard';
import { DealerMeasurementsBoard } from '@/features/catalog/components/DealerMeasurementsBoard';
import { DealerOrderSpecsBoard } from '@/features/catalog/components/DealerOrderSpecsBoard';
import { emptyOrderLine, type NewOrderLine } from '@/features/requests/newOrderLine';
import { upsertBasketLine } from '@/features/requests/newOrderBasket';
import { NewOrderQtyStepper } from '@/features/requests/components/NewOrderQtyStepper';
import { useOptionalOrderBasket } from '@/features/requests/OrderBasketProvider';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { haptics, ListItemEnter } from '@/motion';
import { DEALER_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';

type Props = {
  lineId?: string;
};

const BASKET_HREF = '/(app)/(customer)/(tabs)/basket' as Href;

export function DealerCustomItemScreen({ lineId }: Props) {
  const { user } = useAuth();
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const { showToast } = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const basket = useOptionalOrderBasket();
  const allowed = can(user, 'request.create');
  const canReadCatalog = can(user, 'catalog.read');
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const editing = Boolean(lineId?.trim());

  const specGroupsQuery = useQuery({
    queryKey: queryKeys.catalog.specOptionGroups({ pageSize: 100 }),
    queryFn: () => listSpecOptionGroups({ page: 1, pageSize: 100 }),
    enabled: allowed && canReadCatalog,
    staleTime: 60_000,
  });
  const specValuesQuery = useQuery({
    queryKey: queryKeys.catalog.specOptionValues({ pageSize: 200 }),
    queryFn: () => listSpecOptionValues({ page: 1, pageSize: 200 }),
    enabled: allowed && canReadCatalog,
    staleTime: 60_000,
  });

  const [line, setLine] = useState<NewOrderLine>(() =>
    emptyOrderLine({ productId: '', dealerPrice: '' }),
  );
  const seededKey = useRef('');

  useEffect(() => {
    if (!editing) return;
    if (basket && !basket.hydrated) return;
    const id = lineId!.trim();
    const key = `${id}:${basket?.hydrated ?? false}`;
    if (seededKey.current === key) return;
    seededKey.current = key;
    const existing = basket?.lines.find((row) => row.id === id);
    if (existing) setLine({ ...existing, productId: '', dealerPrice: '' });
  }, [basket, editing, lineId]);

  const footerClearance = stickyCtaBottomInset(
    insets.bottom,
    theme.spacing.sm,
    DEALER_TAB_BAR_CLEARANCE,
  );
  const scrollBottomPad = 88 + footerClearance + theme.spacing.lg;
  const leadSize = theme.sizes.touch.min;

  const onSave = () => {
    if (!basket || !allowed) return;
    const name = line.customProductName.trim();
    if (!name) {
      void haptics.error();
      showToast({ variant: 'warning', message: t('mobile.newOrder.customNameRequired') });
      return;
    }
    if (!line.photoUris.length) {
      void haptics.error();
      showToast({ variant: 'warning', message: t('mobile.newOrder.customPhotoRequired') });
      return;
    }
    void haptics.confirmMedium();
    const next: NewOrderLine = {
      ...line,
      id: lineId?.trim() || line.id,
      productId: '',
      dealerPrice: '',
      customProductName: name,
      imageUrl: line.imageUrl || line.photoUris[0] || '',
    };
    basket.setLines((prev) => upsertBasketLine(prev, next));
    showToast({ variant: 'success', message: t('mobile.productDetail.addedToBasket') });
    router.back();
  };

  if (!allowed) {
    return (
      <AppScreen>
        <ScreenBackLead fallback={BASKET_HREF} />
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }

  return (
    <AppScreen edges={{ top: true, bottom: false }}>
      <View style={{ minHeight: leadSize, justifyContent: 'center' }}>
        <View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            ...(isRTL ? { right: 0 } : { left: 0 }),
            zIndex: 1,
            justifyContent: 'center',
          }}
        >
          <ScreenBackLead fallback={BASKET_HREF} />
        </View>
        <AppText
          variant="largeTitle"
          weight={titleWeight}
          align="center"
          numberOfLines={2}
          style={{ paddingHorizontal: leadSize + theme.spacing.sm }}
        >
          {t('mobile.newOrder.customItemTitle')}
        </AppText>
      </View>

      <ScrollView
        contentContainerStyle={{
          gap: theme.spacing.md,
          paddingBottom: scrollBottomPad,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <ListItemEnter index={0}>
          <CatalogSectionBoard titleWeight={titleWeight}>
            <View
              style={{
                alignSelf: isRTL ? 'flex-end' : 'flex-start',
                borderRadius: theme.radius.xl,
                borderWidth: 1,
                borderColor: colors.warning,
                backgroundColor: colors.warningSoft,
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.xs,
              }}
            >
              <AppText variant="caption" weight="medium" color="warning">
                {t('mobile.lineKind.custom')}
              </AppText>
            </View>
            <AppText variant="caption" color="muted">
              {t('mobile.newOrder.customItemHint')}
            </AppText>
            <View
              style={{
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.warningSoft,
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.sm,
              }}
            >
              <AppText variant="caption" weight="medium" color="warning">
                {t('mobile.newOrder.waitingForFactoryPrice')}
              </AppText>
            </View>
            <TextField
              label={t('mobile.newOrder.modelName')}
              value={line.customProductName}
              onChangeText={(customProductName) =>
                setLine({ ...line, customProductName, productId: '' })
              }
              placeholder={t('mobile.newOrder.modelNamePlaceholder')}
            />
            <NewOrderQtyStepper
              value={line.quantity}
              onChange={(quantity) => setLine({ ...line, quantity })}
            />
          </CatalogSectionBoard>
        </ListItemEnter>

        <ListItemEnter index={1}>
          <DealerCustomPhotosBoard
            line={line}
            onChange={setLine}
            titleWeight={titleWeight}
          />
        </ListItemEnter>

        <ListItemEnter index={2}>
          <DealerOrderSpecsBoard
            line={line}
            onChange={setLine}
            groups={specGroupsQuery.data?.data ?? []}
            values={specValuesQuery.data?.data ?? []}
            titleWeight={titleWeight}
          />
        </ListItemEnter>

        <ListItemEnter index={3}>
          <DealerMeasurementsBoard
            line={line}
            onChange={setLine}
            titleWeight={titleWeight}
          />
        </ListItemEnter>

        <ListItemEnter index={4}>
          <CatalogSectionBoard
            title={t('mobile.newOrder.itemNotes')}
            titleWeight={titleWeight}
          >
            <AppText variant="caption" color="muted">
              {t('mobile.newOrder.customNotesHint')}
            </AppText>
            <TextField
              label={t('mobile.newOrder.itemNotes')}
              value={line.notes}
              onChangeText={(notes) => setLine({ ...line, notes })}
              placeholder={t('mobile.newOrder.customNotesPlaceholder')}
              multiline
              copyable
            />
          </CatalogSectionBoard>
        </ListItemEnter>
      </ScrollView>

      <FloatingActionDock floating tabClearance={DEALER_TAB_BAR_CLEARANCE}>
        <View
          style={{
            borderRadius: theme.radius.xl,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            backgroundColor: colors.surface,
            padding: theme.spacing.md,
            overflow: 'hidden',
            ...orderBoardShadow(colorScheme),
          }}
        >
          <PrimaryButton
            label={
              editing
                ? t('mobile.newOrder.saveCustomToBasket')
                : t('mobile.newOrder.addCustomToBasket')
            }
            testID="custom-item-save"
            onPress={onSave}
            haptic="medium"
            style={{ borderRadius: theme.radius.xl, minHeight: 50 }}
          />
        </View>
      </FloatingActionDock>
    </AppScreen>
  );
}
