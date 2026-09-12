import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import {
  createProductVariant,
  type AdminProductVariant,
} from '@/api/modules/catalogAdmin';
import { queryKeys } from '@/api/queryKeys';
import { toastMessageForError } from '@/api/queryClient';
import { useToast } from '@/components/feedback/Toast';
import { isApiError } from '@/api/errors';
import { BilingualNameField } from './BilingualNameField';

type Props = {
  open: boolean;
  productId: string;
  onClose: () => void;
  onCreated: (variant: AdminProductVariant) => void;
};

export function CreateVariantSheet({ open, productId, onClose, onCreated }: Props) {
  const { t } = useLocale();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const qc = useQueryClient();
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');

  useEffect(() => {
    if (!open) return;
    setNameAr('');
    setNameEn('');
  }, [open]);

  const create = useMutation({
    mutationFn: () =>
      createProductVariant(productId, {
        nameAr: nameAr.trim(),
        nameEn: nameEn.trim() || undefined,
      }),
    onSuccess: async (row) => {
      await qc.invalidateQueries({ queryKey: queryKeys.catalog.variants(productId) });
      showToast({ variant: 'success', message: t('catalog.variantSaved') });
      onCreated(row);
    },
    onError: (err) => {
      showToast({
        variant: 'error',
        message: isApiError(err) ? toastMessageForError(err) : t('errors.REQUEST_FAILED'),
      });
    },
  });

  const canSave = Boolean(nameAr.trim());

  return (
    <BottomSheet open={open} onClose={onClose} title={t('catalog.createVariant')} fitContent>
      <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.md }}>
        <AppText variant="caption" color="muted">
          {t('catalog.variantsHint')}
        </AppText>
        <BilingualNameField
          arabic={nameAr}
          english={nameEn}
          onArabicChange={setNameAr}
          onEnglishChange={setNameEn}
          arabicLabel={t('catalog.variantNameAr')}
          englishLabel={t('catalog.variantNameEn')}
        />
        <PrimaryButton
          label={t('catalog.createVariant')}
          disabled={!canSave || create.isPending}
          loading={create.isPending}
          onPress={() => {
            create.mutate();
          }}
        />
      </View>
    </BottomSheet>
  );
}
