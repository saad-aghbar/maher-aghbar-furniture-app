const PERSONAL_ASSIGNMENT = new Set([
  'task.assigned',
  'task.unassigned',
  'task.urgent',
]);

const FLOOR_SHARED = new Set([
  'task.scheduledToday',
  'task.ready',
  'task.resumed',
  'stage.completed',
  'wip.readyToTakeIn',
  'wip.handoffMismatch',
  'blocker.answered',
  'order.onHold',
  'order.resumed',
  'order.cancelled',
  'order.readyForProduction',
]);

const PACKAGING_SKILLS = ['PACKAGING', 'PACK'] as const;
const QC_SKILLS = ['INSPECTION', 'QC', 'QUALITY', 'FINAL_QC'] as const;
const DELIVERY_SKILLS = ['DELIVERY'] as const;
const FABRIC_SKILLS = ['CUTTING', 'UPHOLSTERY', 'SEWING', 'FABRIC', 'MATERIAL_PREP'] as const;

/** Topic code → stage skill codes that unlock it for a floor worker. */
const SPECIALTY: Record<string, readonly string[]> = {
  'packaging.ready': PACKAGING_SKILLS,
  'packaging.completed': PACKAGING_SKILLS,
  'quality.queued': QC_SKILLS,
  'quality.passed': QC_SKILLS,
  'quality.failed': QC_SKILLS,
  'quality.reworkRequired': QC_SKILLS,
  'quality.reworkReady': QC_SKILLS,
  'delivery.planned': DELIVERY_SKILLS,
  'delivery.readyToLoad': DELIVERY_SKILLS,
  'delivery.departed': DELIVERY_SKILLS,
  'delivery.failed': DELIVERY_SKILLS,
  'delivery.rescheduled': DELIVERY_SKILLS,
  'order.readyForDelivery': DELIVERY_SKILLS,
  'inventory.finishedPosted': [...PACKAGING_SKILLS, ...DELIVERY_SKILLS],
  'fabric.readyForPickup': FABRIC_SKILLS,
};

function normalizeSkills(codes: readonly string[] | undefined): string[] {
  return (codes ?? []).map((code) => code.trim().toUpperCase()).filter(Boolean);
}

function isDeliveryOnly(skills: readonly string[]): boolean {
  return skills.length > 0 && skills.every((code) => code === 'DELIVERY');
}

function hasProductionFloorSkill(skills: readonly string[]): boolean {
  return skills.some((code) => code !== 'DELIVERY');
}

function hasAnySkill(skills: readonly string[], allowed: readonly string[]): boolean {
  const wanted = new Set(allowed);
  return skills.some((code) => wanted.has(code));
}

/**
 * Whether this worker’s stage skills unlock the topic checkbox / inbox row.
 * Union: carpenter + packaging sees both floor-shared and packaging topics.
 */
export function workerSkillsMatchTopic(
  stageSkillCodes: readonly string[] | undefined,
  topicCode: string,
): boolean {
  const skills = normalizeSkills(stageSkillCodes);

  if (PERSONAL_ASSIGNMENT.has(topicCode)) return true;

  const specialty = SPECIALTY[topicCode];
  if (specialty) return hasAnySkill(skills, specialty);

  if (FLOOR_SHARED.has(topicCode)) {
    if (isDeliveryOnly(skills)) return false;
    return hasProductionFloorSkill(skills);
  }

  if (isDeliveryOnly(skills) || skills.length === 0) return false;
  return hasProductionFloorSkill(skills);
}
