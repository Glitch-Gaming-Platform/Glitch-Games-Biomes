// BIOMES_UI_QUESTS_TAB
//
// The dedicated Quests menu (J / QST). Requested 2026-07-24: quests were only
// reachable inside MAP & QUESTS, squeezed beside the chart. This tab is the
// quest log on its own terms — list, filter, full detail, set-as-main — with
// NO MAP. Locate-on-map actions deep-link to the Map tab instead of embedding
// a chart here.
//
// Data: the SAME live adapter surface the map tab consumes (MapAdapter from
// MapQuestsTab). No new backend reads, no duplicate quest pipeline — per the
// ECS source-of-truth doc, BiomesUI panels project existing authority; they
// never grow a second copy of quest state.

import * as React from "react";
import type {
  MapAdapter,
  MapTrackableQuest,
  MissionStep,
} from "./MapQuestsTab";
import {
  questMapMarkerCandidatesForTest,
  questObjectiveRowsForTest,
} from "./MapQuestsTab";
import {
  BIOMES_UI_MAIN_QUEST_EVENT,
  biomesUIMainQuestClearedSelectionForTest,
  readBiomesUIMainQuestSelection,
  setBiomesUIMainQuestFromTrackableQuest,
  writeBiomesUIMainQuestSelection,
  type BiomesUIMainQuestSelection,
} from "../adapters/mainQuestSelection";
import {
  activeBiomesUIMapPinFromMarkerForTest,
  requestBiomesUILocateOnMap,
  writeActiveBiomesUIMapPin,
} from "../adapters/mapPinnedDestination";
import { HarthmereMaterialAcquisitionGuide } from "@/client/components/harthmere_materials/HarthmereMaterialAcquisitionGuide";

export type QuestFilter =
  "all" | "active" | "available" | "failed" | "completed";

const FILTERS: Array<{ id: QuestFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "available", label: "Available" },
  { id: "failed", label: "Failed" },
  { id: "completed", label: "Completed" },
];

const STATUS_COLOR: Record<MapTrackableQuest["status"], string> = {
  active: "var(--biomes-edge-cyan)",
  available: "var(--biomes-fg)",
  completed: "var(--biomes-fg-muted)",
  failed: "var(--biomes-danger, #d9534f)",
};

const STATUS_ORDER: Record<MapTrackableQuest["status"], number> = {
  active: 0,
  available: 1,
  failed: 2,
  completed: 3,
};

/**
 * Pure list projection shared by the component and tests. Keeping filtering
 * and ordering here prevents polling refreshes from subtly changing the UI's
 * priority rules (main quest, active, available, failed, completed).
 */
export function questsTabVisibleQuestsForTest(args: {
  quests: readonly MapTrackableQuest[];
  filter: QuestFilter;
  mainQuestId?: string;
}): MapTrackableQuest[] {
  const filtered =
    args.filter === "all"
      ? args.quests
      : args.quests.filter((quest) => quest.status === args.filter);
  return [...filtered].sort((a, b) => {
    const aMain = a.questId === args.mainQuestId ? 0 : 1;
    const bMain = b.questId === args.mainQuestId ? 0 : 1;
    if (aMain !== bMain) return aMain - bMain;
    const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (byStatus !== 0) return byStatus;
    return a.title.localeCompare(b.title);
  });
}

export function questsTabStatusCountsForTest(
  quests: readonly MapTrackableQuest[]
): Record<QuestFilter, number> {
  const counts: Record<QuestFilter, number> = {
    all: quests.length,
    active: 0,
    available: 0,
    failed: 0,
    completed: 0,
  };
  for (const quest of quests) {
    counts[quest.status] += 1;
  }
  return counts;
}

export function questsTabObjectiveHeadingForTest(
  status: MapTrackableQuest["status"]
): string {
  switch (status) {
    case "completed":
      return "Completed steps";
    case "failed":
      return "Quest outcome";
    case "available":
      return "What to do";
    case "active":
      return "What to do next";
  }
}

/** Resolve the same current-objective/tool/item fallback chain as the map. */
export function questsTabMarkerForQuestForTest(
  quest: MapTrackableQuest,
  markers: ReturnType<NonNullable<MapAdapter["getMarkers"]>>
) {
  for (const markerId of questMapMarkerCandidatesForTest(quest)) {
    const marker = markers.find((entry) => entry.id === markerId);
    if (marker) return marker;
  }
  return undefined;
}

export function activateQuestsTabMainQuestForTest(input: {
  quest: MapTrackableQuest;
  adapter?: MapAdapter;
}): BiomesUIMainQuestSelection | undefined {
  const selection =
    input.adapter?.setMainQuest?.(input.quest) ??
    setBiomesUIMainQuestFromTrackableQuest(input.quest);
  const marker = questsTabMarkerForQuestForTest(
    input.quest,
    input.adapter?.getMarkers?.() ?? []
  );
  if (marker) {
    if (input.adapter?.setActiveMapPin) {
      input.adapter.setActiveMapPin(marker);
    } else {
      const pin = activeBiomesUIMapPinFromMarkerForTest(marker);
      if (pin) writeActiveBiomesUIMapPin(pin);
    }
  }
  return selection;
}

function ensureQuestsTabStyles() {
  if (typeof document === "undefined") return;
  const id = "biomes-ui-quests-tab-styles";
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
@media (max-width: 760px) {
  .biomes-ui-quests-tab { flex-direction: column; }
  .biomes-ui-quests-list-pane,
  .biomes-ui-quests-detail-pane {
    flex: 1 1 auto !important;
    min-width: 0 !important;
    width: 100%;
  }
  .biomes-ui-quests-filters { flex-wrap: wrap; }
}
`;
  document.head.appendChild(style);
}

export const QuestsTab: React.FunctionComponent<{
  adapter?: MapAdapter;
  /** Deep-link into the Map tab for "show me where" actions. */
  onOpenMap?: (quest: MapTrackableQuest) => void;
}> = ({ adapter, onOpenMap }) => {
  const [quests, setQuests] = React.useState<MapTrackableQuest[]>(
    () => adapter?.getTrackableQuests?.() ?? []
  );
  const [missionTitle, setMissionTitle] = React.useState<string>(
    () => adapter?.getMissionTitle?.() ?? ""
  );
  const [missionSteps, setMissionSteps] = React.useState<MissionStep[]>(
    () => adapter?.getMissionSteps?.() ?? []
  );
  const [mainQuest, setMainQuest] = React.useState<
    BiomesUIMainQuestSelection | undefined
  >(
    () => adapter?.getMainQuestSelection?.() ?? readBiomesUIMainQuestSelection()
  );
  const [filter, setFilter] = React.useState<QuestFilter>("all");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  React.useEffect(() => ensureQuestsTabStyles(), []);

  // Same poll-while-mounted pattern the map tab uses: quest progress advances
  // while the menu is open (party members, timers), and the adapter is the
  // only authority. No polling once the tab unmounts.
  React.useEffect(() => {
    if (!adapter) {
      setQuests([]);
      setMissionTitle("");
      setMissionSteps([]);
      return;
    }
    const refresh = () => {
      setQuests(adapter.getTrackableQuests?.() ?? []);
      setMissionTitle(adapter.getMissionTitle?.() ?? "");
      setMissionSteps(adapter.getMissionSteps?.() ?? []);
      setMainQuest(
        adapter.getMainQuestSelection?.() ?? readBiomesUIMainQuestSelection()
      );
    };
    refresh();
    const interval = window.setInterval(refresh, 2000);
    return () => window.clearInterval(interval);
  }, [adapter]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const onMainQuestChanged = (event: Event) => {
      const selection = (
        event as CustomEvent<BiomesUIMainQuestSelection | undefined>
      ).detail;
      setMainQuest(
        selection ??
          adapter?.getMainQuestSelection?.() ??
          readBiomesUIMainQuestSelection()
      );
    };
    window.addEventListener(BIOMES_UI_MAIN_QUEST_EVENT, onMainQuestChanged);
    window.addEventListener("storage", onMainQuestChanged);
    return () => {
      window.removeEventListener(
        BIOMES_UI_MAIN_QUEST_EVENT,
        onMainQuestChanged
      );
      window.removeEventListener("storage", onMainQuestChanged);
    };
  }, [adapter]);

  const visible = React.useMemo(() => {
    return questsTabVisibleQuestsForTest({
      quests,
      filter,
      mainQuestId: mainQuest?.questId,
    });
  }, [quests, filter, mainQuest?.questId]);

  const selected = visible.find((q) => q.questId === selectedId);
  const selectedObjectives = selected
    ? questObjectiveRowsForTest(selected)
    : [];

  const activate = React.useCallback(
    (quest: MapTrackableQuest) => {
      const selection = activateQuestsTabMainQuestForTest({ quest, adapter });
      setMainQuest(selection);
    },
    [adapter]
  );

  const deactivate = React.useCallback(() => {
    const cleared = biomesUIMainQuestClearedSelectionForTest();
    if (adapter?.clearMainQuest) {
      adapter.clearMainQuest();
    } else {
      writeBiomesUIMainQuestSelection(undefined);
    }
    setMainQuest(cleared);
  }, [adapter]);

  const counts = React.useMemo(
    () => questsTabStatusCountsForTest(quests),
    [quests]
  );

  const openQuestOnMap = React.useCallback(
    (quest: MapTrackableQuest) => {
      const marker = questsTabMarkerForQuestForTest(
        quest,
        adapter?.getMarkers?.() ?? []
      );
      const pin = marker
        ? activeBiomesUIMapPinFromMarkerForTest(marker)
        : undefined;
      if (pin) {
        requestBiomesUILocateOnMap(pin);
      }
      // Always switch tabs, even when a quest has no locatable marker yet.
      // The Map will still open and the player can inspect its other hints.
      onOpenMap?.(quest);
    },
    [adapter, onOpenMap]
  );

  return (
    <div
      data-testid="biomes-ui-quests-tab"
      className="biomes-ui-quests-tab"
      style={{ display: "flex", gap: 16, alignItems: "flex-start" }}
    >
      {/* Left: filters + quest list */}
      <div
        className="biomes-ui-quests-list-pane"
        style={{ flex: "0 0 46%", minWidth: 300 }}
      >
        <div
          role="tablist"
          aria-label="Quest filters"
          className="biomes-ui-quests-filters"
          style={{ display: "flex", gap: 6, marginBottom: 10 }}
        >
          {FILTERS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={filter === entry.id}
              onClick={() => setFilter(entry.id)}
              style={{
                padding: "5px 10px",
                fontSize: 11,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                borderRadius: 6,
                cursor: "pointer",
                border:
                  filter === entry.id
                    ? "1px solid var(--biomes-edge-cyan)"
                    : "1px solid var(--biomes-border)",
                background:
                  filter === entry.id
                    ? "var(--biomes-panel-raised, rgba(60,120,160,0.25))"
                    : "transparent",
                color:
                  filter === entry.id
                    ? "var(--biomes-edge-cyan)"
                    : "var(--biomes-fg-muted)",
              }}
            >
              {entry.label} ({counts[entry.id]})
            </button>
          ))}
        </div>

        {visible.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--biomes-fg-muted)" }}>
            {quests.length === 0
              ? "No quests yet. Talk to people — the Grove always needs something."
              : "Nothing under this filter."}
          </p>
        )}

        <ul
          data-testid="biomes-ui-quests-list"
          style={{ listStyle: "none", margin: 0, padding: 0 }}
        >
          {visible.map((quest) => {
            const isMain = quest.questId === mainQuest?.questId;
            const isSelected = quest.questId === selectedId;
            return (
              <li key={quest.questId} style={{ marginBottom: 6 }}>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedId((current) =>
                      current === quest.questId ? null : quest.questId
                    )
                  }
                  aria-expanded={isSelected}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 10px",
                    borderRadius: 8,
                    cursor: "pointer",
                    border: isSelected
                      ? "1px solid var(--biomes-edge-cyan)"
                      : "1px solid var(--biomes-border)",
                    background: "var(--biomes-panel, rgba(10,24,36,0.6))",
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: STATUS_COLOR[quest.status],
                        textDecoration:
                          quest.status === "completed"
                            ? "line-through"
                            : undefined,
                      }}
                    >
                      {isMain ? "★ " : ""}
                      {quest.title}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        color: STATUS_COLOR[quest.status],
                        whiteSpace: "nowrap",
                      }}
                    >
                      {quest.status}
                      {quest.timeRemaining ? ` · ${quest.timeRemaining}` : ""}
                    </span>
                  </span>
                  <span
                    style={{
                      display: "block",
                      marginTop: 2,
                      fontSize: 11,
                      color: "var(--biomes-fg-muted)",
                    }}
                  >
                    {quest.area}
                    {quest.kindLabel ? ` · ${quest.kindLabel}` : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Right: detail for the selected quest, or the active mission log */}
      <div
        className="biomes-ui-quests-detail-pane"
        style={{ flex: 1, minWidth: 280 }}
      >
        {selected ? (
          <section
            data-testid="biomes-ui-quest-detail"
            aria-label={`Quest detail: ${selected.title}`}
          >
            <h3
              style={{
                margin: 0,
                fontSize: 16,
                color: STATUS_COLOR[selected.status],
              }}
            >
              {selected.title}
            </h3>
            <p
              style={{
                margin: "2px 0 10px",
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--biomes-fg-muted)",
              }}
            >
              {selected.kindLabel ?? selected.kind ?? "Quest"} · {selected.area}{" "}
              · {selected.status}
            </p>
            {selected.description && (
              <p style={{ fontSize: 13, lineHeight: 1.5 }}>
                {selected.description}
              </p>
            )}

            <h4 style={quesHeadingStyle}>
              {questsTabObjectiveHeadingForTest(selected.status)}
            </h4>
            <ul style={{ margin: "4px 0 12px", paddingLeft: 18, fontSize: 13 }}>
              {(selectedObjectives.length
                ? selectedObjectives
                : [
                    {
                      objective:
                        "Objective details arrive once the quest is underway.",
                      done: false,
                      current: false,
                    },
                  ]
              ).map((objective, index) => (
                <li
                  key={index}
                  data-completed={objective.done || undefined}
                  style={{
                    marginBottom: 3,
                    color: objective.done
                      ? "var(--biomes-fg-muted)"
                      : "var(--biomes-fg)",
                    textDecoration: objective.done ? "line-through" : undefined,
                    opacity: objective.done ? 0.7 : 1,
                  }}
                >
                  {objective.objective}
                </li>
              ))}
            </ul>

            {selected.reward && (
              <>
                <h4 style={quesHeadingStyle}>Reward</h4>
                <p style={{ margin: "4px 0 12px", fontSize: 13 }}>
                  {selected.reward}
                </p>
              </>
            )}

            {selected.itemSource && (
              <>
                <h4 style={quesHeadingStyle}>Where to get what you need</h4>
                <p style={{ margin: "4px 0 12px", fontSize: 13 }}>
                  {selected.itemSource.itemName} ×
                  {selected.itemSource.missingCount} —{" "}
                  {selected.itemSource.sourceName}. {selected.itemSource.hint}
                </p>
              </>
            )}
            {selected.materialRequirements?.length ? (
              <section data-testid="chapter1-material-requirements">
                <h4 style={quesHeadingStyle}>Where to get what you need</h4>
                <p style={{ margin: "4px 0 8px", fontSize: 13 }}>
                  Choose a source below. “Show on map” uses the same tracked
                  destination as the minimap and HUD.
                </p>
                <p
                  style={{
                    margin: "0 0 8px",
                    fontSize: 12,
                    color: "var(--biomes-fg-muted)",
                  }}
                >
                  Bought crafting materials may go straight to Materials storage
                  instead of a hotbar slot. They still count for this objective
                  and are used automatically when you turn it in.
                </p>
                <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
                  {selected.materialRequirements.map((requirement) => (
                    <div
                      key={`${requirement.label}:${requirement.count}`}
                      data-material-requirement={requirement.label}
                      style={{ minWidth: 0 }}
                    >
                      <strong style={{ fontSize: 13 }}>
                        {requirement.count} × {requirement.label}
                      </strong>
                      {requirement.options.length > 1 ? (
                        <p
                          style={{
                            margin: "2px 0 0",
                            fontSize: 11,
                            color: "var(--biomes-fg-muted)",
                          }}
                        >
                          Any one of these accepted item types will count.
                        </p>
                      ) : null}
                      {requirement.options.map((option) => (
                        <HarthmereMaterialAcquisitionGuide
                          key={option.itemId}
                          itemId={option.itemId}
                          itemName={option.itemName}
                          count={requirement.count}
                          ownerQuestId={selected.questId}
                          ownerStepId={selected.currentStepId}
                          compact
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
            {selected.toolSource && (
              <>
                <h4 style={quesHeadingStyle}>Tool required</h4>
                <p style={{ margin: "4px 0 12px", fontSize: 13 }}>
                  {selected.toolSource.toolName} from{" "}
                  {selected.toolSource.vendorName}. {selected.toolSource.hint}
                </p>
              </>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              {selected.status !== "completed" && (
                <button
                  type="button"
                  data-testid="biomes-ui-quest-set-active"
                  // Toggle, not a one-way door. Disabling this once a quest was
                  // active left no way to stop tracking it — the player could
                  // only swap to a different quest, never clear the selection.
                  onClick={() =>
                    selected.questId === mainQuest?.questId
                      ? deactivate()
                      : activate(selected)
                  }
                  aria-pressed={selected.questId === mainQuest?.questId}
                  title={
                    selected.questId === mainQuest?.questId
                      ? "Stop tracking this quest"
                      : "Track this quest"
                  }
                  style={{
                    padding: "7px 12px",
                    fontSize: 12,
                    borderRadius: 6,
                    cursor: "pointer",
                    border: "1px solid var(--biomes-edge-cyan)",
                    background:
                      selected.questId === mainQuest?.questId
                        ? "transparent"
                        : "var(--biomes-panel-raised, rgba(60,120,160,0.25))",
                    color: "var(--biomes-edge-cyan)",
                  }}
                >
                  {selected.questId === mainQuest?.questId
                    ? "★ Active quest — stop tracking"
                    : "Set as active quest"}
                </button>
              )}
              {onOpenMap && (
                <button
                  type="button"
                  onClick={() => openQuestOnMap(selected)}
                  style={{
                    padding: "7px 12px",
                    fontSize: 12,
                    borderRadius: 6,
                    cursor: "pointer",
                    border: "1px solid var(--biomes-border)",
                    background: "transparent",
                    color: "var(--biomes-fg-muted)",
                  }}
                >
                  Show on map
                </button>
              )}
            </div>
          </section>
        ) : (
          <section
            data-testid="biomes-ui-quests-mission-log"
            aria-label="Active mission log"
          >
            <h3 style={{ margin: 0, fontSize: 16, color: "var(--biomes-fg)" }}>
              {missionTitle || "Mission Log"}
            </h3>
            <p
              style={{
                margin: "2px 0 10px",
                fontSize: 11,
                color: "var(--biomes-fg-muted)",
              }}
            >
              Select a quest on the left for full details, or follow the current
              steps below.
            </p>
            {missionSteps.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--biomes-fg-muted)" }}>
                No mission steps right now.
              </p>
            ) : (
              <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
                {missionSteps.map((step) => (
                  <li
                    key={step.id}
                    style={{
                      marginBottom: 6,
                      color: step.done
                        ? "var(--biomes-fg-muted)"
                        : "var(--biomes-fg)",
                      textDecoration: step.done ? "line-through" : undefined,
                    }}
                  >
                    <strong>{step.title}</strong>
                    <span
                      style={{
                        display: "block",
                        fontSize: 12,
                        marginTop: 1,
                        textDecoration: step.done ? "line-through" : undefined,
                      }}
                    >
                      {step.objective}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}
      </div>
    </div>
  );
};

const quesHeadingStyle: React.CSSProperties = {
  margin: "10px 0 0",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  color: "var(--biomes-fg-muted)",
};
