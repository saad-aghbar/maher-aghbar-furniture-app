import { ActivityIndicator, Modal, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme';

type LoadingOverlayProps = {
  visible: boolean;
  message?: string;
};

export function LoadingOverlay({ visible, message }: LoadingOverlayProps) {
  const { colors, theme } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View
        accessibilityViewIsModal
        accessibilityLabel={message ?? 'Loading'}
        style={[styles.backdrop, { backgroundColor: colors.overlay }]}
      >
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: theme.radius.lg,
            padding: theme.spacing['2xl'],
            gap: theme.spacing.md,
            alignItems: 'center',
            minWidth: 120,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <ActivityIndicator color={colors.brand} size="large" />
          {message ? (
            <AppText variant="bodySecondary" color="secondary" align="center">
              {message}
            </AppText>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
