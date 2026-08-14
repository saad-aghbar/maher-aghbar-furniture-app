import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { localizedName } from '@maher/i18n';
import type { ProductionSetupBehavior, ProductionSetupStage } from '@/api/modules/workflow';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

type Props = {
  open: boolean;
  stage: ProductionSetupStage | null;
  outputs: Array<{
    id: string;
    workflowNodeId: string | null;
    nameEn: string;
    nameAr: string;
    nameHe?: string | null;
  }>;
  warehouses: Array<{
    id: string;
    nameEn: string;
    nameAr: string;
    type: string;
    isDefault: boolean;
  }>;
  onClose: () => void;
  onSave: (stage: ProductionSetupStage) => void;
};

const BEHAVIORS: ProductionSetupBehavior[] = [
  'NONE',
  'USES_MATERIALS',
  'PRODUCES_SEMI_FINISHED',
  'USES_SEMI_FINISHED',
  'USES_AND_PRODUCES',
  'PRODUCES_FINISHED',
];

function produces(b: ProductionSetupBehavior) {
  return b === 'PRODUCES_SEMI_FINISHED' || b === 'USES_AND_PRODUCES' || b === 'PRODUCES_FINISHED';
}

function usesSemi(b: ProductionSetupBehavior) {
  return b === 'USES_SEMI_FINISHED' || b === 'USES_AND_PRODUCES';
}

function behaviorLabel(behavior: ProductionSetupBehavior, t: (k: string) => string) {
  const map: Record<ProductionSetupBehavior, string> = {
    NONE: t('production.setup.behaviorNone'),
    USES_MATERIALS: t('production.setup.behaviorUsesMaterials'),
    PRODUCES_SEMI_FINISHED: t('production.setup.behaviorProducesSemi'),
    USES_SEMI_FINISHED: t('production.setup.behaviorUsesSemi'),
    USES_AND_PRODUCES: t('production.setup.behaviorUsesAndProduces'),
    PRODUCES_FINISHED: t('production.setup.behaviorProducesFinished'),
  };
  return map[behavior];
}

export function ProductionStageSetupSheet({
  open,
  stage,
  outputs,
  warehouses,
  onClose,
  onSave,
}: Props) {
  const { t, locale } = useLocale();
  const { theme, colors } = useTheme();
  const [behavior, setBehavior] = useState<ProductionSetupBehavior>('NONE');
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [nameHe, setNameHe] = useState('');
  const [qty, setQty] = useState('1');
  const [warehouseId, setWarehouseId] = useState('');
  const [consumeIds, setConsumeIds] = useState<string[]>([]);
  const [consumeRaw, setConsumeRaw] = useState(false);
  const [consumeSemi, setConsumeSemi] = useState(false);

  useEffect(() => {
    if (!open || !stage) return;
    setBehavior(stage.behavior);
    setNameEn(stage.output?.nameEn ?? '');
    setNameAr(stage.output?.nameAr ?? '');
    setNameHe(stage.output?.nameHe ?? '');
    setQty(String(stage.output?.qtyPerUnit ?? 1));
    setWarehouseId(stage.output?.defaultWarehouseId ?? '');
    setConsumeIds(stage.consumeOutputIds ?? []);
    setConsumeRaw(stage.consumesRawMaterials);
    setConsumeSemi(stage.consumesSemiFinished);
  }, [open, stage]);

  if (!stage) return null;
  const upstream = outputs.filter((o) => o.workflowNodeId && o.workflowNodeId !== stage.workflowNodeId);
  const warehouseType = behavior === 'PRODUCES_FINISHED' ? 'FINISHED_GOODS' : 'SEMI_FINISHED';

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.production.workflow.setupStage')}
    >
      <ScrollView contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.xl }}>
        <AppText variant="body" weight="semibold">
          {localizedName(locale, stage)}
        </AppText>
        {BEHAVIORS.map((b) => (
          <Pressable
            key={b}
            onPress={() => setBehavior(b)}
            style={{
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: behavior === b ? colors.brand : colors.borderStrong,
              padding: theme.spacing.sm,
            }}
          >
            <AppText variant="caption">{behaviorLabel(b, t)}</AppText>
          </Pressable>
        ))}
        {produces(behavior) ? (
          <>
            <Pressable onPress={() => setConsumeRaw((v) => !v)}>
              <AppText variant="caption">
                {consumeRaw ? '☑ ' : '☐ '}
                {t('production.setup.alsoUsesMaterials')}
              </AppText>
            </Pressable>
            <TextField
              label={t('production.setup.outputNameEn')}
              value={nameEn}
              onChangeText={setNameEn}
            />
            <TextField
              label={t('production.setup.outputNameAr')}
              value={nameAr}
              onChangeText={setNameAr}
            />
            <TextField
              label={t('production.setup.outputNameHe')}
              value={nameHe}
              onChangeText={setNameHe}
            />
            <TextField
              label={t('production.setup.outputQty')}
              value={qty}
              onChangeText={setQty}
              keyboardType="decimal-pad"
            />
            <AppText variant="caption" color="muted">
              {t('production.setup.destinationWarehouse')}
            </AppText>
            <Pressable onPress={() => setWarehouseId('')}>
              <AppText variant="caption">
                {!warehouseId ? '☑ ' : '☐ '}
                {t('production.setup.warehouseAutomatic')}
              </AppText>
            </Pressable>
            {warehouses
              .filter((w) => w.type === warehouseType)
              .map((w) => (
                <Pressable key={w.id} onPress={() => setWarehouseId(w.id)}>
                  <AppText variant="caption">
                    {warehouseId === w.id ? '☑ ' : '☐ '}
                    {localizedName(locale, w)}
                    {w.isDefault ? ' ★' : ''}
                  </AppText>
                </Pressable>
              ))}
          </>
        ) : null}
        {usesSemi(behavior) || consumeSemi ? (
          <View style={{ gap: theme.spacing.sm }}>
            <AppText variant="caption">{t('production.setup.consumeInputs')}</AppText>
            {upstream.map((out) => (
              <Pressable
                key={out.id}
                onPress={() =>
                  setConsumeIds((ids) =>
                    ids.includes(out.id) ? ids.filter((id) => id !== out.id) : [...ids, out.id],
                  )
                }
              >
                <AppText variant="caption">
                  {consumeIds.includes(out.id) ? '☑ ' : '☐ '}
                  {localizedName(locale, out)}
                </AppText>
              </Pressable>
            ))}
          </View>
        ) : null}
        <PrimaryButton
          label={t('mobile.production.workflow.setupSave')}
          onPress={() =>
            onSave({
              ...stage,
              behavior,
              consumesRawMaterials: consumeRaw,
              consumesSemiFinished: usesSemi(behavior) || consumeSemi,
              consumeOutputIds: consumeIds,
              output: produces(behavior)
                ? {
                    id: stage.output?.id ?? null,
                    nameEn,
                    nameAr,
                    nameHe,
                    qtyPerUnit: Number(qty) || 1,
                    defaultWarehouseId: warehouseId || null,
                  }
                : stage.output,
            })
          }
        />
      </ScrollView>
    </BottomSheet>
  );
}
