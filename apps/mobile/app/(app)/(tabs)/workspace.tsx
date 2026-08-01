import {
  Boxes,
  ClipboardCheck,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  Hammer,
  PackageSearch,
  Receipt,
  ShoppingCart,
  Truck,
  Users,
} from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useNav } from '../../../src/lib/nav';
import { visibleLinks, type WorkspaceLink } from '../../../src/permissions/workspace';
import { resolveHomePersona } from '../../../src/permissions/can';
import { useAuth } from '../../../src/providers/auth-provider';
import { useI18n } from '../../../src/providers/i18n-provider';
import { colors, radius, shadow, spacing } from '../../../src/theme/tokens';
import { EmptyState, PressableScale, Screen, ScreenHeader, Text } from '../../../src/ui';

const ICONS: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  tasks: Hammer,
  production: Boxes,
  quality: ClipboardCheck,
  deliveries: Truck,
  inventory: PackageSearch,
  requests: ClipboardList,
  quotations: FileText,
  'sales-orders': ShoppingCart,
  purchasing: FileSpreadsheet,
  invoices: Receipt,
  customers: Users,
  reports: FileSpreadsheet,
};

/** Module launcher listing every area the signed-in user may open. */
export default function WorkspaceScreen() {
  const { user } = useAuth();
  const { t } = useI18n();
  const router = useNav();
  const links = visibleLinks(user);
  const persona = user ? resolveHomePersona(user) : 'generic';

  return (
    <Screen>
      <ScreenHeader
        title={t('common.workspace', 'Workspace')}
        subtitle={t(`mobile.persona.${persona}`, undefined)}
      />
      {links.length === 0 ? (
        <EmptyState
          title={t('mobile.noModules', 'No modules available')}
          description={t('mobile.noModulesHint', 'Your account has no assigned areas yet.')}
        />
      ) : (
        <View style={styles.grid}>
          {links.map((link) => (
            <Tile key={link.key} link={link} onPress={() => router.push(link.href)} />
          ))}
        </View>
      )}
    </Screen>
  );
}

function Tile({ link, onPress }: { link: WorkspaceLink; onPress: () => void }) {
  const { t } = useI18n();
  const Icon = ICONS[link.key] ?? FileText;
  const label = t(link.labelKey);
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" scaleTo={0.98} style={styles.tile}>
      <View style={styles.iconWrap}>
        <Icon size={22} color={colors.brand} />
      </View>
      <Text variant="subheading" numberOfLines={2}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    flexGrow: 1,
    minWidth: '45%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    minHeight: 108,
    ...(shadow.card as object),
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
