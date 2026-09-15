import { Injectable } from '@nestjs/common';
import { Prisma } from '@maher/database';
import {
  isEligibleForTopic,
  preferenceEnabled,
  type RecipientUser,
  type TopicDefinition,
} from '@maher/notifications';
import { PrismaService } from '../../common/prisma.service';

type LoadedUser = RecipientUser & { preferredLanguage: 'ar' | 'en' | 'he' };

@Injectable()
export class RecipientResolverService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(input: {
    topic: TopicDefinition;
    customerId?: string | null;
    recipientUserIds?: string[];
    actorUserId?: string | null;
    excludeActor?: boolean;
  }): Promise<LoadedUser[]> {
    const ids = new Set<string>(input.recipientUserIds ?? []);
    const rows = await this.loadCandidates({
      topic: input.topic,
      customerId: input.customerId,
      extraIds: [...ids],
    });
    const prefs = await this.prisma.userNotificationPreference.findMany({
      where: {
        userId: { in: rows.map((r) => r.id) },
        topic: input.topic.code,
      },
      select: { userId: true, enabled: true },
    });
    const prefByUser = new Map(prefs.map((p) => [p.userId, p.enabled]));
    const extra = new Set(input.recipientUserIds ?? []);
    return rows.filter((user) => {
      const isExtra = extra.has(user.id);
      // Explicit assignees still get the handoff even if they completed the prior stage.
      if (
        (input.excludeActor ?? true) &&
        input.actorUserId &&
        input.actorUserId === user.id &&
        !isExtra
      ) {
        return false;
      }
      const prefOn = preferenceEnabled(input.topic, prefByUser.get(user.id));
      if (!prefOn) return false;
      if (isFloorOperator(user) && !isExtra) {
        return false;
      }
      if (isExtra) return true;
      return isEligibleForTopic(user, input.topic);
    });
  }

  async isTopicOn(userId: string, topic: TopicDefinition): Promise<boolean> {
    const stored = await this.prisma.userNotificationPreference.findUnique({
      where: { userId_topic: { userId, topic: topic.code } },
      select: { enabled: true },
    });
    return preferenceEnabled(topic, stored?.enabled);
  }

  private async loadCandidates(input: {
    topic: TopicDefinition;
    customerId?: string | null;
    extraIds: string[];
  }): Promise<LoadedUser[]> {
    const extraIds = input.extraIds.filter(Boolean);
    const audienceOr: Prisma.UserWhereInput[] = [];
    if (input.topic.audiences.includes('dealer') && input.customerId) {
      audienceOr.push({ customerId: input.customerId });
    }
    if (input.topic.audiences.includes('staff') || input.topic.audiences.includes('admin')) {
      const required = topicPermissionCodes(input.topic);
      audienceOr.push({
        customerId: null,
        roles: {
          some: {
            role: {
              OR: [
                { code: 'SYSTEM_ADMINISTRATOR' },
                required.length > 0
                  ? { permissions: { some: { permission: { code: { in: required } } } } }
                  : { code: 'SYSTEM_ADMINISTRATOR' },
              ],
            },
          },
        },
      });
    }

    const or: Prisma.UserWhereInput[] = [];
    if (extraIds.length > 0) {
      or.push({ id: { in: extraIds } });
    }
    if (audienceOr.length > 0) {
      or.push({ isActive: true, OR: audienceOr });
    }
    if (or.length === 0) return [];

    const users = await this.prisma.user.findMany({
      where: {
        archivedAt: null,
        OR: or,
      },
      select: {
        id: true,
        customerId: true,
        preferredLanguage: true,
        roles: {
          select: {
            role: {
              select: {
                code: true,
                permissions: { select: { permission: { select: { code: true } } } },
              },
            },
          },
        },
      },
      take: 500,
    });
    return users.map(flattenUser);
  }
}

function topicPermissionCodes(topic: TopicDefinition): string[] {
  if (!topic.permission) return [];
  if (typeof topic.permission === 'string') return [topic.permission];
  return [...topic.permission];
}

/** Floor operators are targeted explicitly (assigned). They are not permission-fan-out. */
function isFloorOperator(user: RecipientUser): boolean {
  if (user.roles.includes('SYSTEM_ADMINISTRATOR')) return false;
  return user.roles.includes('PRODUCTION_WORKER');
}

function flattenUser(row: {
  id: string;
  customerId: string | null;
  preferredLanguage: 'ar' | 'en' | 'he';
  roles: Array<{
    role: {
      code: string;
      permissions: Array<{ permission: { code: string } }>;
    };
  }>;
}): LoadedUser {
  const roles = row.roles.map((r) => r.role.code);
  const permissions = [
    ...new Set(row.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.code))),
  ];
  return {
    id: row.id,
    customerId: row.customerId,
    preferredLanguage: row.preferredLanguage,
    roles,
    permissions,
  };
}
