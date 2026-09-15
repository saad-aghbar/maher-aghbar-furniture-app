import type { PrismaClient } from '@prisma/client';
import { TOPICS } from '@maher/notifications';

/** Fill missing IN_APP templates from the shared topic catalog. Existing copy is left alone. */
export async function seedNotificationTopicTemplates(prisma: PrismaClient): Promise<void> {
  for (const topic of TOPICS) {
    await prisma.notificationTemplate.upsert({
      where: { code: topic.templateCode },
      create: {
        code: topic.templateCode,
        channel: 'IN_APP',
        subjectAr: topic.pushTitle.ar,
        subjectEn: topic.pushTitle.en,
        subjectHe: topic.pushTitle.he,
        bodyAr: topic.pushBody.ar,
        bodyEn: topic.pushBody.en,
        bodyHe: topic.pushBody.he,
      },
      update: {},
    });
  }
}
