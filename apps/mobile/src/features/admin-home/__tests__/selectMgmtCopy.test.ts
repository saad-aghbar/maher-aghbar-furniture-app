import { translate } from '@/i18n/translate';
import {
  inferMgmtEvent,
  localizeFloorNote,
  mgmtAttentionAction,
  mgmtAttentionWhy,
  mgmtBlockedWhy,
  mgmtEventLabel,
  mgmtFlowLabel,
} from '@maher/i18n';

describe('mgmtCopy Arabic', () => {
  const t = (key: string, vars?: Record<string, string | number>) =>
    translate('ar', key, vars);

  it('translates factory flow keys', () => {
    expect(mgmtFlowLabel(t, 'prepare', 'Prepare')).toBe('تجهيز');
    expect(mgmtFlowLabel(t, 'ready_factory', 'Ready')).toBe('جاهز للمصنع');
    expect(mgmtFlowLabel(t, 'in_production', 'In production')).toBe('قيد الإنتاج');
    expect(mgmtFlowLabel(t, 'quality_rework', 'Quality')).toBe('جودة / إعادة عمل');
    expect(mgmtFlowLabel(t, 'packaging', 'Packaging')).toBe('تغليف');
    expect(mgmtFlowLabel(t, 'finished', 'Finished')).toBe('جاهز');
  });

  it('translates quality attention even from English fallback copy', () => {
    expect(
      mgmtAttentionWhy(t, 'ar', {
        why: 'Quality failed — open rework or blocked inspection',
        actionLabel: 'Open quality',
      }),
    ).toBe('فشل الجودة — إعادة عمل مفتوحة أو فحص متوقف');
    expect(
      mgmtAttentionAction(t, { actionLabel: 'Open quality' }),
    ).toBe('فتح الجودة');
  });

  it('translates order-on-hold blocked rows', () => {
    expect(
      mgmtBlockedWhy(t, 'ar', { why: 'Order on hold' }),
    ).toBe('الطلبية موقوفة');
  });

  it('translates activity from English labels', () => {
    expect(
      mgmtEventLabel(t, 'ar', {
        label: 'Completed Painting on PO-2026-00035',
      }),
    ).toBe('اكتملت مرحلة الدهان على PO-2026-00035');
    expect(
      mgmtEventLabel(t, 'ar', {
        kind: 'taskCompleted',
        params: { stage: 'Painting', stageAr: 'دهان', number: 'PO-2026-00035' },
        label: 'Completed Painting on PO-2026-00035',
      }),
    ).toBe('اكتملت مرحلة الدهان على PO-2026-00035');
    expect(
      mgmtEventLabel(t, 'ar', { label: 'Delivery DLV-COST-NOMAT updated' }),
    ).toBe('تحديث التسليم DLV-COST-NOMAT');
    expect(
      mgmtEventLabel(t, 'ar', { label: 'QC QC-COST-NORATE-A: PASSED' }),
    ).toBe('فحص الجودة QC-COST-NORATE-A: ناجح');
    expect(
      mgmtEventLabel(t, 'ar', { label: 'Return RET-UF-RC-DONE → RESOLVED' }),
    ).toBe('مرتجع RET-UF-RC-DONE ← مُغلق');
  });

  it('infers payment and delivery templates', () => {
    expect(inferMgmtEvent('Payment PAY-1 from Diwan Seating')).toEqual({
      kind: 'payment',
      params: { number: 'PAY-1', name: 'Diwan Seating' },
    });
  });
});

describe('localizeFloorNote', () => {
  const t = (key: string, vars?: Record<string, string | number>) =>
    translate('ar', key, vars);

  it('translates the P9 packaging seed dump and keeps the ref', () => {
    expect(
      localizeFloorNote(
        t,
        'ar',
        'P9-J: missing Back package / packaging material — seed blocker',
      ),
    ).toBe('P9-J — عبوة الظهر / مادة التغليف ناقصة');
  });

  it('translates i18n keys stored as blocker reasons', () => {
    expect(localizeFloorNote(t, 'ar', 'mobile.tasks.seedBlockers.missingPackaging')).toBe(
      'عبوة الظهر / مادة التغليف ناقصة',
    );
  });

  it('keeps Arabic worker notes', () => {
    expect(localizeFloorNote(t, 'ar', 'القماش ممزق عند الحافة')).toBe(
      'القماش ممزق عند الحافة',
    );
  });
});
