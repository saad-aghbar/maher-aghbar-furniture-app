import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FadeIn, SlideIn, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { ToastCard } from './ToastCard';
import {
  dismissToast,
  enqueueToast,
  peekToast,
  type ShowToastInput,
  type ToastItem,
} from './toastQueue';

type ToastContextValue = {
  showToast: (input: ShowToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function ToastHost({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const t = setTimeout(() => onDismiss(item.id), item.durationMs);
    return () => clearTimeout(t);
  }, [item.durationMs, item.id, onDismiss]);

  useEffect(() => {
    if (item.variant === 'error') void haptics.error();
    else if (item.variant === 'success') void haptics.confirmLight();
    else void haptics.selection();
  }, [item.id, item.variant]);

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.host,
        {
          top: insets.top + theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
        },
      ]}
    >
      <SlideIn direction="down">
        <FadeIn>
          <ToastCard
            variant={item.variant}
            message={item.message}
            durationMs={item.durationMs}
            onPress={() => onDismiss(item.id)}
          />
        </FadeIn>
      </SlideIn>
    </View>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<ToastItem[]>([]);

  const showToast = useCallback((input: ShowToastInput) => {
    setQueue((q) => enqueueToast(q, input));
  }, []);

  const onDismiss = useCallback((id: string) => {
    setQueue((q) => dismissToast(q, id));
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);
  const current = peekToast(queue);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {current ? <ToastHost item={current} onDismiss={onDismiss} /> : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 1000,
  },
});
