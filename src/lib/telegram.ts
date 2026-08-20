import { ReetiError } from "@/lib/errors";
import { missingTelegramConfiguration, serverEnv } from "@/lib/env";

interface TelegramApiResponse<T> {
  ok?: boolean;
  description?: string;
  result?: T;
}

interface TelegramUpdate {
  update_id?: number;
  message?: {
    text?: string;
    date?: number;
    chat?: { id?: number | string };
  };
  channel_post?: {
    text?: string;
    date?: number;
    chat?: { id?: number | string };
  };
}

export interface TelegramPreflight {
  bot: { id: string; username: string | null; name: string };
  updates: {
    pendingCount: number;
    configuredChatSeen: boolean;
    latestUpdateId: number | null;
    latestStartUpdateId: number | null;
  };
}

function telegramUrl(method: string): string {
  return `https://api.telegram.org/bot${serverEnv.telegramBotToken}/${method}`;
}

function requireTelegramConfiguration(): { token: string; chatId: string } {
  if (!serverEnv.telegramBotToken || !serverEnv.telegramChatId) {
    throw new ReetiError(
      "Telegram is not configured for this local project; the follow-up remains unsent.",
      "TELEGRAM_NOT_CONFIGURED",
      503,
      { missing: missingTelegramConfiguration() },
    );
  }
  return { token: serverEnv.telegramBotToken, chatId: serverEnv.telegramChatId };
}

async function telegramFetch<T>(
  method: string,
  init?: RequestInit,
): Promise<TelegramApiResponse<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(telegramUrl(method), { ...init, signal: controller.signal });
    return (await response.json()) as TelegramApiResponse<T>;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError")
      throw new ReetiError("Telegram preflight timed out.", "TELEGRAM_PREFLIGHT_TIMEOUT", 504);
    throw new ReetiError("Telegram could not be reached.", "TELEGRAM_NETWORK_FAILED", 502);
  } finally {
    clearTimeout(timeout);
  }
}

export async function telegramPreflight(): Promise<TelegramPreflight> {
  const { chatId } = requireTelegramConfiguration();
  const me = await telegramFetch<{
    id?: number;
    is_bot?: boolean;
    first_name?: string;
    username?: string;
  }>("getMe");
  if (!me.ok || !me.result?.id || me.result.is_bot !== true) {
    throw new ReetiError(
      "Telegram rejected the bot identity check.",
      "TELEGRAM_PREFLIGHT_FAILED",
      502,
      { providerMessage: me.description ?? "unknown" },
    );
  }

  const updatesQuery = new URLSearchParams({
    limit: "20",
    allowed_updates: JSON.stringify(["message", "channel_post"]),
  });
  const updates = await telegramFetch<TelegramUpdate[]>(`getUpdates?${updatesQuery.toString()}`);
  if (!updates.ok || !Array.isArray(updates.result)) {
    throw new ReetiError(
      "Telegram rejected the update check. The bot identity is valid, but /start could not be read.",
      "TELEGRAM_UPDATES_FAILED",
      502,
      { providerMessage: updates.description ?? "unknown" },
    );
  }

  let configuredChatSeen = false;
  let latestUpdateId: number | null = null;
  let latestStartUpdateId: number | null = null;
  for (const update of updates.result) {
    if (typeof update.update_id === "number") {
      latestUpdateId = Math.max(latestUpdateId ?? update.update_id, update.update_id);
    }
    const item = update.message ?? update.channel_post;
    const itemChatId = item?.chat?.id;
    if (item && itemChatId !== undefined && String(itemChatId) === chatId) {
      configuredChatSeen = true;
      if (item.text?.trim().split(/\s+/)[0] === "/start") {
        latestStartUpdateId = update.update_id ?? latestStartUpdateId;
      }
    }
  }

  return {
    bot: {
      id: String(me.result.id),
      username: me.result.username ? `@${me.result.username}` : null,
      name: me.result.first_name ?? "Unnamed bot",
    },
    updates: {
      pendingCount: updates.result.length,
      configuredChatSeen,
      latestUpdateId,
      latestStartUpdateId,
    },
  };
}

export async function sendTelegramMessage(text: string): Promise<{ messageId: string }> {
  const { chatId } = requireTelegramConfiguration();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(telegramUrl("sendMessage"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: controller.signal,
    });
    const body = (await response.json()) as TelegramApiResponse<{ message_id?: number }>;
    if (!response.ok || !body.ok || !body.result?.message_id) {
      throw new ReetiError(
        "Telegram rejected the follow-up delivery.",
        "TELEGRAM_DELIVERY_FAILED",
        502,
        { providerStatus: response.status, providerMessage: body.description ?? "unknown" },
      );
    }
    return { messageId: String(body.result.message_id) };
  } catch (error) {
    if (error instanceof ReetiError) throw error;
    if (error instanceof Error && error.name === "AbortError")
      throw new ReetiError("Telegram delivery timed out.", "TELEGRAM_TIMEOUT", 504);
    throw new ReetiError("Telegram could not be reached.", "TELEGRAM_NETWORK_FAILED", 502);
  } finally {
    clearTimeout(timeout);
  }
}
