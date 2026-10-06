import type {
  AssistantMessage,
  AssistantPlan,
  AssistantCard,
} from "@/lib/ai-assistant/contracts";
export const characterStates = [
  "IDLE",
  "LISTENING",
  "FINALIZING_SPEECH",
  "PROCESSING",
  "WORKING",
  "SPEAKING",
  "AWAITING_CONFIRMATION",
  "SUCCESS",
  "ERROR",
  "RECONNECTING",
] as const;
export type CharacterState = (typeof characterStates)[number];
export type Gesture =
  | "NEUTRAL"
  | "OPEN_HANDS"
  | "ONE_HAND_EXPLAIN"
  | "POINT"
  | "HAPPY"
  | "THINKING"
  | "CONFIRM"
  | "SUCCESS"
  | "SORRY";
export type Expression =
  | "NEUTRAL_FRIENDLY"
  | "HAPPY"
  | "EXCITED"
  | "THOUGHTFUL"
  | "ATTENTIVE"
  | "CONFIRMING"
  | "SUCCESS"
  | "CONCERNED";
export type VoicePresentationResult = {
  spokenText: string;
  visualPayload: AssistantCard[];
  suggestedAction?: "confirm";
  characterState: CharacterState;
  gestureHint: Gesture;
};
export function concise(text: string) {
  return text
    .replace(/^[\s]*(?:Sigur|Desigur|Bineînțeles|Am înțeles)[.!,:]?\s*/i, "")
    .replace(/[*#`]/g, "")
    .split(/(?<=[.!?])\s+/)
    .slice(0, 2)
    .join(" ")
    .slice(0, 320);
}
export function presentVoice(
  message: AssistantMessage,
  plan?: AssistantPlan,
): VoicePresentationResult {
  const cards = message.cards || [];
  let spokenText = concise(message.text),
    state: CharacterState = "IDLE",
    gesture: Gesture = "ONE_HAND_EXPLAIN";
  if (plan) {
    if (plan.outcome && plan.outcome.state !== 'COMPLETED' && plan.status === 'completed') {
      spokenText = plan.outcome.note;
    } else if (plan.status === "completed") {
      spokenText = `Gata. ${plan.results?.length || plan.actions.length} ${plan.actions.length === 1 ? "acțiune confirmată" : "acțiuni confirmate"}.`;
      state = "SUCCESS";
      gesture = "SUCCESS";
    } else if (plan.status === "cancelled") {
      spokenText = "Planul a fost anulat.";
    } else if (plan.status === "paused") {
      spokenText = `Planul este în pauză. ${plan.results?.length || 0} din ${plan.actions.length} pași confirmați. Îl poți relua din panou.`;
    } else if (plan.status === "running") {
      spokenText = `Planul este în execuție. ${plan.results?.length || 0} din ${plan.actions.length} pași confirmați.`;
    } else if (["failed", "unknown", "partial"].includes(plan.status)) {
      spokenText = "Execuția necesită verificare. Rezultatul este în panou.";
      state = "ERROR";
      gesture = "SORRY";
    } else {
      spokenText = `Am pregătit ${plan.actions.length} ${plan.actions.length === 1 ? "acțiune" : "acțiuni"}. Verifică planul; îl execut?`;
      state = "AWAITING_CONFIRMATION";
      gesture = "CONFIRM";
    }
  } else if (message.planId) {
    spokenText = `Planul cu ${message.actions?.length || 1} pași este pregătit. Îl execut?`;
    state = "AWAITING_CONFIRMATION";
    gesture = "CONFIRM";
  } else if (cards.length) {
    const card = cards[0],
      n = card.summary?.count ?? card.rows.length,
      partial =
        card.complete === false &&
        (!card.summary || /parțial/i.test(card.summary.scope || ""));
    if (card.source === "viewings") {
      const first = card.rows.find(
        (r) =>
          r.viewingDate && Number.isFinite(Date.parse(String(r.viewingDate))),
      );
      const time = first
        ? new Intl.DateTimeFormat("ro-RO", {
            hour: "numeric",
            minute: "2-digit",
            timeZone: "Europe/Bucharest",
          }).format(new Date(String(first.viewingDate)))
        : null;
      spokenText = `${partial ? "Am afișat" : "Sunt"} ${n} vizionări${partial ? " în acest segment" : ""}.${time ? " Prima este la " + time + "." : ""}`;
    } else if (["owners", "crm", "properties"].includes(card.source)) {
      spokenText = `${partial ? "Am afișat" : "Am găsit"} ${n} ${card.outputType === "PROPERTY_MATCH_LIST" ? "potriviri" : "proprietăți"}.${partial ? " Căutarea poate continua." : " Sunt în panou."}`;
      gesture = "OPEN_HANDS";
    } else if (card.source === "tasks")
      spokenText = `${partial ? "Am afișat" : "Sunt"} ${n} sarcini. Le ai în panou.`;
    else if (card.source === "contacts") spokenText = `Am afișat ${n} clienți.`;
    else {
      spokenText = spokenText || "Rezultatul este în panou.";
      gesture = "POINT";
    }
  }
  return {
    spokenText: spokenText || "Rezultatul este disponibil în panou.",
    visualPayload: cards,
    suggestedAction: state === "AWAITING_CONFIRMATION" ? "confirm" : undefined,
    characterState: state,
    gestureHint: gesture,
  };
}
export function confirmationIntent(text: string): "yes" | "no" | null {
  const t = text.toLocaleLowerCase("ro").replace(/[.!?]/g, "").trim();
  return /^(da|confirm|confirmă|execută|executa|da execută|da confirm)$/.test(t)
    ? "yes"
    : /^(nu|anulează|anuleaza|nu anulează)$/.test(t)
      ? "no"
      : null;
}
