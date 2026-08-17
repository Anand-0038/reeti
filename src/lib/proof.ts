const PERSISTENCE_TERMS = ["emoji", "urgency", "technical", "specific"] as const;

export interface ProofSessionResult {
  session?: unknown;
  rememberedSignal?: unknown;
}

export function inspectPersistenceReply(reply: string): {
  rememberedTerms: string[];
  rememberedSignal: boolean;
} {
  const normalized = reply.toLowerCase();
  const rememberedTerms = PERSISTENCE_TERMS.filter((term) => normalized.includes(term));
  return {
    rememberedTerms,
    rememberedSignal: rememberedTerms.length >= 2,
  };
}

export function persistenceProofPassed(input: {
  statusA: number | null;
  statusB: number | null;
  sessionA: ProofSessionResult | null;
  sessionB: ProofSessionResult | null;
}): boolean {
  return (
    input.statusA === 0 &&
    input.statusB === 0 &&
    input.sessionA?.session === "A" &&
    input.sessionB?.session === "B" &&
    input.sessionB?.rememberedSignal === true
  );
}
