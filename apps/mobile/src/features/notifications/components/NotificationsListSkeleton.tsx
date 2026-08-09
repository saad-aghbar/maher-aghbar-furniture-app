import { View } from 'react-native';
import { useTheme } from '@/theme';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';

function BoardSkeleton({ tall }: { tall?: boolean }) {
  const { colors, theme, colorScheme } = useTheme();
  return (
    <View
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        overflow: 'hidden',
        ...orderBoardShadow(colorScheme),
      }}
    >
      <View
        style={{
          height: 44,
          backgroundColor: colors.surfaceSecondary,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      />
      <View style={{ padding: theme.spacing.lg, gap: theme.spacing.sm }}>
        <View
          style={{
            height: 16,
            width: '72%',
            borderRadius: 8,
            backgroundColor: colors.surfaceSecondary,
          }}
        />
        <View
          style={{
            height: 12,
            width: '92%',
            borderRadius: 8,
            backgroundColor: colors.surfaceSecondary,
            opacity: 0.85,
          }}
        />
        {tall ? (
          <View
            style={{
              height: 12,
              width: '64%',
              borderRadius: 8,
              backgroundColor: colors.surfaceSecondary,
              opacity: 0.7,
            }}
          />
        ) : null}
      </View>
    </View>
  );
}

export function NotificationsListSkeleton() {
  const { colors, theme, colorScheme } = useTheme();

  return (
    <View style={{ gap: theme.spacing.md, paddingTop: theme.spacing.sm }}>
      <View
        style={{
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          backgroundColor: colors.surface,
          overflow: 'hidden',
          ...orderBoardShadow(colorScheme),
        }}
      >
        <View
          style={{
            height: 36,
            backgroundColor: colors.surfaceSecondary,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        />
        <View style={{ padding: theme.spacing.md, gap: theme.spacing.md }}>
          <View
            style={{
              height: 48,
              borderRadius: 24,
              backgroundColor: colors.surfaceSecondary,
            }}
          />
          <View
            style={{
              height: theme.sizes.touch.min,
              borderRadius: theme.radius.full,
              backgroundColor: colors.surfaceSecondary,
              opacity: 0.75,
            }}
          />
        </View>
      </View>

      <View
        style={{
          height: 18,
          alignSelf: 'center',
          width: '70%',
          borderRadius: 9,
          backgroundColor: colors.surfaceSecondary,
          opacity: 0.55,
        }}
      />

      <BoardSkeleton tall />
      <BoardSkeleton />
      <BoardSkeleton tall />
      <BoardSkeleton />
    </View>
  );
}

