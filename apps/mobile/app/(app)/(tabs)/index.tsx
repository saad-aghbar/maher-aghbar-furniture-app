import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useNav } from '../../../src/lib/nav';
import { resolveHomePersona } from '../../../src/permissions/can';
import { primaryLinks } from '../../../src/permissions/workspace';
import { useAuth } from '../../../src/providers/auth-provider';
import { useI18n } from '../../../src/providers/i18n-provider';
import { FocusList } from '../../../src/features/home/FocusList';
import { HomeHero } from '../../../src/features/home/HomeHero';
import { MetricIcon } from '../../../src/features/home/MetricIcon';
import { buildMetrics } from '../../../src/features/home/metrics';
import { useHomeData } from '../../../src/features/home/use-home-data';
import { colors, spacing } from '../../../src/theme/tokens';
import { Button, Grid, MetricCard, Section, Skeleton } from '../../../src/ui';

function greetingKey(): { key: string; fallback: string } {
  const hour = new Date().getHours();
  if (hour < 12) return { key: 'mobile.goodMorning', fallback: 'Good morning' };
  if (hour < 17) return { key: 'mobile.goodAfternoon', fallback: 'Good afternoon' };
  return { key: 'mobile.goodEvening', fallback: 'Good evening' };
}

export default function HomeScreen() {
  const { user } = useAuth();
  const { t } = useI18n();
  const router = useNav();
  const data = useHomeData(user);

  if (!user) return null;

  const persona = resolveHomePersona(user);
  const tiles = buildMetrics(persona, data);
  const quickActions = primaryLinks(user, persona);
  const greeting = greetingKey();

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={data.isRefreshing}
            onRefresh={data.refetchAll}
            tintColor={colors.brand}
            colors={[colors.brand]}
          />
        }
      >
        <HomeHero
          user={user}
          greeting={t(greeting.key, greeting.fallback)}
          personaLabel={t(`mobile.persona.${persona}`, t('common.workspace', 'Workspace'))}
        />

        <View style={styles.body}>
          {data.isLoading && tiles.length === 0 ? (
            <Grid>
              <Skeleton height={104} style={styles.tileSkeleton} />
              <Skeleton height={104} style={styles.tileSkeleton} />
              <Skeleton height={104} style={styles.tileSkeleton} />
              <Skeleton height={104} style={styles.tileSkeleton} />
            </Grid>
          ) : tiles.length > 0 ? (
            <Section title={t('mobile.overview', 'Overview')}>
              <Grid>
                {tiles.map((tile) => (
                  <MetricCard
                    key={tile.key}
                    label={t(tile.labelKey, tile.labelFallback)}
                    value={tile.value}
                    tone={tile.tone}
                    icon={<MetricIcon name={tile.icon} tone={tile.tone} />}
                    onPress={tile.href ? () => router.push(tile.href!) : undefined}
                  />
                ))}
              </Grid>
            </Section>
          ) : null}

          {quickActions.length > 0 ? (
            <Section title={t('mobile.quickActions', 'Quick actions')}>
              <View style={styles.actions}>
                {quickActions.slice(0, 4).map((link) => (
                  <Button
                    key={link.key}
                    label={t(link.labelKey, link.key)}
                    variant="subtle"
                    size="sm"
                    onPress={() => router.push(link.href)}
                    style={styles.action}
                  />
                ))}
              </View>
            </Section>
          ) : null}

          <FocusList persona={persona} data={data} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingBottom: spacing.xxl },
  body: { padding: spacing.md, gap: spacing.lg },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  action: { flexGrow: 1, minWidth: '45%' },
  tileSkeleton: { flexGrow: 1, minWidth: '45%' },
});
