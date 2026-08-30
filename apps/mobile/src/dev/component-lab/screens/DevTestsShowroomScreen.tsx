import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { PreviewErrorBoundary } from '../harness/PreviewErrorBoundary';
import { getReview, setReview } from '../work-queue/reviewStore';
import type { ReviewState } from '../registry/types';
import type { LabRole } from '../registry/types';
import {
  filterShowroom,
  getShowroomCatalog,
  getShowroomSections,
} from '../showroom/catalog';
import {
  peekShowroomScroll,
  saveShowroomScroll,
  type ShowroomItem,
} from '../showroom/types';

const ROLES: Array<LabRole | 'All'> = ['All', 'Admin', 'Dealer', 'Worker'];

/**
 * Visual Showroom — default Dev Tests experience.
 * Components dominate; metadata behind ⓘ; scroll memory across overlays & Coverage.
 */
export function DevTestsShowroomScreen() {
  const { colors, theme } = useTheme();
  const { isRTL } = useLocale();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const sectionY = useRef<Record<string, number>>({});
  const scrollYRef = useRef(0);

  const [query, setQuery] = useState('');
  const [role, setRole] = useState<LabRole | 'All'>('All');
  const [infoItem, setInfoItem] = useState<ShowroomItem | null>(null);
  const [sheetItem, setSheetItem] = useState<ShowroomItem | null>(null);
  const [reviewState, setReviewState] = useState<ReviewState>('unset');
  const [note, setNote] = useState('');

  const catalog = useMemo(() => getShowroomCatalog(), []);
  const sections = useMemo(() => getShowroomSections(), []);
  const filtered = useMemo(
    () => filterShowroom(catalog, { query, role }),
    [catalog, query, role],
  );

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollYRef.current = e.nativeEvent.contentOffset.y;
    saveShowroomScroll(scrollYRef.current);
  }, []);

  useFocusEffect(
    useCallback(() => {
      const { y } = peekShowroomScroll();
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ y, animated: false });
      });
    }, []),
  );

  useEffect(() => {
    if (!infoItem) return;
    void getReview(infoItem.id).then((r) => {
      setReviewState(r.state);
      setNote(r.note);
    });
  }, [infoItem]);

  const jumpSection = (section: string) => {
    const y = sectionY.current[section];
    if (y != null) {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
      saveShowroomScroll(Math.max(0, y - 8));
    }
  };

  const openCoverage = () => {
    saveShowroomScroll(scrollYRef.current);
    router.push('/dev/tests/coverage' as Href);
  };

  const openScreen = (href: string) => {
    saveShowroomScroll(scrollYRef.current);
    router.push(href as Href);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: theme.spacing['3xl'],
          paddingTop: theme.spacing.md,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <AppText variant="largeTitle" weight="semibold" testID="dev-tests-title">
          Dev tests
        </AppText>
        <AppText variant="bodySecondary" color="secondary">
          Frontend visual playground
        </AppText>

        <Pressable
          onPress={openCoverage}
          style={{
            alignSelf: isRTL ? 'flex-end' : 'flex-start',
            marginTop: theme.spacing.sm,
            marginBottom: theme.spacing.md,
          }}
        >
          <AppText variant="caption" color="brand" weight="medium">
            Coverage / Registry →
          </AppText>
        </Pressable>

        <TextField
          label="Search components…"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          testID="dev-tests-search"
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginVertical: theme.spacing.md }}
          contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
        >
          {ROLES.map((r) => (
            <Chip key={r} label={r} selected={role === r} onPress={() => setRole(r)} />
          ))}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingBottom: theme.spacing.md }}
        >
          {sections.map((s) => (
            <Chip key={s} label={s} selected={false} onPress={() => jumpSection(s)} />
          ))}
        </ScrollView>

        {sections.map((section) => {
          const items = filtered.filter((i) => i.section === section);
          if (!items.length) return null;
          return (
            <View
              key={section}
              onLayout={(e) => {
                sectionY.current[section] = e.nativeEvent.layout.y;
              }}
              style={{ marginBottom: theme.spacing.xl }}
            >
              <AppText
                variant="heading"
                weight="semibold"
                style={{ marginBottom: theme.spacing.md }}
              >
                {section}
              </AppText>
              {items.map((item) => (
                <ShowroomRow
                  key={item.id}
                  item={item}
                  onInfo={() => setInfoItem(item)}
                  onOpenSheet={() => setSheetItem(item)}
                  onOpenScreen={() => item.screenHref && openScreen(item.screenHref)}
                />
              ))}
            </View>
          );
        })}

        {!filtered.length ? (
          <AppText variant="body" color="secondary">
            No components match this search.
          </AppText>
        ) : null}
      </ScrollView>

      {/* Info sheet — overlay; list stays mounted */}
      <BottomSheet
        open={Boolean(infoItem)}
        onClose={() => setInfoItem(null)}
        title={infoItem?.componentName ?? 'Info'}
        fitContent
        maxHeight={520}
      >
        {infoItem ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Meta label="SOURCE" value={`apps/mobile/${infoItem.sourceFile}`} />
            <Meta label="USED IN" value={infoItem.usedIn.join('\n')} />
            <Meta label="ROLE" value={infoItem.role} />
            <Meta label="STABLE ID" value={infoItem.id} />
            {infoItem.contains?.length ? (
              <Meta label="CONTAINS" value={infoItem.contains.join(', ')} />
            ) : null}
            <AppText variant="body">{infoItem.description}</AppText>
            <AppText variant="label" color="secondary">
              Aesthetic review (local)
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(
                [
                  ['needs_work', 'Needs work'],
                  ['review_later', 'Later'],
                  ['approved', 'Approved'],
                  ['unset', 'Clear'],
                ] as const
              ).map(([st, label]) => (
                <Chip
                  key={st}
                  label={label}
                  selected={reviewState === st}
                  onPress={() => {
                    void setReview(infoItem.id, { state: st, note }).then((r) => {
                      setReviewState(r.state);
                    });
                  }}
                />
              ))}
            </View>
            <TextField
              label="Note"
              value={note}
              onChangeText={setNote}
              onBlur={() => {
                void setReview(infoItem.id, { state: reviewState, note });
              }}
            />
          </View>
        ) : null}
      </BottomSheet>

      {/* Demo sheets — overlay */}
      {sheetItem?.renderSheet?.({
        open: Boolean(sheetItem),
        onClose: () => setSheetItem(null),
      })}
    </View>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 2 }}>
      <AppText variant="caption" color="secondary" weight="medium">
        {label}
      </AppText>
      <AppText variant="caption" selectable>
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

function InlinePreview({ item }: { item: ShowroomItem }) {
  const { theme } = useTheme();

  if (item.variants?.length) {
    return (
      <View style={{ gap: theme.spacing.md }}>
        {item.variants.map((v) => {
          const Variant = v.render;
          return (
            <View key={v.label} style={{ gap: 4 }}>
              <AppText variant="caption" color="secondary">
                {v.label}
              </AppText>
              <Variant />
            </View>
          );
        })}
      </View>
    );
  }

  const Render = item.render;
  if (!Render) return null;

  if (item.layout === 'horizontal' || item.layout === 'compact-grid') {
    return (
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.sm,
          alignItems: 'center',
        }}
      >
        <Render />
      </View>
    );
  }

  return <Render />;
}

function ShowroomRow({
  item,
  onInfo,
  onOpenSheet,
  onOpenScreen,
}: {
  item: ShowroomItem;
  onInfo: () => void;
  onOpenSheet: () => void;
  onOpenScreen: () => void;
}) {
  const { colors, theme } = useTheme();
  const { isRTL } = useLocale();

  return (
    <View
      style={{
        marginBottom: theme.spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderMuted,
        paddingBottom: theme.spacing.lg,
      }}
    >
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          marginBottom: theme.spacing.sm,
          gap: theme.spacing.sm,
        }}
      >
        <AppText variant="caption" weight="medium" style={{ flex: 1 }} numberOfLines={2}>
          {item.componentName}
        </AppText>
        <Pressable
          accessibilityLabel="Component info"
          onPress={onInfo}
          hitSlop={12}
          style={{ padding: 4 }}
        >
          <Ionicons name="information-circle-outline" size={22} color={colors.textMuted} />
        </Pressable>
      </View>

      <PreviewErrorBoundary componentName={item.componentName}>
        {item.mode === 'sheet' ? (
          <SecondaryButton label="Open sheet" onPress={onOpenSheet} />
        ) : item.mode === 'screen' ? (
          <PrimaryButton label="Open preview" onPress={onOpenScreen} />
        ) : (
          <InlinePreview item={item} />
        )}
      </PreviewErrorBoundary>
    </View>
  );
}
