import { View } from 'react-native';
import { useTheme } from '@/theme';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';

function Bone({
  height,
  width,
  radius,
}: {
  height: number;
  width: number | `${number}%`;
  radius?: number;
}) {
  const { colors, theme } = useTheme();
  return (
    <View
      style={{
        height,
        width,
        borderRadius: radius ?? theme.radius.sm,
        backgroundColor: colors.surfaceSecondary,
      }}
    />
  );
}

export function TasksListSkeleton() {
  const { colors, theme, colorScheme } = useTheme();
  return (
    <View style={{ gap: theme.spacing.md }}>
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          overflow: 'hidden',
          opacity: 0.85,
          ...orderBoardShadow(colorScheme),
        }}
      >
        <View style={{ height: 3, backgroundColor: colors.brand, opacity: 0.2 }} />
        <View style={{ padding: theme.spacing.md, gap: theme.spacing.md }}>
          <Bone height={12} width="28%" />
          <Bone height={28} width="48%" />
          <Bone height={14} width="62%" />
          <Bone height={48} width="100%" radius={24} />
          <Bone height={32} width="100%" radius={theme.radius.lg} />
        </View>
      </View>

      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            backgroundColor: colors.surface,
            borderRadius: theme.radius.xl,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            overflow: 'hidden',
            opacity: 0.75,
            ...orderBoardShadow(colorScheme),
          }}
        >
          <View style={{ height: 3, backgroundColor: colors.borderStrong }} />
          <View style={{ padding: theme.spacing.md, gap: theme.spacing.md }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                gap: theme.spacing.sm,
              }}
            >
              <Bone height={22} width={88} radius={11} />
              <Bone height={22} width={64} radius={11} />
            </View>
            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <Bone height={76} width={76} radius={theme.radius.lg} />
              <View style={{ flex: 1, gap: 8, justifyContent: 'center' }}>
                <Bone height={18} width="78%" />
                <Bone height={14} width="42%" />
                <Bone height={12} width="55%" />
              </View>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

export function TaskDetailSkeleton() {
  const { colors, theme } = useTheme();
  return (
    <View style={{ gap: theme.spacing.lg, paddingTop: theme.spacing.md }}>
      <View
        style={{
          height: 200,
          borderRadius: theme.radius.lg,
          backgroundColor: colors.surfaceSecondary,
        }}
      />
      <View
        style={{
          height: 24,
          width: '70%',
          borderRadius: theme.radius.sm,
          backgroundColor: colors.surfaceSecondary,
        }}
      />
      <View
        style={{
          height: 80,
          borderRadius: theme.radius.md,
          backgroundColor: colors.surfaceSecondary,
        }}
      />
      <View
        style={{
          height: 52,
          borderRadius: theme.radius.md,
          backgroundColor: colors.surfaceSecondary,
        }}
      />
    </View>
  );
}
