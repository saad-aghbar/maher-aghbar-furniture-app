import { useMemo } from 'react';
import { RolesTouchBar } from '@/features/users/components/RolesTouchBar';
import { useLocale } from '@/i18n';

export const RECOVERY_OUTCOMES = ['RECOVER_TO_INVENTORY', 'DISPOSE', 'DAMAGED'] as const;
export type RecoveryOutcome = (typeof RECOVERY_OUTCOMES)[number];

type Props = {
  value: RecoveryOutcome;
  onChange: (outcome: RecoveryOutcome) => void;
};

/**
 * Recover / Dispose / Damaged — same wood bubble as the users role bar.
 */
export function RecoveryOutcomeTouchBar({ value, onChange }: Props) {
  const { t } = useLocale();
  const roles = useMemo(
    () =>
      RECOVERY_OUTCOMES.map((id) => ({
        id,
        label: t(`mobile.returns.recoveryOutcome.${id}`),
      })),
    [t],
  );

  return (
    <RolesTouchBar
      roles={roles}
      value={value}
      onChange={(id) => onChange(id as RecoveryOutcome)}
    />
  );
}
