import { localizedName } from '@maher/i18n';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Camera, CheckCircle2, Pause, Play, ShieldAlert } from 'lucide-react-native';
import { apiFetch } from '../../../src/api/client';
import { errorMessage, useAction, useItemQuery } from '../../../src/api/hooks';
import { uploadFile } from '../../../src/api/upload';
import { formatDate, formatDateTime, formatMinutes } from '../../../src/lib/format';
import { can } from '../../../src/permissions/can';
import { useAuth } from '../../../src/providers/auth-provider';
import { useI18n } from '../../../src/providers/i18n-provider';
import { colors, spacing } from '../../../src/theme/tokens';
import {
  Button,
  Card,
  ErrorState,
  ListSkeleton,
  ProgressBar,
  Row,
  Screen,
  Section,
  StatusBadge,
  Text,
  TextField,
} from '../../../src/ui';

type TaskDetail = {
  id: string;
  number: string;
  name: string;
  description: string | null;
  status: string;
  priority: string;
  progressPercent: number;
  plannedStart: string | null;
  plannedCompletion: string | null;
  actualStart: string | null;
  actualCompletion: string | null;
  estimatedMinutes: number | null;
  actualMinutes: number | null;
  notes: string | null;
  productionOrder?: { id: string; number: string; productDescription: string | null } | null;
  stageDefinition?: { id: string; code: string; nameEn: string; nameAr: string } | null;
  assignedEmployee?: { firstName: string; lastName: string } | null;
  blockers?: {
    id: string;
    category: string;
    reason: string;
    resolvedAt: string | null;
    createdAt: string;
  }[];
  timeEntries?: { id: string; startedAt: string; endedAt: string | null; minutes: number | null }[];
  photos?: { id: string; fileName: string; createdAt: string }[];
};

const PROGRESS_STEPS = [25, 50, 75, 100];

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const [notes, setNotes] = useState<string | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const key = ['tasks', id];
  const query = useItemQuery<TaskDetail>(key, `/tasks/${id}`, { enabled: Boolean(id) });
  const invalidate = [key, ['tasks', 'mine'], ['tasks-mine'], ['tasks-all']];

  const onError = (err: unknown) =>
    Alert.alert(t('common.error', 'Error'), errorMessage(err, t('common.actionFailed', 'Action failed')));

  const start = useAction(() => apiFetch(`/tasks/${id}/start`, { method: 'POST' }), invalidate);
  const pause = useAction(() => apiFetch(`/tasks/${id}/pause`, { method: 'POST' }), invalidate);
  const resume = useAction(() => apiFetch(`/tasks/${id}/resume`, { method: 'POST' }), invalidate);
  const progress = useAction(
    (percent: number) => apiFetch(`/tasks/${id}/progress`, { body: { percent } }),
    invalidate,
  );
  const complete = useAction(
    () => apiFetch(`/tasks/${id}/complete`, { body: { notes: notes ?? undefined } }),
    invalidate,
  );
  const block = useAction(
    (reason: string) =>
      apiFetch(`/tasks/${id}/block`, { body: { category: 'OTHER', reason } }),
    invalidate,
  );
  const unblock = useAction(() => apiFetch(`/tasks/${id}/unblock`, { method: 'POST' }), invalidate);
  const saveNotes = useAction(
    (value: string) => apiFetch(`/tasks/${id}/notes`, { method: 'PATCH', body: { notes: value } }),
    invalidate,
  );

  const run = <V,>(action: { mutate: (v: V, opts?: object) => void }, vars: V) =>
    action.mutate(vars, { onError });

  async function capturePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        t('common.error', 'Error'),
        t('mobile.cameraPermission', 'Camera permission is required to attach photos.'),
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setUploadingPhoto(true);
    try {
      await uploadFile({
        uri: asset.uri,
        name: asset.fileName ?? `task-${id}-${Date.now()}.jpg`,
        mimeType: asset.mimeType ?? 'image/jpeg',
        taskId: id,
      });
      await query.refetch();
    } catch (err) {
      onError(err);
    } finally {
      setUploadingPhoto(false);
    }
  }

  if (query.isLoading) {
    return (
      <Screen>
        <ListSkeleton rows={3} />
      </Screen>
    );
  }
  if (query.isError || !query.data) {
    return (
      <Screen>
        <ErrorState onRetry={() => void query.refetch()} />
      </Screen>
    );
  }

  const task = query.data;
  const title = task.stageDefinition
    ? localizedName(locale, task.stageDefinition, task.name)
    : task.name;
  const percent = Number(task.progressPercent ?? 0);
  const openBlockers = (task.blockers ?? []).filter((b) => !b.resolvedAt);
  const isBlocked = task.status === 'BLOCKED' || openBlockers.length > 0;
  const isDone = task.status === 'COMPLETED';
  const busy =
    start.isPending ||
    pause.isPending ||
    resume.isPending ||
    complete.isPending ||
    progress.isPending;

  return (
    <>
      <Stack.Screen options={{ title: task.number }} />
      <Screen
        refreshing={query.isFetching}
        onRefresh={() => void query.refetch()}
        footer={
          isDone ? undefined : (
            <View style={styles.footerRow}>
              {task.status === 'NOT_STARTED' || task.status === 'READY' ? (
                <Button
                  label={t('catalog.startProduction', 'Start')}
                  icon={<Play size={18} color="#fff" />}
                  onPress={() => run(start, undefined)}
                  loading={start.isPending}
                  disabled={busy || isBlocked}
                  style={styles.grow}
                />
              ) : null}
              {task.status === 'IN_PROGRESS' ? (
                <Button
                  label={t('mobile.pause', 'Pause')}
                  variant="secondary"
                  icon={<Pause size={18} color={colors.brand} />}
                  onPress={() => run(pause, undefined)}
                  loading={pause.isPending}
                  disabled={busy}
                  style={styles.grow}
                />
              ) : null}
              {task.status === 'PAUSED' ? (
                <Button
                  label={t('mobile.resume', 'Resume')}
                  icon={<Play size={18} color="#fff" />}
                  onPress={() => run(resume, undefined)}
                  loading={resume.isPending}
                  disabled={busy || isBlocked}
                  style={styles.grow}
                />
              ) : null}
              <Button
                label={t('mobile.complete', 'Complete')}
                icon={<CheckCircle2 size={18} color="#fff" />}
                onPress={() =>
                  Alert.alert(
                    t('mobile.complete', 'Complete'),
                    t('mobile.completeConfirm', 'Mark this task as completed?'),
                    [
                      { text: t('common.cancel', 'Cancel'), style: 'cancel' },
                      {
                        text: t('mobile.complete', 'Complete'),
                        onPress: () => run(complete, undefined),
                      },
                    ],
                  )
                }
                loading={complete.isPending}
                disabled={busy || isBlocked}
                style={styles.grow}
              />
            </View>
          )
        }
      >
        <Card>
          <View style={styles.titleRow}>
            <View style={styles.titleText}>
              <Text variant="title">{title}</Text>
              <Text variant="caption" color="secondary" latin>
                {`${task.number} · ${task.productionOrder?.number ?? '—'}`}
              </Text>
            </View>
            <StatusBadge status={task.status} />
          </View>

          <View style={styles.progressBlock}>
            <View style={styles.progressHead}>
              <Text variant="caption" color="secondary">
                {t('catalog.progress', 'Progress')}
              </Text>
              <Text variant="subheading" latin>
                {`${percent}%`}
              </Text>
            </View>
            <ProgressBar
              percent={percent}
              height={10}
              tone={isBlocked ? colors.error : colors.brand}
            />
          </View>

          {task.description ? (
            <Text variant="caption" color="secondary" style={styles.description}>
              {task.description}
            </Text>
          ) : null}
        </Card>

        {!isDone ? (
          <Section title={t('mobile.updateProgress', 'Update progress')}>
            <View style={styles.stepRow}>
              {PROGRESS_STEPS.map((step) => (
                <Button
                  key={step}
                  label={`${step}%`}
                  variant={percent >= step ? 'primary' : 'subtle'}
                  size="sm"
                  disabled={busy}
                  onPress={() => run(progress, step)}
                  style={styles.step}
                />
              ))}
            </View>
          </Section>
        ) : null}

        <Card title={t('mobile.details', 'Details')}>
          <Row label={t('catalog.priority', 'Priority')} value={t(`statuses.${task.priority}`, task.priority)} />
          <Row label={t('catalog.plannedStart', 'Planned start')} value={formatDate(task.plannedStart)} latin />
          <Row label={t('catalog.plannedEnd', 'Planned end')} value={formatDate(task.plannedCompletion)} latin />
          <Row label={t('mobile.actualStart', 'Started')} value={formatDateTime(task.actualStart)} latin />
          <Row
            label={t('catalog.estMinutes', 'Estimated')}
            value={formatMinutes(task.estimatedMinutes)}
            latin
          />
          <Row label={t('mobile.timeLogged', 'Time logged')} value={formatMinutes(task.actualMinutes)} latin />
          <Row
            label={t('catalog.worker', 'Worker')}
            value={
              task.assignedEmployee
                ? `${task.assignedEmployee.firstName} ${task.assignedEmployee.lastName}`
                : t('catalog.unassigned', 'Unassigned')
            }
          />
        </Card>

        <Section title={t('mobile.blockers', 'Blockers')}>
          {openBlockers.length > 0 ? (
            <Card style={styles.blockerCard}>
              {openBlockers.map((b) => (
                <View key={b.id} style={styles.blocker}>
                  <ShieldAlert size={18} color={colors.error} />
                  <View style={styles.grow}>
                    <Text variant="subheading" color="error">
                      {t(`statuses.${b.category}`, b.category)}
                    </Text>
                    <Text variant="caption" color="secondary">
                      {b.reason}
                    </Text>
                  </View>
                </View>
              ))}
              <Button
                label={t('mobile.unblock', 'Resolve blocker')}
                variant="secondary"
                size="sm"
                loading={unblock.isPending}
                onPress={() => run(unblock, undefined)}
              />
            </Card>
          ) : showBlockForm ? (
            <Card>
              <TextField
                label={t('mobile.blockReason', 'What is blocking you?')}
                value={blockReason}
                onChangeText={setBlockReason}
                multiline
                numberOfLines={3}
                style={styles.multiline}
              />
              <View style={styles.stepRow}>
                <Button
                  label={t('common.cancel', 'Cancel')}
                  variant="ghost"
                  size="sm"
                  onPress={() => setShowBlockForm(false)}
                  style={styles.grow}
                />
                <Button
                  label={t('mobile.reportBlocker', 'Report blocker')}
                  variant="danger"
                  size="sm"
                  disabled={blockReason.trim().length === 0}
                  loading={block.isPending}
                  onPress={() =>
                    block.mutate(blockReason.trim(), {
                      onError,
                      onSuccess: () => {
                        setBlockReason('');
                        setShowBlockForm(false);
                      },
                    })
                  }
                  style={styles.grow}
                />
              </View>
            </Card>
          ) : (
            <Button
              label={t('mobile.reportBlocker', 'Report blocker')}
              variant="subtle"
              size="sm"
              icon={<ShieldAlert size={16} color={colors.brand} />}
              onPress={() => setShowBlockForm(true)}
            />
          )}
        </Section>

        <Card title={t('common.notes', 'Notes')}>
          <TextField
            value={notes ?? task.notes ?? ''}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            placeholder={t('mobile.notesPlaceholder', 'Add a note for the next shift')}
            style={styles.multiline}
          />
          <Button
            label={t('common.save', 'Save')}
            variant="secondary"
            size="sm"
            disabled={notes == null || notes === (task.notes ?? '')}
            loading={saveNotes.isPending}
            onPress={() => run(saveNotes, notes ?? '')}
            style={styles.saveNotes}
          />
        </Card>

        <Section title={t('mobile.photos', 'Photos')}>
          {(task.photos ?? []).map((photo) => (
            <Row
              key={photo.id}
              label={photo.fileName}
              value={formatDateTime(photo.createdAt)}
              latin
            />
          ))}
          {can(user, 'document.manage') && !isDone ? (
            <Button
              label={t('mobile.takePhoto', 'Take photo')}
              variant="subtle"
              size="sm"
              icon={<Camera size={16} color={colors.brand} />}
              loading={uploadingPhoto}
              onPress={() => void capturePhoto()}
            />
          ) : null}
          {(task.photos ?? []).length === 0 && (isDone || !can(user, 'document.manage')) ? (
            <Text variant="caption" color="secondary">
              {t('mobile.noPhotos', 'No photos attached yet')}
            </Text>
          ) : null}
        </Section>

        {(task.timeEntries ?? []).length > 0 ? (
          <Card title={t('mobile.timeEntries', 'Time entries')}>
            {(task.timeEntries ?? []).map((entry) => (
              <Row
                key={entry.id}
                label={formatDateTime(entry.startedAt)}
                value={
                  entry.endedAt ? formatMinutes(entry.minutes) : t('mobile.running', 'Running')
                }
                latin
              />
            ))}
          </Card>
        ) : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  titleText: { flex: 1, gap: 2 },
  progressBlock: { marginTop: spacing.md, gap: spacing.sm },
  progressHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  description: { marginTop: spacing.md },
  stepRow: { flexDirection: 'row', gap: spacing.sm },
  step: { flex: 1 },
  grow: { flex: 1 },
  footerRow: { flexDirection: 'row', gap: spacing.sm },
  blockerCard: { borderColor: colors.error },
  blocker: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  multiline: { minHeight: 90, textAlignVertical: 'top', paddingTop: spacing.sm },
  saveNotes: { marginTop: spacing.sm, alignSelf: 'flex-start' },
});
