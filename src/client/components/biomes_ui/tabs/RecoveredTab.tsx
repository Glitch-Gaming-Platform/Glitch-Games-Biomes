import { CH1_AUGUR9_RECHARGES } from "@/shared/harthmere/ch1_augur9";
import { defaultHarthmereLiveFetch } from "@/client/components/harthmere_live_fetch";
import { publishChapter1LatentSkillUse } from "@/client/components/challenges/chapter1LatentSkillPresentation";
import { CH1_LINK_RECIPES } from "@/shared/harthmere/ch1_fragment_ledger";
import { ch1Item } from "@/shared/harthmere/ch1_items";
import type { Ch1LatentSkillId } from "@/shared/harthmere/ch1_latent_skills";
import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

const RECHARGE_CELLS = Object.entries(CH1_AUGUR9_RECHARGES).map(
  ([itemId, amount]) => ({
    itemId,
    label: `${ch1Item(itemId)?.name ?? itemId} +${amount}`,
  })
);

interface RecoveredDocument {
  id: string;
  title: string;
  attribution: string;
  itemId?: string;
  pages: Array<{ heading?: string; body: string }>;
}

interface RecoveredState {
  ok: boolean;
  reason?: string;
  unlocked: boolean;
  cardName: string;
  ledger: {
    linkingUnlocked: boolean;
    consolidated: boolean;
    entries: Array<{
      fragmentId: string;
      title: string;
      type: "echo" | "overlay" | "playback" | "reconstruction" | "derived";
      body: string;
      confidence?: number;
      revised: boolean;
    }>;
  };
  latentSkills: Array<{
    id: Ch1LatentSkillId;
    name: string;
    tooltip: string;
    description: string;
    readyAtMs: number;
  }>;
  testimonies: { count: number; total: number };
  augur9: {
    charge: number;
    shutDown: boolean;
    availableLogs: Array<{
      fragmentId: string;
      title: string;
      chargeCost: number;
      played: boolean;
    }>;
  };
  ending?: "confess" | "contain" | "bargain";
  hallrChoice?: "let_run" | "hold_stall";
  lastSkillUse?: {
    skillId: Ch1LatentSkillId;
    usedAtMs: number;
    result: string;
  };
  documents?: RecoveredDocument[];
  worldPhase?: Array<{ id: string; summary: string }>;
}

async function chapter1StoryAction(body: object): Promise<RecoveredState> {
  const response = await defaultHarthmereLiveFetch(
    "/api/harthmere/chapter1_story",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (!response.ok) {
    throw new Error(`Recovered ledger request failed (${response.status})`);
  }
  return response.json();
}

const typeLabel: Record<
  RecoveredState["ledger"]["entries"][number]["type"],
  string
> = {
  echo: "Echo",
  overlay: "Overlay",
  playback: "Playback",
  reconstruction: "Reconstruction",
  derived: "Linked",
};

/**
 * The reader.
 *
 * Chapter 1's fair-play promise is that the evidence is physically present
 * before the reveal. That promise is only kept if the player can come BACK to a
 * document once they know what to look for, so nothing here is a one-shot
 * modal: every unlocked document stays open forever, paginated, in the order it
 * was written.
 */
const DocumentReader: React.FunctionComponent<{
  documents: RecoveredDocument[];
}> = ({ documents }) => {
  const [openId, setOpenId] = useState<string>();
  const [pageIndex, setPageIndex] = useState(0);
  const open = documents.find((doc) => doc.id === openId);

  useEffect(() => {
    setPageIndex(0);
  }, [openId]);

  if (documents.length === 0) {
    return null;
  }
  const page = open?.pages[Math.min(pageIndex, open.pages.length - 1)];
  return (
    <div data-chapter1-documents={String(documents.length)}>
      <h3 className="mb-2 text-sm font-bold uppercase tracking-[0.16em] text-white/70">
        Things you can read again
      </h3>
      <div className="grid gap-2 md:grid-cols-2">
        {documents.map((doc) => (
          <button
            key={doc.id}
            type="button"
            data-chapter1-document-id={doc.id}
            onClick={() => setOpenId(doc.id === openId ? undefined : doc.id)}
            className={`rounded-lg border px-3 py-2 text-left ${
              doc.id === openId
                ? "border-amber-200/50 bg-amber-950/25"
                : "border-white/10 bg-black/20 hover:border-white/30"
            }`}
          >
            <span className="block font-semibold text-white">{doc.title}</span>
            <span className="mt-1 block text-xs text-white/50">
              {doc.attribution} · {doc.pages.length}{" "}
              {doc.pages.length === 1 ? "page" : "pages"}
            </span>
          </button>
        ))}
      </div>

      {open && page && (
        <article
          data-chapter1-document-open={open.id}
          data-chapter1-document-page={String(pageIndex + 1)}
          className="border-amber-200/25 rounded-xl mt-3 border bg-black/30 p-4"
        >
          {page.heading && (
            <div className="text-amber-200/70 text-[10px] font-bold uppercase tracking-[0.16em]">
              {page.heading}
            </div>
          )}
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-white/75">
            {page.body}
          </p>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              data-chapter1-document-prev={open.id}
              disabled={pageIndex === 0}
              className="border-white/15 rounded border px-3 py-1 text-xs text-white/70 disabled:opacity-40"
              onClick={() => setPageIndex((index) => Math.max(0, index - 1))}
            >
              Back
            </button>
            <span className="text-white/45 text-xs">
              {pageIndex + 1} / {open.pages.length}
            </span>
            <button
              type="button"
              data-chapter1-document-next={open.id}
              disabled={pageIndex >= open.pages.length - 1}
              className="border-white/15 rounded border px-3 py-1 text-xs text-white/70 disabled:opacity-40"
              onClick={() =>
                setPageIndex((index) =>
                  Math.min(open.pages.length - 1, index + 1)
                )
              }
            >
              Next
            </button>
          </div>
        </article>
      )}
    </div>
  );
};

export const RecoveredTab: React.FunctionComponent = () => {
  const [state, setState] = useState<RecoveredState>();
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    try {
      const next = await chapter1StoryAction({ action: "state" });
      setState(next);
      setError(next.ok ? undefined : next.reason);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onUpdated = () => void refresh();
    window.addEventListener("chapter1-story-updated", onUpdated);
    window.addEventListener("chapter1-ledger-revision", onUpdated);
    window.addEventListener("chapter1-card-renamed", onUpdated);
    return () => {
      window.removeEventListener("chapter1-story-updated", onUpdated);
      window.removeEventListener("chapter1-ledger-revision", onUpdated);
      window.removeEventListener("chapter1-card-renamed", onUpdated);
    };
  }, [refresh]);

  const recoveredIds = useMemo(
    () => new Set(state?.ledger.entries.map((entry) => entry.fragmentId) ?? []),
    [state?.ledger.entries]
  );
  // Every buildable timeline, not just the first. The Act 5 screen is supposed
  // to be a board the player works, and offering one recipe at a time made
  // three authored links look like one button that changed its mind.
  const availableLinks = useMemo(
    () =>
      state?.ledger.linkingUnlocked
        ? CH1_LINK_RECIPES.filter(
            (recipe) =>
              !recoveredIds.has(recipe.derives) &&
              recipe.sources.every((fragmentId) => recoveredIds.has(fragmentId))
          )
        : [],
    [state?.ledger.linkingUnlocked, recoveredIds]
  );

  const mutate = useCallback(async (key: string, body: object) => {
    setBusy(key);
    try {
      const next = await chapter1StoryAction(body);
      setState(next);
      setError(next.ok ? undefined : next.reason);
      if (next.ok) {
        if (body && "action" in body && body.action === "use_skill") {
          const skillUse = next.lastSkillUse;
          if (skillUse) publishChapter1LatentSkillUse(skillUse);
        }
        window.dispatchEvent(new CustomEvent("chapter1-story-updated"));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(undefined);
    }
  }, []);

  if (!state) {
    return <div className="text-sm text-white/60">Opening the ledger…</div>;
  }

  if (!state.unlocked) {
    return (
      <section data-chapter1-recovered-tab="locked">
        <div className="rounded-xl border border-white/10 bg-black/20 p-8 text-center">
          <div className="text-lg font-semibold text-white">Nothing yet.</div>
          <p className="text-white/55 mt-2 text-sm">
            The page is present. Whatever belongs here has not come back.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5" data-chapter1-recovered-tab="unlocked">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="border-cyan-200/20 rounded-xl bg-cyan-950/20 border p-4">
          <div className="text-cyan-200/70 text-[10px] font-bold uppercase tracking-[0.18em]">
            Instrument
          </div>
          <div className="text-lg mt-1 font-semibold text-white">
            {state.cardName}
          </div>
        </div>
        <div className="border-amber-200/20 rounded-xl bg-amber-950/20 border p-4">
          <div className="text-amber-200/70 text-[10px] font-bold uppercase tracking-[0.18em]">
            AUGUR-9 Core
          </div>
          <div className="mt-1 flex items-end gap-2">
            <span className="text-2xl font-semibold text-white">
              {Math.round(state.augur9.charge)}%
            </span>
            <span className="text-white/55 pb-1 text-xs">
              {state.augur9.shutDown ? "shut down" : "online"}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/40">
            <div
              className="from-red-500 via-amber-400 to-cyan-300 h-full bg-gradient-to-r"
              style={{
                width: `${Math.max(0, Math.min(100, state.augur9.charge))}%`,
              }}
            />
          </div>
          {/* Recharging has always existed on the API and never had a control.
              Choosing what to remember costs the robot hours of its life; the
              player deserves the option to give some back. */}
          <div className="mt-3 flex flex-wrap gap-2">
            {RECHARGE_CELLS.map((cell) => (
              <button
                key={cell.itemId}
                type="button"
                disabled={busy !== undefined || state.augur9.charge >= 100}
                data-chapter1-recharge-item={cell.itemId}
                className="border-white/15 hover:border-amber-200/50 rounded border px-2 py-1 text-xs text-white/75 disabled:opacity-40"
                onClick={() =>
                  void mutate(`recharge:${cell.itemId}`, {
                    action: "recharge",
                    itemId: cell.itemId,
                    requestId: crypto.randomUUID(),
                  })
                }
              >
                {cell.label}
              </button>
            ))}
          </div>
        </div>
        <div className="border-fuchsia-200/20 rounded-xl bg-fuchsia-950/20 border p-4">
          <div className="text-fuchsia-200/70 text-[10px] font-bold uppercase tracking-[0.18em]">
            The Night You Came
          </div>
          <div className="text-lg mt-1 font-semibold text-white">
            {state.testimonies.count}/{state.testimonies.total} accounts
          </div>
        </div>
      </div>

      {state.augur9.availableLogs.some((log) => !log.played) && (
        <div className="border-amber-200/20 rounded-xl border bg-black/25 p-4">
          <h3 className="text-amber-100 text-sm font-bold uppercase tracking-[0.16em]">
            Logs still in the core
          </h3>
          <p className="text-white/55 mt-1 text-xs">
            Pulling a recording costs core charge. Replaying a saved recording
            is free.
          </p>
          <div className="mt-3 grid gap-2">
            {state.augur9.availableLogs
              .filter((log) => !log.played)
              .map((log) => (
                <button
                  key={log.fragmentId}
                  type="button"
                  disabled={busy !== undefined || state.augur9.shutDown}
                  data-chapter1-playback-id={log.fragmentId}
                  className="border-white/15 hover:border-amber-200/50 rounded-lg disabled:opacity-45 border px-3 py-2 text-left"
                  onClick={() =>
                    void mutate(`play:${log.fragmentId}`, {
                      action: "play_log",
                      fragmentId: log.fragmentId,
                    })
                  }
                >
                  <span className="font-semibold text-white">{log.title}</span>
                  <span className="text-amber-200/70 ml-2 text-xs">
                    −{log.chargeCost} charge
                  </span>
                </button>
              ))}
          </div>
        </div>
      )}

      {availableLinks.length > 0 && (
        <div className="grid gap-2">
          {availableLinks.map((recipe) => (
            <button
              key={recipe.derives}
              type="button"
              disabled={busy !== undefined}
              data-chapter1-link-fragments={recipe.derives}
              className="border-cyan-200/30 hover:border-cyan-100/70 rounded-lg bg-cyan-900/20 disabled:opacity-45 border px-4 py-3 text-left"
              onClick={() =>
                void mutate(`link:${recipe.derives}`, {
                  action: "link",
                  fragmentIds: recipe.sources,
                })
              }
            >
              <span className="text-cyan-100 block font-semibold">
                Link these fragments
              </span>
              <span className="text-white/55 mt-1 block text-xs">
                {recipe.sources.length} records. Put them beside one another and
                see what survives comparison.
              </span>
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="border-red-300/30 rounded-lg bg-red-950/40 text-red-100 border p-3 text-sm">
          {error}
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {state.ledger.entries.length === 0 ? (
          <div className="rounded-xl text-white/55 border border-white/10 bg-black/20 p-6">
            Nothing yet.
          </div>
        ) : (
          state.ledger.entries.map((entry) => (
            <article
              key={entry.fragmentId}
              data-chapter1-fragment-id={entry.fragmentId}
              className={`rounded-xl border p-4 ${
                entry.revised
                  ? "border-fuchsia-200/40 bg-fuchsia-950/20"
                  : "border-white/10 bg-black/20"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-white/45 text-[10px] font-bold uppercase tracking-[0.16em]">
                    {typeLabel[entry.type]}
                    {entry.revised ? " · revised" : ""}
                  </div>
                  <h3 className="text-base mt-1 font-semibold text-white">
                    {entry.title}
                  </h3>
                </div>
                {entry.confidence !== undefined && (
                  <div className="border-white/15 text-white/65 rounded-full border px-2 py-1 text-xs">
                    {entry.confidence}%
                  </div>
                )}
              </div>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-white/70">
                {entry.body}
              </p>
            </article>
          ))
        )}
      </div>

      <DocumentReader documents={state.documents ?? []} />

      {(state.worldPhase?.length ?? 0) > 0 && (
        <div data-chapter1-world-phase="present">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-[0.16em] text-white/70">
            Where things stand
          </h3>
          <ul className="grid gap-2">
            {state.worldPhase!.map((effect) => (
              <li
                key={effect.id}
                data-chapter1-world-phase-id={effect.id}
                className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/70"
              >
                {effect.summary}
              </li>
            ))}
          </ul>
        </div>
      )}

      {state.latentSkills.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-bold uppercase tracking-[0.16em] text-white/70">
            Things your hands remember
          </h3>
          <div className="grid gap-2 md:grid-cols-2">
            {state.latentSkills.map((skill) => (
              <div
                key={skill.id}
                className="border-cyan-200/20 rounded-lg bg-cyan-950/15 border p-3"
              >
                <div className="text-cyan-100 font-semibold">{skill.name}</div>
                <div className="text-white/55 mt-1 text-xs italic">
                  {skill.tooltip}
                </div>
                <p className="text-white/65 mt-2 text-sm">
                  {skill.description}
                </p>
                <button
                  type="button"
                  disabled={busy !== undefined || Date.now() < skill.readyAtMs}
                  data-chapter1-use-skill={skill.id}
                  className="border-cyan-100/30 hover:border-cyan-100/70 rounded text-cyan-100 mt-3 border px-3 py-1 text-xs font-semibold disabled:opacity-40"
                  onClick={() =>
                    void mutate(`skill:${skill.id}`, {
                      action: "use_skill",
                      skillId: skill.id,
                    })
                  }
                >
                  Use
                </button>
              </div>
            ))}
          </div>
          {state.lastSkillUse && (
            <p
              className="border-cyan-200/20 rounded-lg text-cyan-50/80 mt-3 border bg-black/20 px-3 py-2 text-sm"
              data-chapter1-skill-result={state.lastSkillUse.skillId}
            >
              {state.lastSkillUse.result}
            </p>
          )}
        </div>
      )}
    </section>
  );
};
