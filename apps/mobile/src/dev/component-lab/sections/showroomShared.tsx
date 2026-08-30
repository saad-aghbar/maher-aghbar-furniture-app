/**
 * Showroom shared demos — real components, compact where natural.
 */
import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { BackButton } from '@/components/BackButton';
import { PriorityBadge } from '@/components/badges/PriorityBadge';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { DestructiveButton } from '@/components/buttons/DestructiveButton';
import { IconButton } from '@/components/buttons/IconButton';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { TertiaryButton } from '@/components/buttons/TertiaryButton';
import { ProductThumb } from '@/components/desk/ProductThumb';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { SkeletonLoader } from '@/components/feedback/SkeletonLoader';
import { InfoRow } from '@/components/forms/InfoRow';
import { TextField } from '@/components/forms/TextField';
import { AppHeader } from '@/components/layout/AppHeader';
import { Divider } from '@/components/layout/Divider';
import { FloatingActionDock } from '@/components/layout/FloatingActionDock';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { ActionSheet } from '@/components/sheets/ActionSheet';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { ConfirmationSheet } from '@/components/sheets/ConfirmationSheet';
import { SurfaceCard } from '@/components/surfaces/SurfaceCard';
import { useTheme } from '@/theme';
import type { ShowroomItem } from '../showroom/types';

function Gap({ children, row }: { children: ReactNode; row?: boolean }) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        gap: theme.spacing.sm,
        flexDirection: row ? 'row' : 'column',
        flexWrap: row ? 'wrap' : undefined,
        alignItems: row ? 'center' : undefined,
      }}
    >
      {children}
    </View>
  );
}

function PressableChip({
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

export function buildSharedShowroomItems(): ShowroomItem[] {
  return [
    {
      id: 'lab.foundations',
      componentName: 'Foundations',
      section: 'FOUNDATIONS',
      role: 'Shared',
      sourceFile: 'src/theme',
      usedIn: ['Entire app'],
      description: 'Live theme tokens — typography and surfaces.',
      layout: 'full',
      mode: 'inline',
      tags: ['foundations', 'theme', 'colors'],
      render: function FoundationsDemo() {
        const { colors, theme } = useTheme();
        return (
          <Gap>
            <AppText variant="title">Title</AppText>
            <AppText variant="body">Body</AppText>
            <AppText variant="caption" color="secondary">
              Caption · spacing.md={theme.spacing.md}
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {[colors.brand, colors.success, colors.warning, colors.error, colors.surface].map(
                (c, i) => (
                  <View
                    key={i}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: theme.radius.md,
                      backgroundColor: c,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  />
                ),
              )}
            </View>
          </Gap>
        );
      },
    },
    {
      id: 'shared.buttons-row',
      componentName: 'PrimaryButton · SecondaryButton · TertiaryButton · DestructiveButton',
      section: 'BUTTONS',
      role: 'Shared',
      sourceFile: 'src/components/buttons/',
      usedIn: ['Throughout app'],
      description: 'Core button family — interactive, no mutations.',
      layout: 'full',
      mode: 'inline',
      tags: ['PrimaryButton', 'SecondaryButton', 'TertiaryButton', 'DestructiveButton', 'button'],
      contains: ['PrimaryButton', 'SecondaryButton', 'TertiaryButton', 'DestructiveButton'],
      render: function ButtonsFamilyDemo() {
        const [loading, setLoading] = useState(false);
        return (
          <Gap>
            <PrimaryButton label="Primary" onPress={() => undefined} />
            <SecondaryButton label="Secondary" onPress={() => undefined} />
            <TertiaryButton label="Tertiary" onPress={() => undefined} />
            <DestructiveButton label="Destructive" onPress={() => undefined} />
            <PrimaryButton
              label={loading ? 'Loading…' : 'Loading demo'}
              loading={loading}
              onPress={() => {
                setLoading(true);
                setTimeout(() => setLoading(false), 1000);
              }}
            />
            <PrimaryButton label="Disabled" disabled onPress={() => undefined} />
          </Gap>
        );
      },
    },
    {
      id: 'shared.icon-button',
      componentName: 'IconButton',
      section: 'BUTTONS',
      role: 'Shared',
      sourceFile: 'src/components/buttons/IconButton.tsx',
      usedIn: ['Headers', 'toolbars'],
      description: 'Icon-only control.',
      layout: 'horizontal',
      mode: 'inline',
      tags: ['IconButton', 'icon'],
      render: function IconButtonDemo() {
        const { colors } = useTheme();
        return (
          <Gap row>
            <IconButton accessibilityLabel="Settings" onPress={() => undefined}>
              <Ionicons name="settings-outline" size={22} color={colors.textPrimary} />
            </IconButton>
            <IconButton accessibilityLabel="Search" onPress={() => undefined}>
              <Ionicons name="search-outline" size={22} color={colors.textPrimary} />
            </IconButton>
            <IconButton accessibilityLabel="More" onPress={() => undefined}>
              <Ionicons name="ellipsis-horizontal" size={22} color={colors.textPrimary} />
            </IconButton>
          </Gap>
        );
      },
    },
    {
      id: 'shared.status-badges',
      componentName: 'StatusBadge · PriorityBadge',
      section: 'STATUS',
      role: 'Shared',
      sourceFile: 'src/components/badges/',
      usedIn: ['Orders', 'Production', 'Tasks'],
      description: 'Human status and priority chips.',
      layout: 'horizontal',
      mode: 'inline',
      tags: ['StatusBadge', 'PriorityBadge', 'badge'],
      contains: ['StatusBadge', 'PriorityBadge'],
      render: () => (
        <Gap row>
          <StatusBadge status="READY" />
          <StatusBadge status="IN_PROGRESS" />
          <StatusBadge status="COMPLETED" />
          <PriorityBadge priority="high" />
          <PriorityBadge priority="urgent" />
          <PriorityBadge priority="low" />
        </Gap>
      ),
    },
    {
      id: 'shared.product-thumb',
      componentName: 'ProductThumb',
      section: 'CARDS',
      role: 'Shared',
      sourceFile: 'src/components/desk/ProductThumb.tsx',
      usedIn: ['Order cards', 'Production', 'Catalog'],
      description: 'Product media with missing-image placeholder.',
      layout: 'horizontal',
      mode: 'inline',
      tags: ['ProductThumb', 'image'],
      render: () => (
        <Gap row>
          <ProductThumb uri={null} size={64} />
          <ProductThumb uri={null} size={88} />
        </Gap>
      ),
    },
    {
      id: 'shared.surface-card',
      componentName: 'SurfaceCard',
      section: 'CARDS',
      role: 'Shared',
      sourceFile: 'src/components/surfaces/SurfaceCard.tsx',
      usedIn: ['Boards'],
      description: 'Shared paper surface.',
      layout: 'full',
      mode: 'inline',
      tags: ['SurfaceCard'],
      render: () => (
        <SurfaceCard>
          <AppText variant="body" weight="semibold">
            SurfaceCard
          </AppText>
          <AppText variant="caption" color="secondary">
            Raised board surface
          </AppText>
        </SurfaceCard>
      ),
    },
    {
      id: 'shared.search-filters',
      componentName: 'Filter chips (role / board)',
      section: 'SEARCH & FILTERS',
      role: 'Shared',
      sourceFile: 'src/components/',
      usedIn: ['Boards', 'Dev Tests'],
      description: 'Compact selectable filter chips — interactive fixture.',
      layout: 'horizontal',
      mode: 'inline',
      tags: ['filter', 'chip', 'search'],
      contains: ['FilterChip'],
      render: function SearchFiltersDemo() {
        const [sel, setSel] = useState('All');
        const opts = ['All', 'Active', 'Late', 'Ready'];
        return (
          <Gap row>
            {opts.map((o) => (
              <PressableChip
                key={o}
                label={o}
                selected={sel === o}
                onPress={() => setSel(o)}
              />
            ))}
          </Gap>
        );
      },
    },
    {
      id: 'shared.forms',
      componentName: 'TextField · InfoRow',
      section: 'FORMS',
      role: 'Shared',
      sourceFile: 'src/components/forms/',
      usedIn: ['Forms', 'detail sheets'],
      description: 'Editable field + read-only info row.',
      layout: 'full',
      mode: 'inline',
      tags: ['TextField', 'InfoRow', 'form'],
      contains: ['TextField', 'InfoRow'],
      render: function FormsDemo() {
        const [v, setV] = useState('Sample');
        return (
          <Gap>
            <TextField label="TextField" value={v} onChangeText={setV} />
            <InfoRow label="Dealer" value="Oasis Furniture" />
            <InfoRow label="Account credit" value="₪ 500" />
            <InfoRow label="Amount due" value="₪ 12,400" />
          </Gap>
        );
      },
    },
    {
      id: 'shared.headers',
      componentName: 'AppHeader · SectionHeader · Divider · BackButton',
      section: 'HEADERS',
      role: 'Shared',
      sourceFile: 'src/components/layout/',
      usedIn: ['Screens'],
      description: 'Navigation and section chrome.',
      layout: 'full',
      mode: 'inline',
      tags: ['AppHeader', 'SectionHeader', 'Divider', 'BackButton'],
      contains: ['AppHeader', 'SectionHeader', 'Divider', 'BackButton'],
      render: () => (
        <Gap>
          <AppHeader title="AppHeader" onBack={() => undefined} />
          <SectionHeader title="SectionHeader" />
          <Divider />
          <BackButton onPress={() => undefined} />
        </Gap>
      ),
    },
    {
      id: 'shared.empty-error',
      componentName: 'EmptyState · ErrorState · SkeletonLoader',
      section: 'LOADING / EMPTY / ERROR',
      role: 'Shared',
      sourceFile: 'src/components/feedback/',
      usedIn: ['Lists'],
      description: 'Empty, error, and loading patterns.',
      layout: 'full',
      mode: 'inline',
      tags: ['EmptyState', 'ErrorState', 'SkeletonLoader'],
      contains: ['EmptyState', 'ErrorState', 'SkeletonLoader'],
      render: () => (
        <Gap>
          <EmptyState title="Nothing here" description="Empty dataset" />
          <ErrorState title="Couldn’t load" description="Retry demo" onRetry={() => undefined} />
          <SkeletonLoader rows={2} />
        </Gap>
      ),
    },
    {
      id: 'shared.floating-action-dock',
      componentName: 'FloatingActionDock',
      section: 'NAVIGATION',
      role: 'Shared',
      sourceFile: 'src/components/layout/FloatingActionDock.tsx',
      usedIn: ['Orders', 'detail CTAs'],
      description: 'Floating CTA dock — transparent mode.',
      layout: 'full',
      mode: 'inline',
      tags: ['FloatingActionDock', 'dock', 'cta'],
      render: function FloatingDockDemo() {
        const { colors, theme } = useTheme();
        return (
          <View style={{ height: 120, backgroundColor: colors.surfaceSecondary }}>
            <AppText variant="caption" color="secondary" style={{ padding: theme.spacing.sm }}>
              Transparent floating dock over content
            </AppText>
            <FloatingActionDock floating>
              <PrimaryButton label="Primary CTA" onPress={() => undefined} />
            </FloatingActionDock>
          </View>
        );
      },
    },
    {
      id: 'shared.bottom-sheet',
      componentName: 'BottomSheet',
      section: 'SHEETS & POPUPS',
      role: 'Shared',
      sourceFile: 'src/components/sheets/BottomSheet.tsx',
      usedIn: ['Pickers', 'forms'],
      description: 'Open the real bottom sheet.',
      layout: 'full',
      mode: 'sheet',
      tags: ['BottomSheet', 'sheet'],
      renderSheet: ({ open, onClose }) => (
        <BottomSheet open={open} onClose={onClose} title="BottomSheet" fitContent>
          <AppText variant="body">Real sheet — dismiss to return to showroom.</AppText>
          <PrimaryButton label="Close" onPress={onClose} />
        </BottomSheet>
      ),
    },
    {
      id: 'shared.confirmation-sheet',
      componentName: 'ConfirmationSheet',
      section: 'SHEETS & POPUPS',
      role: 'Shared',
      sourceFile: 'src/components/sheets/ConfirmationSheet.tsx',
      usedIn: ['Destructive confirms'],
      description: 'Confirmation pattern.',
      layout: 'full',
      mode: 'sheet',
      tags: ['ConfirmationSheet', 'confirm'],
      renderSheet: ({ open, onClose }) => (
        <ConfirmationSheet
          open={open}
          onClose={onClose}
          title="Confirm action"
          message="Simulated — no mutation."
          onConfirm={onClose}
        />
      ),
    },
    {
      id: 'shared.action-sheet',
      componentName: 'ActionSheet',
      section: 'SHEETS & POPUPS',
      role: 'Shared',
      sourceFile: 'src/components/sheets/ActionSheet.tsx',
      usedIn: ['Menus'],
      description: 'Action list sheet.',
      layout: 'full',
      mode: 'sheet',
      tags: ['ActionSheet'],
      renderSheet: ({ open, onClose }) => (
        <ActionSheet
          open={open}
          onClose={onClose}
          title="Actions"
          actions={[
            { label: 'Option A', onPress: onClose },
            { label: 'Option B', onPress: onClose },
          ]}
        />
      ),
    },
  ];
}
