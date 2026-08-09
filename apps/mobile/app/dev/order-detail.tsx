import { useState } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { OrderDetailScreen } from '@/features/sales-orders/OrderDetailScreen';
import type { OrdersListVariant } from '@/features/sales-orders/selectOrderCard';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

type GalleryState = 'loading' | 'error' | 'offline' | 'success';

const STATES: GalleryState[] = ['success', 'loading', 'error', 'offline'];

/**
 * Forced Order Detail states for visual QA.
 * Route: `/dev/order-detail`
 */
export default function OrderDetailGalleryScreen() {
  const [state, setState] = useState<GalleryState>('success');
  const [variant, setVariant] = useState<OrdersListVariant>('admin');
  const { theme, colors } = useTheme();
  const { setLocale, locale } = useLocale();

  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          gap: theme.spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <AppText variant="caption" color="secondary">
          Order detail gallery · {variant} · {locale}
        </AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
          {STATES.map((s) => (
            <SecondaryButton
              key={s}
              label={s}
              onPress={() => setState(s)}
              style={{ paddingHorizontal: theme.spacing.sm }}
            />
          ))}
          <SecondaryButton
            label={variant === 'admin' ? 'Dealer' : 'Admin'}
            onPress={() => setVariant((v) => (v === 'admin' ? 'dealer' : 'admin'))}
          />
          <SecondaryButton
            label={locale === 'ar' ? 'EN' : 'AR'}
            onPress={() => void setLocale(locale === 'ar' ? 'en' : 'ar')}
          />
        </View>
      </View>
      <OrderDetailScreen
        orderId="so1"
        variant={variant}
        forceState={state}
      />
    </View>
  );
}
