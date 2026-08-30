import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { TertiaryButton } from '@/components/buttons/TertiaryButton';
import { TextField } from '@/components/forms/TextField';
import { ScrollableScreen } from '@/components/layout/ScrollableScreen';
import { Divider } from '@/components/layout/Divider';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { DevComponentHarness } from '../harness/DevComponentHarness';
import { PreviewErrorBoundary } from '../harness/PreviewErrorBoundary';
import { getLabEntry } from '../registry';
import type { LabRole, ReviewState } from '../registry/types';
import { getReview, setReview } from '../work-queue/reviewStore';

/**
 * Focused component inspector — metadata, variants, Open usage, aesthetic review.
 * Route param: `/dev/tests/[id]`
 */
export function DevTestsInspectorScreen() {
  const { colors, theme } = useTheme();
  const { isRTL } = useLocale();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; component?: string }>();
  const raw =
    typeof params.id === 'string'
      ? params.id
      : typeof params.component === 'string'
        ? params.component
        : '';
  const id = raw ? decodeURIComponent(Array.isArray(raw) ? raw[0]! : raw) : '';
  const entry = useMemo(() => (id ? getLabEntry(id) : undefined), [id]);

  const [variant, setVariant] = useState('default');
  const [resetKey, setResetKey] = useState(0);
  const [rolePreview, setRolePreview] = useState<LabRole | 'All'>('All');
  const [reviewState, setReviewState] = useState<ReviewState>('unset');
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    void getReview(id).then((r) => {
      setReviewState(r.state);
      setNote(r.note);
    });
  }, [id]);

  const persistReview = useCallback(
    async (state: ReviewState, nextNote?: string) => {
      if (!id) return;
      const rec = await setReview(id, { state, note: nextNote ?? note });
      setReviewState(rec.state);
      setNote(rec.note);
    },
    [id, note],
  );

  if (!entry) {
    return (
      <ScrollableScreen>
        <AppText variant="title">Component not found</AppText>
        <AppText variant="bodySecondary" color="secondary">
          {id || 'Missing component id'}
        </AppText>
        <SecondaryButton label="Back to Showroom" onPress={() => router.replace('/dev/tests' as Href)} />
      </ScrollableScreen>
    );
  }

  const variants = entry.variants?.length ? entry.variants : ['default'];

  return (
    <ScrollableScreen>
      <AppText variant="title" weight="semibold" testID="dev-tests-inspector-name">
        {entry.componentName}
      </AppText>
      <AppText variant="caption" color="secondary">
        {entry.role} · {entry.category}
        {entry.subcategory ? ` / ${entry.subcategory}` : ''}
      </AppText>

      <View style={{ marginTop: theme.spacing.md, gap: theme.spacing.xs }}>
        <AppText variant="label" color="secondary">
          SOURCE
        </AppText>
        <AppText variant="caption" selectable>
          apps/mobile/{entry.sourceFile}
        </AppText>
      </View>

      <View style={{ marginTop: theme.spacing.md, gap: theme.spacing.xs }}>
        <AppText variant="label" color="secondary">
          USED IN
        </AppText>
        {entry.usedIn.map((u) => (
          <AppText key={u} variant="caption">
            {u}
          </AppText>
        ))}
      </View>

      <AppText variant="body" style={{ marginTop: theme.spacing.md }}>
        {entry.description}
      </AppText>

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.sm,
          marginTop: theme.spacing.md,
        }}
      >
        <SecondaryButton
          label={copied ? 'Copied' : 'Copy component name'}
          onPress={() => {
            void Clipboard.setStringAsync(entry.componentName).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            });
          }}
        />
        {entry.openUsageTarget ? (
          <PrimaryButton
            label="Open usage"
            onPress={() => router.push(entry.openUsageTarget as Href)}
          />
        ) : null}
        <TertiaryButton label="Reset demo" onPress={() => setResetKey((k) => k + 1)} />
      </View>

      <Divider />

      <AppText variant="label" color="secondary">
        VARIANT
      </AppText>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          flexWrap: 'wrap',
          gap: 8,
          marginVertical: theme.spacing.sm,
        }}
      >
        {variants.map((v) => (
          <Pressable
            key={v}
            onPress={() => setVariant(v)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: theme.radius.lg,
              backgroundColor: variant === v ? colors.brandSoft : colors.surface,
              borderWidth: 1,
              borderColor: variant === v ? colors.brand : colors.border,
            }}
          >
            <AppText variant="caption">{v}</AppText>
          </Pressable>
        ))}
      </View>

      <AppText variant="label" color="secondary" style={{ marginTop: theme.spacing.sm }}>
        ROLE PREVIEW (fixtures only)
      </AppText>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          flexWrap: 'wrap',
          gap: 8,
          marginVertical: theme.spacing.sm,
        }}
      >
        {(['All', 'Admin', 'Dealer', 'Worker', 'Shared'] as const).map((r) => (
          <Pressable
            key={r}
            onPress={() => setRolePreview(r)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: theme.radius.lg,
              backgroundColor: rolePreview === r ? colors.brandSoft : colors.surface,
              borderWidth: 1,
              borderColor: rolePreview === r ? colors.brand : colors.border,
            }}
          >
            <AppText variant="caption">{r}</AppText>
          </Pressable>
        ))}
      </View>

      <Divider />

      <AppText variant="heading" weight="semibold" style={{ marginBottom: theme.spacing.sm }}>
        Preview
      </AppText>
      <PreviewErrorBoundary componentName={entry.componentName} key={resetKey}>
        <DevComponentHarness>
          {entry.render ? (
            entry.render({ variant, resetKey, rolePreview })
          ) : (
            <View style={{ gap: theme.spacing.sm }}>
              <AppText variant="body">
                No isolated fixture mount — use Open usage to see this in surrounding layout.
              </AppText>
              <AppText variant="caption" color="secondary">
                Representation: {entry.representation}
              </AppText>
              {entry.openUsageTarget ? (
                <PrimaryButton
                  label="Open usage"
                  onPress={() => router.push(entry.openUsageTarget as Href)}
                />
              ) : null}
            </View>
          )}
        </DevComponentHarness>
      </PreviewErrorBoundary>

      <Divider />

      <AppText variant="heading" weight="semibold">
        Aesthetic review (local only)
      </AppText>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          flexWrap: 'wrap',
          gap: 8,
          marginVertical: theme.spacing.sm,
        }}
      >
        {(
          [
            ['needs_work', 'Needs work'],
            ['review_later', 'Review later'],
            ['approved', 'Approved'],
            ['unset', 'Clear'],
          ] as const
        ).map(([state, label]) => (
          <Pressable
            key={state}
            onPress={() => void persistReview(state)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: theme.radius.lg,
              backgroundColor: reviewState === state ? colors.brandSoft : colors.surface,
              borderWidth: 1,
              borderColor: reviewState === state ? colors.brand : colors.border,
            }}
          >
            <AppText variant="caption">{label}</AppText>
          </Pressable>
        ))}
      </View>
      <TextField
        label="Note"
        value={note}
        onChangeText={setNote}
        placeholder="Too flat / Reduce height / …"
        onBlur={() => void persistReview(reviewState, note)}
      />

      <View style={{ height: theme.spacing['3xl'] }} />
    </ScrollableScreen>
  );
}
