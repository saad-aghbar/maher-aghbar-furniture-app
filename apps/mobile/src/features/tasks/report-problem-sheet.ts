import { sanitizeFeedbackCopy } from '@/api/toastErrors';
import type { TaskBlockerCategory } from './api';

export const REPORT_PROBLEM_SHEET_HEIGHT_RATIO = 0.72;
export const PROBLEM_CATEGORY_LIST_MAX_HEIGHT = 220;

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

export function reportProblemSheetHeight(windowHeight: number): number {
  return Math.round(windowHeight * REPORT_PROBLEM_SHEET_HEIGHT_RATIO);
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
