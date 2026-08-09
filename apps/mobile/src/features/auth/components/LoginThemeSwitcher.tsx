import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import type { LoginColors } from '../theme/loginColors';

type Props = {
  colors: LoginColors;
};

/** Login chrome — shared sun/moon control with login palette. */
export function LoginThemeSwitcher({ colors }: Props) {
  return (
    <ThemeSwitcher
      borderColor={colors.chromeBorder}
      backgroundColor={colors.chromeBg}
      glowColor={colors.brandGoldSoft}
      iconColor={undefined}
    />
  );
}
