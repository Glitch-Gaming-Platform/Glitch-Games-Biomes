import * as React from "react";
import { installBiomesUITheme } from "../biomes_ui/theme/biomesUITheme";
import { completeHarthmereJobsBoardReadQuestV140 } from "../challenges/LocalDevHarthmereQuests";
import { installHarthmereJobsBoardStylesV141 } from "./HarthmereJobsBoardStylesV141";
import {
  HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
  getHarthmereAvailableJobsPanelV1,
  getHarthmereJobsBoardSafetyPanelV1,
  getHarthmereJobsBoardTabsV1,
  getHarthmereMyJobsPanelV1,
  getHarthmerePostedJobsPanelV1,
  type HarthmereJobsBoardSnapshotV1,
} from "./jobsBoardLiveAdapter";

const TABS = ["available", "accepted", "posted", "post", "safety"] as const;
type TabId = typeof TABS[number];

export function HarthmereJobsBoardPanel({
  snapshot,
  boardId = HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
  onAcceptJob,
  onCompleteJob,
  onCancelJob,
  onPostJob,
  onClose,
}: {
  snapshot: HarthmereJobsBoardSnapshotV1;
  boardId?: string;
  onAcceptJob?: (jobId: string) => void;
  onCompleteJob?: (jobId: string) => void;
  onCancelJob?: (jobId: string) => void;
  onPostJob?: () => void;
  onClose?: () => void;
}) {
  const [tab, setTab] = React.useState<TabId>("available");
  const tabs = getHarthmereJobsBoardTabsV1(snapshot);
  const board = snapshot.boards[boardId];
  // HARTHMERE_JOBS_BOARD_STYLES_V141: Theme tokens first, then jobs-board
  // overrides, so the panel inherits BiomesUI surfaces but layers its own
  // mobile-responsive grid on top.
  React.useEffect(() => {
    installBiomesUITheme();
    installHarthmereJobsBoardStylesV141();
  }, []);
  React.useEffect(() => {
    if (!board) return;
    completeHarthmereJobsBoardReadQuestV140("jobs_board_panel_opened");
  }, [board, boardId]);
  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose?.();
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const index = TABS.indexOf(tab);
      const next = event.key === "ArrowRight" ? (index + 1) % TABS.length : (index - 1 + TABS.length) % TABS.length;
      setTab(TABS[next]);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [tab, onClose]);

  if (!board) {
    return (
      <div className="harthmere-jobs-board__backdrop" role="dialog" aria-modal="true">
        <section className="harthmere-jobs-board">
          <header className="harthmere-jobs-board__header">
            <div>
              <h2>Jobs Board</h2>
              <p>No board is registered for this town yet.</p>
            </div>
            <button onClick={onClose} aria-label="Close jobs board">×</button>
          </header>
          <main className="harthmere-jobs-board__content">
            <p className="empty">
              The Grove Jobs Board is loading or has not been synced from the live backend. Try again in a moment.
            </p>
          </main>
        </section>
      </div>
    );
  }
  const available = getHarthmereAvailableJobsPanelV1(snapshot, boardId);
  const accepted = getHarthmereMyJobsPanelV1(snapshot);
  const posted = getHarthmerePostedJobsPanelV1(snapshot);
  const safety = getHarthmereJobsBoardSafetyPanelV1(snapshot);

  return (
    <div className="harthmere-jobs-board__backdrop" role="dialog" aria-modal="true" onClick={(e) => {
      // Backdrop click (outside the section) closes the panel — matches mobile
      // sheet behaviour and standard BiomesUI modals.
      if (e.target === e.currentTarget) onClose?.();
    }}>
    <section className="harthmere-jobs-board" role="document" aria-label={board.displayName}>
      <header className="harthmere-jobs-board__header">
        <div>
          <h2>{board.displayName}</h2>
          <p>{board.location.district} · Jobs require in-person board interaction.</p>
        </div>
        <button onClick={onClose} aria-label="Close jobs board">×</button>
      </header>
      <nav className="harthmere-jobs-board__tabs" aria-label="Jobs board sections">
        {tabs.map((item) => (
          <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id as TabId)}>
            {item.label}{item.count ? ` (${item.count})` : ""}
          </button>
        ))}
      </nav>
      <main className="harthmere-jobs-board__content">
        {tab === "available" && (
          <div className="harthmere-jobs-grid">
            {available.length === 0 && <p className="empty">No open jobs on this board.</p>}
            {available.map((job) => (
              <article className="harthmere-jobs-card" key={job.jobId}>
                <strong>{job.title}</strong>
                <span>{job.kindLabel} · {job.rewardGold} gold</span>
                <small>{job.requiresFieldWork ? "Creates map/quest todo" : "Turn in at board"}</small>
                {job.warning && <em>{job.warning}</em>}
                <button onClick={() => onAcceptJob?.(job.jobId)}>Accept</button>
              </article>
            ))}
          </div>
        )}
        {tab === "accepted" && (
          <div className="harthmere-jobs-grid">
            {accepted.length === 0 && <p className="empty">You have no accepted jobs.</p>}
            {accepted.map((job) => (
              <article className="harthmere-jobs-card" key={job.jobId}>
                <strong>{job.title}</strong>
                <span>{job.status} · {job.rewardGold} gold</span>
                <small>{job.todo?.todoText ?? "Return to the board when complete."}</small>
                <button disabled={!job.canComplete} onClick={() => onCompleteJob?.(job.jobId)}>Turn In</button>
              </article>
            ))}
          </div>
        )}
        {tab === "posted" && (
          <div className="harthmere-jobs-grid">
            {posted.length === 0 && <p className="empty">You have not posted jobs.</p>}
            {posted.map((job) => (
              <article className="harthmere-jobs-card" key={job.jobId}>
                <strong>{job.title}</strong>
                <span>{job.status} · escrow {job.escrowGold}</span>
                <small>{job.acceptedByActorId ? `Accepted by ${job.acceptedByActorId}` : "Waiting for a seeker"}</small>
                <button disabled={!job.canCancel} onClick={() => onCancelJob?.(job.jobId)}>Cancel</button>
              </article>
            ))}
          </div>
        )}
        {tab === "post" && (
          <div className="harthmere-jobs-card">
            <strong>Post work</strong>
            <p>Postings escrow the reward immediately. Businesses, towns, guilds, NPCs, and players can post here when authorized.</p>
            <button onClick={onPostJob}>Create Job Posting</button>
          </div>
        )}
        {tab === "safety" && (
          <div className="harthmere-jobs-card">
            <strong>Board safety</strong>
            <p>Reward range: {safety.minRewardGold}–{safety.maxRewardGold} gold.</p>
            <p>Limits: {safety.issuerLimit} active postings per issuer, {safety.seekerLimit} active jobs per seeker.</p>
            <ul>{safety.guidance.map((line) => <li key={line}>{line}</li>)}</ul>
          </div>
        )}
      </main>
    </section>
    </div>
  );
}
