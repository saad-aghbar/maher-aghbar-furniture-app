import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { TextField } from '@/components/forms/TextField';
import { translateCatalogName } from '@/api/modules/catalogAdmin';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  arabic: string;
  english: string;
  onArabicChange: (value: string) => void;
  onEnglishChange: (value: string) => void;
  arabicLabel?: string;
  englishLabel?: string;
  kind?: 'name' | 'prose';
  multiline?: boolean;
};

/**
 * Arabic-first catalog copy. English stays collapsed until filled or opened,
 * with a translate / re-translate affordance.
 */
export function BilingualNameField({
  arabic,
  english,
  onArabicChange,
  onEnglishChange,
  arabicLabel,
  englishLabel,
  kind = 'name',
  multiline = false,
}: Props) {
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const [openEn, setOpenEn] = useState(() => Boolean(english.trim()));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (english.trim()) setOpenEn(true);
  }, [english]);

  const arLabel = arabicLabel ?? t('catalog.nameAr');
  const enLabel = englishLabel ?? t('catalog.englishOptional');
  const hasEnglish = Boolean(english.trim());
  const canTranslate = Boolean(arabic.trim()) && !busy;

  const translate = async () => {
    if (!canTranslate) return;
    void haptics.selection();
    setBusy(true);
    try {
      const result = await translateCatalogName(arabic.trim(), kind);
      onEnglishChange(result.nameEn);
      setOpenEn(true);
    } catch {
      setOpenEn(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <TextField
        label={arLabel}
        value={arabic}
        onChangeText={onArabicChange}
        multiline={multiline}
        growMinHeight={multiline ? 80 : undefined}
      />
      {openEn ? (
        <TextField
          label={enLabel}
          value={english}
          onChangeText={onEnglishChange}
          multiline={multiline}
          hint={t('catalog.englishOptional')}
        />
      ) : (
        <AnimatedPressable
          variant="button"
          accessibilityRole="button"
          accessibilityLabel={enLabel}
          onPress={() => {
            void haptics.selection();
            setOpenEn(true);
          }}
          style={{
            minHeight: 40,
            borderRadius: theme.radius.xl,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: theme.spacing.md,
            justifyContent: 'center',
          }}
        >
          <AppText variant="caption" color="muted">
            {enLabel}
          </AppText>
        </AnimatedPressable>
      )}
      <AnimatedPressable
        variant="button"
        accessibilityRole="button"
        accessibilityLabel={
          hasEnglish ? t('catalog.retranslate') : t('catalog.translateToEnglish')
        }
        disabled={!canTranslate}
        onPress={() => {
          void translate();
        }}
        style={{
          minHeight: 40,
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: theme.spacing.md,
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          opacity: canTranslate ? 1 : 0.45,
        }}
      >
        <Ionicons name="language-outline" size={16} color={colors.brand} />
        <AppText variant="caption" weight="medium" style={{ color: colors.brand }}>
          {busy
            ? t('common.loading')
            : hasEnglish
              ? t('catalog.retranslate')
              : t('catalog.translateToEnglish')}
        </AppText>
      </AnimatedPressable>
    </View>
  );
}
