import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import MapView, { Marker, type Region } from 'react-native-maps';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { useLocationMapVisibility } from '@/components/maps/LocationMapVisibility';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';

export type MapCoords = {
  latitude: number;
  longitude: number;
  /** Human-readable address from reverse geocode when available. */
  address?: string;
};

type LocationMapPickerProps = {
  open: boolean;
  initial?: MapCoords | null;
  onClose: () => void;
  onConfirm: (coords: MapCoords) => void;
  onClear?: () => void;
  /** Override title (defaults to delivery map title). */
  title?: string;
  hint?: string;
};

/** Ramallah / West Bank default frame. */
const DEFAULT_REGION: Region = {
  latitude: 31.9522,
  longitude: 35.2332,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

function regionFrom(coords: MapCoords): Region {
  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    latitudeDelta: 0.018,
    longitudeDelta: 0.018,
  };
}

function formatPlacemark(place: Location.LocationGeocodedAddress): string {
  const streetLine = [place.streetNumber, place.street].filter(Boolean).join(' ').trim();
  const parts = [
    place.name && place.name !== streetLine && place.name !== place.street ? place.name : null,
    streetLine || null,
    place.district,
    place.city,
    place.subregion,
    place.region,
    place.postalCode,
    place.country,
  ].filter((part): part is string => Boolean(part && String(part).trim()));
  const unique: string[] = [];
  for (const part of parts) {
    if (!unique.some((u) => u.toLowerCase() === part.toLowerCase())) unique.push(part);
  }
  return unique.join(', ');
}

async function reverseGeocodeLabel(coords: MapCoords): Promise<string> {
  try {
    const places = await Location.reverseGeocodeAsync({
      latitude: coords.latitude,
      longitude: coords.longitude,
    });
    const formatted = places[0] ? formatPlacemark(places[0]) : '';
    if (formatted.trim()) return formatted.trim();
  } catch {
    // Fall through to coordinate label.
  }
  return `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
}

function BrandMapPin({ active }: { active: boolean }) {
  const { colors, theme } = useTheme();
  const reduce = useReducedMotion();
  const drop = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reduce) {
      drop.value = 1;
      pulse.value = 0;
      return;
    }
    drop.value = 0;
    drop.value = withSpring(1, { damping: 12, stiffness: 220 });
    pulse.value = withDelay(
      200,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }),
          withTiming(0, { duration: 0 }),
        ),
        -1,
        false,
      ),
    );
  }, [active, drop, pulse, reduce]);

  const pinStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(drop.value, [0, 1], [-18, 0]) },
      { scale: interpolate(drop.value, [0, 0.7, 1], [0.6, 1.12, 1]) },
    ],
    opacity: interpolate(drop.value, [0, 1], [0.4, 1]),
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.35, 0]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.55, 1.85]) }],
  }));

  return (
    <View style={{ alignItems: 'center', width: 48, height: 56 }}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            bottom: 4,
            width: 28,
            height: 28,
            borderRadius: 14,
            borderWidth: 2,
            borderColor: colors.brand,
            backgroundColor: colors.brandSoft,
          },
          ringStyle,
        ]}
      />
      <Animated.View style={[{ alignItems: 'center' }, pinStyle]}>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: colors.brand,
            borderWidth: 2,
            borderColor: colors.onBrand,
            alignItems: 'center',
            justifyContent: 'center',
            ...theme.elevation.raised,
          }}
        >
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: colors.onBrand,
            }}
          />
        </View>
        <View
          style={{
            width: 0,
            height: 0,
            marginTop: -2,
            borderLeftWidth: 7,
            borderRightWidth: 7,
            borderTopWidth: 10,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderTopColor: colors.brand,
          }}
        />
      </Animated.View>
    </View>
  );
}

/**
 * Full-screen aesthetic map pin picker — brand pin, pulse, floor chrome.
 */
export function LocationMapPicker({
  open,
  initial,
  onClose,
  onConfirm,
  onClear,
  title,
  hint,
}: LocationMapPickerProps) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const { setOpen: setMapVisible } = useLocationMapVisibility();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const [coords, setCoords] = useState<MapCoords | null>(initial ?? null);
  const [region, setRegion] = useState<Region>(
    initial ? regionFrom(initial) : DEFAULT_REGION,
  );
  const [busy, setBusy] = useState(false);
  const [mapAvailable, setMapAvailable] = useState(true);
  const [pinKey, setPinKey] = useState(0);
  /** Delayed so host BottomSheet Modal can yield first (iOS nested-Modal race). */
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    if (!open) {
      setModalVisible(false);
      setMapVisible(false);
      return;
    }
    setMapVisible(true);
    const t = setTimeout(() => setModalVisible(true), 60);
    return () => clearTimeout(t);
  }, [open, setMapVisible]);

  useEffect(() => {
    if (!open) return;
    setCoords(initial ?? null);
    setRegion(initial ? regionFrom(initial) : DEFAULT_REGION);
    setPinKey((k) => k + 1);
  }, [open, initial]);

  const dropPin = useCallback((next: MapCoords) => {
    setCoords(next);
    setPinKey((k) => k + 1);
    void haptics.selection();
  }, []);

  const requestPermission = useCallback(async () => {
    const current = await Location.getForegroundPermissionsAsync();
    if (current.granted) return true;
    const asked = await Location.requestForegroundPermissionsAsync();
    if (!asked.granted) {
      Alert.alert(
        t('mobile.newOrder.locationPermissionTitle'),
        t('mobile.newOrder.locationPermissionBody'),
      );
      return false;
    }
    return true;
  }, [t]);

  const locateCurrent = useCallback(async () => {
    setBusy(true);
    try {
      const ok = await requestPermission();
      if (!ok) return;
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const next = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };
      dropPin(next);
      setRegion(regionFrom(next));
    } catch {
      Alert.alert(
        t('mobile.newOrder.locationErrorTitle'),
        t('mobile.newOrder.locationErrorBody'),
      );
    } finally {
      setBusy(false);
    }
  }, [dropPin, requestPermission, t]);

  return (
    <Modal
      visible={modalVisible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Map fills the screen */}
        <View style={{ flex: 1 }}>
          {mapAvailable ? (
            <MapView
              style={{ flex: 1 }}
              region={region}
              onRegionChangeComplete={setRegion}
              onPress={(e) => {
                const { latitude, longitude } = e.nativeEvent.coordinate;
                dropPin({ latitude, longitude });
              }}
              onMapReady={() => setMapAvailable(true)}
              showsUserLocation
              showsCompass={false}
              showsPointsOfInterest={false}
              userInterfaceStyle={colorScheme}
            >
              {coords ? (
                <Marker
                  key={pinKey}
                  coordinate={coords}
                  draggable
                  anchor={{ x: 0.5, y: 1 }}
                  onDragEnd={(e) => {
                    const { latitude, longitude } = e.nativeEvent.coordinate;
                    dropPin({ latitude, longitude });
                  }}
                >
                  <BrandMapPin active />
                </Marker>
              ) : null}
            </MapView>
          ) : (
            <View
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                padding: theme.spacing.xl,
                gap: theme.spacing.md,
                backgroundColor: colors.surfaceSecondary,
              }}
            >
              <AppText variant="body" color="secondary" align="center">
                {t('mobile.newOrder.mapUnavailableHint')}
              </AppText>
              {coords ? (
                <AppText variant="caption" color="muted" align="center">
                  {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
                </AppText>
              ) : null}
            </View>
          )}

          {busy ? (
            <View
              style={{
                ...StyleSheetAbsoluteFill,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(30,26,27,0.18)',
              }}
            >
              <ActivityIndicator color={colors.brand} size="large" />
            </View>
          ) : null}
        </View>

        {/* Top chrome */}
        <Animated.View
          entering={reduce ? undefined : FadeIn.duration(280)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            paddingTop: insets.top + theme.spacing.sm,
            paddingHorizontal: theme.spacing.lg,
            paddingBottom: theme.spacing.md,
          }}
        >
          <View
            style={{
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              backgroundColor: colors.surface,
              paddingHorizontal: theme.spacing.lg,
              paddingVertical: theme.spacing.md,
              gap: theme.spacing.xs,
              ...orderBoardShadow(colorScheme),
            }}
          >
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: theme.spacing.sm,
              }}
            >
              <AppText
                variant="heading"
                weight={titleWeight}
                style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}
              >
                {title ?? t('mobile.newOrder.mapPickerTitle')}
              </AppText>
              <AnimatedPressable
                variant="button"
                accessibilityRole="button"
                accessibilityLabel={t('mobile.newOrder.closeMap')}
                onPress={onClose}
                style={{
                  minHeight: 36,
                  paddingHorizontal: theme.spacing.md,
                  borderRadius: theme.radius.xl,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.surfaceSecondary,
                }}
              >
                <AppText variant="caption" weight="semibold" color="brand">
                  {t('mobile.newOrder.closeMap')}
                </AppText>
              </AnimatedPressable>
            </View>
            <AppText
              variant="caption"
              color="muted"
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {hint ??
                (mapAvailable
                  ? t('mobile.newOrder.mapPickerHint')
                  : t('mobile.newOrder.mapUnavailableHint'))}
            </AppText>
          </View>
        </Animated.View>

        {/* Bottom actions */}
        <Animated.View
          entering={reduce ? undefined : FadeInDown.duration(320).delay(80)}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.md,
            paddingBottom: Math.max(insets.bottom, theme.spacing.md) + theme.spacing.sm,
          }}
        >
          <View
            style={{
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              backgroundColor: colors.surface,
              padding: theme.spacing.lg,
              gap: theme.spacing.sm,
              ...orderBoardShadow(colorScheme),
            }}
          >
            {coords ? (
              <AppText
                variant="caption"
                color="muted"
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {t('mobile.newOrder.coordsLabel', {
                  lat: coords.latitude.toFixed(5),
                  lng: coords.longitude.toFixed(5),
                })}
              </AppText>
            ) : (
              <AppText
                variant="caption"
                color="muted"
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {t('mobile.newOrder.locationRequiredBody')}
              </AppText>
            )}

            <SecondaryButton
              label={t('mobile.newOrder.useCurrentLocation')}
              onPress={() => void locateCurrent()}
              loading={busy}
              style={{ borderRadius: theme.radius.xl }}
            />

            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                gap: theme.spacing.sm,
              }}
            >
              {onClear && (coords || initial) ? (
                <SecondaryButton
                  label={t('mobile.newOrder.clearLocation')}
                  onPress={() => {
                    setCoords(null);
                    onClear();
                    void haptics.selection();
                  }}
                  style={{ flex: 1, borderRadius: theme.radius.xl }}
                />
              ) : null}
              <PrimaryButton
                label={t('mobile.newOrder.confirmLocation')}
                loading={busy}
                onPress={() => {
                  if (!coords) {
                    Alert.alert(
                      t('mobile.newOrder.locationRequiredTitle'),
                      t('mobile.newOrder.locationRequiredBody'),
                    );
                    return;
                  }
                  void (async () => {
                    setBusy(true);
                    try {
                      const address = await reverseGeocodeLabel(coords);
                      onConfirm({ ...coords, address });
                      void haptics.confirmMedium();
                    } finally {
                      setBusy(false);
                    }
                  })();
                }}
                style={{ flex: 1, borderRadius: theme.radius.xl }}
              />
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const StyleSheetAbsoluteFill = {
  position: 'absolute' as const,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};
