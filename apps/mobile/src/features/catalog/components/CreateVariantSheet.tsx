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
import { invalidateFactoryJourney } from '@/api/invalidateFactoryJourney';
import { toastMessageForError } from '@/api/queryClient';
import { useToast } from '@/components/feedback/Toast';
import { isApiError } from '@/api/errors';
import { LocaleNameField } from './BilingualNameField';
import { resolveTrilingualName } from '@/i18n/resolveTrilingualName';

type Props = {
  open: boolean;
  productId: string;
  onClose: () => void;
  onCreated: (variant: AdminProductVariant) => void;
};

export function CreateVariantSheet({ open, productId, onClose, onCreated }: Props) {
  const { t, locale } = useLocale();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState('');

  useEffect(() => {
    if (!open) return;
    setName('');
  }, [open]);

  const create = useMutation({
    mutationFn: async () => {
      const names = await resolveTrilingualName(name, locale);
      return createProductVariant(productId, {
        nameAr: names.nameAr,
        nameEn: names.nameEn || undefined,
        nameHe: names.nameHe || undefined,
      });
    },
    onSuccess: async (row) => {
      await qc.invalidateQueries({ queryKey: queryKeys.catalog.variants(productId) });
      await invalidateFactoryJourney(qc);
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

  const canSave = Boolean(name.trim());

  return (
    <BottomSheet open={open} onClose={onClose} title={t('catalog.createVariant')} fitContent>
      <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.md }}>
        <AppText variant="caption" color="muted">
          {t('catalog.variantsHint')}
        </AppText>
        <LocaleNameField
          value={name}
          onChange={setName}
          label={t('catalog.name')}
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
