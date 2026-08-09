import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@maher/database';
import type { AuthUser } from '@maher/types';
import { PrismaService } from '../../common/prisma.service';
import { IdempotencyService } from '../../common/idempotency.service';
import { AiChatAgentService } from './ai-chat.agent';
import { AiChatToolsService } from './ai-chat.tools';
import type {
  AiChatLocale,
  ChatContent,
  ChatMessageDto,
} from './dto/chat.types';

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 20;
const rateBuckets = new Map<string, number[]>();

@Injectable()
export class AiChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agent: AiChatAgentService,
    private readonly tools: AiChatToolsService,
    private readonly idempotency: IdempotencyService,
  ) {}

  private assertEnabled() {
    if (process.env.AI_CHAT_ENABLED === 'false') {
      throw new ServiceUnavailableException({
        code: 'AI_CHAT_DISABLED',
        message: 'AI chat is disabled.',
      });
    }
  }

  private assertRateLimit(userId: string) {
    const now = Date.now();
    const prev = rateBuckets.get(userId) ?? [];
    const recent = prev.filter((t) => now - t < RATE_WINDOW_MS);
    if (recent.length >= RATE_MAX) {
      throw new ServiceUnavailableException({
        code: 'AI_CHAT_RATE_LIMIT',
        message: 'Too many chat messages. Try again shortly.',
      });
    }
    recent.push(now);
    rateBuckets.set(userId, recent);
  }

  async createConversation(
    user: AuthUser,
    body: { locale?: string; title?: string },
  ) {
    this.assertEnabled();
    const locale = this.parseLocale(body.locale ?? user.preferredLanguage);
    const surface = this.tools.surfaceFor(user);
    const row = await this.prisma.aiChatConversation.create({
      data: {
        userId: user.id,
        locale,
        surface,
        title: body.title?.trim() || null,
      },
    });
    return this.toConversation(row);
  }

  async listConversations(user: AuthUser) {
    const rows = await this.prisma.aiChatConversation.findMany({
      where: { userId: user.id, archivedAt: null },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
    return rows.map((r) => this.toConversation(r));
  }

  async getConversation(user: AuthUser, id: string) {
    const row = await this.requireOwned(user, id);
    const messages = await this.prisma.aiChatMessage.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    return {
      ...this.toConversation(row),
      messages: messages.map((m) => this.toMessage(m)),
    };
  }

  async archiveConversation(user: AuthUser, id: string) {
    await this.requireOwned(user, id);
    await this.prisma.aiChatConversation.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
    return { ok: true };
  }

  async sendMessage(
    user: AuthUser,
    conversationId: string,
    body: { text: string; clientMessageId?: string; locale?: string },
  ) {
    this.assertEnabled();
    this.assertRateLimit(user.id);

    const text = (body.text ?? '').trim();
    if (text.length < 1) {
      throw new ForbiddenException({ code: 'EMPTY_MESSAGE', message: 'Message required.' });
    }
    if (text.length > 4000) {
      throw new ForbiddenException({ code: 'MESSAGE_TOO_LONG', message: 'Message too long.' });
    }

    const scope = `ai-chat:${conversationId}`;
    const { result } = await this.idempotency.once(
      scope,
      body.clientMessageId,
      { userId: user.id, entityId: conversationId },
      async () => this.runSend(user, conversationId, text, body.locale),
    );
    return result;
  }

  private async runSend(
    user: AuthUser,
    conversationId: string,
    text: string,
    localeOverride?: string,
  ) {
    const conversation = await this.requireOwned(user, conversationId);
    const locale = this.parseLocale(localeOverride ?? conversation.locale);
    const surface = this.tools.surfaceFor(user);

    const prior = await this.prisma.aiChatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const history = prior
      .reverse()
      .map((m) => ({
        role: m.role,
        text: this.blocksToPlain(m.blocks as ChatContent[]),
      }));

    const userMessage = await this.prisma.aiChatMessage.create({
      data: {
        conversationId,
        role: 'user',
        blocks: [{ type: 'text', markdown: text }] as unknown as Prisma.InputJsonValue,
      },
    });

    const started = Date.now();
    const assistantDto = await this.agent.runTurn({
      user,
      locale,
      surface,
      userText: text,
      history,
    });

    const assistantMessage = await this.prisma.aiChatMessage.create({
      data: {
        conversationId,
        role: 'assistant',
        blocks: assistantDto.blocks as unknown as Prisma.InputJsonValue,
        suggestions: (assistantDto.suggestions ?? null) as unknown as Prisma.InputJsonValue,
      },
    });

    await this.prisma.aiChatConversation.update({
      where: { id: conversationId },
      data: {
        updatedAt: new Date(),
        locale,
        title: conversation.title ?? text.slice(0, 80),
      },
    });

    // Lightweight audit line — no raw LLM dump.
    // eslint-disable-next-line no-console
    console.info(
      JSON.stringify({
        event: 'ai_chat_turn',
        userId: user.id,
        conversationId,
        surface,
        locale,
        latencyMs: Date.now() - started,
      }),
    );

    return {
      userMessage: this.toMessage(userMessage),
      assistantMessage: this.toMessage(assistantMessage),
    };
  }

  private async requireOwned(user: AuthUser, id: string) {
    const row = await this.prisma.aiChatConversation.findFirst({
      where: { id, userId: user.id, archivedAt: null },
    });
    if (!row) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Conversation not found.' });
    }
    return row;
  }

  private parseLocale(raw: string | undefined): AiChatLocale {
    if (raw === 'en' || raw === 'he' || raw === 'ar') return raw;
    return 'ar';
  }

  private toConversation(row: {
    id: string;
    locale: string;
    surface: string;
    title: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      locale: row.locale,
      surface: row.surface,
      title: row.title,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toMessage(row: {
    id: string;
    role: string;
    blocks: unknown;
    suggestions?: unknown;
    createdAt: Date;
  }): ChatMessageDto {
    return {
      id: row.id,
      role: row.role as ChatMessageDto['role'],
      createdAt: row.createdAt.toISOString(),
      blocks: (row.blocks as ChatContent[]) ?? [],
      suggestions: (row.suggestions as ChatMessageDto['suggestions']) ?? undefined,
    };
  }

  private blocksToPlain(blocks: ChatContent[]): string {
    return blocks
      .map((b) => {
        if (b.type === 'text') return b.markdown;
        if (b.type === 'clarification') return b.question;
        if (b.type === 'error') return `${b.title}: ${b.body}`;
        return b.type;
      })
      .join('\n');
  }
}
