import type { Href } from 'expo-router';
import { BackButton } from '@/components/BackButton';
import { useSmartBack } from '@/navigation/useSmartBack';

type Props = {
  fallback: Href;
};

/** Drop-in lead control for pushed screens that need an escape hatch. */
export function ScreenBackLead({ fallback }: Props) {
  const onBack = useSmartBack(fallback);
  return <BackButton onPress={onBack} />;
}
