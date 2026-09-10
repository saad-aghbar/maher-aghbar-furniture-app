import { useEffect, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { isApiError } from '@/api/errors';
import { toastMessageForError } from '@/api/queryClient';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { useToast } from '@/components/feedback/Toast';
import { SearchBarShell } from '@/components/forms/SearchBarShell';
import { AppTextInput } from '@/components/forms/AppTextInput';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { resolveOrderMediaUri } from '@/features/sales-orders/components/OrderCardMedia';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { resolveAppFontStyle, useTheme } from '@/theme';
import { InvoicesTabBar } from './InvoicesTabBar';
import {
  invoiceCreateBlockedKey,
  invoiceCreateEmptyKey,
  type InvoiceCreatableKind,
  type InvoiceCreatableSource,
} from '../invoiceCreate';
import { useCreateInvoiceFromSourceMutation, useCreatableInvoiceSourcesQuery } from '../query';
import type { InvoiceDeskTab } from '../invoiceFilters';

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (invoiceId: string, kind: InvoiceCreatableKind) => void;
  includePurchasing?: boolean;
};

const THUMB = 52;

function deskToKind(desk: InvoiceDeskTab): 'ALL' | InvoiceCreatableKind {
  if (desk === 'orders') return 'ORDER';
  if (desk === 'returns') return 'RETURN';
  if (desk === 'purchasing') return 'PURCHASING';
  return 'ALL';
}

export function CreateInvoiceSheet({
  open,
  onClose,
  onCreated,
  includePurchasing = true,
}: Props) {
  const { t, formatCurrency, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const { showToast } = useToast();
  const { height } = useWindowDimensions();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const sheetHeight = Math.min(Math.round(height * 0.86), 720);

  const [desk, setDesk] = useState<InvoiceDeskTab>('all');
  const [query, setQuery] = useState('');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<InvoiceCreatableSource | null>(null);
  const kind = deskToKind(desk);
  const sourcesQuery = useCreatableInvoiceSourcesQuery({ kind, q: q || undefined }, open);
  const createMutation = useCreateInvoiceFromSourceMutation();

  useEffect(() => {
    if (!open) {
      setQuery('');
      setQ('');
      setSelected(null);
      setDesk('all');
      return;
    }
  }, [open]);

  useEffect(() => {
    const id = setTimeout(() => setQ(query.trim()), 250);
    return () => clearTimeout(id);
  }, [query]);

  const rows = sourcesQuery.data?.data ?? [];
  const selectable = selected && !selected.blockedReason ? selected : null;

  const reset = () => {
    setQuery('');
    setSelected(null);
    onClose();
  };

  const confirm = async () => {
    if (!selectable) return;
    try {
      const created = await createMutation.mutateAsync({
        kind: selectable.kind,
        id: selectable.id,
      });
      void haptics.confirmLight();
      showToast({ variant: 'success', message: t('accounting.invoiceCreated') });
      reset();
      onCreated(created.id, created.kind);
    } catch (err) {
      void haptics.error();
      showToast({
        variant: 'error',
        message: isApiError(err) ? toastMessageForError(err) : t('mobile.invoices.paymentFailed'),
      });
    }
  };

  const emptyKey = invoiceCreateEmptyKey(kind);

  return (
    <BottomSheet
      open={open}
      onClose={reset}
      title={t('mobile.invoices.createInvoice')}
      sheetHeight={sheetHeight}
    >
      <View style={{ gap: theme.spacing.md, flex: 1, minHeight: 0 }}>
        <InvoicesTabBar
          embedded
          value={desk}
          onChange={(next) => {
            setDesk(next);
            setSelected(null);
          }}
          tabs={[
            { key: 'all', label: t('mobile.invoices.tabs.all') },
            { key: 'orders', label: t('mobile.invoices.tabs.orders') },
            { key: 'returns', label: t('mobile.invoices.tabs.returns') },
            ...(includePurchasing
              ? [{ key: 'purchasing' as const, label: t('mobile.invoices.tabs.purchasing') }]
              : []),
          ]}
        />

        <SearchBarShell>
          <AppTextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('mobile.invoices.searchSources')}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
            style={{
              flex: 1,
              minWidth: 0,
              paddingVertical: theme.spacing.sm,
              fontSize: 16,
              color: colors.textPrimary,
              textAlign: isRTL ? 'right' : 'left',
              ...resolveAppFontStyle(locale, { variant: 'body' }),
            }}
          />
        </SearchBarShell>

        <ScrollView
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          style={{ flex: 1 }}
          contentContainerStyle={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.sm }}
        >
          {rows.length === 0 ? (
            <AppText
              variant="caption"
              color="muted"
              style={{ textAlign: isRTL ? 'right' : 'left', paddingVertical: theme.spacing.md }}
            >
              {t(emptyKey)}
            </AppText>
          ) : (
            rows.map((row) => (
              <SourceRow
                key={`${row.kind}-${row.id}`}
                row={row}
                active={selected?.id === row.id && selected.kind === row.kind}
                onPress={() => {
                  if (row.blockedReason) return;
                  void haptics.selection();
                  setSelected(row);
                }}
                formatCurrency={formatCurrency}
                isRTL={isRTL}
                titleWeight={titleWeight}
              />
            ))
          )}
        </ScrollView>

        <PrimaryButton
          label={t('mobile.invoices.createInvoice')}
          onPress={() => void confirm()}
          loading={createMutation.isPending}
          disabled={!selectable}
          style={{ borderRadius: theme.radius.full, minHeight: 44 }}
        />
        <SecondaryButton
          label={t('common.cancel')}
          onPress={reset}
          style={{ borderRadius: theme.radius.full, minHeight: 44 }}
        />
      </View>
    </BottomSheet>
  );
}

function SourceRow({
  row,
  active,
  onPress,
  formatCurrency,
  isRTL,
  titleWeight,
}: {
  row: InvoiceCreatableSource;
  active: boolean;
  onPress: () => void;
  formatCurrency: (n: number) => string;
  isRTL: boolean;
  titleWeight: 'medium' | 'semibold';
}) {
  const { t } = useLocale();
  const { colors, theme } = useTheme();
  const blocked = Boolean(row.blockedReason);
  const blockedKey = invoiceCreateBlockedKey(row.blockedReason);
  const imageUri = resolveOrderMediaUri(row.imageUrl);
  return (
    <AnimatedPressable
      variant="card"
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled: blocked }}
      onPress={onPress}
      disabled={blocked}
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        padding: theme.spacing.sm,
        borderRadius: theme.radius.lg,
        borderWidth: 1.5,
        borderColor: active ? colors.brand : colors.border,
        backgroundColor: blocked
          ? colors.surfaceSecondary
          : active
            ? colors.brandSoft
            : colors.surfaceSecondary,
        opacity: blocked ? 0.72 : 1,
      }}
    >
      <View
        style={{
          width: THUMB,
          height: THUMB,
          borderRadius: theme.radius.md,
          backgroundColor: colors.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.borderStrong,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Ionicons
            name={
              row.kind === 'RETURN'
                ? 'return-down-back-outline'
                : row.kind === 'PURCHASING'
                  ? 'cart-outline'
                  : 'cube-outline'
            }
            size={22}
            color={colors.brand}
          />
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
          }}
        >
          <AppText
            variant="label"
            weight={titleWeight}
            numberOfLines={1}
            style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}
          >
            {row.number}
          </AppText>
          <StatusBadge status={row.status} dot />
        </View>
        <AppText
          variant="caption"
          color="secondary"
          numberOfLines={1}
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {[row.title, row.partyName, row.amount > 0 ? formatCurrency(row.amount) : null]
            .filter(Boolean)
            .join(' · ')}
        </AppText>
        {blockedKey ? (
          <AppText
            variant="caption"
            style={{ color: colors.warning, textAlign: isRTL ? 'right' : 'left' }}
          >
            {t(blockedKey)}
          </AppText>
        ) : null}
      </View>
    </AnimatedPressable>
  );
}

export function CreateInvoiceFromSalesOrderSheet(props: Props) {
  return <CreateInvoiceSheet {...props} />;
}
