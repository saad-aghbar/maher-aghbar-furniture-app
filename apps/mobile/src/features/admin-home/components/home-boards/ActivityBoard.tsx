import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { mapMgmtHref } from '../../mapMgmtHref';
import type { MgmtEvent } from '../../api';

type Props = { events: MgmtEvent[] };

/** Spine timeline — Activity board. */
export function ActivityBoard({ events }: Props) {
  const { formatDateTime, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const router = useRouter();

  return (
    <View style={{ gap: 0, paddingStart: isRTL ? 0 : 4, paddingEnd: isRTL ? 4 : 0 }}>
      {events.map((event, i) => {
        const when = (() => {
          try {
            return formatDateTime(event.at);
          } catch {
            return '';
          }
        })();
        const isLast = i === events.length - 1;
        const row = (
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              gap: theme.spacing.md,
              minHeight: 52,
            }}
          >
            <View style={{ alignItems: 'center', width: 16 }}>
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: colors.brand,
                  marginTop: 6,
                }}
              />
              {!isLast ? (
                <View
                  style={{
                    width: 2,
                    flex: 1,
                    backgroundColor: colors.borderStrong,
                    marginTop: 4,
                  }}
                />
              ) : null}
            </View>
            <View
              style={{
                flex: 1,
                paddingBottom: isLast ? 0 : theme.spacing.md,
                gap: 2,
              }}
            >
              <AppText variant="caption" color="muted">
                {when}
              </AppText>
              <AppText variant="bodySecondary" numberOfLines={2}>
                {event.label}
              </AppText>
            </View>
            {event.href ? (
              <Ionicons
                name={isRTL ? 'chevron-back' : 'chevron-forward'}
                size={16}
                color={colors.textMuted}
                style={{ marginTop: 8 }}
              />
            ) : null}
          </View>
        );

        if (!event.href) {
          return <View key={`${event.at}-${i}`}>{row}</View>;
        }

        return (
          <AnimatedPressable
            key={`${event.at}-${i}`}
            variant="button"
            accessibilityRole="button"
            onPress={() => {
              void haptics.selection();
              router.push(mapMgmtHref(event.href!));
            }}
          >
            {row}
          </AnimatedPressable>
        );
      })}
    </View>
  );
}
