import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import type { AuthUser } from '@maher/types';
import { randomUUID } from 'crypto';
import { buildSystemPrompt } from './ai-chat.prompt';
import { mapToolResultsToMessage } from './ai-chat.mapper';
import { AiChatToolsService } from './ai-chat.tools';
import type { AiChatLocale, AiChatSurface, ChatMessageDto } from './dto/chat.types';

type OpenAiMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
};

@Injectable()
export class AiChatAgentService {
  private readonly logger = new Logger(AiChatAgentService.name);

  constructor(private readonly tools: AiChatToolsService) {}

  isEnabled(): boolean {
    if (process.env.AI_CHAT_ENABLED === 'false') return false;
    if (process.env.AI_CHAT_ENABLED === 'true') return true;
    // Default: enabled when an OpenAI key is present, else deterministic tool router.
    return true;
  }

  async runTurn(params: {
    user: AuthUser;
    locale: AiChatLocale;
    surface: AiChatSurface;
    userText: string;
    history: Array<{ role: string; text: string }>;
  }): Promise<ChatMessageDto> {
    if (!this.isEnabled()) {
      throw new ServiceUnavailableException({
        code: 'AI_CHAT_DISABLED',
        message: 'AI chat is disabled.',
      });
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    const model = process.env.AI_LLM_MODEL ?? 'gpt-4o-mini';

    if (!apiKey || process.env.AI_CHAT_MODE === 'deterministic') {
      return this.deterministicTurn(params);
    }

    return this.openAiTurn({ ...params, apiKey, model });
  }

  /** Keyword → tool path for tests / offline. */
  async deterministicTurn(params: {
    user: AuthUser;
    locale: AiChatLocale;
    surface: AiChatSurface;
    userText: string;
  }): Promise<ChatMessageDto> {
    const q = params.userText.toLowerCase();
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];

    if (params.surface === 'customer') {
      if (/statement|كشف|דוח|balance|رصيد/.test(q)) calls.push({ name: 'my_statement', args: {} });
      else if (/invoice|فاتور|חשבונ/.test(q)) calls.push({ name: 'my_invoices', args: {} });
      else if (/request|طلب عرض|בקש/.test(q)) calls.push({ name: 'my_requests', args: {} });
      else calls.push({ name: 'my_orders', args: { limit: 8 } });
    } else {
      if (/profit|ربح|רווח/.test(q)) {
        const nameMatch = params.userText.match(
          /(?:from|for|من|של)\s+([A-Za-z\u0600-\u06FF][\w\u0600-\u06FF\s.-]{1,40})/i,
        );
        calls.push({
          name: 'dealer_profit_summary',
          args: {
            customerName: nameMatch?.[1]?.trim() || 'Oasis',
            limit: 3,
          },
        });
      } else if (/late|متأخر|איחור/.test(q)) {
        calls.push({ name: 'list_late_orders', args: { limit: 8 } });
      } else if (/stock|مخزون|מלאי|material/.test(q)) {
        calls.push({ name: 'list_low_stock', args: { limit: 8 } });
      } else if (/invoice|receivable|ذمم|חשבונ/.test(q)) {
        calls.push({ name: 'list_open_invoices', args: { limit: 8 } });
      } else if (/home|snapshot|لوحة|דשבורד/.test(q)) {
        calls.push({ name: 'admin_home_snapshot', args: {} });
      } else {
        calls.push({ name: 'list_sales_orders', args: { limit: 5 } });
      }
    }

    const toolResults: Array<{ name: string; result: unknown }> = [];
    for (const call of calls) {
      const available = this.tools.toolsForUser(params.user).some((t) => t.name === call.name);
      if (!available) continue;
      const exec = await this.tools.execute(params.user, params.locale, call.name, call.args);
      if (exec.ok) toolResults.push({ name: exec.name, result: exec.result });
      else toolResults.push({ name: exec.name, result: { error: exec.error } });
    }

    const summary =
      params.locale === 'ar'
        ? 'إليك ما وجدته من بيانات النظام.'
        : params.locale === 'he'
          ? 'הנה מה שמצאתי במערכת.'
          : 'Here’s what I found in the system.';

    return mapToolResultsToMessage({
      id: randomUUID(),
      locale: params.locale,
      summaryText: summary,
      toolResults,
    });
  }

  private async openAiTurn(params: {
    user: AuthUser;
    locale: AiChatLocale;
    surface: AiChatSurface;
    userText: string;
    history: Array<{ role: string; text: string }>;
    apiKey: string;
    model: string;
  }): Promise<ChatMessageDto> {
    const tools = this.tools.openaiToolsForUser(params.user);
    const messages: OpenAiMessage[] = [
      {
        role: 'system',
        content: buildSystemPrompt({
          locale: params.locale,
          surface: params.surface,
          userName: params.user.name || params.user.username,
        }),
      },
      ...params.history.slice(-16).map((h) => ({
        role: (h.role === 'assistant' ? 'assistant' : 'user') as 'assistant' | 'user',
        content: h.text,
      })),
      { role: 'user', content: params.userText },
    ];

    const toolResults: Array<{ name: string; result: unknown }> = [];
    let finalText = '';
    const maxRounds = 4;

    for (let round = 0; round < maxRounds; round++) {
      const body = {
        model: params.model,
        temperature: 0.2,
        messages,
        tools: tools.length ? tools : undefined,
        tool_choice: tools.length ? 'auto' : undefined,
      };

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${params.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        this.logger.error(`OpenAI chat failed (${res.status}): ${errText.slice(0, 400)}`);
        // Quota / auth failures must not silently answer with keyword guesses.
        if (
          res.status === 401 ||
          res.status === 402 ||
          res.status === 403 ||
          (res.status === 429 && /insufficient_quota|credit_balance|billing/i.test(errText))
        ) {
          return this.llmUnavailableMessage(params.locale, 'quota');
        }
        // Transient rate limits: try keyword tools, but label the answer as limited.
        if (res.status === 429) {
          const fallback = await this.deterministicTurn(params);
          return {
            ...fallback,
            blocks: [
              {
                type: 'error',
                title:
                  params.locale === 'ar'
                    ? 'المساعد مشغول مؤقتاً'
                    : params.locale === 'he'
                      ? 'העוזר עמוס כרגע'
                      : 'Assistant is briefly busy',
                body:
                  params.locale === 'ar'
                    ? 'تم الرد بأدوات محدودة — أعد المحاولة بعد لحظات لجواب أدق.'
                    : params.locale === 'he'
                      ? 'תשובה מוגבלת לפי מילות מפתח — נסו שוב בעוד רגע לתשובה מלאה.'
                      : 'Showing a limited keyword match — try again shortly for a full answer.',
              },
              ...fallback.blocks,
            ],
          };
        }
        return this.llmUnavailableMessage(params.locale, 'error');
      }

      const json = (await res.json()) as {
        choices?: Array<{ message?: OpenAiMessage }>;
      };
      const msg = json.choices?.[0]?.message;
      if (!msg) break;

      if (msg.tool_calls?.length) {
        messages.push({
          role: 'assistant',
          content: msg.content ?? null,
          tool_calls: msg.tool_calls,
        });
        for (const call of msg.tool_calls) {
          const exec = await this.tools.execute(
            params.user,
            params.locale,
            call.function.name,
            call.function.arguments,
          );
          const payload = exec.ok ? exec.result : { error: exec.error };
          toolResults.push({ name: call.function.name, result: payload });
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            name: call.function.name,
            content: JSON.stringify(payload).slice(0, 12_000),
          });
        }
        continue;
      }

      finalText = msg.content?.trim() ?? '';
      break;
    }

    if (!finalText) {
      finalText =
        params.locale === 'ar'
          ? 'إليك النتيجة من بيانات النظام.'
          : params.locale === 'he'
            ? 'הנה התוצאה מנתוני המערכת.'
            : 'Here is the result from system data.';
    }

    return mapToolResultsToMessage({
      id: randomUUID(),
      locale: params.locale,
      summaryText: finalText,
      toolResults,
    });
  }

  private llmUnavailableMessage(
    locale: AiChatLocale,
    reason: 'quota' | 'error',
  ): ChatMessageDto {
    const title =
      reason === 'quota'
        ? locale === 'ar'
          ? 'رصيد OpenAI منتهٍ'
          : locale === 'he'
            ? 'אין יתרת OpenAI'
            : 'OpenAI credits exhausted'
        : locale === 'ar'
          ? 'تعذّر الاتصال بالمساعد'
          : locale === 'he'
            ? 'לא ניתן להתחבר לעוזר'
            : 'Couldn’t reach the language model';

    const body =
      reason === 'quota'
        ? locale === 'ar'
          ? 'أضف رصيداً في حساب OpenAI ثم أعد المحاولة. بدون ذلك لا يستطيع المساعد فهم أسئلتك بحرية.'
          : locale === 'he'
            ? 'הוסיפו יתרה בחשבון OpenAI ונסו שוב. בלי זה העוזר לא יכול להבין שאלות חופשיות.'
            : 'Add credits in your OpenAI billing settings, then try again. Without that, free-form questions can’t be understood.'
        : locale === 'ar'
          ? 'حدث خطأ أثناء الاتصال بنموذج اللغة. حاول مرة أخرى.'
          : locale === 'he'
            ? 'אירעה שגיאה בחיבור למודל השפה. נסו שוב.'
            : 'There was an error contacting the language model. Please try again.';

    return {
      id: randomUUID(),
      role: 'assistant',
      createdAt: new Date().toISOString(),
      blocks: [{ type: 'error', title, body }],
    };
  }
}
