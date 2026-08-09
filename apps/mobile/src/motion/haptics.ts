import * as Haptics from 'expo-haptics';

async function safe(run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch {
    // Web / unsupported platforms — no-op
  }
}

/** Selection change (chips, tabs, toggles). */
export function selection(): Promise<void> {
  return safe(() => Haptics.selectionAsync());
}

/** Light confirmation (minor success). */
export function confirmLight(): Promise<void> {
  return safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

/** Medium confirmation (save, primary action). */
export function confirmMedium(): Promise<void> {
  return safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

/** Strong feedback for completed tasks. */
export function completeStrong(): Promise<void> {
  return safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/** Error / invalid form. */
export function error(): Promise<void> {
  return safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
}

export const haptics = {
  selection,
  confirmLight,
  confirmMedium,
  completeStrong,
  error,
};
