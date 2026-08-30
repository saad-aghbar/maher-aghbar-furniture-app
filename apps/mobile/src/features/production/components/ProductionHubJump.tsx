import { Pressable, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';

export type ProductionHubSection = 'overview' | 'materials' | 'wip' | 'tasks';

type Props = {
  active: ProductionHubSection;
  onChange: (section: ProductionHubSection) => void;
};

const SECTIONS: ProductionHubSection[] = ['overview', 'materials', 'wip', 'tasks'];

function labelKey(section: ProductionHubSection): string {
  switch (section) {
    case 'overview':
      return 'mobile.production.hubJumpOverview';
    case 'materials':
      return 'mobile.production.hubJumpMaterials';
    case 'wip':
      return 'mobile.production.hubJumpWip';
    case 'tasks':
      return 'mobile.production.hubJumpTasks';
  }
}

export function ProductionHubJump({ active, onChange }: Props) {
  const { t, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();

  return (
    <View
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        backgroundColor: colors.surfaceSecondary,
        padding: 5,
        flexDirection: isRTL ? 'row-reverse' : 'row',
        gap: 3,
      }}
    >
      {SECTIONS.map((section) => {
        const selected = active === section;
        return (
          <Pressable
            key={section}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => {
              if (selected) return;
              void haptics.selection();
              onChange(section);
            }}
            style={{
              flex: 1,
              minHeight: 36,
              borderRadius: theme.radius.lg,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 4,
              backgroundColor: selected ? colors.surface : 'transparent',
              borderWidth: selected ? 1 : 0,
              borderColor: selected ? colors.borderStrong : 'transparent',
              ...(selected
                ? colorScheme === 'dark'
                  ? {
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.22,
                      shadowRadius: 3,
                    }
                  : {
                      shadowColor: '#1E1A1B',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.08,
                      shadowRadius: 2,
                    }
                : null),
            }}
          >
            <AppText
              variant="caption"
              weight={selected ? 'semibold' : 'medium'}
              numberOfLines={1}
              style={{
                color: selected ? colors.brand : colors.textMuted,
                fontSize: 11,
                textAlign: 'center',
              }}
            >
              {t(labelKey(section))}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
