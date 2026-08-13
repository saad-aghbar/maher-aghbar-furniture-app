import { useState } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { TaskDetailScreen } from '@/features/tasks/TaskDetailScreen';
import { taskDetailFixture } from '@/features/tasks/fixtures';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

type GalleryState = 'loading' | 'error' | 'offline' | 'success';

const STATES: GalleryState[] = ['success', 'loading', 'error', 'offline'];

/**
 * Forced Task Detail states for visual QA.
 * Route: `/dev/task-detail`
 */
export default function TaskDetailGalleryScreen() {
  const [state, setState] = useState<GalleryState>('success');
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
          Task detail gallery · {locale}
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
      <TaskDetailScreen
        taskId={taskDetailFixture.id}
        forceState={state}
        fixture={state === 'success' || state === 'offline' ? taskDetailFixture : undefined}
      />
    </View>
  );
}
