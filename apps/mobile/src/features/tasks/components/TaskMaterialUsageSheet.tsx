import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { can } from '@maher/permissions';
import { localizedName } from '@maher/i18n';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { useCodeScanner } from '@/components/scan/CodeScannerProvider';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useToast } from '@/components/feedback/Toast';
import { InventorySkuThumb } from '@/features/inventory/components/InventorySkuThumb';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';
import {
  identifyTaskMaterial,
  listTaskMaterialUsage,
  saveTaskMaterialUsage,
  type TaskMaterialUsageLine,
} from '../api';

type DraftLine = {
  inventoryItemId: string;
  sku: string;
  nameEn: string;
  nameAr: string;
  nameHe?: string | null;
  imageUrl?: string | null;
  unit: string;
  expectedQty: number;
  actualQty: string;
  returnedQty: string;
  scrapQty: string;
  reasonNotes: string;
  isExtra: boolean;
  matched: boolean;
};

type Props = {
  open: boolean;
  taskId: string;
  onClose: () => void;
  onConfirmed: () => void;
};

function toDraft(row: TaskMaterialUsageLine): DraftLine {
  const item = row.inventoryItem;
  return {
    inventoryItemId: row.inventoryItemId,
    sku: row.sku,
    nameEn: item?.nameEn ?? row.sku,
    nameAr: item?.nameAr ?? row.sku,
    nameHe: item?.nameHe,
    imageUrl: item?.imageUrl,
    unit: item?.unit ?? 'pcs',
    expectedQty: Number(row.expectedQty) || 0,
    actualQty: String(row.actualQty ?? row.expectedQty ?? 0),
    returnedQty: String(row.returnedQty ?? 0),
    scrapQty: String(row.scrapQty ?? 0),
    reasonNotes: row.reasonNotes ?? '',
    isExtra: Boolean(row.isExtra),
    matched: false,
  };
}

export function TaskMaterialUsageSheet({ open, taskId, onClose, onConfirmed }: Props) {
  const { user } = useAuth();
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const { showToast } = useToast();
  const { openScanner } = useCodeScanner();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const allowed = can(user, 'production.material-usage.record');
  const sheetMax = Math.round(Dimensions.get('window').height * 0.88);

  useEffect(() => {
    if (!open || !allowed) return;
    let cancelled = false;
    setLoading(true);
    setScanMessage(null);
    setScanError(null);
    void listTaskMaterialUsage(taskId)
      .then((rows) => {
        if (cancelled) return;
        setLines(rows.map(toDraft));
      })
      .catch(() => {
        if (!cancelled) {
          showToast({ variant: 'error', message: t('mobile.tasks.materialsLoadFailed') });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, allowed, taskId, showToast, t]);

  function updateLine(inventoryItemId: string, patch: Partial<DraftLine>) {
    setLines((prev) =>
      prev.map((line) =>
        line.inventoryItemId === inventoryItemId ? { ...line, ...patch } : line,
      ),
    );
  }

  async function onScan() {
    setScanError(null);
    setScanMessage(null);
    setScanning(true);
    try {
      const code = await openScanner({
        title: t('mobile.tasks.scanMaterialTitle'),
        hint: t('mobile.tasks.scanMaterialHint'),
      });
      if (!code?.trim()) return;
      const result = await identifyTaskMaterial(taskId, code.trim());
      if (result.status === 'MATCH') {
        void haptics.confirmLight();
        setLines((prev) =>
          prev.map((line) =>
            line.inventoryItemId === result.inventoryItemId
              ? { ...line, matched: true }
              : line,
          ),
        );
        setScanMessage(t('mobile.tasks.scanMaterialMatch', { sku: result.sku }));
      } else if (result.status === 'WRONG') {
        void haptics.error();
        setScanError(
          t('mobile.tasks.scanMaterialWrong', {
            sku: result.scannedSku,
            expected: result.expectedSkus.join(', '),
          }),
        );
      } else if (result.status === 'EXTRA') {
        void haptics.selection();
        setLines((prev) => {
          if (prev.some((l) => l.inventoryItemId === result.inventoryItemId)) {
            return prev;
          }
          return [
            ...prev,
            {
              inventoryItemId: result.inventoryItemId,
              sku: result.sku,
              nameEn: result.nameEn,
              nameAr: result.nameAr,
              nameHe: result.nameHe,
              imageUrl: result.imageUrl,
              unit: result.unit,
              expectedQty: 0,
              actualQty: '1',
              returnedQty: '0',
              scrapQty: '0',
              reasonNotes: '',
              isExtra: true,
              matched: true,
            },
          ];
        });
        setScanMessage(t('mobile.tasks.scanMaterialExtra', { sku: result.sku }));
      } else {
        void haptics.error();
        setScanError(t('mobile.tasks.scanMaterialNotFound', { code: result.code }));
      }
    } catch {
      void haptics.error();
      setScanError(t('mobile.tasks.scanMaterialFailed'));
    } finally {
      setScanning(false);
    }
  }

  async function onConfirm() {
    setSaving(true);
    try {
      await saveTaskMaterialUsage(
        taskId,
        lines.map((line) => ({
          inventoryItemId: line.inventoryItemId,
          actualQty: Number(line.actualQty) || 0,
          returnedQty: Number(line.returnedQty) || 0,
          scrapQty: Number(line.scrapQty) || 0,
          reasonNotes: line.reasonNotes.trim() || null,
          isExtra: line.isExtra,
          sku: line.sku,
        })),
      );
      void haptics.confirmMedium();
      onConfirmed();
    } catch {
      void haptics.error();
      showToast({ variant: 'error', message: t('mobile.tasks.materialsSaveFailed') });
    } finally {
      setSaving(false);
    }
  }

  if (!allowed) return null;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.tasks.materialsTitle')}
      fitContent
      maxHeight={sheetMax}
    >
      {loading ? (
        <View style={{ padding: theme.spacing.xl, alignItems: 'center' }}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.lg,
            paddingBottom: theme.spacing.xl,
            gap: theme.spacing.md,
          }}
        >
          <AppText variant="caption" color="muted">
            {t('mobile.tasks.materialsHint')}
          </AppText>

          <SecondaryButton
            label={scanning ? t('mobile.tasks.scanning') : t('mobile.tasks.scanMaterial')}
            onPress={() => void onScan()}
            disabled={scanning || saving}
            leading={<Ionicons name="qr-code-outline" size={18} color={colors.textPrimary} />}
          />

          {scanMessage ? (
            <AppText variant="caption" color="success">
              {scanMessage}
            </AppText>
          ) : null}
          {scanError ? (
            <AppText variant="caption" color="error">
              {scanError}
            </AppText>
          ) : null}

          {lines.length === 0 ? (
            <AppText variant="body" color="muted">
              {t('mobile.tasks.materialsEmpty')}
            </AppText>
          ) : (
            lines.map((line) => {
              const name = localizedName(locale, line);
              return (
                <View
                  key={line.inventoryItemId}
                  style={{
                    borderWidth: 1,
                    borderColor: line.matched ? colors.success : colors.borderStrong,
                    borderRadius: theme.radius.lg,
                    padding: theme.spacing.md,
                    gap: theme.spacing.sm,
                    backgroundColor: colors.surface,
                  }}
                >
                  <View
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      gap: theme.spacing.sm,
                      alignItems: 'center',
                    }}
                  >
                    <InventorySkuThumb uri={line.imageUrl} size={44} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <AppText variant="body" weight="semibold" numberOfLines={2}>
                        {name}
                      </AppText>
                      <AppText variant="caption" color="muted" dir="ltr">
                        {line.sku}
                        {line.isExtra ? ` · ${t('mobile.tasks.materialsExtra')}` : ''}
                      </AppText>
                    </View>
                    {line.matched ? (
                      <Ionicons name="checkmark-circle" size={22} color={colors.success} />
                    ) : null}
                  </View>

                  <View
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      gap: theme.spacing.sm,
                    }}
                  >
                    <QtyField
                      label={t('mobile.tasks.materialsExpected')}
                      value={String(line.expectedQty)}
                      editable={false}
                    />
                    <QtyField
                      label={t('mobile.tasks.materialsActual')}
                      value={line.actualQty}
                      onChange={(v) => updateLine(line.inventoryItemId, { actualQty: v })}
                    />
                  </View>
                  <View
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      gap: theme.spacing.sm,
                    }}
                  >
                    <QtyField
                      label={t('mobile.tasks.materialsReturned')}
                      value={line.returnedQty}
                      onChange={(v) => updateLine(line.inventoryItemId, { returnedQty: v })}
                    />
                    <QtyField
                      label={t('mobile.tasks.materialsScrap')}
                      value={line.scrapQty}
                      onChange={(v) => updateLine(line.inventoryItemId, { scrapQty: v })}
                    />
                  </View>
                  <TextInput
                    value={line.reasonNotes}
                    onChangeText={(v) => updateLine(line.inventoryItemId, { reasonNotes: v })}
                    placeholder={t('mobile.tasks.materialsReasonPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: theme.radius.md,
                      paddingHorizontal: theme.spacing.md,
                      paddingVertical: theme.spacing.sm,
                      color: colors.textPrimary,
                      textAlign: isRTL ? 'right' : 'left',
                      minHeight: 40,
                    }}
                  />
                </View>
              );
            })
          )}

          <PrimaryButton
            label={t('mobile.tasks.materialsConfirmFinish')}
            onPress={() => void onConfirm()}
            loading={saving}
            disabled={saving || lines.length === 0}
          />
          <Pressable
            onPress={() => {
              // Prefill rows already equal expected; finish without editing.
              onConfirmed();
            }}
            accessibilityRole="button"
            disabled={saving}
          >
            <AppText variant="caption" color="muted" align="center">
              {t('mobile.tasks.materialsSkip')}
            </AppText>
          </Pressable>
        </ScrollView>
      )}
    </BottomSheet>
  );
}

function QtyField({
  label,
  value,
  onChange,
  editable = true,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  editable?: boolean;
}) {
  const { colors, theme } = useTheme();
  const { isRTL } = useLocale();
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <AppText variant="caption" color="muted">
        {label}
      </AppText>
      <TextInput
        value={value}
        editable={editable}
        keyboardType="decimal-pad"
        onChangeText={onChange}
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: theme.radius.md,
          paddingHorizontal: theme.spacing.sm,
          paddingVertical: theme.spacing.sm,
          color: colors.textPrimary,
          backgroundColor: editable ? colors.surface : colors.surfaceSecondary,
          textAlign: isRTL ? 'right' : 'left',
        }}
      />
    </View>
  );
}
