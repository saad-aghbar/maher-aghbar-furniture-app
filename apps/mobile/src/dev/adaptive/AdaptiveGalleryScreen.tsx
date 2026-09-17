import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { AdaptiveContainer } from '@/adaptive/AdaptiveContainer';
import { AdaptiveOverlay } from '@/adaptive/AdaptiveOverlay';
import { DataRow } from '@/adaptive/DataRow';
import { SplitPane, SplitPanePlaceholder } from '@/adaptive/SplitPane';
import { useMaherLayout } from '@/adaptive/useMaherLayout';
import { WindowMetricsOverride } from '@/adaptive/windowMetrics';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

const WIDTHS = [390, 820, 1024, 1440] as const;

function GalleryBody({
  overlayOpen,
  setOverlayOpen,
}: {
  overlayOpen: boolean;
  setOverlayOpen: (open: boolean) => void;
}) {
  const { t } = useLocale();
  const { colors, theme } = useTheme();
  const layout = useMaherLayout();

  return (
    <AdaptiveContainer padded testID="adaptive-gallery">
      <ScrollView contentContainerStyle={{ gap: theme.spacing.lg, paddingBottom: theme.spacing['3xl'] }}>
        <AppText variant="title" weight="semibold">
          {t('mobile.adaptive.galleryTitle')}
        </AppText>
        <AppText variant="body" color="secondary">
          {t('mobile.adaptive.galleryHint')}
        </AppText>
        <AppText testID="adaptive-gallery-class">{`${layout.windowClass} · ${layout.navigationMode} · ${layout.columnCapacity} col`}</AppText>

        <SplitPane
          testID="adaptive-gallery-split"
          split={layout.isDesk}
          primary={
            <View style={{ gap: theme.spacing.sm }}>
              <DataRow title="SO-1001" subtitle="Preparing" selected />
              <DataRow title="SO-1002" subtitle="In production" />
            </View>
          }
          detail={
            <View style={{ padding: theme.spacing.md, backgroundColor: colors.surface }}>
              <AppText>{t('mobile.adaptive.chooseOrderBody')}</AppText>
            </View>
          }
          detailPlaceholder={
            <SplitPanePlaceholder
              title={t('mobile.adaptive.chooseOrderTitle')}
              body={t('mobile.adaptive.chooseOrderBody')}
            />
          }
        />

        <PrimaryButton
          label={t('mobile.adaptive.intentConfirm')}
          onPress={() => setOverlayOpen(true)}
        />
        <AdaptiveOverlay
          open={overlayOpen}
          onClose={() => setOverlayOpen(false)}
          title={t('mobile.adaptive.intentConfirm')}
          intent="confirm"
          fitContent
        >
          <AppText>{t('mobile.adaptive.galleryHint')}</AppText>
        </AdaptiveOverlay>
      </ScrollView>
    </AdaptiveContainer>
  );
}

/**
 * Visual QA for window class, split pane, and overlay intents.
 * Route: `/dev/adaptive`
 */
export default function AdaptiveGalleryScreen() {
  const { theme, colors } = useTheme();
  const { setLocale, locale } = useLocale();
  const [width, setWidth] = useState<(typeof WIDTHS)[number]>(390);
  const [overlayOpen, setOverlayOpen] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.sm,
          padding: theme.spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        {WIDTHS.map((w) => (
          <SecondaryButton
            key={w}
            label={`${w}`}
            onPress={() => setWidth(w)}
          />
        ))}
        {(['en', 'ar', 'he'] as const).map((loc) => (
          <SecondaryButton
            key={loc}
            label={loc.toUpperCase()}
            onPress={() => setLocale(loc)}
          />
        ))}
        <AppText variant="caption">{locale}</AppText>
      </View>
      <WindowMetricsOverride value={{ width, height: width < 600 ? 844 : 1024 }}>
        <GalleryBody overlayOpen={overlayOpen} setOverlayOpen={setOverlayOpen} />
      </WindowMetricsOverride>
    </View>
  );
}
