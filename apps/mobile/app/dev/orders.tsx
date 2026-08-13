import { useState } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { OrdersListScreen } from '@/features/sales-orders/OrdersListScreen';
import {
  adminOrdersFixture,
  dealerOrdersFixture,
} from '@/features/sales-orders/fixtures';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import type { OrdersListVariant } from '@/features/sales-orders/selectOrderCard';

type GalleryState = 'loading' | 'error' | 'empty' | 'offline' | 'success';

const STATES: GalleryState[] = ['success', 'loading', 'error', 'empty', 'offline'];

/**
 * Forced Orders list states for visual QA.
 * Route: `/dev/orders`
 */
export default function OrdersGalleryScreen() {
  const [state, setState] = useState<GalleryState>('success');
  const [variant, setVariant] = useState<OrdersListVariant>('admin');
  const { theme, colors } = useTheme();
  const { setLocale, locale } = useLocale();

  const fixture =
    variant === 'admin' ? adminOrdersFixture : dealerOrdersFixture;

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
          Orders gallery · {variant} · {locale}
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
      <OrdersListScreen
        variant={variant}
        forceState={state}
        fixture={state === 'success' || state === 'offline' ? fixture : undefined}
      />
    </View>
  );
}
