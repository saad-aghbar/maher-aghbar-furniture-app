import { useEffect, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';
import { PurchasingFloorBoard } from './PurchasingFloorBoard';

export type WhatsAppPreviewMessage = {
  orderId: string;
  supplierName: string;
  to?: string | null;
  body: string;
  templateBody?: string;
  lines?: Array<{ description: string; quantity?: number; unit?: string }>;
};

export type WhatsAppSendResult = {
  id: string;
  ok: boolean;
  error?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  sending?: boolean;
  messages?: WhatsAppPreviewMessage[];
  /** Legacy single-supplier props — wrapped into one message when `messages` is omitted. */
  to?: string | null;
  body?: string;
  templateBody?: string;
  results?: WhatsAppSendResult[];
  onSend: (orders: Array<{ id: string; body: string }>) => void;
};

export function PurchaseWhatsAppPreviewSheet({
  open,
  onClose,
  title,
  sending,
  messages,
  to,
  body,
  templateBody,
  results,
  onSend,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const { height } = useWindowDimensions();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const sheetHeight = Math.min(Math.round(height * 0.86), 740);
  const initial = messages?.length
    ? messages
    : [
        {
          orderId: 'single',
          supplierName: '',
          to,
          body: body ?? '',
          templateBody: templateBody ?? body,
        },
      ];
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    const next: Record<string, string> = {};
    for (const message of initial) next[message.orderId] = message.body;
    setDrafts(next);
  }, [open, messages, body]);

  const resultById = new Map((results ?? []).map((row) => [row.id, row]));

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={title ?? t('mobile.purchasing.whatsappPreview')}
      expandable
      sheetHeight={sheetHeight}
    >
      <ScrollView contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.sm }}>
        {initial.map((message) => {
          const result = resultById.get(message.orderId);
          return (
            <PurchasingFloorBoard
              key={message.orderId}
              title={message.supplierName || t('mobile.purchasing.whatsappMessage')}
            >
              {message.to ? (
                <AppText variant="caption" color="muted" dir="ltr">
                  {`${t('mobile.purchasing.whatsappTo')}: ${message.to}`}
                </AppText>
              ) : (
                <View
                  style={{
                    borderRadius: theme.radius.lg,
                    backgroundColor: colors.warningSoft,
                    padding: theme.spacing.sm,
                  }}
                >
                  <AppText color="warning" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {t('mobile.purchasing.whatsappNoPhone')}
                  </AppText>
                </View>
              )}
              <TextField
                label={t('mobile.purchasing.whatsappMessage')}
                value={drafts[message.orderId] ?? message.body}
                onChangeText={(value) =>
                  setDrafts((prev) => ({ ...prev, [message.orderId]: value }))
                }
                multiline
              />
              {(message.lines ?? []).map((line, index) => (
                <AppText
                  key={`${message.orderId}-${index}`}
                  variant="caption"
                  color="muted"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {`• ${line.description}${line.quantity != null ? ` · ${line.quantity} ${line.unit ?? ''}` : ''}`}
                </AppText>
              ))}
              <SecondaryButton
                label={t('mobile.purchasing.resetTemplate')}
                onPress={() => {
                  void haptics.selection();
                  setDrafts((prev) => ({
                    ...prev,
                    [message.orderId]: message.templateBody ?? message.body,
                  }));
                }}
                style={{ borderRadius: theme.radius.full, minHeight: 44 }}
              />
              {result ? (
                <AppText
                  weight={titleWeight}
                  color={result.ok ? 'success' : 'error'}
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {result.ok
                    ? t('mobile.purchasing.sent')
                    : result.error || t('mobile.purchasing.failed')}
                </AppText>
              ) : null}
            </PurchasingFloorBoard>
          );
        })}
        <PrimaryButton
          label={t('mobile.purchasing.sendAll')}
          loading={sending}
          disabled={sending}
          onPress={() => {
            void haptics.confirmMedium();
            onSend(
              initial.map((message) => ({
                id: message.orderId,
                body: (drafts[message.orderId] ?? message.body).trim(),
              })),
            );
          }}
          style={{ borderRadius: theme.radius.full, minHeight: 44 }}
        />
        <SecondaryButton
          label={t('mobile.purchasing.cancel')}
          onPress={onClose}
          style={{ borderRadius: theme.radius.full, minHeight: 44 }}
        />
      </ScrollView>
    </BottomSheet>
  );
}
