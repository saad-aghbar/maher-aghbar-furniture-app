import { Redirect, useLocalSearchParams, type Href } from 'expo-router';

/** Piece 3: Production Plan lives on detail — keep deep links working. */
export default function AdminProductionSetupRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Redirect href={`/(app)/(admin)/production/${String(id ?? '')}` as Href} />
  );
}
