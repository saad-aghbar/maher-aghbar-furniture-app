import type { SpecOptionGroup, SpecOptionValue } from '@/api/modules/catalog';
import { VariantSpecsBoard } from './VariantSpecsBoard';

type Props = {
  groups: SpecOptionGroup[];
  values: SpecOptionValue[];
  selectedByGroup: Record<string, string | null>;
  onChange: (groupId: string, valueId: string | null) => void;
  hostOpen?: boolean;
  pickerOverlay?: boolean;
};

/** Order-line picker: one ticket per category. Admin ledger is `VariantSpecsBoard`. */
export function VariantOptionGroupsBoard(props: Props) {
  return <VariantSpecsBoard {...props} compose={false} />;
}
