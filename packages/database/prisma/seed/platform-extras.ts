import { PrismaClient, Locale, AIJobStatus, CommunicationType } from '@prisma/client';
import { daysAgo } from './util';
import type { DealerRef } from './people';

/**
 * Light platform stubs that do not assume sales/production mock orders exist.
 */
export async function seedPlatformExtras(
  prisma: PrismaClient,
  opts: {
    adminId: string;
    workerIds: string[];
    dealers: DealerRef[];
  },
) {
  await prisma.notification.createMany({
    data: [
      {
        userId: opts.adminId,
        type: 'LOW_STOCK',
        titleAr: 'مخزون قماش منخفض',
        titleEn: 'Fabric stock low',
        bodyAr: 'رول قماش التنجيد تحت حد إعادة الطلب',
        bodyEn: 'Upholstery fabric roll is below reorder level',
        linkUrl: '/inventory',
        createdAt: daysAgo(1),
      },
    ],
  });

  await prisma.auditEvent.createMany({
    data: [
      {
        userId: opts.adminId,
        action: 'SEED.WORLD',
        entityType: 'System',
        entityId: 'seed',
        newValues: { summary: 'Catalog + accounts world seeded' },
        createdAt: new Date(),
      },
    ],
  });

  // Standalone AI stub (no RFQ/order FK).
  await prisma.aIExtractionJob.create({
    data: {
      number: 'AI-JOB-0001',
      status: AIJobStatus.COMPLETED,
      sourceType: 'pdf',
      storageKey: 'seed/ai/sample-po.pdf',
      originalText: 'Dining chairs x8 oak',
      translatedText: 'كراسي سفرة × 8 سنديان',
      detectedLanguage: Locale.en,
      targetLanguage: Locale.ar,
      provider: 'seed-stub',
      reviewedById: opts.adminId,
      reviewedAt: daysAgo(12),
      fields: {
        create: [
          {
            fieldName: 'product',
            fieldValue: 'Dining Chair Wood',
            confidence: 0.9,
            reviewedValue: 'Dining Chair Wood',
          },
          { fieldName: 'quantity', fieldValue: '8', confidence: 0.95, reviewedValue: '8' },
        ],
      },
    },
  });

  for (const d of opts.dealers) {
    await prisma.communicationLog.create({
      data: {
        customerId: d.id,
        type: CommunicationType.PHONE_CALL,
        subject: 'Account introduction',
        summary: 'Welcomed dealer portal access and shared catalog overview.',
        employeeId: opts.adminId,
        occurredAt: daysAgo(5),
      },
    });
  }
}
