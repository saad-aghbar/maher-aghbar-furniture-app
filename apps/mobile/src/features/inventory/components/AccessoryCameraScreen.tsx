import { CameraView, useCameraPermissions } from 'expo-camera';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { useResponsiveCameraOrientation } from '@/components/camera/useResponsiveCameraOrientation';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  title?: string;
  hint?: string;
  /** Width ÷ height for the viewfinder. Defaults to 4/3. */
  aspectRatio?: number;
  onConfirm: (uri: string) => void;
  onCancel: () => void;
};

/**
 * Branded full-bleed accessory camera: live preview → shutter → review → use / retake.
 * Stays upright in portrait when the phone is flipped (portrait-locked app).
 */
export function AccessoryCameraScreen({
  title,
  hint,
  aspectRatio = 4 / 3,
  onConfirm,
  onCancel,
}: Props) {
  const { t, locale } = useLocale();
  const { colors, theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowW, height: windowH } = useWindowDimensions();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [mountError, setMountError] = useState(false);
  const { isLandscape, overlayRotation, cameraOrientationProps } =
    useResponsiveCameraOrientation();

  const ink = '#1E1A1B';
  const cream = '#F5F1EA';
  const creamMuted = 'rgba(245, 241, 234, 0.72)';

  const ratio = Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 4 / 3;
  const maxFrameW = Math.min(windowW - theme.spacing.lg * 2, windowW * 0.92);
  const maxFrameH = windowH * 0.48;
  let frameW = isLandscape ? Math.min(maxFrameH * ratio, maxFrameW) : maxFrameW;
  let frameH = frameW / ratio;
  if (!isLandscape && frameH > maxFrameH) {
    frameH = maxFrameH;
    frameW = frameH * ratio;
  }
  if (isLandscape && frameH > maxFrameW) {
    frameH = maxFrameW;
    frameW = frameH * ratio;
  }

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  const retake = useCallback(() => {
    setPreviewUri(null);
    setTorch(false);
    setCameraReady(false);
  }, []);

  const capture = useCallback(async () => {
    if (busy || previewUri || !cameraRef.current || !cameraReady) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: false,
      });
      if (!photo?.uri) return;
      void haptics.confirmMedium();
      setTorch(false);
      setPreviewUri(photo.uri);
    } catch {
      void haptics.error();
    } finally {
      setBusy(false);
    }
  }, [busy, previewUri, cameraReady]);

  const heading = title ?? t('mobile.inventory.accessoryPhoto');
  const sub = hint ?? t('mobile.inventory.accessoryPhotoHint');

  return (
    <View style={[styles.root, { backgroundColor: ink }]}>
      {permission?.granted && !previewUri && !mountError ? (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
          mode="picture"
          onCameraReady={() => setCameraReady(true)}
          onMountError={() => {
            setMountError(true);
            setCameraReady(false);
          }}
          {...cameraOrientationProps}
        />
      ) : null}

      {previewUri ? (
        <Image
          source={{ uri: previewUri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      ) : null}

      {!permission?.granted ? (
        <View style={[StyleSheet.absoluteFill, styles.permFallback, { backgroundColor: ink }]}>
          <AppText variant="title" style={{ color: cream, textAlign: 'center' }}>
            {t('mobile.scan.permissionTitle')}
          </AppText>
          <AppText
            variant="body"
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
      ) : null}

      {mountError && permission?.granted && !previewUri ? (
        <View style={[StyleSheet.absoluteFill, styles.permFallback, { backgroundColor: ink }]}>
          <AppText variant="title" style={{ color: cream, textAlign: 'center' }}>
            {t('mobile.returns.cameraUnavailableTitle')}
          </AppText>
          <AppText
            variant="body"
            style={{ color: creamMuted, textAlign: 'center', marginTop: theme.spacing.sm }}
          >
            {t('mobile.returns.cameraUnavailable')}
          </AppText>
          <PrimaryButton
            label={t('mobile.inventory.cancel')}
            onPress={onCancel}
            style={{ marginTop: theme.spacing.lg, alignSelf: 'stretch' }}
          />
        </View>
      ) : null}

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
            accessibilityLabel={t('mobile.inventory.cancel')}
            style={[
              styles.chip,
              { backgroundColor: 'rgba(28, 25, 23, 0.72)', borderColor: 'rgba(245, 240, 232, 0.22)' },
            ]}
          >
            <AppText variant="label" style={{ color: cream }}>
              {t('mobile.inventory.cancel')}
            </AppText>
          </Pressable>

          {permission?.granted && !previewUri ? (
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
          <View style={{ transform: [{ rotate: overlayRotation }], alignItems: 'center' }}>
            <AppText
              variant="title"
              weight={locale === 'ar' ? 'medium' : 'semibold'}
              style={{
                color: cream,
                textAlign: 'center',
                alignSelf: 'stretch',
                marginBottom: theme.spacing.xs,
              }}
            >
              {heading}
            </AppText>
            <AppText
              variant="body"
              style={{
                color: creamMuted,
                textAlign: 'center',
                alignSelf: 'stretch',
                marginBottom: theme.spacing.lg,
                paddingHorizontal: theme.spacing.sm,
              }}
            >
              {sub}
            </AppText>

            {!previewUri && permission?.granted && !mountError ? (
              <View
                style={[
                  styles.viewfinder,
                  {
                    width: frameW,
                    height: frameH,
                    borderColor: 'rgba(245, 241, 234, 0.4)',
                  },
                ]}
              >
                <View style={[styles.corner, styles.tl, { borderColor: colors.brand }]} />
                <View style={[styles.corner, styles.tr, { borderColor: colors.brand }]} />
                <View style={[styles.corner, styles.bl, { borderColor: colors.brand }]} />
                <View style={[styles.corner, styles.br, { borderColor: colors.brand }]} />
              </View>
            ) : null}
          </View>
        </View>

        {previewUri ? (
          <View style={[styles.actions, { gap: theme.spacing.sm }]}>
            <SecondaryButton
              label={t('mobile.scan.rescan')}
              onPress={retake}
              style={{ flex: 1 }}
            />
            <PrimaryButton
              label={t('mobile.inventory.confirm')}
              onPress={() => onConfirm(previewUri)}
              style={{ flex: 1 }}
            />
          </View>
        ) : permission?.granted && !mountError ? (
          <View style={[styles.shutterRow, { transform: [{ rotate: overlayRotation }] }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('mobile.inventory.takePhoto')}
              disabled={busy || !cameraReady}
              onPress={() => void capture()}
              style={[
                styles.shutterOuter,
                {
                  borderColor: cream,
                  opacity: busy || !cameraReady ? 0.55 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.shutterInner,
                  { backgroundColor: busy ? creamMuted : cream },
                ]}
              />
            </Pressable>
          </View>
        ) : (
          <View style={{ height: 72 }} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  wash: {
    backgroundColor: 'rgba(28, 25, 23, 0.18)',
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
  },
  viewfinder: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'transparent',
  },
  corner: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderWidth: 3,
  },
  tl: {
    top: 14,
    left: 14,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  tr: {
    top: 14,
    right: 14,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bl: {
    bottom: 14,
    left: 14,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  br: {
    bottom: 14,
    right: 14,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  shutterRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 8,
  },
  shutterOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(28, 25, 23, 0.35)',
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
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
