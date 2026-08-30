import { Component, type ErrorInfo, type ReactNode } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { useTheme } from '@/theme';

type Props = {
  componentName: string;
  children: ReactNode;
  onRetry?: () => void;
};

type State = { error: Error | null };

/** Isolates a broken preview so the lab hub stays usable. */
export class PreviewErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    if (__DEV__) {
      console.warn('[DevComponentLab] preview failed', this.props.componentName, error, info);
    }
  }

  override render() {
    if (this.state.error) {
      return (
        <PreviewErrorFallback
          componentName={this.props.componentName}
          message={this.state.error.message}
          onRetry={() => {
            this.setState({ error: null });
            this.props.onRetry?.();
          }}
        />
      );
    }
    return this.props.children;
  }
}

function PreviewErrorFallback({
  componentName,
  message,
  onRetry,
}: {
  componentName: string;
  message: string;
  onRetry: () => void;
}) {
  const { colors, theme } = useTheme();
  return (
    <View
      style={{
        padding: theme.spacing.md,
        borderRadius: theme.radius.lg,
        backgroundColor: colors.errorSoft,
        gap: theme.spacing.sm,
      }}
    >
      <AppText variant="label" weight="semibold" style={{ color: colors.error }}>
        Component preview failed
      </AppText>
      <AppText variant="caption" color="secondary">
        {componentName}
      </AppText>
      <AppText variant="caption" color="secondary">
        {message}
      </AppText>
      <SecondaryButton label="Retry" onPress={onRetry} />
    </View>
  );
}
