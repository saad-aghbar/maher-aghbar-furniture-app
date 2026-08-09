import { useState } from 'react';
import { View } from 'react-native';
import { WorkerHomeScreen } from '@/features/worker-home/WorkerHomeScreen';
import {
  workerHomeEmptyFixture,
  workerHomeSuccessFixture,
} from '@/features/worker-home/fixtures';
import { AppText } from '@/components/AppText';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

type GalleryState = 'loading' | 'error' | 'empty' | 'offline' | 'success';

const STATES: GalleryState[] = ['success', 'loading', 'error', 'empty', 'offline'];

/**
 * Forced Worker Home states for visual QA / screenshots.
 * Route: `/dev/worker-home`
 */
export default function WorkerHomeGalleryScreen() {
  const [state, setState] = useState<GalleryState>('success');
  const { theme, colors } = useTheme();
  const { setLocale, locale } = useLocale();

  const fixture =
    state === 'empty' ? workerHomeEmptyFixture : workerHomeSuccessFixture;

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
          Worker Home gallery · locale {locale}
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
            label={locale === 'ar' ? 'EN' : 'AR'}
            onPress={() => void setLocale(locale === 'ar' ? 'en' : 'ar')}
          />
        </View>
      </View>
      <WorkerHomeScreen
        forceState={state}
        fixture={state === 'error' || state === 'loading' ? undefined : fixture}
      />
    </View>
  );
}
