import { PrismaClient, Locale, AIJobStatus, CommunicationType, DocumentVisibility } from '@prisma/client';
import { daysAgo } from './util';
import type { DealerRef } from './people';

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
      {
        userId: opts.adminId,
        type: 'QUOTE_SENT',
        titleAr: 'عرض سعر بانتظار الرد',
        titleEn: 'Quote awaiting reply',
        bodyAr: 'عرض أسعار مفتوح من بوابة التجار',
        bodyEn: 'Open dealer-portal quotes awaiting acceptance',
        linkUrl: '/quotations',
        createdAt: daysAgo(2),
      },
      {
        userId: opts.adminId,
        type: 'PAYMENT',
        titleAr: 'دفعة مستلمة',
        titleEn: 'Payment received',
        bodyAr: 'تم تسجيل دفعة بنكية على فاتورة مفتوحة',
        bodyEn: 'Bank transfer recorded against an open invoice',
        linkUrl: '/invoices',
        createdAt: daysAgo(3),
      },
    ],
  });

  for (const wid of opts.workerIds.slice(0, 4)) {
    await prisma.notification.create({
      data: {
        userId: wid,
        type: 'WORKER_ASSIGNED',
        titleAr: 'مهمة جديدة',
        titleEn: 'New task assigned',
        bodyAr: 'تم تعيين مهمة إنتاج لك اليوم',
        bodyEn: 'A production task was assigned to you today',
        linkUrl: '/tasks',
        createdAt: daysAgo(0),
      },
    });
  }

  for (const d of opts.dealers.slice(0, 4)) {
    const user = await prisma.user.findUnique({ where: { username: d.username } });
    if (!user) continue;
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: 'ORDER_UPDATE',
        titleAr: 'تحديث الطلب',
        titleEn: 'Order update',
        bodyAr: 'طلبك تقدّم في الإنتاج',
        bodyEn: 'Your order advanced in production',
        linkUrl: '/orders',
        createdAt: daysAgo(1),
      },
    });
  }

  await prisma.auditEvent.createMany({
    data: [
      {
        userId: opts.adminId,
        action: 'SEED.WORLD',
        entityType: 'System',
        entityId: 'seed',
        newValues: { summary: '8-month operational world seeded' },
        createdAt: new Date(),
      },
      {
        userId: opts.adminId,
        action: 'SALES_ORDER.CONFIRM',
        entityType: 'SalesOrder',
        entityId: 'sample',
        newValues: { summary: 'Historical confirmations present in timeline' },
        createdAt: daysAgo(10),
      },
    ],
  });

  const openRfq = await prisma.requestForQuotation.findFirst({
    where: { number: { startsWith: 'RFQ-LIVE-' } },
    orderBy: { createdAt: 'desc' },
  });
  if (openRfq) {
    await prisma.aIExtractionJob.create({
      data: {
        number: 'AI-JOB-0001',
        requestId: openRfq.id,
        status: AIJobStatus.NEEDS_REVIEW,
        sourceType: 'image',
        storageKey: 'seed/ai/sample-handwritten.jpg',
        originalText: '3 sofa L shape fabric sand for Nile',
        translatedText: 'كنبة زاوية قماش رملي للنيل',
        detectedLanguage: Locale.en,
        targetLanguage: Locale.ar,
        provider: 'seed-stub',
        fields: {
          create: [
            { fieldName: 'product', fieldValue: 'L-Sectional Sofa', confidence: 0.82 },
            { fieldName: 'quantity', fieldValue: '3', confidence: 0.91 },
            { fieldName: 'fabric', fieldValue: 'sand velvet', confidence: 0.74 },
            { fieldName: 'dealer', fieldValue: 'Nile', confidence: 0.66 },
          ],
        },
      },
    });
  }

  await prisma.aIExtractionJob.create({
    data: {
      number: 'AI-JOB-0002',
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

  const so = await prisma.salesOrder.findFirst({ orderBy: { createdAt: 'desc' } });
  if (so) {
    await prisma.document.create({
      data: {
        fileName: 'approved-sketch.pdf',
        mimeType: 'application/pdf',
        storageKey: `seed/docs/${so.number}-sketch.pdf`,
        category: 'ORDER_ATTACHMENT',
        visibility: DocumentVisibility.CUSTOMER_VISIBLE,
        sizeBytes: 128000,
        salesOrderId: so.id,
        uploadedById: opts.adminId,
      },
    });
  }

  // Sample worker completion photos on recently completed tasks (local disk).
  const { mkdirSync, writeFileSync, existsSync } = await import('fs');
  const { join } = await import('path');
  const uploadRoot =
    process.env.LOCAL_UPLOAD_DIR?.trim() ||
    join(process.cwd(), '../../uploads');
  const seedDir = join(uploadRoot, 'seed', 'task-photos');
  if (!existsSync(seedDir)) mkdirSync(seedDir, { recursive: true });

  // Minimal valid 1×1 JPEG
  const jpeg = Buffer.from(
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGcP//Z',
    'base64',
  );

  const completedTasks = await prisma.productionTask.findMany({
    where: { status: 'COMPLETED' },
    select: { id: true, productionOrderId: true, name: true },
    orderBy: { updatedAt: 'desc' },
    take: 48,
  });

  for (const [i, task] of completedTasks.entries()) {
    const key = `seed/task-photos/${task.id}.jpg`;
    const full = join(uploadRoot, key);
    if (!existsSync(full)) {
      writeFileSync(full, jpeg);
    }
    await prisma.document.create({
      data: {
        fileName: `stage-complete-${i + 1}.jpg`,
        mimeType: 'image/jpeg',
        storageKey: key,
        category: `TASK_PHOTO:${task.id}`,
        visibility: DocumentVisibility.INTERNAL,
        sizeBytes: jpeg.length,
        productionOrderId: task.productionOrderId,
        uploadedById: opts.workerIds[i % Math.max(1, opts.workerIds.length)] ?? opts.adminId,
      },
    });
  }

  for (const d of opts.dealers.slice(0, 3)) {
    await prisma.communicationLog.create({
      data: {
        customerId: d.id,
        type: CommunicationType.PHONE_CALL,
        subject: 'Delivery window confirmation',
        summary: 'Confirmed morning delivery window with receiving desk.',
        employeeId: opts.adminId,
        occurredAt: daysAgo(5),
      },
    });
  }
}
