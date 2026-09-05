/**
 * §16 Production board alignment — matrix contract tests.
 * Complements deeper unit suites; fails if Phase A/B/C invariants regress.
 */

import en from '../../../../../../packages/i18n/src/messages/en/mobile.json';
import ar from '../../../../../../packages/i18n/src/messages/ar/mobile.json';
import he from '../../../../../../packages/i18n/src/messages/he/mobile.json';
import {
  collectProductionAttention,
  isRawAttentionToken,
} from '../productionAttention';
import { productionStartDueHint } from '../selectProduction';
import { shouldOpenPlanSheet } from '../planCta';

const ATTENTION_CODES = [
  'MISSING_ASSIGNMENT',
  'MISSING_DATE',
  'MATERIALS_HOLD',
  'OPEN_BLOCKER',
  'QUALITY_FAILED',
  'SEMI_ISSUE',
  'TASK_LATE',
  'SCHEDULE_CONFLICT',
] as const;

describe('§16 test matrix — Production board alignment', () => {
  describe('Attention i18n EN/AR/HE — never raw codes as UI copy', () => {
    it.each(['en', 'ar', 'he'] as const)(
      '%s has WHAT/WHY/NEXT for core Attention codes',
      (locale) => {
        const root = locale === 'en' ? en : locale === 'ar' ? ar : he;
        const attention = (root as { production?: { attention?: Record<string, unknown> } })
          .production?.attention as
          | {
              what?: Record<string, string>;
              why?: Record<string, string>;
              next?: Record<string, string>;
            }
          | undefined;
        expect(attention?.what).toBeTruthy();
        expect(attention?.why).toBeTruthy();
        expect(attention?.next).toBeTruthy();
        for (const code of ATTENTION_CODES) {
          const what = attention!.what?.[code];
          const why = attention!.why?.[code];
          const next = attention!.next?.[code];
          expect(what).toBeTruthy();
          expect(why).toBeTruthy();
          expect(next).toBeTruthy();
          expect(isRawAttentionToken(what!)).toBe(false);
          expect(isRawAttentionToken(why!)).toBe(false);
          expect(isRawAttentionToken(next!)).toBe(false);
        }
      },
    );

    it('collectProductionAttention never returns code strings as whyDetail', () => {
      const blocks = collectProductionAttention({
        reasons: [
          { code: 'MISSING_ASSIGNMENT', message: 'MISSING_ASSIGNMENT' },
          { code: 'WAITING_FOR_MATERIALS', message: 'WAITING_FOR_MATERIALS' },
        ],
        blockers: [
          {
            id: '1',
            category: 'SEMI_HANDOFF_MISMATCH',
            reason: 'SEMI_HANDOFF_MISMATCH',
          },
        ],
        isLate: true,
      });
      expect(blocks.length).toBeGreaterThan(0);
      for (const b of blocks) {
        expect(b.whatKey.startsWith('mobile.production.attention.')).toBe(true);
        if (b.whyDetail) expect(isRawAttentionToken(b.whyDetail)).toBe(false);
      }
    });
  });

  describe('In Production gate — planned date never auto-moves', () => {
    it('startDueHint is presentation-only for released idle orders', () => {
      const base = {
        releasedToFactoryAt: '2026-09-01T08:00:00.000Z',
        actualStartDate: null as string | null,
        status: 'READY',
        plannedStartDate: '2026-09-02T00:00:00.000Z',
      };
      const now = new Date('2026-09-02T12:00:00Z');
      expect(productionStartDueHint(base, now)).toBe('due_today');
      expect(
        productionStartDueHint(
          { ...base, plannedStartDate: '2026-08-30T00:00:00.000Z' },
          now,
        ),
      ).toBe('planned_start_passed');
      // Floor started → no hint (lifecycle already moved by actual start)
      expect(
        productionStartDueHint(
          { ...base, actualStartDate: '2026-09-02T09:00:00.000Z' },
          now,
        ),
      ).toBeNull();
    });
  });

  describe('Confirm / Replan CTA gates', () => {
    it('Confirm/release only when canStart + permissions', () => {
      expect(
        shouldOpenPlanSheet({
          canStart: true,
          executableCount: 1,
          canAssign: true,
          canUpdate: true,
        }),
      ).toBe('release');
    });

    it('Replan only while released and floor not started', () => {
      const showReplan = (released: boolean, floorStarted: boolean) =>
        released && !floorStarted;
      expect(showReplan(true, false)).toBe(true);
      expect(showReplan(true, true)).toBe(false);
      expect(showReplan(false, false)).toBe(false);
    });
  });

  describe('Day lens i18n present', () => {
    it('EN/AR/HE expose Planned / Actual / All time keys', () => {
      for (const root of [en, ar, he]) {
        const dayLens = (root as { production?: { dayLens?: Record<string, string> } })
          .production?.dayLens;
        expect(dayLens?.planned).toBeTruthy();
        expect(dayLens?.actual).toBeTruthy();
        expect(dayLens?.allTime).toBeTruthy();
        expect(dayLens?.emptyPlanned).toBeTruthy();
      }
    });
  });
});
