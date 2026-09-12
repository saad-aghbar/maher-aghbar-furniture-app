import { dealerFabricsPayload } from './FabricSelectionsEditor';
import { formatDimensionsNotes } from './newOrderMeasurements';
import type { NewOrderLine } from './newOrderLine';

export type ReviewBasketLine = {
  name: string;
  quantity: string;
  variant: string;
  fabric: string;
  dimensions: string;
  notes: string;
};

export function selectReviewBasketLine(
  line: NewOrderLine,
  untitled: string,
  defaultVariant: string,
): ReviewBasketLine {
  const fabric = dealerFabricsPayload(line.fabrics)
    .map((row) => [row.type, row.color, row.role].filter(Boolean).join(' · '))
    .join('; ');
  const dimensions = formatDimensionsNotes({
    width: line.dimWidth,
    height: line.dimHeight,
    depth: line.dimDepth,
    seat: line.dimSeat,
    custom: line.customMeasurements,
  });
  return {
    name: line.customProductName.trim() || line.variantLabel.trim() || untitled,
    quantity: line.quantity,
    variant: line.variantLabel.trim() || defaultVariant,
    fabric,
    dimensions,
    notes: line.notes.trim(),
  };
}
