import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  children?: ReactNode;
  title?: string;
  trailing?: ReactNode;
  onHeaderPress?: () => void;
  /** Brand-wash the header band (open accordion, selected chrome). */
  headerAccent?: boolean;
  /** Header-only board — skip the body pad (collapsed accordion). */
  hideBody?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

export function PurchasingFloorBoard({
  children,
  title,
  trailing,
  onHeaderPress,
  headerAccent,
  hideBody,
  style,
  contentStyle,
}: Props) {
  const { isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const showHeader = Boolean(title || trailing);
  const showBody = !hideBody && children != null && children !== false;

  const headerStyle = {
    paddingTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
    ...(isRTL
      ? { paddingRight: theme.spacing.lg + 4 }
      : { paddingLeft: theme.spacing.lg + 4 }),
    flexDirection: isRTL ? ('row-reverse' as const) : ('row' as const),
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.sm,
    borderBottomWidth: showBody ? 1 : 0,
    borderBottomColor: colors.border,
    backgroundColor: headerAccent ? colors.brandSoft : colors.surfaceSecondary,
    minHeight: theme.sizes.touch.min,
  };

  const headerInner = (
    <>
      {title ? (
        <AppText
          variant="heading"
          weight={titleWeight}
          style={{
            flex: 1,
            minWidth: 0,
            color: headerAccent ? colors.brand : colors.textPrimary,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {title}
        </AppText>
      ) : (
        <View style={{ flex: 1 }} />
      )}
      {trailing}
    </>
  );

  return (
    <View
      style={[
        {
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: headerAccent ? colors.brand : colors.borderStrong,
          backgroundColor: colors.surface,
          overflow: 'hidden',
          ...orderBoardShadow(colorScheme),
        },
        style,
      ]}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: 3,
          backgroundColor: colors.brand,
          opacity: headerAccent ? 0.85 : 0.55,
          ...(isRTL ? { right: 0 } : { left: 0 }),
        }}
      />
      {showHeader ? (
        onHeaderPress ? (
          <AnimatedPressable
            variant="button"
            accessibilityRole="button"
            accessibilityState={{ expanded: Boolean(headerAccent) }}
            onPress={() => {
              void haptics.selection();
              onHeaderPress();
            }}
            style={headerStyle}
          >
            {headerInner}
          </AnimatedPressable>
        ) : (
          <View style={headerStyle}>{headerInner}</View>
        )
      ) : null}
      {showBody ? (
        <View
          style={[
            {
              padding: theme.spacing.lg,
              gap: theme.spacing.md,
              ...(isRTL
                ? { paddingRight: theme.spacing.lg + 4 }
                : { paddingLeft: theme.spacing.lg + 4 }),
            },
            contentStyle,
          ]}
        >
          {children}
        </View>
      ) : null}
    </View>
  );
}
