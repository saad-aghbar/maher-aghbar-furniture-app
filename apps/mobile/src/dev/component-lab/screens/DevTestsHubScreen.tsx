import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { TextField } from '@/components/forms/TextField';
import { ScrollableScreen } from '@/components/layout/ScrollableScreen';
import { SurfaceCard } from '@/components/surfaces/SurfaceCard';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import {
  filterRegistry,
  getAuditStats,
  getLabRegistry,
} from '../registry';
import type { LabRegistryEntry, LabRole } from '../registry/types';
import { getAllReviews, getReviewCounts } from '../work-queue/reviewStore';

const ROLES: Array<LabRole | 'All'> = ['All', 'Admin', 'Dealer', 'Worker', 'Shared'];
const REVIEW_FILTERS = ['All', 'needs_work', 'review_later', 'approved', 'unset'] as const;

/**
 * Dev Tests hub — searchable catalog of the mobile frontend.
 * Only reachable when `__DEV__`.
 */
export function DevTestsHubScreen() {
  const { colors, theme } = useTheme();
  const { isRTL } = useLocale();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<LabRole | 'All'>('All');
  const [reviewFilter, setReviewFilter] = useState<string>('All');
  const [reviews, setReviews] = useState<Record<string, { state: string }>>({});
  const [reviewCounts, setReviewCounts] = useState({
    needs_work: 0,
    review_later: 0,
    approved: 0,
    unset: 0,
  });

  const stats = useMemo(() => getAuditStats(), []);
  const all = useMemo(() => getLabRegistry(), []);

  const refreshReviews = useCallback(async () => {
    const [allR, counts] = await Promise.all([getAllReviews(), getReviewCounts()]);
    setReviews(allR);
    setReviewCounts(counts);
  }, []);

  useEffect(() => {
    void refreshReviews();
  }, [refreshReviews]);

  const filtered = useMemo(
    () =>
      filterRegistry(all, {
        query,
        role,
        reviewFilter,
        reviews,
      }),
    [all, query, role, reviewFilter, reviews],
  );

  const categories = useMemo(() => {
    const set = new Set(filtered.map((e) => e.category));
    return [...set].sort();
  }, [filtered]);

  return (
    <ScrollableScreen>
      <AppText variant="largeTitle" weight="semibold" testID="dev-tests-title">
        DEV TESTS
      </AppText>
      <AppText variant="bodySecondary" color="secondary" style={{ marginBottom: theme.spacing.md }}>
        Frontend component & interaction laboratory
      </AppText>

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.sm,
          marginBottom: theme.spacing.md,
        }}
      >
        <StatChip label="Files" value={stats.totalFiles} />
        <StatChip label="Registered" value={stats.registered} />
        <StatChip label="Parent" value={stats.representedByParent} />
        <StatChip label="Screens" value={stats.screenLink} />
        <StatChip label="Unclassified" value={stats.unclassified} />
      </View>

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.sm,
          marginBottom: theme.spacing.md,
        }}
      >
        <StatChip label="Needs work" value={reviewCounts.needs_work} />
        <StatChip label="Review later" value={reviewCounts.review_later} />
        <StatChip label="Approved" value={reviewCounts.approved} />
      </View>

      <TextField
        label="Search components, screens, sheets…"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
        testID="dev-tests-search"
      />

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          flexWrap: 'wrap',
          gap: 8,
          marginVertical: theme.spacing.md,
        }}
      >
        {ROLES.map((r) => (
          <Chip
            key={r}
            label={r}
            selected={role === r}
            onPress={() => setRole(r)}
          />
        ))}
      </View>

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: theme.spacing.md,
        }}
      >
        {REVIEW_FILTERS.map((r) => (
          <Chip
            key={r}
            label={r === 'needs_work' ? 'Needs work' : r === 'review_later' ? 'Later' : r}
            selected={reviewFilter === r}
            onPress={() => setReviewFilter(r)}
          />
        ))}
      </View>

      <AppText variant="caption" color="secondary" style={{ marginBottom: theme.spacing.sm }}>
        Showing {filtered.length} / {all.length}
      </AppText>

      {categories.map((cat) => {
        const items = filtered.filter((e) => e.category === cat);
        if (!items.length) return null;
        return (
          <View key={cat} style={{ marginBottom: theme.spacing.lg, gap: theme.spacing.sm }}>
            <AppText variant="heading" weight="semibold">
              {cat}
            </AppText>
            {items.slice(0, 80).map((entry) => (
              <RegistryRow
                key={entry.id}
                entry={entry}
                reviewState={reviews[entry.id]?.state}
                onPress={() =>
                  router.push(`/dev/tests/${encodeURIComponent(entry.id)}` as Href)
                }
              />
            ))}
            {items.length > 80 ? (
              <AppText variant="caption" color="secondary">
                +{items.length - 80} more — refine search
              </AppText>
            ) : null}
          </View>
        );
      })}
    </ScrollableScreen>
  );
}

function StatChip({ label, value }: { label: string; value: number }) {
  const { colors, theme } = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: 6,
        borderRadius: theme.radius.md,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <AppText variant="caption" color="secondary">
        {label}
      </AppText>
      <AppText variant="label" weight="semibold">
        {value}
      </AppText>
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors, theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: theme.spacing.md,
        paddingVertical: 8,
        borderRadius: theme.radius.xl,
        backgroundColor: selected ? colors.brandSoft : colors.surface,
        borderWidth: 1,
        borderColor: selected ? colors.brand : colors.border,
      }}
    >
      <AppText variant="caption" weight={selected ? 'semibold' : 'regular'}>
        {label}
      </AppText>
    </Pressable>
  );
}

function RegistryRow({
  entry,
  reviewState,
  onPress,
}: {
  entry: LabRegistryEntry;
  reviewState?: string;
  onPress: () => void;
}) {
  const { colors, theme } = useTheme();
  const { isRTL } = useLocale();
  return (
    <SurfaceCard onPress={onPress} accessibilityLabel={entry.componentName}>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
        }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="label" weight="semibold" numberOfLines={1}>
            {entry.componentName}
          </AppText>
          <AppText variant="caption" color="secondary" numberOfLines={1}>
            {entry.role} · {entry.subcategory ?? entry.category}
            {reviewState && reviewState !== 'unset' ? ` · ${reviewState}` : ''}
          </AppText>
          <AppText variant="caption" color="muted" numberOfLines={1}>
            {entry.sourceFile}
          </AppText>
        </View>
        <Ionicons
          name={isRTL ? 'chevron-back' : 'chevron-forward'}
          size={18}
          color={colors.textMuted}
        />
      </View>
    </SurfaceCard>
  );
}
