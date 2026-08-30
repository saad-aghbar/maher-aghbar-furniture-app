/**
 * Pure helpers for Production Plan CTA / floating dock — unit-testable without RN.
 */

export function shouldOpenPlanSheet(input: {
  canStart: boolean;
  executableCount: number;
  canAssign: boolean;
  canUpdate: boolean;
}): 'release' | 'plan' | 'none' {
  if (input.canStart && input.canUpdate) return 'release';
  if (input.canAssign || input.canUpdate) return 'plan';
  return 'none';
}

/** Dead-CTA bug: openAssign(first) with empty list is a no-op. Always open the plan sheet instead. */
export function planCtaMustOpenSheet(executableCount: number): boolean {
  // Even when count is 0, open sheet so user sees prepare/retry — never silent no-op.
  return true;
}

export function workersDatesLabel(assigned: number, required: number): string {
  return `${assigned}/${required}`;
}
