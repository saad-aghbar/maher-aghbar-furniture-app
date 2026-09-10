import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { useLocale } from '@/i18n';
import { AnimatedPressable, ListItemEnter, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { TaskProblem } from '../selectTask';

function ProblemChip({ label }: { label: string }) {
  const { colors, theme } = useTheme();
  return (
    <View
      style={{
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceSecondary,
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: 4,
      }}
    >
      <AppText variant="caption" color="secondary" numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

export function TaskProblemsBoard({
  problems,
  onOpen,
}: {
  problems: TaskProblem[];
  onOpen: (problem: TaskProblem) => void;
}) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const openCount = problems.filter((p) => !p.answered).length;

  if (problems.length === 0) return null;

  return (
    <DealerBoard
      title={t('mobile.tasks.problemsBoardTitle')}
      titleWeight={titleWeight}
      accentColor={openCount > 0 ? colors.error : colors.brand}
      trailing={
        openCount > 0 ? (
          <AppText variant="caption" color="secondary">
            {t('mobile.tasks.problemsOpenCount', { count: openCount })}
          </AppText>
        ) : (
          <StatusBadge
            status="RESOLVED"
            label={t('mobile.tasks.problemsStatusAnswered')}
            variant="success"
            dot
          />
        )
      }
    >
      {problems.map((problem, index) => {
        const categoryKey = `mobile.tasks.blocker.${problem.category}`;
        const categoryLabel = t(categoryKey as never);
        return (
          <ListItemEnter key={problem.id} index={index}>
            <AnimatedPressable
              variant="card"
              accessibilityRole="button"
              accessibilityLabel={problem.reason}
              onPress={() => {
                void haptics.selection();
                onOpen(problem);
              }}
              style={{
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surfaceSecondary,
                overflow: 'hidden',
                paddingVertical: theme.spacing.sm + 2,
                paddingHorizontal: theme.spacing.md,
                gap: theme.spacing.sm,
                ...(isRTL
                  ? { paddingRight: theme.spacing.md + 4 }
                  : { paddingLeft: theme.spacing.md + 4 }),
              }}
            >
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  width: 3,
                  backgroundColor: problem.answered ? colors.brand : colors.error,
                  opacity: problem.answered ? 0.55 : 0.9,
                  ...(isRTL ? { right: 0 } : { left: 0 }),
                }}
              />
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: theme.spacing.sm,
                }}
              >
                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <View
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      alignItems: 'center',
                      gap: theme.spacing.sm,
                      flexWrap: 'wrap',
                    }}
                  >
                    <StatusBadge
                      status={problem.answered ? 'RESOLVED' : 'OPEN'}
                      label={
                        problem.answered
                          ? t('mobile.tasks.problemsStatusAnswered')
                          : t('mobile.tasks.problemsStatusOpen')
                      }
                      variant={problem.answered ? 'success' : 'error'}
                      dot
                    />
                    <AppText variant="caption" color="secondary" numberOfLines={1}>
                      {categoryLabel === categoryKey ? problem.category : categoryLabel}
                    </AppText>
                  </View>
                  <AppText
                    variant="body"
                    numberOfLines={1}
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  >
                    {problem.reason}
                  </AppText>
                  <View
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      flexWrap: 'wrap',
                      gap: theme.spacing.xs,
                    }}
                  >
                    {problem.voiceDocumentId ? (
                      <ProblemChip label={t('mobile.tasks.voiceNoteTitle')} />
                    ) : null}
                    {(problem.photoDocumentIds?.length ?? 0) > 0 ? (
                      <ProblemChip
                        label={t('mobile.tasks.problemPhotosCount', {
                          count: problem.photoDocumentIds!.length,
                        })}
                      />
                    ) : null}
                    {problem.answered ? (
                      <ProblemChip label={t('mobile.tasks.problemAnswered')} />
                    ) : null}
                  </View>
                </View>
                <Ionicons
                  name={isRTL ? 'chevron-back' : 'chevron-forward'}
                  size={18}
                  color={colors.textMuted}
                />
              </View>
            </AnimatedPressable>
          </ListItemEnter>
        );
      })}
    </DealerBoard>
  );
}
