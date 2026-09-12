import { ScrollView, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { CostPressableRow } from '@/features/reports/components/CostPressableRow';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import {
  SCAN_REVIEW_FIELDS,
  scanLineNeedsConfirm,
  scanReviewCanConfirm,
  type ScanReviewFieldKey,
  type ScanReviewLine,
} from './scanReview';

type Props = {
  open: boolean;
  lines: ScanReviewLine[];
  onChange: (next: ScanReviewLine[]) => void;
  onConfirm: () => void;
  onClose: () => void;
  onOpenCrop: () => void;
};

const FIELD_LABEL: Record<ScanReviewFieldKey, string> = {
  productName: 'mobile.newOrder.modelName',
  quantity: 'mobile.adminRequest.qty',
  width: 'mobile.adminRequest.dimensions',
  height: 'mobile.adminRequest.dimensions',
  depth: 'mobile.adminRequest.dimensions',
  fabricType: 'mobile.newOrder.fabricName',
  woodColor: 'mobile.adminRequest.woodColor',
  foamDensity: 'mobile.adminRequest.foamDensity',
  woodType: 'mobile.adminRequest.woodType',
  finish: 'mobile.adminRequest.finish',
  orientation: 'mobile.adminRequest.orientation',
  notes: 'mobile.adminRequest.itemNotes',
};

export function ScanReviewScreen({
  open,
  lines,
  onChange,
  onConfirm,
  onClose,
  onOpenCrop,
}: Props) {
  const { t, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const canConfirm = scanReviewCanConfirm(lines);

  const patch = (id: string, next: Partial<ScanReviewLine>, field?: string) => {
    onChange(
      lines.map((line) => {
        if (line.id !== id) return line;
        const merged = { ...line, ...next };
        if (field && !merged.confirmedFields.includes(field)) {
          merged.confirmedFields = [...merged.confirmedFields, field];
        }
        return merged;
      }),
    );
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.newOrder.scanReview')}
      fitContent
      overlay={false}
    >
      <ScrollView
        testID="scan-review-sheet"
        contentContainerStyle={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.lg }}
        keyboardShouldPersistTaps="handled"
      >
        <AnimatedPressable
          variant="button"
          accessibilityRole="button"
          accessibilityLabel={t('mobile.newOrder.cropPreview')}
          testID="scan-review-crop"
          onPress={() => {
            void haptics.selection();
            onOpenCrop();
          }}
        >
          <AppText color="brand">{t('mobile.newOrder.cropPreview')}</AppText>
        </AnimatedPressable>
        {lines.map((line, index) => {
          const pending = scanLineNeedsConfirm(line);
          return (
            <DealerBoard
              key={line.id}
              title={`${index + 1}. ${line.productName || t('mobile.newOrder.untitledModel')}`}
              titleWeight={titleWeight}
              accentColor={pending ? colors.warning : colors.brand}
            >
              <View style={{ gap: theme.spacing.sm }}>
                {SCAN_REVIEW_FIELDS.map((field) => {
                  const low = line.lowConfidenceFields.includes(field);
                  const confirmed = line.confirmedFields.includes(field);
                  const value = String(line[field] ?? '');
                  return (
                    <View key={field} style={{ gap: theme.spacing.xs }}>
                      <TextField
                        label={`${t(FIELD_LABEL[field])}${field === 'width' ? ' W' : field === 'height' ? ' H' : field === 'depth' ? ' D' : ''}`}
                        value={value}
                        onChangeText={(text) => {
                          patch(line.id, { [field]: text } as Partial<ScanReviewLine>, field);
                        }}
                      />
                      {low ? (
                        <CostPressableRow
                          testID={`scan-confirm-${line.id}-${field}`}
                          accessibilityLabel={t('mobile.newOrder.confirmField')}
                          onPress={() => patch(line.id, {}, field)}
                        >
                          <AppText variant="caption" color={confirmed ? 'success' : 'warning'}>
                            {confirmed
                              ? t('mobile.newOrder.fieldConfirmed')
                              : t('mobile.newOrder.lowConfidence')}
                          </AppText>
                        </CostPressableRow>
                      ) : null}
                    </View>
                  );
                })}
                {line.unrecognizedOptions.length ? (
                  <View style={{ gap: theme.spacing.xs }}>
                    <AppText variant="caption" color="warning">
                      {t('mobile.newOrder.unrecognizedOption')}
                    </AppText>
                    {line.unrecognizedOptions.map((row) => (
                      <AppText key={row} variant="caption">
                        {row}
                      </AppText>
                    ))}
                    <CostPressableRow
                      testID={`scan-note-unrecognized-${line.id}`}
                      accessibilityLabel={t('mobile.newOrder.noteUnrecognized')}
                      onPress={() => patch(line.id, { unrecognizedNoted: true })}
                    >
                      <AppText color={line.unrecognizedNoted ? 'success' : 'warning'}>
                        {t('mobile.newOrder.noteUnrecognized')}
                      </AppText>
                    </CostPressableRow>
                  </View>
                ) : null}
              </View>
            </DealerBoard>
          );
        })}
        <AnimatedPressable
          variant="button"
          accessibilityRole="button"
          accessibilityLabel={t('mobile.newOrder.scanConfirm')}
          testID="scan-review-confirm"
          disabled={!canConfirm}
          onPress={() => {
            if (!canConfirm) return;
            void haptics.confirmMedium();
            onConfirm();
          }}
          style={{
            minHeight: theme.sizes.touch.min,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: theme.radius.xl,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            backgroundColor: canConfirm ? colors.brand : colors.surfaceSecondary,
            opacity: canConfirm ? 1 : 0.5,
          }}
        >
          <AppText weight={titleWeight} color={canConfirm ? 'onBrand' : 'muted'}>
            {t('mobile.newOrder.scanConfirm')}
          </AppText>
        </AnimatedPressable>
      </ScrollView>
    </BottomSheet>
  );
}
