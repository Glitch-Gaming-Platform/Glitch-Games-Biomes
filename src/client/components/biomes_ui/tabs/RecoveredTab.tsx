import { CH1_LINK_RECIPES } from "@/shared/harthmere/ch1_fragment_ledger";
import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

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
    id: string;
    name: string;
    tooltip: string;
    description: string;
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
}

async function chapter1StoryAction(body: object): Promise<RecoveredState> {
  const response = await fetch("/api/harthmere/chapter1_story", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Recovered ledger request failed (${response.status})`);
  }
  return response.json();
}

const typeLabel: Record<RecoveredState["ledger"]["entries"][number]["type"], string> = {
  echo: "Echo",
  overlay: "Overlay",
  playback: "Playback",
  reconstruction: "Reconstruction",
  derived: "Linked",
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
  const availableLink = state?.ledger.linkingUnlocked
    ? CH1_LINK_RECIPES.find((recipe) =>
        recipe.sources.every((fragmentId) => recoveredIds.has(fragmentId))
      )
    : undefined;

  const mutate = useCallback(async (key: string, body: object) => {
    setBusy(key);
    try {
      const next = await chapter1StoryAction(body);
      setState(next);
      setError(next.ok ? undefined : next.reason);
      if (next.ok) {
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
        <div className="border-white/10 rounded-xl border bg-black/20 p-8 text-center">
          <div className="text-lg font-semibold text-white">Nothing yet.</div>
          <p className="mt-2 text-sm text-white/55">
            The page is present. Whatever belongs here has not come back.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5" data-chapter1-recovered-tab="unlocked">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="border-cyan-200/20 rounded-xl border bg-cyan-950/20 p-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-200/70">
            Instrument
          </div>
          <div className="mt-1 text-lg font-semibold text-white">
            {state.cardName}
          </div>
        </div>
        <div className="border-amber-200/20 rounded-xl border bg-amber-950/20 p-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-200/70">
            AUGUR-9 Core
          </div>
          <div className="mt-1 flex items-end gap-2">
            <span className="text-2xl font-semibold text-white">
              {Math.round(state.augur9.charge)}%
            </span>
            <span className="pb-1 text-xs text-white/55">
              {state.augur9.shutDown ? "shut down" : "online"}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/40">
            <div
              className="h-full bg-gradient-to-r from-red-500 via-amber-400 to-cyan-300"
              style={{ width: `${Math.max(0, Math.min(100, state.augur9.charge))}%` }}
            />
          </div>
        </div>
        <div className="border-fuchsia-200/20 rounded-xl border bg-fuchsia-950/20 p-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-fuchsia-200/70">
            The Night You Came
          </div>
          <div className="mt-1 text-lg font-semibold text-white">
            {state.testimonies.count}/{state.testimonies.total} accounts
          </div>
        </div>
      </div>

      {state.augur9.availableLogs.some((log) => !log.played) && (
        <div className="border-amber-200/20 rounded-xl border bg-black/25 p-4">
          <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-amber-100">
            Logs still in the core
          </h3>
          <p className="mt-1 text-xs text-white/55">
            Pulling a recording costs core charge. Replaying a saved recording is free.
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
                  className="border-white/15 hover:border-amber-200/50 rounded-lg border px-3 py-2 text-left disabled:opacity-45"
                  onClick={() =>
                    void mutate(`play:${log.fragmentId}`, {
                      action: "play_log",
                      fragmentId: log.fragmentId,
                    })
                  }
                >
                  <span className="font-semibold text-white">{log.title}</span>
                  <span className="ml-2 text-xs text-amber-200/70">
                    −{log.chargeCost} charge
                  </span>
                </button>
              ))}
          </div>
        </div>
      )}

      {availableLink && !recoveredIds.has(availableLink.derives) && (
        <button
          type="button"
          disabled={busy !== undefined}
          data-chapter1-link-fragments={availableLink.derives}
          className="border-cyan-200/30 hover:border-cyan-100/70 rounded-lg border bg-cyan-900/20 px-4 py-3 text-left disabled:opacity-45"
          onClick={() =>
            void mutate("link", {
              action: "link",
              fragmentIds: availableLink.sources,
            })
          }
        >
          <span className="block font-semibold text-cyan-100">
            Link these fragments
          </span>
          <span className="mt-1 block text-xs text-white/55">
            Put the records beside one another and see what survives comparison.
          </span>
        </button>
      )}

      {error && (
        <div className="border-red-300/30 rounded-lg border bg-red-950/40 p-3 text-sm text-red-100">
          {error}
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {state.ledger.entries.length === 0 ? (
          <div className="border-white/10 rounded-xl border bg-black/20 p-6 text-white/55">
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
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">
                    {typeLabel[entry.type]}
                    {entry.revised ? " · revised" : ""}
                  </div>
                  <h3 className="mt-1 text-base font-semibold text-white">
                    {entry.title}
                  </h3>
                </div>
                {entry.confidence !== undefined && (
                  <div className="rounded-full border border-white/15 px-2 py-1 text-xs text-white/65">
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

      {state.latentSkills.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-bold uppercase tracking-[0.16em] text-white/70">
            Things your hands remember
          </h3>
          <div className="grid gap-2 md:grid-cols-2">
            {state.latentSkills.map((skill) => (
              <div
                key={skill.id}
                className="border-cyan-200/20 rounded-lg border bg-cyan-950/15 p-3"
              >
                <div className="font-semibold text-cyan-100">{skill.name}</div>
                <div className="mt-1 text-xs italic text-white/55">
                  {skill.tooltip}
                </div>
                <p className="mt-2 text-sm text-white/65">{skill.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
