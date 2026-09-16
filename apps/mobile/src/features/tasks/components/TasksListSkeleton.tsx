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
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            backgroundColor: colors.surface,
            borderRadius: theme.radius.xl,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            overflow: 'hidden',
            opacity: 0.75 - i * 0.08,
            ...orderBoardShadow(colorScheme),
          }}
        >
          <View
            style={{
              height: 40,
              backgroundColor: colors.surfaceSecondary,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              paddingHorizontal: theme.spacing.md,
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Bone height={22} width={88} radius={11} />
              <Bone height={14} width={48} />
            </View>
          </View>
          <View style={{ padding: theme.spacing.md, gap: theme.spacing.md }}>
            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <Bone height={72} width={72} radius={theme.radius.lg} />
              <View style={{ flex: 1, gap: 8, justifyContent: 'center' }}>
                <Bone height={18} width="48%" />
                <Bone height={52} width="100%" radius={theme.radius.lg} />
              </View>
            </View>
            <Bone height={64} width="100%" radius={theme.radius.lg} />
            <Bone height={64} width="100%" radius={theme.radius.lg} />
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
