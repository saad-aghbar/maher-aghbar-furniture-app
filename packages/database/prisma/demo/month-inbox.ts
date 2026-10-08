/**
 * Small role-correct inbox plus one reviewed extraction and two chat threads.
 * Seeded after reset's notification wipe.
 */
import { Locale, type PrismaClient } from '@prisma/client';
import { demoAsOf } from './clock';

export async function seedMonthInbox(prisma: PrismaClient, adminId: string): Promise<void> {
  const asOf = demoAsOf();
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, username: true },
  });
  const byName = new Map(users.map((u) => [u.username, u.id]));

  const so = await prisma.salesOrder.findFirst({
    where: { projectName: 'Abdoun lounge set' },
    select: { id: true, number: true },
  });
  const invoice = await prisma.invoice.findFirst({
    where: { status: 'OVERDUE' },
    select: { id: true, number: true, customerId: true },
  });
  const task = await prisma.productionTask.findFirst({
    where: { status: { in: ['READY', 'IN_PROGRESS', 'PAUSED', 'BLOCKED'] } },
    select: { id: true, number: true, assignedEmployeeId: true },
  });

  const notes: Array<{ username: string; titleEn: string; bodyEn: string; entityType?: string; entityId?: string }> = [
    { username: 'admin', titleEn: 'Month factory is loaded', bodyEn: 'Thirty days of orders, stock, and invoices are on the desks.' },
    { username: 'sales', titleEn: 'Quote waiting on Balqis', bodyEn: 'Photo enquiry needs a clearer corner shot.', entityType: 'RequestForQuotation' },
    { username: 'warehouse', titleEn: 'Beech still under reorder', bodyEn: 'MAT-BEECH is the low-stock watch. Brass feet are quarantined.' },
    { username: 'finance', titleEn: 'Overdue dealer invoice', bodyEn: invoice ? `${invoice.number} is overdue.` : 'An invoice is overdue.', entityType: 'Invoice', entityId: invoice?.id },
    { username: 'nile', titleEn: 'Abdoun lounge delivered', bodyEn: so ? `${so.number} is on your statement.` : 'A delivered order is on your statement.', entityType: 'SalesOrder', entityId: so?.id },
    { username: 'oasis', titleEn: 'Sectional still on the floor', bodyEn: 'Sweifieh sectional is in production.' },
    { username: 'balqis', titleEn: 'Deposit still open', bodyEn: 'Balqis deposit pending is waiting on payment.' },
    { username: 'carpenter', titleEn: 'Frames on your bench', bodyEn: 'Dining chairs and the Mecca frames are assigned.', entityType: 'ProductionTask', entityId: task?.id },
    { username: 'inspector', titleEn: 'Inspection waiting', bodyEn: 'A chair set is ready for final inspection.' },
    { username: 'driver', titleEn: 'A van is out', bodyEn: 'One delivery is out for delivery today.' },
  ];

  for (const note of notes) {
    const userId = byName.get(note.username);
    if (!userId) continue;
    const eventId = `demo-month:${note.username}`;
    const row = await prisma.notification.create({
      data: {
        userId,
        type: 'DEMO',
        topic: null,
        eventId,
        entityType: note.entityType,
        entityId: note.entityId,
        titleAr: note.titleEn,
        titleEn: note.titleEn,
        bodyAr: note.bodyEn,
        bodyEn: note.bodyEn,
        createdAt: asOf,
      },
    });
    if (note.username === 'finance' || note.username === 'nile') {
      await prisma.notificationOutbox.create({
        data: {
          notificationId: row.id,
          userId,
          eventId,
          topic: 'order.inProduction',
          title: note.titleEn,
          body: note.bodyEn,
          data: { entityType: note.entityType ?? null, entityId: note.entityId ?? null },
          status: 'SENT',
        },
      });
    }
    await prisma.userNotificationPreference.upsert({
      where: { userId_topic: { userId, topic: 'order.inProduction' } },
      update: { enabled: true },
      create: { userId, topic: 'order.inProduction', enabled: true },
    });
  }

  const photoRfq = await prisma.requestForQuotation.findUnique({ where: { number: 'RFQ-SHELF-PHOTO' } });
  await prisma.aIExtractionJob.create({
    data: {
      number: 'AI-DEMO-1',
      requestId: photoRfq?.id,
      status: 'COMPLETED',
      sourceType: 'IMAGE',
      storageKey: 'demo/ai/balqis-corner.jpg',
      originalText: 'Corner sectional, cream boucle, Jabal Amman.',
      detectedLanguage: Locale.en,
      targetLanguage: Locale.ar,
      provider: 'demo',
      reviewedById: adminId,
      reviewedAt: asOf,
      fields: {
        create: [
          { fieldName: 'fabric', fieldValue: 'Boucle Cream', confidence: 0.91, isMissing: false },
          { fieldName: 'width', fieldValue: null, confidence: 0.2, isMissing: true },
        ],
      },
    },
  });

  for (const username of ['admin', 'nile'] as const) {
    const userId = byName.get(username);
    if (!userId) continue;
    await prisma.aiChatConversation.create({
      data: {
        userId,
        locale: Locale.en,
        surface: username === 'admin' ? 'admin' : 'dealer',
        title: username === 'admin' ? 'What is late this month?' : 'Where is my lounge set?',
        messages: {
          create: [
            {
              role: 'user',
              blocks: [{ type: 'text', text: username === 'admin' ? 'Which orders are late?' : 'Has the Abdoun lounge shipped?' }],
            },
            {
              role: 'assistant',
              blocks: [
                {
                  type: 'text',
                  text:
                    username === 'admin'
                      ? 'Rainbow Street committed late is past its promise. Oasis Italian velvet is waiting on fabric.'
                      : 'Abdoun lounge set is delivered.',
                },
              ],
            },
          ],
        },
      },
    });
  }

  console.log('  inbox + AI extraction + chat');
}
