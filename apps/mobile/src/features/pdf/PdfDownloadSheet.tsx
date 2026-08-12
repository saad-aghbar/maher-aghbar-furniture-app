import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { PdfDownloadLang, PdfDownloadTheme } from './pdfDownloadTypes';

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (lang: PdfDownloadLang, theme: PdfDownloadTheme) => void;
  /** Fires after the Modal fully unmounts — use before Linking / Share / pickers. */
  onClosed?: () => void;
};

const LANGS: Array<{ id: PdfDownloadLang; labelKey: string; native: string }> = [
  { id: 'ar', labelKey: 'mobile.pdfDownload.langAr', native: 'العربية' },
  { id: 'en', labelKey: 'mobile.pdfDownload.langEn', native: 'English' },
  { id: 'he', labelKey: 'mobile.pdfDownload.langHe', native: 'עברית' },
];

const THEMES: Array<{
  id: PdfDownloadTheme;
  labelKey: string;
  paper: string;
  rule: string;
  ink: string;
}> = [
  {
    id: 'white',
    labelKey: 'mobile.pdfDownload.themeWhite',
    paper: '#F7F3EC',
    rule: 'rgba(30, 26, 27, 0.10)',
    ink: '#1E1A1B',
  },
  {
    id: 'brown',
    labelKey: 'mobile.pdfDownload.themeBrown',
    paper: '#2A1E17',
    rule: 'rgba(245, 241, 234, 0.18)',
    ink: '#F5F1EA',
  },
];

/**
 * Export sheet — iOS segmented language, paper-preview print tiles, pill download.
 */
export function PdfDownloadSheet({ open, onClose, onConfirm, onClosed }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const dark = colorScheme === 'dark';
  const defaultLang = (['ar', 'en', 'he'].includes(locale)
    ? locale
    : 'en') as PdfDownloadLang;
  const [lang, setLang] = useState<PdfDownloadLang>(defaultLang);
  const [pdfTheme, setPdfTheme] = useState<PdfDownloadTheme>('white');

  useEffect(() => {
    if (!open) return;
    setLang(defaultLang);
    setPdfTheme('white');
  }, [open, defaultLang]);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      onClosed={onClosed}
      title={t('mobile.pdfDownload.title')}
      fitContent
    >
      <View style={{ gap: theme.spacing.xl }}>
        <View style={{ gap: theme.spacing.sm }}>
          <SectionLabel>{t('mobile.pdfDownload.languageSection')}</SectionLabel>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              backgroundColor: colors.surfaceSecondary,
              borderRadius: theme.radius.full,
              padding: 3,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.border,
            }}
          >
            {LANGS.map((item) => {
              const selected = item.id === lang;
              const label = (() => {
                const v = t(item.labelKey);
                return v === item.labelKey ? item.native : v;
              })();
              return (
                <AnimatedPressable
                  key={item.id}
                  variant="button"
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    void haptics.selection();
                    setLang(item.id);
                  }}
                  style={{
                    flex: 1,
                    minHeight: 36,
                    borderRadius: theme.radius.full,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: theme.spacing.sm,
                    backgroundColor: selected ? colors.surface : 'transparent',
                    ...(selected
                      ? dark
                        ? {
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.45,
                            shadowRadius: 3,
                            elevation: 2,
                          }
                        : {
                            shadowColor: '#1E1A1B',
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.12,
                            shadowRadius: 3,
                            elevation: 2,
                          }
                      : null),
                  }}
                >
                  <AppText
                    variant="label"
                    weight={selected ? titleWeight : 'medium'}
                    numberOfLines={1}
                    style={{
                      color: selected ? colors.textPrimary : colors.textSecondary,
                      fontSize: 13,
                    }}
                  >
                    {label}
                  </AppText>
                </AnimatedPressable>
              );
            })}
          </View>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <SectionLabel>{t('mobile.pdfDownload.themeSection')}</SectionLabel>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              gap: theme.spacing.md,
            }}
          >
            {THEMES.map((item) => {
              const selected = item.id === pdfTheme;
              return (
                <AnimatedPressable
                  key={item.id}
                  variant="card"
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    void haptics.selection();
                    setPdfTheme(item.id);
                  }}
                  style={{
                    flex: 1,
                    gap: theme.spacing.sm,
                    padding: theme.spacing.sm,
                    borderRadius: theme.radius.xl,
                    backgroundColor: colors.surfaceSecondary,
                    borderWidth: selected ? 1.5 : StyleSheet.hairlineWidth,
                    borderColor: selected ? colors.brand : colors.border,
                  }}
                >
                  <View
                    style={{
                      aspectRatio: 0.72,
                      borderRadius: theme.radius.lg,
                      backgroundColor: item.paper,
                      overflow: 'hidden',
                      paddingHorizontal: 14,
                      paddingVertical: 16,
                      gap: 7,
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor:
                        item.id === 'white'
                          ? 'rgba(30, 26, 27, 0.08)'
                          : 'rgba(245, 241, 234, 0.12)',
                    }}
                  >
                    <View
                      style={{
                        height: 5,
                        width: '62%',
                        borderRadius: 2,
                        backgroundColor: item.ink,
                        opacity: 0.55,
                      }}
                    />
                    <View
                      style={{
                        height: 3,
                        width: '88%',
                        borderRadius: 1.5,
                        backgroundColor: item.rule,
                      }}
                    />
                    <View
                      style={{
                        height: 3,
                        width: '76%',
                        borderRadius: 1.5,
                        backgroundColor: item.rule,
                      }}
                    />
                    <View
                      style={{
                        height: 3,
                        width: '84%',
                        borderRadius: 1.5,
                        backgroundColor: item.rule,
                      }}
                    />
                    {selected ? (
                      <View
                        style={{
                          position: 'absolute',
                          top: 8,
                          ...(isRTL ? { left: 8 } : { right: 8 }),
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          backgroundColor: colors.brand,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Ionicons name="checkmark" size={13} color={colors.onBrand} />
                      </View>
                    ) : null}
                  </View>
                  <AppText
                    variant="label"
                    weight={selected ? titleWeight : 'medium'}
                    align="center"
                    style={{
                      color: selected ? colors.brand : colors.textPrimary,
                    }}
                  >
                    {t(item.labelKey)}
                  </AppText>
                </AnimatedPressable>
              );
            })}
          </View>
        </View>

        <View
          style={{
            paddingTop: theme.spacing.md,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
          }}
        >
          <AnimatedPressable
            variant="button"
            accessibilityRole="button"
            accessibilityLabel={t('mobile.pdfDownload.confirm')}
            onPress={() => {
              void haptics.confirmMedium();
              onConfirm(lang, pdfTheme);
            }}
            style={{
              minHeight: 50,
              borderRadius: theme.radius.full,
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: theme.spacing.sm,
              paddingHorizontal: theme.spacing.xl,
              backgroundColor: colors.brand,
              ...(dark
                ? {
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.35,
                    shadowRadius: 10,
                    elevation: 5,
                  }
                : {
                    shadowColor: colors.brand,
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.28,
                    shadowRadius: 12,
                    elevation: 4,
                  }),
            }}
          >
            <Ionicons name="arrow-down-circle" size={20} color={colors.onBrand} />
            <AppText
              variant="label"
              weight={titleWeight}
              style={{ color: colors.onBrand }}
            >
              {t('mobile.pdfDownload.confirm')}
            </AppText>
          </AnimatedPressable>
        </View>
      </View>
    </BottomSheet>
  );
}

function SectionLabel({ children }: { children: string }) {
  const { locale, isRTL } = useLocale();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  return (
    <AppText
      variant="caption"
      color="muted"
      weight={titleWeight}
      style={{
        textTransform: locale === 'ar' ? 'none' : 'uppercase',
        letterSpacing: locale === 'ar' ? 0 : 0.8,
        fontSize: 11,
        paddingHorizontal: 4,
        textAlign: isRTL ? 'right' : 'left',
      }}
    >
      {children}
    </AppText>
  );
}
