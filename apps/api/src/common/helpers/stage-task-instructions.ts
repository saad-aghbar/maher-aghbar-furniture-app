/**
 * Stage-specific work instructions generated when a sales order is split
 * into production tasks (one instruction set per stage / worker specialty).
 */
export function buildStageTaskInstructions(opts: {
  stageCode: string;
  stageNameEn: string;
  productDescription: string;
  quantity: number | string;
  specifications?: string | null;
}): string {
  const qty = Number(opts.quantity);
  const qtyLabel = Number.isFinite(qty) ? String(qty) : String(opts.quantity);
  const productLine = `${opts.productDescription} × ${qtyLabel}`;
  const specs = opts.specifications?.trim();
  const specsBlock = specs ? `\nSpecs: ${specs}` : '';

  switch (opts.stageCode) {
    case 'MATERIAL_PREP':
      return [
        `Prepare materials for: ${productLine}.${specsBlock}`,
        'Pull fabric, wood, foam, and hardware per BOM.',
        'Label kits for carpentry, painting, and upholstery.',
        'Flag shortages to purchasing before releasing the kit.',
      ].join('\n');

    case 'CARPENTRY':
      return [
        `Carpentry for: ${productLine}.${specsBlock}`,
        'Cut and assemble frames to drawing dimensions.',
        'Sand all visible surfaces; check joints and squareness.',
        'Stage completed frames for painting / upholstery.',
      ].join('\n');

    case 'PAINTING':
      return [
        `Finishing / paint for: ${productLine}.${specsBlock}`,
        'Apply primer and finish coats per color reference.',
        'Allow full cure time before handing off to assembly.',
        'Protect finished surfaces for transport to next stage.',
      ].join('\n');

    case 'UPHOLSTERY':
      return [
        `Upholstery for: ${productLine}.${specsBlock}`,
        'Cut fabric to pattern; match grain and color batch.',
        'Foam and cover to the approved sample.',
        'Inspect seams and staples before assembly handoff.',
      ].join('\n');

    case 'ASSEMBLY':
      return [
        `Assemble: ${productLine}.${specsBlock}`,
        'Join carpentry, paint, and upholstery components.',
        'Fit hardware and verify dimensions against the order.',
        'Move complete unit to inspection with paperwork.',
      ].join('\n');

    case 'INSPECTION':
      return [
        `Quality inspection for: ${productLine}.${specsBlock}`,
        'Run the stage checklist; photograph defects if any.',
        'Pass only if dimensions, finish, and fabric match the order.',
        'Fail with clear rework notes for the owning stage.',
      ].join('\n');

    case 'PACKAGING':
      return [
        `Package: ${productLine}.${specsBlock}`,
        'Wrap and crate for safe transport; add corner protection.',
        'Attach packing list and factory order label.',
        'Stage for delivery only after QC pass.',
      ].join('\n');

    case 'DELIVERY':
      return [
        `Deliver: ${productLine}.${specsBlock}`,
        'Confirm address, window, and contact on the sales order.',
        'Collect POD signature / photo on delivery.',
        'Report any transit damage immediately.',
      ].join('\n');

    default:
      return [
        `${opts.stageNameEn} for: ${productLine}.${specsBlock}`,
        'Follow the shop drawing and order specifications.',
        'Update task progress and attach required photos before complete.',
      ].join('\n');
  }
}
