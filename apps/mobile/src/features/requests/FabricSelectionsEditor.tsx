import { Pressable, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { TextField } from '@/components/forms/TextField';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

export type DealerFabricRow = {
  key: string;
  type: string;
  color: string;
  role: string;
  code: string;
  quantity: string;
  notes: string;
};

export function emptyDealerFabricRow(): DealerFabricRow {
  return {
    key: `fab-${Math.random().toString(36).slice(2, 10)}`,
    type: '',
    color: '',
    role: '',
    code: '',
    quantity: '',
    notes: '',
  };
}

export function dealerFabricsPayload(rows: DealerFabricRow[]) {
  return rows
    .map((row) => ({
      key: row.key,
      type: row.type.trim() || null,
      color: row.color.trim() || null,
      role: row.role.trim() || null,
      code: row.code.trim() || null,
      quantity: row.quantity.trim() ? Number(row.quantity) : null,
      unit: 'm',
      notes: row.notes.trim() || null,
    }))
    .filter((row) => row.type || row.color || row.code || row.role);
}

type Props = {
  value: DealerFabricRow[];
  onChange: (next: DealerFabricRow[]) => void;
};

export function FabricSelectionsEditor({ value, onChange }: Props) {
  const { t, isRTL } = useLocale();
  const { theme, colors } = useTheme();

  function patch(index: number, partial: Partial<DealerFabricRow>) {
    onChange(value.map((row, i) => (i === index ? { ...row, ...partial } : row)));
  }

  return (
    <View style={{ gap: theme.spacing.md }}>
      {value.map((row, index) => (
        <View
          key={row.key}
          style={{
            gap: theme.spacing.sm,
            padding: theme.spacing.md,
            borderRadius: theme.radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceSecondary,
          }}
        >
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <AppText variant="caption" weight="semibold" color="muted">
              {t('mobile.newOrder.fabricN', { n: index + 1 })}
            </AppText>
            {value.length > 1 ? (
              <Pressable onPress={() => onChange(value.filter((_, i) => i !== index))} hitSlop={8}>
                <AppText variant="caption" color="error">
                  {t('mobile.newOrder.removeFabric')}
                </AppText>
              </Pressable>
            ) : null}
          </View>
          <TextField
            label={t('mobile.newOrder.fabricName')}
            value={row.type}
            onChangeText={(type) => patch(index, { type })}
            placeholder={t('mobile.newOrder.fabricNamePlaceholder')}
          />
          <TextField
            label={t('mobile.newOrder.fabricColor')}
            value={row.color}
            onChangeText={(color) => patch(index, { color })}
            placeholder={t('mobile.newOrder.fabricColorPlaceholder')}
          />
          <TextField
            label={t('mobile.newOrder.fabricCode')}
            value={row.code}
            onChangeText={(code) => patch(index, { code })}
            placeholder={t('mobile.newOrder.fabricCodePlaceholder')}
          />
          <TextField
            label={t('mobile.newOrder.fabricRole')}
            value={row.role}
            onChangeText={(role) => patch(index, { role })}
            placeholder={t('mobile.newOrder.fabricRolePlaceholder')}
          />
          <TextField
            label={t('mobile.newOrder.fabricQty')}
            value={row.quantity}
            onChangeText={(quantity) => patch(index, { quantity })}
            keyboardType="decimal-pad"
            placeholder={t('mobile.newOrder.fabricQtyPlaceholder')}
          />
        </View>
      ))}
      <Pressable
        onPress={() => onChange([...value, emptyDealerFabricRow()])}
        style={{
          alignSelf: isRTL ? 'flex-end' : 'flex-start',
          paddingVertical: theme.spacing.sm,
        }}
      >
        <AppText variant="label" weight="semibold">
          {t('mobile.newOrder.addFabric')}
        </AppText>
      </Pressable>
    </View>
  );
}
