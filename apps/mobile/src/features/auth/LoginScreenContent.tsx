import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { LoginReveal } from '@/components/branding';
import type { BrandIntroState } from '@/hooks/useBrandIntroState';
import type { LoginColors } from './theme/loginColors';
import { LoginForm } from './components/LoginForm';

type FormProps = Omit<ComponentProps<typeof LoginForm>, 'motion' | 'colors'>;

type Props = {
  intro: BrandIntroState;
  colors: LoginColors;
  form: FormProps;
};

/**
 * Shared login form — username/password only (no email, no admin chrome).
 */
export function LoginScreenContent({ intro, colors, form }: Props) {
  const { shared } = intro;

  const formMotion = {
    formOpacity: shared.field0,
    formY: shared.field0Y,
    field0: shared.field0,
    field1: shared.field1,
    field2: shared.buttonOpacity,
  };

  return (
    <View
      style={styles.root}
      pointerEvents={intro.formInteractive ? 'auto' : 'none'}
    >
      <LoginReveal
        opacity={shared.field0}
        translateY={shared.field0Y}
        testID="login-form"
        pointerEvents={intro.formInteractive ? 'auto' : 'none'}
      >
        <LoginForm motion={formMotion} colors={colors} {...form} />
      </LoginReveal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    alignSelf: 'stretch',
    alignItems: 'stretch',
    paddingHorizontal: 20,
  },
});
