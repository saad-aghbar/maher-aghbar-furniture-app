import { PrismaClient, CommunicationType, Locale } from '@prisma/client';
import { ammanLocal, demoAsOf } from './clock';
import { nextDoc, type SeqBag } from './seq';
import type { DealerRef } from './people';

export async function seedDemoExtras(
  prisma: PrismaClient,
  opts: {
    adminId: string;
    salesId: string;
    dealers: DealerRef[];
    workerIds: string[];
    counters: SeqBag;
  },
) {
  const asOf = demoAsOf();
  const nile = opts.dealers.find((d) => d.username === 'nile')!;
  await prisma.communicationLog.create({
    data: {
      customerId: nile.id,
      contactName: 'Ruba Nabulsi',
      type: CommunicationType.WHATSAPP,
      subject: 'Abdoun lounge fabric confirmation',
      summary: 'Confirmed sand velvet lot and 14-day receiving window.',
      occurredAt: ammanLocal(2026, 6, 20, 11),
      employeeId: opts.salesId,
    },
  });
  await prisma.communicationLog.create({
    data: {
      customerId: opts.dealers.find((d) => d.username === 'cedar')!.id,
      contactName: 'Elias Haddad',
      type: CommunicationType.PHONE_CALL,
      subject: 'Italian velvet ETA',
      summary: 'Dealer asked for velvet arrival; purchasing confirmed inbound PO.',
      occurredAt: ammanLocal(2026, 8, 14, 16),
      employeeId: opts.salesId,
      nextFollowUpAt: ammanLocal(2026, 8, 18, 10),
    },
  });

  const jobNumber = await nextDoc(prisma, 'ai_job', opts.counters);
  const rfq = await prisma.requestForQuotation.findFirst({
    where: { status: 'READY_FOR_QUOTATION' },
  });
  await prisma.aIExtractionJob.create({
    data: {
      number: jobNumber,
      requestId: rfq?.id,
      status: 'COMPLETED',
      sourceType: 'WHATSAPP_IMAGE',
      originalText: 'كنبة ثلاثية مخمل كحلي لغرفة عبدون، التسليم نهاية أيلول',
      translatedText: '3-seater navy velvet sofa for Abdoun room, delivery end of September',
      detectedLanguage: Locale.ar,
      targetLanguage: Locale.en,
      provider: 'demo-reviewed',
      reviewedById: opts.salesId,
      reviewedAt: addHours(asOf, -20),
      createdAt: addHours(asOf, -26),
      fields: {
        create: [
          { fieldName: 'product', fieldValue: '3-seater sofa', confidence: 0.92, reviewedValue: 'SOF-3S-LUX' },
          { fieldName: 'fabric', fieldValue: 'navy velvet', confidence: 0.88, reviewedValue: 'Velvet Navy' },
          { fieldName: 'qty', fieldValue: '1', confidence: 0.99, reviewedValue: '1' },
        ],
      },
    },
  });

  const adminNotifs = [
    {
      type: 'SCHEDULE_AT_RISK',
      titleAr: 'طلب معرّض للتأخير',
      titleEn: 'Order at risk',
      bodyAr: 'كنبة الاسترخاء لمخمل إيطالي بانتظار المادة.',
      bodyEn: 'Italian velvet recliner is waiting on inbound fabric.',
    },
    {
      type: 'NEW_ORDER',
      titleAr: 'طلب جديد',
      titleEn: 'New order',
      bodyAr: 'تم تأكيد طلب قصر الأجنحة لطاولة السفرة.',
      bodyEn: 'Qasr suite dining is awaiting schedule approval.',
    },
  ];
  for (const n of adminNotifs) {
    await prisma.notification.create({
      data: { userId: opts.adminId, ...n, createdAt: addHours(asOf, -8) },
    });
  }
  if (opts.workerIds[0]) {
    await prisma.notification.create({
      data: {
        userId: opts.workerIds[0],
        type: 'TASK_SCHEDULED_TODAY',
        titleAr: 'مهمة اليوم',
        titleEn: 'Task today',
        bodyAr: 'تجهيز مواد لكنبة واحة المعيشة.',
        bodyEn: 'Material prep for the Oasis sectional.',
        createdAt: addHours(asOf, -2),
      },
    });
  }

  await prisma.auditEvent.create({
    data: {
      userId: opts.adminId,
      action: 'DEMO_RESET',
      entityType: 'SystemSetting',
      entityId: 'company',
      newValues: { seededWorld: 'demo-factory-v1', asOf: asOf.toISOString() },
      createdAt: asOf,
    },
  });
}

function addHours(base: Date, hours: number) {
  return new Date(base.getTime() + hours * 3600 * 1000);
}
