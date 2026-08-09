import { useCallback, useMemo, useState } from 'react';
import type { CameraOrientation } from 'expo-camera';

/** Degrees to rotate chrome/viewfinder so it stays upright relative to gravity. */
export function degreesForCameraOrientation(orientation: CameraOrientation): number {
  switch (orientation) {
    case 'landscapeLeft':
      return 90;
    case 'landscapeRight':
      return -90;
    case 'portraitUpsideDown':
      return 180;
    case 'portrait':
    default:
      return 0;
  }
}

type OrientationEvent =
  | { orientation: CameraOrientation }
  | { nativeEvent: { orientation: CameraOrientation } };

function readOrientation(event: OrientationEvent): CameraOrientation | null {
  if ('orientation' in event && typeof event.orientation === 'string') {
    return event.orientation;
  }
  if ('nativeEvent' in event && event.nativeEvent?.orientation) {
    return event.nativeEvent.orientation;
  }
  return null;
}

/**
 * Keeps camera capture + overlay aligned when the app is portrait-locked
 * but the phone is flipped / tilted (iOS `responsiveOrientationWhenOrientationLocked`).
 */
export function useResponsiveCameraOrientation() {
  const [orientation, setOrientation] = useState<CameraOrientation>('portrait');

  const onResponsiveOrientationChanged = useCallback((event: OrientationEvent) => {
    const next = readOrientation(event);
    if (next) setOrientation(next);
  }, []);

  const overlayRotation = useMemo(
    () => `${degreesForCameraOrientation(orientation)}deg`,
    [orientation],
  );

  const isLandscape =
    orientation === 'landscapeLeft' || orientation === 'landscapeRight';

  return {
    orientation,
    isLandscape,
    overlayRotation,
    cameraOrientationProps: {
      responsiveOrientationWhenOrientationLocked: true as const,
      onResponsiveOrientationChanged,
    },
  };
}
