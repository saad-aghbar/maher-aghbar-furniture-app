import { Image, Pressable, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import type { PendingAttachment } from '../pendingAttachment';

export type { PendingAttachment } from '../pendingAttachment';

type AttachmentRowProps = {
  title: string;
  hint: string;
  files: PendingAttachment[];
  onPick: () => void;
  onRemove: (id: string) => void;
  busy?: boolean;
};

/** @deprecated Prefer UploadsStep — kept for gallery/dev fixtures. */
export function AttachmentRow({
  title,
  hint,
  files,
  onPick,
  onRemove,
  busy,
}: AttachmentRowProps) {
  const { t } = useLocale();
  const { colors, theme } = useTheme();

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <AppText variant="label" weight="semibold">
        {title}
      </AppText>
      <AppText variant="caption" color="muted">
        {hint}
      </AppText>
      <SecondaryButton
        label={busy ? t('mobile.newOrder.uploading') : t('mobile.newOrder.pickImage')}
        onPress={onPick}
        disabled={busy}
      />
      {files.map((f) => (
        <View
          key={f.id}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
            padding: theme.spacing.sm,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: theme.radius.md,
            backgroundColor: colors.surface,
          }}
        >
          <Image
            source={{ uri: f.uri }}
            style={{ width: 48, height: 48, borderRadius: theme.radius.sm }}
            resizeMode="cover"
          />
          <AppText variant="caption" style={{ flex: 1 }} numberOfLines={2}>
            {f.fileName}
          </AppText>
          <Pressable
            onPress={() => onRemove(f.id)}
            accessibilityRole="button"
            accessibilityLabel={t('mobile.newOrder.removeAttachment')}
          >
            <AppText variant="label" color="brand">
              {t('mobile.newOrder.remove')}
            </AppText>
          </Pressable>
        </View>
      ))}
    </View>
  );
}
