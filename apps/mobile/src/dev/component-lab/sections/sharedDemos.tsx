/**
 * Interactive demos for shared primitives + motion — real components only.
 */
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { BackButton } from '@/components/BackButton';
import { BrandMark } from '@/components/BrandMark';
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
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { SkeletonLoader } from '@/components/feedback/SkeletonLoader';
import { CodeField } from '@/components/forms/CodeField';
import { InfoRow } from '@/components/forms/InfoRow';
import { PasswordField } from '@/components/forms/PasswordField';
import { TextField } from '@/components/forms/TextField';
import { AppHeader } from '@/components/layout/AppHeader';
import { Divider } from '@/components/layout/Divider';
import { FloatingActionDock } from '@/components/layout/FloatingActionDock';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { ActionSheet } from '@/components/sheets/ActionSheet';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { ConfirmationSheet } from '@/components/sheets/ConfirmationSheet';
import { SurfaceCard } from '@/components/surfaces/SurfaceCard';
import { AnimatedPressable, ProgressBar, SkeletonShimmer } from '@/motion';
import { useTheme } from '@/theme';
import type { LabRenderContext } from '../registry/types';

function Gap({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  return <View style={{ gap: theme.spacing.sm }}>{children}</View>;
}

export const richDemoRenderers: Record<string, (ctx: LabRenderContext) => ReactNode> = {
  'shared.primary-button': () => {
    const [loading, setLoading] = useState(false);
    return (
      <Gap>
        <PrimaryButton label="Primary filled" onPress={() => undefined} />
        <PrimaryButton label="Disabled" disabled onPress={() => undefined} />
        <PrimaryButton
          label={loading ? 'Loading…' : 'Start loading'}
          loading={loading}
          onPress={() => {
            setLoading(true);
            setTimeout(() => setLoading(false), 1200);
          }}
        />
      </Gap>
    );
  },
  'shared.secondary-button': () => (
    <Gap>
      <SecondaryButton label="Secondary" onPress={() => undefined} />
      <SecondaryButton label="Disabled" disabled onPress={() => undefined} />
    </Gap>
  ),
  'shared.tertiary-button': () => (
    <TertiaryButton label="Tertiary / ghost" onPress={() => undefined} />
  ),
  'shared.destructive-button': () => (
    <DestructiveButton label="Danger action" onPress={() => undefined} />
  ),
  'shared.icon-button': () => {
    const { colors } = useTheme();
    return (
      <IconButton accessibilityLabel="Settings" onPress={() => undefined}>
        <Ionicons name="settings-outline" size={22} color={colors.textPrimary} />
      </IconButton>
    );
  },
  'shared.app-text': () => (
    <Gap>
      <AppText variant="display">Display</AppText>
      <AppText variant="largeTitle">Large title</AppText>
      <AppText variant="title">Title</AppText>
      <AppText variant="heading">Heading</AppText>
      <AppText variant="body">Body copy</AppText>
      <AppText variant="bodySecondary" color="secondary">
        Body secondary
      </AppText>
      <AppText variant="caption" color="muted">
        Caption / metadata
      </AppText>
      <AppText variant="label" weight="semibold">
        Button label
      </AppText>
    </Gap>
  ),
  'shared.surface-card': () => (
    <SurfaceCard>
      <AppText variant="body" weight="semibold">
        SurfaceCard
      </AppText>
      <AppText variant="caption" color="secondary">
        Raised surface used across boards
      </AppText>
    </SurfaceCard>
  ),
  'shared.status-badge': () => (
    <Gap>
      <StatusBadge status="READY" />
      <StatusBadge status="IN_PROGRESS" />
      <StatusBadge status="ATTENTION" />
      <StatusBadge status="COMPLETED" />
    </Gap>
  ),
  'shared.priority-badge': () => (
    <Gap>
      <PriorityBadge priority="high" />
      <PriorityBadge priority="medium" />
      <PriorityBadge priority="low" />
      <PriorityBadge priority="urgent" />
    </Gap>
  ),
  'shared.text-field': () => {
    const [v, setV] = useState('Editable');
    return (
      <Gap>
        <TextField label="Text" value={v} onChangeText={setV} />
        <TextField label="Error" value="" onChangeText={() => undefined} error="Required" />
        <TextField label="Disabled" value="Locked" editable={false} />
      </Gap>
    );
  },
  'shared.password-field': () => {
    const [v, setV] = useState('secret');
    return (
      <PasswordField
        label="Password"
        value={v}
        onChangeText={setV}
        showLabel="Show"
        hideLabel="Hide"
      />
    );
  },
  'shared.code-field': () => {
    const [v, setV] = useState('');
    return <CodeField label="Code" value={v} onChangeText={setV} />;
  },
  'shared.info-row': () => (
    <Gap>
      <InfoRow label="Dealer" value="Oasis Furniture" />
      <InfoRow label="Amount due" value="₪ 12,400" />
      <InfoRow label="Account credit" value="₪ 500" />
    </Gap>
  ),
  'shared.empty-state': () => (
    <EmptyState title="Nothing here" description="Empty dataset example" />
  ),
  'shared.error-state': () => (
    <ErrorState title="Couldn’t load" description="Network error example" onRetry={() => undefined} />
  ),
  'shared.skeleton-loader': () => <SkeletonLoader />,
  'shared.offline-banner': () => <OfflineBanner />,
  'shared.section-header': () => <SectionHeader title="Section header" />,
  'shared.divider': () => <Divider />,
  'shared.app-header': () => <AppHeader title="App header" />,
  'shared.back-button': () => <BackButton onPress={() => undefined} />,
  'shared.brand-mark': () => <BrandMark />,
  'shared.product-thumb': () => <ProductThumb uri={null} size={72} />,
  'shared.bottom-sheet': () => {
    const [open, setOpen] = useState(false);
    return (
      <Gap>
        <SecondaryButton label="Open BottomSheet" onPress={() => setOpen(true)} />
        <BottomSheet open={open} onClose={() => setOpen(false)} title="BottomSheet" fitContent>
          <AppText variant="body">Real BottomSheet — close via dismiss.</AppText>
          <PrimaryButton label="Close" onPress={() => setOpen(false)} />
        </BottomSheet>
      </Gap>
    );
  },
  'shared.confirmation-sheet': () => {
    const [open, setOpen] = useState(false);
    return (
      <Gap>
        <SecondaryButton label="Open ConfirmationSheet" onPress={() => setOpen(true)} />
        <ConfirmationSheet
          open={open}
          onClose={() => setOpen(false)}
          title="Confirm action"
          message="Simulated confirmation — no mutation."
          confirmLabel="Confirm"
          onConfirm={() => setOpen(false)}
        />
      </Gap>
    );
  },
  'shared.action-sheet': () => {
    const [open, setOpen] = useState(false);
    return (
      <Gap>
        <SecondaryButton label="Open ActionSheet" onPress={() => setOpen(true)} />
        <ActionSheet
          open={open}
          onClose={() => setOpen(false)}
          title="Actions"
          actions={[
            { label: 'Option A', onPress: () => setOpen(false) },
            { label: 'Option B', onPress: () => setOpen(false) },
          ]}
        />
      </Gap>
    );
  },
  'shared.floating-action-dock': () => {
    const { colors, theme } = useTheme();
    return (
      <View style={{ height: 180, backgroundColor: colors.surfaceSecondary }}>
        <AppText variant="caption" color="secondary" style={{ padding: theme.spacing.md }}>
          Checker area behind dock (transparent floating mode)
        </AppText>
        <FloatingActionDock floating>
          <PrimaryButton label="Floating CTA" onPress={() => undefined} />
        </FloatingActionDock>
      </View>
    );
  },
  'motion.animated-pressable': () => (
    <AnimatedPressable onPress={() => undefined} style={{ padding: 12 }}>
      <AppText>AnimatedPressable</AppText>
    </AnimatedPressable>
  ),
  'motion.skeleton-shimmer': () => <SkeletonShimmer height={48} />,
  'motion.progress-bar': () => <ProgressBar progress={0.65} />,
};

/** Foundations token board — real theme values */
export function FoundationsDemo(_ctx?: LabRenderContext) {
  const { colors, theme } = useTheme();
  const swatches: { label: string; color: string }[] = [
    { label: 'background', color: colors.background },
    { label: 'surface', color: colors.surface },
    { label: 'surfaceSecondary', color: colors.surfaceSecondary },
    { label: 'brand', color: colors.brand },
    { label: 'error', color: colors.error },
    { label: 'warning', color: colors.warning },
    { label: 'success', color: colors.success },
    { label: 'info', color: colors.info },
  ];
  return (
    <Gap>
      <AppText variant="heading" weight="semibold">
        Typography
      </AppText>
      <AppText variant="title">Title</AppText>
      <AppText variant="body">Body</AppText>
      <AppText variant="caption" color="secondary">
        Caption
      </AppText>
      <AppText variant="heading" weight="semibold">
        Surfaces
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {swatches.map((s) => (
          <View key={s.label} style={{ width: 96, gap: 4 }}>
            <View
              style={{
                height: 40,
                borderRadius: theme.radius.md,
                backgroundColor: s.color,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            />
            <AppText variant="caption">{s.label}</AppText>
          </View>
        ))}
      </View>
      <AppText variant="caption" color="secondary">
        spacing.md={String(theme.spacing.md)} · radius.lg={String(theme.radius.lg)}
      </AppText>
    </Gap>
  );
}
