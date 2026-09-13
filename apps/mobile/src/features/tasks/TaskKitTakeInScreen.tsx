import { useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { AppText } from '@/components/AppText';
import { BackButton } from '@/components/BackButton';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { AppScreen } from '@/components/layout/AppScreen';
import { Ionicons } from '@expo/vector-icons';
import { useCodeScanner } from '@/components/scan/CodeScannerProvider';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useSmartBack } from '@/navigation/useSmartBack';
import { useTheme } from '@/theme';
import { TaskActionDock } from './components/TaskActionDock';
import {
  TaskIncomingWorkFloorSection,
  type TaskIncomingFloorHandle,
} from './components/TaskIncomingWorkFloorSection';
import { useTaskQuery } from './query';
import { selectTaskDetail } from './selectTask';

type Props = { taskId: string };

export function TaskKitTakeInScreen({ taskId }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const onBack = useSmartBack('/(app)/(employee)/(tabs)/tasks' as Href);
  const incomingRef = useRef<TaskIncomingFloorHandle>(null);
  const { openScanner } = useCodeScanner();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const [info, setInfo] = useState({ required: false, allReceived: true, received: 0, expected: 0 });
  const [incomingReady, setIncomingReady] = useState(false);
  const [dockH, setDockH] = useState(0);
  const taskQuery = useTaskQuery(taskId, Boolean(taskId));
  const readOnly = taskQuery.data
    ? selectTaskDetail(taskQuery.data, locale).isTerminal
    : false;

  const continueEnabled = incomingReady && (!info.required || info.allReceived || readOnly);
  const floorClearance = insets.bottom + SURFACE_TAB_BAR_CLEARANCE;

  return (
    <AppScreen edges={{ top: true, bottom: true }}>
      <View style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingBottom: floorClearance + dockH + theme.spacing.md,
            gap: theme.spacing.md,
          }}
        >
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
            }}
          >
            <BackButton onPress={onBack} />
            <View style={{ flex: 1, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
              <AppText variant="caption" weight="semibold" style={{ color: colors.brand }}>
                {t('mobile.tasks.takeInEyebrow')}
              </AppText>
              <AppText variant="largeTitle" weight={titleWeight}>
                {t('mobile.tasks.takeInTitle')}
              </AppText>
            </View>
          </View>

          {readOnly ? (
            <AppText variant="bodySecondary" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t('mobile.tasks.viewOnlyCompleted')}
            </AppText>
          ) : null}

          <TaskIncomingWorkFloorSection
            ref={incomingRef}
            taskId={taskId}
            showNoneWhenEmpty
            readOnly={readOnly}
            onAvailabilityChange={(next) => {
              const expected = next.lines.reduce((sum, l) => sum + (l.expected || 0), 0);
              const received = next.lines.reduce((sum, l) => sum + (l.received || 0), 0);
              setInfo({
                required: next.required,
                allReceived: next.allReceived,
                received,
                expected,
              });
              setIncomingReady(true);
            }}
          />

          {readOnly ? null : (
            <SecondaryButton
              testID="task-takein-scan"
              label={t('mobile.tasks.incomingScanOptional')}
              accessibilityLabel={t('mobile.tasks.incomingScanOptional')}
              onPress={() => incomingRef.current?.openScan()}
              leading={<Ionicons name="qr-code-outline" size={18} color={colors.brand} />}
            />
          )}

          <PrimaryButton
            label={
              info.expected > 0
                ? t('mobile.tasks.takeInContinueCount', {
                    received: info.received,
                    expected: info.expected,
                  })
                : t('mobile.tasks.takeInContinue')
            }
            disabled={!continueEnabled}
            onPress={() => {
              if (!continueEnabled) {
                void haptics.error();
                return;
              }
              void haptics.confirmMedium();
              router.replace(`/(app)/(employee)/tasks/${taskId}` as Href);
            }}
          />
          {readOnly ? null : (
            <SecondaryButton
              label={t('mobile.tasks.takeInReportDefect')}
              onPress={() => incomingRef.current?.openDiscrepancy()}
            />
          )}
        </ScrollView>

        {readOnly ? null : (
          <TaskActionDock
            bottomOffset={floorClearance}
            onHeight={setDockH}
            actions={[
              {
                key: 'scan-incoming',
                label: t('mobile.tasks.incomingScanOptional'),
                icon: 'qr-code-outline',
                primary: true,
                onPress: () => {
                  void (async () => {
                    const code = await openScanner({
                      title: t('mobile.tasks.incomingReceiveTitle'),
                      hint: t('mobile.tasks.incomingReceiveSoftHint'),
                    });
                    if (code?.trim()) incomingRef.current?.applyScan(code.trim());
                  })();
                },
              },
              {
                key: 'defect',
                label: t('mobile.tasks.takeInReportDefect'),
                icon: 'alert-circle-outline',
                onPress: () => incomingRef.current?.openDiscrepancy(),
              },
            ]}
          />
        )}
      </View>
    </AppScreen>
  );
}
