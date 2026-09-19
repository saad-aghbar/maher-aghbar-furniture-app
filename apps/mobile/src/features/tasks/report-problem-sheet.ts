import { sanitizeFeedbackCopy } from '@/api/toastErrors';
import { sheetNestedListHeight, sheetPickerHeight } from '@/components/sheets/sheetListViewport';
import type { TaskBlockerCategory } from './api';

export const REPORT_PROBLEM_CATEGORIES: TaskBlockerCategory[] = [
  'MATERIAL_MISSING',
  'MATERIAL_DEFECT',
  'MACHINE_PROBLEM',
  'MEASUREMENT_ISSUE',
  'DESIGN_ISSUE',
  'PREVIOUS_STAGE_DEFECT',
  'STAFFING',
  'SAFETY',
  'OTHER',
];

export function reportProblemSheetHeight(windowHeight: number, isDesk = false): number {
  return sheetPickerHeight(windowHeight, isDesk);
}

export function problemCategoryListMaxHeight(windowHeight: number, isDesk = false): number {
  return sheetNestedListHeight(windowHeight, isDesk);
}

export function trimmedProblemReason(reason: string): string | null {
  const text = reason.trim();
  return text.length > 0 ? text : null;
}

export function voiceUploadToastMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return sanitizeFeedbackCopy(error.message, fallback);
  }
  if (typeof error === 'string' && error.trim()) {
    return sanitizeFeedbackCopy(error, fallback);
  }
  return fallback;
}
