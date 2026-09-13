import { TextField } from '@/components/forms/TextField';
import { useLocale } from '@/i18n';

type Props = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  multiline?: boolean;
  growMinHeight?: number;
  editable?: boolean;
  placeholder?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
};

/** One name/notes field in the current app language. Other locales fill on save. */
export function LocaleNameField({
  value,
  onChange,
  label,
  multiline = false,
  growMinHeight,
  editable,
  placeholder,
  autoCapitalize,
}: Props) {
  const { t } = useLocale();
  return (
    <TextField
      label={label ?? t('catalog.name')}
      value={value}
      onChangeText={onChange}
      multiline={multiline}
      growMinHeight={multiline ? (growMinHeight ?? 80) : undefined}
      editable={editable}
      placeholder={placeholder}
      autoCapitalize={autoCapitalize}
    />
  );
}
