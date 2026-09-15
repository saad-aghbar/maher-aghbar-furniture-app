/**
 * One physical Expo token belongs to at most one user.
 * Registering for B on a phone that still holds A's token must steal it.
 */
export function nextDeviceTokenBinding(input: {
  existingUserId: string | null;
  incomingUserId: string;
}): { action: 'create' | 'keep' | 'reassign'; previousUserId: string | null } {
  if (!input.existingUserId) {
    return { action: 'create', previousUserId: null };
  }
  if (input.existingUserId === input.incomingUserId) {
    return { action: 'keep', previousUserId: null };
  }
  return { action: 'reassign', previousUserId: input.existingUserId };
}

export function canReleaseDeviceToken(input: {
  tokenUserId: string | null;
  requesterUserId: string;
}): boolean {
  return Boolean(input.tokenUserId && input.tokenUserId === input.requesterUserId);
}

export function isDevicePushDeliverable(input: {
  userId: string;
  intendedUserId: string;
  pushEnabled: boolean;
  osPermission: string | null | undefined;
  disabledAt: Date | string | null | undefined;
  userMasterEnabled: boolean;
}): boolean {
  if (input.userId !== input.intendedUserId) return false;
  if (!input.userMasterEnabled) return false;
  if (!input.pushEnabled) return false;
  if (input.disabledAt) return false;
  if (input.osPermission && input.osPermission !== 'granted') return false;
  return true;
}
