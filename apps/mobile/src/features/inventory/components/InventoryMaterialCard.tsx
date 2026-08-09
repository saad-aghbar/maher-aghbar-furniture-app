import { InventoryMaterialRow } from './InventoryMaterialRow';
import type { InventoryItemCardModel } from '../selectInventory';

type InventoryMaterialCardProps = {
  item: InventoryItemCardModel;
  onPress: () => void;
  canReceive?: boolean;
  canIssue?: boolean;
  canEdit?: boolean;
  canLabelPdf?: boolean;
  onReceive?: () => void;
  onIssue?: () => void;
  onEdit?: () => void;
  onLabelPdf?: () => void;
};

/** Classic list card — delegates to signature material row. */
export function InventoryMaterialCard(props: InventoryMaterialCardProps) {
  return <InventoryMaterialRow {...props} index={0} />;
}
