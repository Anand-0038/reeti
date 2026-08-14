function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export const serverEnv = {
  mindsBuilderApiKey: optionalEnv("MINDS_BUILDER_API_KEY"),
  mindsMindId: optionalEnv("MINDS_MIND_ID"),
  mindsConversationAlias: optionalEnv("MINDS_CONVERSATION_ALIAS") ?? "reeti-main",
  telegramBotToken: optionalEnv("TELEGRAM_BOT_TOKEN"),
  telegramChatId: optionalEnv("TELEGRAM_CHAT_ID"),
  workerSecret: optionalEnv("REETI_WORKER_SECRET"),
  dbPath: optionalEnv("REETI_DB_PATH"),
};

export function getProviderStatus() {
  return {
    mindsConfigured: Boolean(serverEnv.mindsBuilderApiKey && serverEnv.mindsMindId),
    telegramConfigured: Boolean(serverEnv.telegramBotToken && serverEnv.telegramChatId),
    mindAlias: serverEnv.mindsConversationAlias,
  };
}

export function missingMindsConfiguration(): string[] {
  const missing: string[] = [];
  if (!serverEnv.mindsBuilderApiKey) missing.push("MINDS_BUILDER_API_KEY");
  if (!serverEnv.mindsMindId) missing.push("MINDS_MIND_ID");
  return missing;
}

export function missingTelegramConfiguration(): string[] {
  const missing: string[] = [];
  if (!serverEnv.telegramBotToken) missing.push("TELEGRAM_BOT_TOKEN");
  if (!serverEnv.telegramChatId) missing.push("TELEGRAM_CHAT_ID");
  return missing;
}
