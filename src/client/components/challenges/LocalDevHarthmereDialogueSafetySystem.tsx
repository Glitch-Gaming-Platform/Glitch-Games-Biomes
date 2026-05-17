
import React, { useEffect, useState } from "react";

export const HARTHMERE_DIALOGUE_SAFETY_VERSION = "harthmere-dialogue-edge-safety-v1";
// dialogue choice idempotency: processedChoiceRequestIds prevents duplicate choice effects.
// no repeated greeting variation: chooseHarthmereGreetingVariation avoids repeating identical lines back-to-back.
export const HARTHMERE_DIALOGUE_SAFETY_STORAGE_KEY = "biomes.localDev.harthmere.dialogueSafety.v1";

export type HarthmereDialogueSession = {
  requestId: string;
  npcId: string;
  npcRole: string;
  startedAt: number;
  lastPlayerPosition: { x: number; y: number; z: number };
  maxDistanceMeters: number;
  status: "open" | "completed" | "interrupted" | "expired";
  hostile: boolean;
  questState?: string;
  reputationSnapshot: { likeability: number; legal: number; notoriety: number };
  requiredItems: string[];
  partyImpactingChoices: string[];
};

export type HarthmereDialogueChoice = {
  choiceId: string;
  label: string;
  requiresItems?: string[];
  requiresReputation?: Partial<{ likeabilityMin: number; legalMin: number; notorietyMin: number }>;
  hostileAllowed?: boolean;
  consequenceWarning?: string;
  partyImpact?: boolean;
  journalSummary?: string;
};

export type HarthmereDialogueSafetyState = {
  version: 1;
  active?: HarthmereDialogueSession;
  processedChoiceRequestIds: Record<string, number>;
  transcript: Array<{ requestId: string; npcId: string; line: string; choiceId?: string; at: number }>;
  journalSummaries: Array<{ requestId: string; summary: string; at: number }>;
  recentGreetings: Record<string, string[]>;
  interrupts: Array<{ requestId: string; reason: string; at: number }>;
};

function isBrowser() { return typeof window !== "undefined" && typeof window.localStorage !== "undefined"; }
function id(prefix = "dlg") { return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`; }

export const HARTHMERE_GREETING_VARIATIONS: Record<string, string[]> = {
  merchant: ["Looking for something useful?", "Coin talks, but good sense spends slower.", "I keep the decent stock behind the counter."],
  guard: ["State your business and keep the road clear.", "Keep your hands visible near the gate.", "Report trouble before it spreads."],
  priest: ["Speak softly; the sick are resting.", "The chapel helps those who come honestly.", "Light a candle if you carry grief."],
  thief: ["Keep your voice low.", "Not every door is meant for daylight.", "You did not hear this from me."],
};

export function emptyHarthmereDialogueSafetyState(): HarthmereDialogueSafetyState {
  return { version: 1, processedChoiceRequestIds: {}, transcript: [], journalSummaries: [], recentGreetings: {}, interrupts: [] };
}

export function readHarthmereDialogueSafetyState(): HarthmereDialogueSafetyState {
  if (!isBrowser()) return emptyHarthmereDialogueSafetyState();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(HARTHMERE_DIALOGUE_SAFETY_STORAGE_KEY) || "null");
    if (parsed?.version !== 1) return emptyHarthmereDialogueSafetyState();
    return { ...emptyHarthmereDialogueSafetyState(), ...parsed };
  } catch { return emptyHarthmereDialogueSafetyState(); }
}

export function writeHarthmereDialogueSafetyState(state: HarthmereDialogueSafetyState) {
  if (!isBrowser()) return;
  window.localStorage.setItem(HARTHMERE_DIALOGUE_SAFETY_STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new Event("biomes:harthmere-dialogue-safety"));
}

export function startHarthmereDialogueSession(input: Omit<HarthmereDialogueSession, "requestId" | "startedAt" | "status">) {
  const state = readHarthmereDialogueSafetyState();
  const session: HarthmereDialogueSession = { ...input, requestId: id("dlg"), startedAt: Date.now(), status: "open" };
  writeHarthmereDialogueSafetyState({ ...state, active: session, transcript: [{ requestId: session.requestId, npcId: session.npcId, line: chooseHarthmereGreetingVariation(session.npcRole, session.npcId), at: Date.now() }, ...state.transcript].slice(0, 200) });
  return session;
}

export function chooseHarthmereGreetingVariation(role: string, npcId: string) {
  const state = readHarthmereDialogueSafetyState();
  const pool = HARTHMERE_GREETING_VARIATIONS[role] ?? ["What brings you here?", "Speak your piece.", "I am listening."];
  const recent = state.recentGreetings[npcId] ?? [];
  const choice = pool.find((line) => !recent.includes(line)) ?? pool[(recent.length + 1) % pool.length];
  writeHarthmereDialogueSafetyState({ ...state, recentGreetings: { ...state.recentGreetings, [npcId]: [choice, ...recent].slice(0, Math.max(1, pool.length - 1)) } });
  return choice;
}

export function interruptHarthmereDialogue(reason: "combat" | "npc_death" | "distance" | "disconnect" | "timeout") {
  const state = readHarthmereDialogueSafetyState();
  if (!state.active) return { ok: false, reason: "no_active_session" as const };
  const active = { ...state.active, status: reason === "timeout" ? "expired" as const : "interrupted" as const };
  writeHarthmereDialogueSafetyState({ ...state, active, interrupts: [{ requestId: active.requestId, reason, at: Date.now() }, ...state.interrupts].slice(0, 80) });
  return { ok: true, reason };
}

export function checkHarthmereDialogueDistance(player: { x: number; y: number; z: number }) {
  const state = readHarthmereDialogueSafetyState();
  const active = state.active;
  if (!active || active.status !== "open") return { ok: true };
  const dx = player.x - active.lastPlayerPosition.x;
  const dy = player.y - active.lastPlayerPosition.y;
  const dz = player.z - active.lastPlayerPosition.z;
  const distance = Math.hypot(dx, dy, dz);
  if (distance > active.maxDistanceMeters) return interruptHarthmereDialogue("distance");
  return { ok: true, distance };
}

export function validateHarthmereDialogueChoice(choice: HarthmereDialogueChoice, context: { inventoryItemIds: string[]; reputation: { likeability: number; legal: number; notoriety: number }; hostile: boolean }) {
  const missing = (choice.requiresItems ?? []).filter((itemId) => !context.inventoryItemIds.includes(itemId));
  if (missing.length) return { ok: false, reason: "missing_required_item" as const, missing };
  if (choice.requiresReputation?.likeabilityMin !== undefined && context.reputation.likeability < choice.requiresReputation.likeabilityMin) return { ok: false, reason: "likeability_changed" as const };
  if (choice.requiresReputation?.legalMin !== undefined && context.reputation.legal < choice.requiresReputation.legalMin) return { ok: false, reason: "legal_state_changed" as const };
  if (choice.requiresReputation?.notorietyMin !== undefined && context.reputation.notoriety < choice.requiresReputation.notorietyMin) return { ok: false, reason: "notoriety_changed" as const };
  if (context.hostile && !choice.hostileAllowed) return { ok: false, reason: "hostile_negotiation_blocked" as const };
  return { ok: true };
}

export function processHarthmereDialogueChoice(requestId: string, choice: HarthmereDialogueChoice, context: { inventoryItemIds: string[]; reputation: { likeability: number; legal: number; notoriety: number }; hostile: boolean; disconnected?: boolean }) {
  let state = readHarthmereDialogueSafetyState();
  if (context.disconnected) return interruptHarthmereDialogue("disconnect");
  if (state.processedChoiceRequestIds[requestId]) return { ok: true, duplicate: true };
  const validation = validateHarthmereDialogueChoice(choice, context);
  if (!validation.ok) {
    writeHarthmereDialogueSafetyState({ ...state, transcript: [{ requestId, npcId: state.active?.npcId ?? "unknown", choiceId: choice.choiceId, line: `Choice blocked: ${validation.reason}`, at: Date.now() }, ...state.transcript].slice(0, 200) });
    return validation;
  }
  state = readHarthmereDialogueSafetyState();
  const summary = choice.journalSummary ?? `Chose: ${choice.label}`;
  writeHarthmereDialogueSafetyState({ ...state, processedChoiceRequestIds: { ...state.processedChoiceRequestIds, [requestId]: Date.now() }, transcript: [{ requestId, npcId: state.active?.npcId ?? "unknown", choiceId: choice.choiceId, line: choice.label, at: Date.now() }, ...state.transcript].slice(0, 200), journalSummaries: [{ requestId, summary, at: Date.now() }, ...state.journalSummaries].slice(0, 80), active: state.active ? { ...state.active, status: "completed" } : undefined });
  return { ok: true, summary };
}

export function skipHarthmereDialogueToJournalSummary(requestId: string, summary: string) {
  const state = readHarthmereDialogueSafetyState();
  writeHarthmereDialogueSafetyState({ ...state, journalSummaries: [{ requestId, summary, at: Date.now() }, ...state.journalSummaries].slice(0, 80) });
  return { ok: true, summary };
}

export function getHarthmereDialogueConsequenceWarning(choice: HarthmereDialogueChoice) {
  if (choice.consequenceWarning) return choice.consequenceWarning;
  if (choice.partyImpact) return "This choice can affect your party, quest phase, reputation, or rewards.";
  return undefined;
}

export const HarthmereDialogueSafetyPanel: React.FunctionComponent<{}> = () => {
  const [state, setState] = useState(readHarthmereDialogueSafetyState);
  useEffect(() => {
    const on = () => setState(readHarthmereDialogueSafetyState());
    window.addEventListener("biomes:harthmere-dialogue-safety", on);
    return () => window.removeEventListener("biomes:harthmere-dialogue-safety", on);
  }, []);
  return <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs" data-harthmere-dialogue-safety="v1"><div className="text-sm font-bold text-violet-100">Dialogue Safety</div><div>Active: {state.active?.requestId ?? "none"}</div><div>Transcript lines: {state.transcript.length}</div><div>Journal summaries: {state.journalSummaries.length}</div><div>Interrupts: {state.interrupts.length}</div></div>;
};
