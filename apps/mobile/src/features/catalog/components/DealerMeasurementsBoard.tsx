import { useState } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import type { NewOrderLine } from '@/features/requests/newOrderLine';
import type { NewOrderCustomMeasurement } from '@/features/requests/newOrderMeasurements';
import {
  CappedNestedScroll,
  CatalogFloorEmpty,
  CatalogFloorListHeader,
  FLOOR_ROW_ESTIMATE,
} from './CatalogFloorList';
import { CatalogSectionBoard } from './CatalogSectionBoard';
import { MeasurementFloorRow, displayMeasurementUnit } from './MeasurementFloorRow';
import { MeasurementValuePanel } from './MeasurementValueSheet';

type CoreKey = 'width' | 'height' | 'depth' | 'seat';

type Sheet =
  | { kind: 'core'; key: CoreKey }
  | { kind: 'custom'; id: string }
  | { kind: 'add' };

type Props = {
  line: NewOrderLine;
  onChange: (next: NewOrderLine) => void;
  titleWeight: 'medium' | 'semibold';
};

function coreField(line: NewOrderLine, key: CoreKey): string {
  if (key === 'width') return line.dimWidth;
  if (key === 'height') return line.dimHeight;
  if (key === 'depth') return line.dimDepth;
  return line.dimSeat;
}

function patchCore(line: NewOrderLine, key: CoreKey, value: string): NewOrderLine {
  if (key === 'width') return { ...line, dimWidth: value };
  if (key === 'height') return { ...line, dimHeight: value };
  if (key === 'depth') return { ...line, dimDepth: value };
  return { ...line, dimSeat: value };
}

function newMeasurementId(): string {
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Core W/H/D/seat plus extra measurements — edit and add, same tickets as the variant floor.
 */
export function DealerMeasurementsBoard({ line, onChange, titleWeight }: Props) {
  const { t } = useLocale();
  const { theme } = useTheme();
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [addLabel, setAddLabel] = useState('');

  const core: Array<{ key: CoreKey; name: string }> = [
    { key: 'width', name: t('mobile.newOrder.dimWidth') },
    { key: 'height', name: t('mobile.newOrder.dimHeight') },
    { key: 'depth', name: t('mobile.newOrder.dimDepth') },
    { key: 'seat', name: t('mobile.newOrder.dimSeat') },
  ];
  const custom = line.customMeasurements;
  const itemCount = core.length + custom.length;

  const closeSheet = () => {
    setSheet(null);
    setAddLabel('');
  };

  const editingCustom =
    sheet?.kind === 'custom' ? custom.find((row) => row.id === sheet.id) ?? null : null;

  return (
    <>
      <CatalogSectionBoard
        title={t('mobile.newOrder.dimensionsSection')}
        titleWeight={titleWeight}
        actionLabel={t('mobile.newOrder.addMeasurement')}
        onAction={() => {
          setAddLabel('');
          setSheet({ kind: 'add' });
        }}
      >
        <View style={{ gap: theme.spacing.md }}>
          <AppText variant="caption" color="muted">
            {t('mobile.newOrder.modifyMeasurementsHint')}
          </AppText>
          {itemCount === 0 ? (
            <CatalogFloorEmpty
              icon="resize-outline"
              title={t('mobile.newOrder.noCustomMeasurements')}
            />
          ) : (
            <View style={{ gap: theme.spacing.sm }}>
              <CatalogFloorListHeader
                title={t('mobile.newOrder.dimensionsSection')}
                count={itemCount}
              />
              <CappedNestedScroll
                itemCount={itemCount}
                rowEstimate={FLOOR_ROW_ESTIMATE.measurement}
                gap={theme.spacing.sm}
                visibleRows={5}
              >
                {core.map((row, index) => {
                  const value = coreField(line, row.key).trim();
                  return (
                    <MeasurementFloorRow
                      key={row.key}
                      index={index}
                      name={row.name}
                      valueLabel={
                        value ? `${value} ${displayMeasurementUnit('cm')}` : '—'
                      }
                      onEdit={() => setSheet({ kind: 'core', key: row.key })}
                    />
                  );
                })}
                {custom.map((row, index) => {
                  const unit = displayMeasurementUnit(row.unit);
                  return (
                    <MeasurementFloorRow
                      key={row.id}
                      index={core.length + index}
                      name={row.label || '—'}
                      valueLabel={row.value ? `${row.value} ${unit}` : '—'}
                      onEdit={() => setSheet({ kind: 'custom', id: row.id })}
                      onRemove={() =>
                        onChange({
                          ...line,
                          customMeasurements: custom.filter((m) => m.id !== row.id),
                        })
                      }
                    />
                  );
                })}
              </CappedNestedScroll>
            </View>
          )}
        </View>
      </CatalogSectionBoard>

      <BottomSheet
        open={sheet?.kind === 'core'}
        onClose={closeSheet}
        title={
          sheet?.kind === 'core'
            ? core.find((row) => row.key === sheet.key)?.name ?? t('mobile.newOrder.measurementValue')
            : t('mobile.newOrder.measurementValue')
        }
        fitContent
      >
        {sheet?.kind === 'core' ? (
          <MeasurementValuePanel
            active
            selected={coreField(line, sheet.key)}
            unit="cm"
            onSelect={(value) => {
              onChange(patchCore(line, sheet.key, value));
              closeSheet();
            }}
          />
        ) : null}
      </BottomSheet>

      <BottomSheet
        open={sheet?.kind === 'custom' || sheet?.kind === 'add'}
        onClose={closeSheet}
        title={
          sheet?.kind === 'add'
            ? t('mobile.newOrder.addMeasurement')
            : t('mobile.newOrder.measurementValue')
        }
        fitContent
      >
        <View style={{ gap: theme.spacing.md }}>
          {sheet?.kind === 'add' ? (
            <TextField
              label={t('mobile.newOrder.measurementLabel')}
              value={addLabel}
              onChangeText={setAddLabel}
              placeholder={t('mobile.newOrder.measurementLabelPlaceholder')}
            />
          ) : null}
          {sheet?.kind === 'custom' || sheet?.kind === 'add' ? (
            <MeasurementValuePanel
              active
              selected={sheet?.kind === 'custom' ? editingCustom?.value ?? '' : ''}
              unit={sheet?.kind === 'custom' ? editingCustom?.unit ?? 'cm' : 'cm'}
              onSelect={(value, unit) => {
                if (sheet.kind === 'add') {
                  const label = addLabel.trim();
                  if (!label) return;
                  const row: NewOrderCustomMeasurement = {
                    id: newMeasurementId(),
                    label,
                    value,
                    unit,
                  };
                  onChange({ ...line, customMeasurements: [...custom, row] });
                  closeSheet();
                  return;
                }
                onChange({
                  ...line,
                  customMeasurements: custom.map((row) =>
                    row.id === sheet.id ? { ...row, value, unit } : row,
                  ),
                });
                closeSheet();
              }}
            />
          ) : null}
        </View>
      </BottomSheet>
    </>
  );
}
