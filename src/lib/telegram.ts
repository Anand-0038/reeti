import { ReetiError } from "@/lib/errors";
import { missingTelegramConfiguration, serverEnv } from "@/lib/env";

export async function sendTelegramMessage(text: string): Promise<{ messageId: string }> {
  if (!serverEnv.telegramBotToken || !serverEnv.telegramChatId) {
    throw new ReetiError(
      "Telegram is not configured for this local project; the follow-up remains unsent.",
      "TELEGRAM_NOT_CONFIGURED",
      503,
      { missing: missingTelegramConfiguration() },
    );
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${serverEnv.telegramBotToken}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: serverEnv.telegramChatId, text }),
        signal: controller.signal,
      },
    );
    const body = (await response.json()) as {
      ok?: boolean;
      description?: string;
      result?: { message_id?: number };
    };
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
