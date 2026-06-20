import * as React from "react";
import {
  buildHarthmereWantedBoardView,
  type HarthmereWantedBoardNotice,
  type HarthmereWantedBoardView,
} from "./wantedBoardLiveAdapter";
import { installHarthmereWantedBoardStyles } from "./HarthmereWantedBoardStyles";
import type { HarthmereJobsBoardSnapshot } from "@/client/components/harthmere_jobs_board/jobsBoardLiveAdapter";

const TABS = ["bounties", "mine", "warrants", "watchlist", "law"] as const;
type WantedBoardTab = (typeof TABS)[number];

export function nextHarthmereWantedBoardTabForKey(
  tab: WantedBoardTab,
  key: string
): WantedBoardTab {
  const index = TABS.indexOf(tab);
  if (key === "Home") return TABS[0];
  if (key === "End") return TABS[TABS.length - 1];
  if (
    key !== "ArrowRight" &&
    key !== "ArrowLeft" &&
    key !== "PageDown" &&
    key !== "PageUp"
  ) {
    return tab;
  }
  const delta = key === "ArrowRight" || key === "PageDown" ? 1 : -1;
  return TABS[(index + delta + TABS.length) % TABS.length];
}

export function nextHarthmereWantedBoardGridIndexForKey(input: {
  key: string;
  currentIndex: number;
  itemCount: number;
  columns: number;
}) {
  const itemCount = Math.max(0, Math.trunc(input.itemCount) || 0);
  if (itemCount <= 0) return -1;
  const columns = Math.max(1, Math.trunc(input.columns) || 1);
  const currentIndex = Math.max(
    0,
    Math.min(itemCount - 1, Math.trunc(input.currentIndex) || 0)
  );
  switch (input.key) {
    case "ArrowRight":
      return Math.min(itemCount - 1, currentIndex + 1);
    case "ArrowLeft":
      return Math.max(0, currentIndex - 1);
    case "ArrowDown":
      return Math.min(itemCount - 1, currentIndex + columns);
    case "ArrowUp":
      return Math.max(0, currentIndex - columns);
    case "Home":
      return 0;
    case "End":
      return itemCount - 1;
    default:
      return currentIndex;
  }
}

function tabLabel(tab: WantedBoardTab, view: HarthmereWantedBoardView) {
  switch (tab) {
    case "bounties":
      return `Bounties ${view.totals.open}`;
    case "mine":
      return `Mine ${view.totals.mine}`;
    case "warrants":
      return `Warrants ${view.totals.law}`;
    case "watchlist":
      return `Watch ${view.totals.watchlist}`;
    case "law":
      return "Law";
  }
}

function noticesForTab(
  tab: WantedBoardTab,
  view: HarthmereWantedBoardView
) {
  switch (tab) {
    case "bounties":
      return view.openNotices;
    case "mine":
      return view.myNotices;
    case "warrants":
      return view.lawNotices;
    case "watchlist":
      return view.watchlistNotices;
    case "law":
      return [];
  }
}

function emptyTextForTab(tab: WantedBoardTab) {
  switch (tab) {
    case "bounties":
      return "No active bounty jobs are posted right now.";
    case "mine":
      return "You have no accepted bounty jobs.";
    case "warrants":
      return "No active law warrants are posted.";
    case "watchlist":
      return "Every known Muck bounty target already has an active posting.";
    case "law":
      return "";
  }
}

function noticeActionLabel(notice: HarthmereWantedBoardNotice) {
  if (notice.canAccept) return "Accept Bounty";
  if (notice.canComplete) return "Turn In Bounty";
  if (notice.canClear) return "Clear My Bounty";
  return "No Action";
}

function HarthmereWantedNoticeCard({
  notice,
  pending,
  onAcceptJob,
  onCompleteJob,
  onClearBounty,
}: {
  notice: HarthmereWantedBoardNotice;
  pending?: boolean;
  onAcceptJob?: (jobId: string, boardId?: string) => void | Promise<void>;
  onCompleteJob?: (jobId: string, boardId?: string) => void | Promise<void>;
  onClearBounty?: (factionId?: string) => void | Promise<void>;
}) {
  const actionDisabled =
    pending ||
    (!notice.canAccept && !notice.canComplete && !notice.canClear) ||
    (notice.canAccept && !notice.jobId) ||
    (notice.canComplete && !notice.jobId);
  return (
    <article
      className="harthmere-wanted-card"
      data-testid="harthmere-wanted-board-notice"
      data-source={notice.source}
    >
      <div className="harthmere-wanted-card__meta">
        <span className="harthmere-wanted-chip">{notice.kindLabel}</span>
        <span className="harthmere-wanted-chip" data-tone="gold">
          {notice.rewardGold > 0 ? `${notice.rewardGold} gold` : "No reward"}
        </span>
        <span className="harthmere-wanted-chip">{notice.status}</span>
      </div>
      <h3>{notice.title}</h3>
      <p>{notice.subtitle}</p>
      <p>{notice.description}</p>
      {notice.areaLabel && <small>{notice.areaLabel}</small>}
      {notice.boardName && <small>{notice.boardName}</small>}
      {notice.timeRemaining && <small>{notice.timeRemaining}</small>}
      {notice.warning && <em>{notice.warning}</em>}
      <button
        type="button"
        data-harthmere-wanted-board-action="true"
        data-pending={pending ? "true" : "false"}
        disabled={actionDisabled}
        onClick={() => {
          if (notice.canAccept && notice.jobId) {
            void onAcceptJob?.(notice.jobId, notice.boardId);
            return;
          }
          if (notice.canComplete && notice.jobId) {
            void onCompleteJob?.(notice.jobId, notice.boardId);
            return;
          }
          if (notice.canClear) {
            void onClearBounty?.(notice.subtitle.split(" · ")[0]);
          }
        }}
      >
        {pending ? "Working..." : noticeActionLabel(notice)}
      </button>
    </article>
  );
}

function HarthmereWantedLawPanel({ view }: { view: HarthmereWantedBoardView }) {
  const law = view.law;
  return (
    <div className="harthmere-wanted-board__law">
      <div className="harthmere-wanted-board__law-row">
        <div className="harthmere-wanted-board__stat">
          <span>Legal</span>
          <strong>{law.legal}</strong>
        </div>
        <div className="harthmere-wanted-board__stat">
          <span>Notoriety</span>
          <strong>{law.notoriety}</strong>
        </div>
        <div className="harthmere-wanted-board__stat">
          <span>Fines</span>
          <strong>{law.finesGold}g</strong>
        </div>
        <div className="harthmere-wanted-board__stat">
          <span>Bounties</span>
          <strong>{law.activeBountyGold}g</strong>
        </div>
      </div>
      {law.publicFlags.length > 0 && (
        <div className="harthmere-wanted-board__law-note">
          {law.publicFlags.join(", ")}
        </div>
      )}
      {law.guidance.map((line) => (
        <div className="harthmere-wanted-board__law-note" key={line}>
          {line}
        </div>
      ))}
    </div>
  );
}

export function HarthmereWantedBoardPanel({
  snapshot,
  boardId,
  view: explicitView,
  statusLine,
  statusState = "info",
  pendingActionId,
  onAcceptJob,
  onCompleteJob,
  onClearBounty,
  onClose,
}: {
  snapshot?: HarthmereJobsBoardSnapshot;
  boardId?: string;
  view?: HarthmereWantedBoardView;
  statusLine?: string;
  statusState?: "info" | "error";
  pendingActionId?: string;
  onAcceptJob?: (jobId: string, boardId?: string) => void | Promise<void>;
  onCompleteJob?: (jobId: string, boardId?: string) => void | Promise<void>;
  onClearBounty?: (factionId?: string) => void | Promise<void>;
  onClose?: () => void;
}) {
  const [tab, setTab] = React.useState<WantedBoardTab>("bounties");
  const panelRef = React.useRef<HTMLElement | null>(null);
  const tabRefs = React.useRef<
    Partial<Record<WantedBoardTab, HTMLButtonElement | null>>
  >({});
  const view =
    explicitView ??
    (snapshot ? buildHarthmereWantedBoardView(snapshot, boardId) : undefined);
  const focusableSelector = [
    "button:not(:disabled)",
    "input:not(:disabled)",
    "select:not(:disabled)",
    "textarea:not(:disabled)",
    "a[href]",
    "[tabindex]:not([tabindex='-1'])",
  ].join(",");
  const actionSelector =
    "[data-harthmere-wanted-board-action='true']:not(:disabled)";

  React.useEffect(() => {
    installHarthmereWantedBoardStyles();
  }, []);

  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose?.();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const focusableElements = React.useCallback(() => {
    return Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? []
    ).filter((element) => element.tabIndex >= 0);
  }, [focusableSelector]);

  const actionButtons = React.useCallback(() => {
    return Array.from(
      panelRef.current?.querySelectorAll<HTMLButtonElement>(actionSelector) ?? []
    );
  }, [actionSelector]);

  const switchTab = React.useCallback(
    (nextTab: WantedBoardTab, focus: "tab" | "action" = "tab") => {
      setTab(nextTab);
      requestAnimationFrame(() => {
        if (focus === "action") {
          const firstAction = actionButtons()[0];
          if (firstAction) {
            firstAction.focus();
            return;
          }
        }
        tabRefs.current[nextTab]?.focus();
      });
    },
    [actionButtons]
  );

  React.useEffect(() => {
    requestAnimationFrame(() => {
      const firstAction = actionButtons()[0];
      if (firstAction) {
        firstAction.focus();
        return;
      }
      tabRefs.current[tab]?.focus();
    });
  }, [actionButtons, tab]);

  const handlePanelKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose?.();
        return;
      }
      if (event.key === "Tab") {
        const focusable = focusableElements();
        if (!focusable.length) return;
        const currentIndex = focusable.indexOf(
          document.activeElement as HTMLElement
        );
        if (event.shiftKey && currentIndex <= 0) {
          event.preventDefault();
          focusable[focusable.length - 1]?.focus();
          return;
        }
        if (!event.shiftKey && currentIndex === focusable.length - 1) {
          event.preventDefault();
          focusable[0]?.focus();
        }
        return;
      }
      if (event.key === "PageDown" || event.key === "PageUp") {
        event.preventDefault();
        switchTab(nextHarthmereWantedBoardTabForKey(tab, event.key), "action");
      }
    },
    [focusableElements, onClose, switchTab, tab]
  );

  const handleTabKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, itemTab: WantedBoardTab) => {
      if (
        event.key === "ArrowRight" ||
        event.key === "ArrowLeft" ||
        event.key === "Home" ||
        event.key === "End" ||
        event.key === "PageDown" ||
        event.key === "PageUp"
      ) {
        event.preventDefault();
        event.stopPropagation();
        switchTab(nextHarthmereWantedBoardTabForKey(itemTab, event.key));
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        event.stopPropagation();
        switchTab(itemTab, "action");
      }
    },
    [switchTab]
  );

  const handleGridKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (
        event.key !== "ArrowRight" &&
        event.key !== "ArrowLeft" &&
        event.key !== "ArrowDown" &&
        event.key !== "ArrowUp" &&
        event.key !== "Home" &&
        event.key !== "End"
      ) {
        return;
      }
      const buttons = actionButtons();
      if (!buttons.length) return;
      const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
      if (currentIndex < 0) return;
      event.preventDefault();
      const columns = window.innerWidth >= 1080 ? 3 : window.innerWidth >= 760 ? 2 : 1;
      const nextIndex = nextHarthmereWantedBoardGridIndexForKey({
        key: event.key,
        currentIndex,
        itemCount: buttons.length,
        columns,
      });
      buttons[nextIndex]?.focus();
    },
    [actionButtons]
  );

  if (!view) {
    return (
      <div className="harthmere-wanted-board__backdrop" role="dialog" aria-modal="true">
        <section
          className="harthmere-wanted-board"
          data-testid="harthmere-wanted-board-panel"
          data-harthmere-wanted-board-interface="true"
          data-pointer-lock-policy="unlock-while-open"
          data-mouse-policy="show-while-open"
          data-keyboard-navigation="tabs-grid-escape"
        >
          <header className="harthmere-wanted-board__header">
            <div>
              <h2>Wanted Board</h2>
              <p>{statusLine ?? "Loading live wanted notices..."}</p>
            </div>
            <button className="harthmere-wanted-board__close" onClick={onClose} aria-label="Close wanted board">
              x
            </button>
          </header>
        </section>
      </div>
    );
  }

  const notices = noticesForTab(tab, view);

  return (
    <div
      className="harthmere-wanted-board__backdrop"
      role="dialog"
      aria-modal="true"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <section
        ref={panelRef}
        className="harthmere-wanted-board"
        tabIndex={-1}
        data-testid="harthmere-wanted-board-panel"
        data-harthmere-wanted-board-interface="true"
        data-pointer-lock-policy="unlock-while-open"
        data-mouse-policy="show-while-open"
        data-keyboard-navigation="tabs-grid-escape"
        onKeyDown={handlePanelKeyDown}
      >
        <header className="harthmere-wanted-board__header">
          <div>
            <h2>Wanted Board</h2>
            <p>{view.boardName} · Live bounties, warrants, and watch notices</p>
          </div>
          <button
            className="harthmere-wanted-board__close"
            onClick={onClose}
            aria-label="Close wanted board"
          >
            x
          </button>
        </header>
        <div className="harthmere-wanted-board__stats">
          <div className="harthmere-wanted-board__stat">
            <span>Open</span>
            <strong>{view.totals.open}</strong>
          </div>
          <div className="harthmere-wanted-board__stat">
            <span>Mine</span>
            <strong>{view.totals.mine}</strong>
          </div>
          <div className="harthmere-wanted-board__stat">
            <span>Warrants</span>
            <strong>{view.totals.law}</strong>
          </div>
          <div className="harthmere-wanted-board__stat">
            <span>Rewards</span>
            <strong>{view.totals.rewardGold}g</strong>
          </div>
        </div>
        <nav className="harthmere-wanted-board__tabs" role="tablist">
          {TABS.map((item) => (
            <button
              key={item}
              ref={(node) => {
                tabRefs.current[item] = node;
              }}
              type="button"
              role="tab"
              aria-selected={tab === item}
              className={tab === item ? "active" : undefined}
              onClick={() => switchTab(item)}
              onKeyDown={(event) => handleTabKeyDown(event, item)}
            >
              {tabLabel(item, view)}
            </button>
          ))}
        </nav>
        <main className="harthmere-wanted-board__body">
          {statusLine && (
            <div className="harthmere-wanted-board__status" data-state={statusState}>
              {statusLine}
            </div>
          )}
          {tab === "law" ? (
            <HarthmereWantedLawPanel view={view} />
          ) : (
            <div className="harthmere-wanted-board__grid" onKeyDown={handleGridKeyDown}>
              {notices.length === 0 ? (
                <div className="harthmere-wanted-board__empty">
                  {emptyTextForTab(tab)}
                </div>
              ) : (
                notices.map((notice) => (
                  <HarthmereWantedNoticeCard
                    key={notice.noticeId}
                    notice={notice}
                    pending={
                      pendingActionId === notice.noticeId ||
                      (notice.jobId
                        ? pendingActionId === `job:${notice.jobId}`
                        : false) ||
                      (notice.canClear
                        ? pendingActionId?.startsWith("clear:") ?? false
                        : false)
                    }
                    onAcceptJob={onAcceptJob}
                    onCompleteJob={onCompleteJob}
                    onClearBounty={onClearBounty}
                  />
                ))
              )}
            </div>
          )}
        </main>
      </section>
    </div>
  );
}
