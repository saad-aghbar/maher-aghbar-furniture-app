import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { useResponsiveCameraOrientation } from '@/components/camera/useResponsiveCameraOrientation';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

const CODE_TYPES = [
  'qr',
  'ean13',
  'ean8',
  'upc_a',
  'upc_e',
  'code128',
  'code39',
  'code93',
  'itf14',
  'codabar',
] as const;

const DEV_SIMULATE =
  typeof __DEV__ !== 'undefined' && __DEV__;

type CodeScannerScreenProps = {
  title?: string;
  hint?: string;
  onConfirm: (code: string) => void;
  onCancel: () => void;
};

/**
 * Themed full-bleed camera: live preview → capture → confirm / rescan.
 */
export function CodeScannerScreen({
  title,
  hint,
  onConfirm,
  onCancel,
}: CodeScannerScreenProps) {
  const { t } = useLocale();
  const { colors, theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [devCode, setDevCode] = useState('');
  const lockRef = useRef(false);
  const { overlayRotation, cameraOrientationProps } = useResponsiveCameraOrientation();

  const ink = '#1E1A1B';
  const cream = '#F5F1EA';
  const creamMuted = 'rgba(245, 241, 234, 0.72)';

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  const onBarcode = useCallback((result: BarcodeScanningResult) => {
    if (lockRef.current) return;
    const raw = result.data?.trim();
    if (!raw) return;
    lockRef.current = true;
    setTorch(false);
    setScannedCode(raw);
  }, []);

  const rescan = useCallback(() => {
    lockRef.current = false;
    setScannedCode(null);
  }, []);

  const heading = title ?? t('mobile.scan.title');
  const sub = hint ?? t('mobile.scan.hint');

  return (
    <View style={[styles.root, { backgroundColor: ink }]}>
      {permission?.granted ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch && !scannedCode}
          barcodeScannerSettings={{ barcodeTypes: [...CODE_TYPES] }}
          onBarcodeScanned={scannedCode ? undefined : onBarcode}
          {...cameraOrientationProps}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.permFallback, { backgroundColor: ink }]}>
          <AppText variant="title" style={{ color: cream, textAlign: 'center' }}>
            {t('mobile.scan.permissionTitle')}
          </AppText>
          <AppText
            variant="body"
            color="secondary"
            style={{ color: creamMuted, textAlign: 'center', marginTop: theme.spacing.sm }}
          >
            {t('mobile.scan.permissionBody')}
          </AppText>
          <PrimaryButton
            label={t('mobile.scan.allowCamera')}
            onPress={() => void requestPermission()}
            style={{ marginTop: theme.spacing.lg, alignSelf: 'stretch' }}
          />
        </View>
      )}

      {/* Brand atmosphere wash */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.wash]} />

      <View
        style={[
          styles.chrome,
          {
            paddingTop: insets.top + theme.spacing.sm,
            paddingBottom: insets.bottom + theme.spacing.lg,
            paddingHorizontal: theme.spacing.lg,
          },
        ]}
      >
        <View style={styles.topRow}>
          <Pressable
            onPress={onCancel}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('mobile.scan.cancel')}
            style={[
              styles.chip,
              { backgroundColor: 'rgba(28, 25, 23, 0.72)', borderColor: 'rgba(245, 240, 232, 0.22)' },
            ]}
          >
            <AppText variant="label" style={{ color: cream }}>
              {t('mobile.scan.cancel')}
            </AppText>
          </Pressable>

          {permission?.granted && !scannedCode ? (
            <Pressable
              onPress={() => setTorch((v) => !v)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={torch ? t('mobile.scan.torchOff') : t('mobile.scan.torchOn')}
              style={[
                styles.chip,
                {
                  backgroundColor: torch ? colors.brand : 'rgba(28, 25, 23, 0.72)',
                  borderColor: torch ? colors.brand : 'rgba(245, 240, 232, 0.22)',
                },
              ]}
            >
              <AppText variant="label" style={{ color: cream }}>
                {torch ? t('mobile.scan.torchOff') : t('mobile.scan.torchOn')}
              </AppText>
            </Pressable>
          ) : (
            <View style={{ width: 72 }} />
          )}
        </View>

        <View style={styles.mid}>
          <View style={{ transform: [{ rotate: overlayRotation }], alignItems: 'center', width: '100%' }}>
            <AppText
              variant="display"
              style={{
                color: cream,
                textAlign: 'center',
                alignSelf: 'stretch',
                fontSize: 28,
                letterSpacing: 0.4,
              }}
            >
              {heading}
            </AppText>

            {!scannedCode ? (
              <>
                <AppText
                  variant="body"
                  style={{
                    color: creamMuted,
                    textAlign: 'center',
                    alignSelf: 'stretch',
                    marginTop: theme.spacing.sm,
                  }}
                >
                  {sub}
                </AppText>
                <View style={styles.viewfinderWrap}>
                  <View style={[styles.viewfinder, { borderColor: cream }]}>
                    <View style={[styles.corner, styles.tl, { borderColor: colors.brand }]} />
                    <View style={[styles.corner, styles.tr, { borderColor: colors.brand }]} />
                    <View style={[styles.corner, styles.bl, { borderColor: colors.brand }]} />
                    <View style={[styles.corner, styles.br, { borderColor: colors.brand }]} />
                    <View style={[styles.scanLine, { backgroundColor: colors.brand }]} />
                  </View>
                  <AppText
                    variant="caption"
                    style={{ color: creamMuted, marginTop: theme.spacing.md, textAlign: 'center' }}
                  >
                    {t('mobile.scan.scanning')}
                  </AppText>
                </View>
                {DEV_SIMULATE ? (
                  <View style={{ marginTop: theme.spacing.lg, width: '100%', gap: theme.spacing.sm }}>
                    <AppText
                      variant="caption"
                      style={{ color: creamMuted, textAlign: 'center', alignSelf: 'stretch' }}
                    >
                      {t('mobile.scan.devSimulateHint')}
                    </AppText>
                    <TextInput
                      value={devCode}
                      onChangeText={setDevCode}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      placeholder={t('mobile.scan.devSimulatePlaceholder')}
                      placeholderTextColor="rgba(245,241,234,0.35)"
                      style={{
                        borderWidth: 1,
                        borderColor: 'rgba(245,240,232,0.28)',
                        borderRadius: 12,
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                        color: cream,
                        backgroundColor: 'rgba(28,25,23,0.55)',
                        fontVariant: ['tabular-nums'],
                      }}
                      onSubmitEditing={() => {
                        const raw = devCode.trim();
                        if (!raw) return;
                        lockRef.current = true;
                        setTorch(false);
                        setScannedCode(raw);
                      }}
                    />
                    <SecondaryButton
                      label={t('mobile.scan.devSimulate')}
                      onPress={() => {
                        const raw = devCode.trim();
                        if (!raw) return;
                        lockRef.current = true;
                        setTorch(false);
                        setScannedCode(raw);
                      }}
                      style={{ alignSelf: 'stretch' }}
                    />
                  </View>
                ) : null}
              </>
            ) : (
              <View
                style={[
                  styles.resultCard,
                  {
                    backgroundColor: 'rgba(245, 240, 232, 0.94)',
                    borderColor: colors.brand,
                    marginTop: theme.spacing.xl,
                  },
                ]}
              >
                <AppText
                  variant="caption"
                  color="secondary"
                  style={{ marginBottom: theme.spacing.sm, textAlign: 'center', alignSelf: 'stretch' }}
                >
                  {t('mobile.scan.scannedLabel')}
                </AppText>
                <AppText
                  variant="title"
                  style={{
                    color: ink,
                    textAlign: 'center',
                    alignSelf: 'stretch',
                    fontVariant: ['tabular-nums'],
                  }}
                  numberOfLines={4}
                >
                  {scannedCode}
                </AppText>
              </View>
            )}
          </View>
        </View>

        {scannedCode ? (
          <View style={[styles.actions, { gap: theme.spacing.sm }]}>
            <SecondaryButton
              label={t('mobile.scan.rescan')}
              onPress={rescan}
              style={{ flex: 1 }}
            />
            <PrimaryButton
              label={t('mobile.scan.useCode')}
              onPress={() => onConfirm(scannedCode)}
              style={{ flex: 1 }}
            />
          </View>
        ) : (
          <View style={{ height: 48 }} />
        )}
      </View>
    </View>
  );
}

const VF = 248;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  wash: {
    backgroundColor: 'rgba(28, 25, 23, 0.12)',
  },
  chrome: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  mid: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  viewfinderWrap: {
    marginTop: 28,
    alignItems: 'center',
    alignSelf: 'center',
  },
  viewfinder: {
    width: VF,
    height: VF,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderWidth: 3,
  },
  tl: { top: 10, left: 10, borderTopWidth: 3, borderLeftWidth: 3, borderRightWidth: 0, borderBottomWidth: 0 },
  tr: { top: 10, right: 10, borderTopWidth: 3, borderRightWidth: 3, borderLeftWidth: 0, borderBottomWidth: 0 },
  bl: { bottom: 10, left: 10, borderBottomWidth: 3, borderLeftWidth: 3, borderRightWidth: 0, borderTopWidth: 0 },
  br: { bottom: 10, right: 10, borderBottomWidth: 3, borderRightWidth: 3, borderLeftWidth: 0, borderTopWidth: 0 },
  scanLine: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: '46%',
    height: 2,
    opacity: 0.85,
    borderRadius: 1,
  },
  resultCard: {
    width: '100%',
    maxWidth: 340,
    alignSelf: 'center',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1.5,
    paddingVertical: 20,
    paddingHorizontal: 18,
  },
  actions: {
    flexDirection: 'row',
    width: '100%',
    alignSelf: 'center',
  },
  permFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
});
