import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PROBLEM_CATEGORY_LIST_MAX_HEIGHT,
  REPORT_PROBLEM_CATEGORIES,
  reportProblemSheetHeight,
  trimmedProblemReason,
  voiceUploadToastMessage,
} from '../report-problem-sheet';

const sheetSrc = readFileSync(join(__dirname, '../components/ReportProblemSheet.tsx'), 'utf8');

describe('ReportProblemSheet layout', () => {
  it('sizes the sheet to 72% of the window', () => {
    expect(reportProblemSheetHeight(800)).toBe(576);
    expect(sheetSrc).toContain('reportProblemSheetHeight(windowH)');
    expect(sheetSrc).toContain('sheetHeight={sheetHeight}');
    expect(sheetSrc).toContain('overlay');
    expect(sheetSrc).toContain('expandable');
  });

  it('uses a scrollable category board and a pinned footer', () => {
    expect(sheetSrc).toContain('DealerBoard');
    expect(sheetSrc).toContain("t('mobile.tasks.problemKindTitle')");
    expect(sheetSrc).toContain('PROBLEM_CATEGORY_LIST_MAX_HEIGHT');
    expect(sheetSrc).toContain('nestedScrollEnabled');
    expect(sheetSrc).toContain('DealerFormFooter');
    expect(sheetSrc).toContain("t('mobile.tasks.submitProblem')");
    expect(sheetSrc).toContain('flex: 1, minHeight: 0');
    expect(PROBLEM_CATEGORY_LIST_MAX_HEIGHT).toBe(220);
    expect(REPORT_PROBLEM_CATEGORIES).toHaveLength(9);
    expect(REPORT_PROBLEM_CATEGORIES).toContain('MATERIAL_MISSING');
    expect(REPORT_PROBLEM_CATEGORIES).toContain('OTHER');
  });

  it('toasts an empty reason and a failed voice upload without submitting', () => {
    expect(sheetSrc).toContain("t('mobile.tasks.problemReasonRequired')");
    expect(sheetSrc).toContain('voiceUploadToastMessage');
    expect(sheetSrc).toContain("t('mobile.tasks.uploadFailed')");
    expect(sheetSrc).toContain('showToast');
    expect(trimmedProblemReason('   ')).toBeNull();
    expect(trimmedProblemReason(' hinge ')).toBe('hinge');
    expect(voiceUploadToastMessage(new Error('disk full'), 'fallback')).toBe('disk full');
    expect(voiceUploadToastMessage({}, 'Upload failed. Try again.')).toBe(
      'Upload failed. Try again.',
    );
  });
});
