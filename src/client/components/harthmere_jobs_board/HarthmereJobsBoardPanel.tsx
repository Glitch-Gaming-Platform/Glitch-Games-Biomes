import * as React from "react";
import { installBiomesUITheme } from "../biomes_ui/theme/biomesUITheme";
import { installHarthmereJobsBoardStylesV141 } from "./HarthmereJobsBoardStylesV141";
import {
  HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
  buildHarthmereJobsBoardPostPayloadV1,
  displayNameForHarthmereJobsBoardV145,
  getHarthmereAvailableJobsPanelV1,
  getHarthmereJobsBoardSafetyPanelV1,
  getHarthmereJobsBoardTabsV1,
  getHarthmereMyJobsPanelV1,
  getHarthmerePostedJobsPanelV1,
  type HarthmereJobsBoardSnapshotV1,
} from "./jobsBoardLiveAdapter";
import {
  HARTHMERE_JOBS_BOARD_BUSINESS_TEMPLATES_V146,
  harthmereJobsBoardBusinessTemplatesForTypeV146,
  type HarthmereJobsBoardBusinessTemplateV146,
} from "../../../shared/harthmere/jobs_board_business_templates_v146";

const TABS = ["available", "accepted", "posted", "post", "safety"] as const;
type TabId = typeof TABS[number];

export function harthmereJobsBoardColumnCountForWidthV145(width: number) {
  if (!Number.isFinite(width)) return 1;
  if (width >= 1024) return 3;
  if (width >= 720) return 2;
  return 1;
}

export function nextHarthmereJobsBoardGridIndexForKeyV145({
  key,
  currentIndex,
  itemCount,
  columns,
}: {
  key: string;
  currentIndex: number;
  itemCount: number;
  columns: number;
}) {
  if (itemCount <= 0) return -1;
  const safeColumns = Math.max(1, Math.trunc(columns) || 1);
  const index = Math.max(0, Math.min(itemCount - 1, Math.trunc(currentIndex) || 0));
  switch (key) {
    case "ArrowRight":
      return Math.min(itemCount - 1, index + 1);
    case "ArrowLeft":
      return Math.max(0, index - 1);
    case "ArrowDown":
      return Math.min(itemCount - 1, index + safeColumns);
    case "ArrowUp":
      return Math.max(0, index - safeColumns);
    case "Home":
      return 0;
    case "End":
      return itemCount - 1;
    default:
      return index;
  }
}

export function nextHarthmereJobsBoardTabForKeyV145(tab: TabId, key: string) {
  const index = TABS.indexOf(tab);
  if (key === "Home") return TABS[0];
  if (key === "End") return TABS[TABS.length - 1];
  if (key !== "ArrowRight" && key !== "ArrowLeft" && key !== "PageDown" && key !== "PageUp") return tab;
  const delta = key === "ArrowRight" || key === "PageDown" ? 1 : -1;
  return TABS[(index + delta + TABS.length) % TABS.length];
}

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
  onPostJob?: (payload: Record<string, unknown>) => void;
  onClose?: () => void;
}) {
  const [tab, setTab] = React.useState<TabId>("available");
  const panelRef = React.useRef<HTMLElement | null>(null);
  const tabRefs = React.useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({});
  const tabs = getHarthmereJobsBoardTabsV1(snapshot);
  const board = snapshot.boards[boardId];
  const boardDisplayName = displayNameForHarthmereJobsBoardV145(board);
  const actionSelector = "[data-harthmere-jobs-board-action='true']:not(:disabled)";
  const myBusinesses = snapshot.myBusinesses ?? [];
  const [issuerMode, setIssuerMode] = React.useState<"player" | "business">(
    () => (myBusinesses.length > 0 ? "business" : "player"),
  );
  const [businessId, setBusinessId] = React.useState<string>(() => myBusinesses[0]?.businessId ?? "");
  const selectedBusiness = myBusinesses.find((business) => business.businessId === businessId);
  const postTemplates = React.useMemo(
    () => issuerMode === "business" && selectedBusiness
      ? harthmereJobsBoardBusinessTemplatesForTypeV146(selectedBusiness.typeId as any)
      : HARTHMERE_JOBS_BOARD_BUSINESS_TEMPLATES_V146,
    [issuerMode, selectedBusiness],
  );
  const [templateId, setTemplateId] = React.useState<string>(() => postTemplates[0]?.templateId ?? "");
  const selectedTemplate = postTemplates.find((template) => template.templateId === templateId) ?? postTemplates[0];
  const [postTitle, setPostTitle] = React.useState("");
  const [postDescription, setPostDescription] = React.useState("");
  const [rewardGold, setRewardGold] = React.useState(0);
  const [deadlineDays, setDeadlineDays] = React.useState(3);
  const [rewardItemId, setRewardItemId] = React.useState("");
  const [rewardItemCount, setRewardItemCount] = React.useState(1);
  const [rewardItems, setRewardItems] = React.useState<Array<{ itemId: string; count: number }>>([]);
  const [rewardCollectibleId, setRewardCollectibleId] = React.useState("");
  const [rewardCollectibleIds, setRewardCollectibleIds] = React.useState<string[]>([]);
  const availableRewardItemIds = React.useMemo(() => {
    const source = issuerMode === "business"
      ? Object.fromEntries(Object.entries(selectedBusiness?.inventory ?? {}).map(([itemId, stack]) => [itemId, stack.count]))
      : snapshot.inventoryItems ?? {};
    return Object.entries(source)
      .filter(([, count]) => Number(count) > 0)
      .map(([itemId]) => itemId)
      .sort();
  }, [issuerMode, selectedBusiness?.inventory, snapshot.inventoryItems]);
  const availableCollectibleIds = React.useMemo(
    () => Object.keys(snapshot.discoveredCollectibles ?? {}).sort(),
    [snapshot.discoveredCollectibles],
  );
  // HARTHMERE_JOBS_BOARD_STYLES_V141: Theme tokens first, then jobs-board
  // overrides, so the panel inherits BiomesUI surfaces but layers its own
  // mobile-responsive grid on top.
  React.useEffect(() => {
    installBiomesUITheme();
    installHarthmereJobsBoardStylesV141();
  }, []);
  React.useEffect(() => {
    if (issuerMode === "business" && myBusinesses.length === 0) {
      setIssuerMode("player");
      return;
    }
    if (issuerMode === "business" && !selectedBusiness && myBusinesses[0]) {
      setBusinessId(myBusinesses[0].businessId);
    }
  }, [issuerMode, myBusinesses, selectedBusiness]);
  React.useEffect(() => {
    const first = postTemplates[0];
    if (!first) return;
    if (!postTemplates.some((template) => template.templateId === templateId)) {
      setTemplateId(first.templateId);
      return;
    }
    const template = postTemplates.find((candidate) => candidate.templateId === templateId) ?? first;
    setPostTitle((current) => current || template.title);
    setPostDescription((current) => current || template.description);
    setRewardGold((current) => current || template.defaultRewardGold);
    setDeadlineDays((current) => current || template.defaultDeadlineDays);
  }, [postTemplates, templateId]);
  React.useEffect(() => {
    if (!rewardItemId && availableRewardItemIds[0]) {
      setRewardItemId(availableRewardItemIds[0]);
    }
  }, [availableRewardItemIds, rewardItemId]);
  React.useEffect(() => {
    if (!rewardCollectibleId && availableCollectibleIds[0]) {
      setRewardCollectibleId(availableCollectibleIds[0]);
    }
  }, [availableCollectibleIds, rewardCollectibleId]);
  React.useEffect(() => {
    if (!board) return;
    void import("../challenges/LocalDevHarthmereQuests").then(
      ({ completeHarthmereJobsBoardReadQuestV140 }) => {
        completeHarthmereJobsBoardReadQuestV140("jobs_board_panel_opened");
      },
    );
  }, [board, boardId]);
  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const actionButtons = React.useCallback(() => {
    return Array.from(
      panelRef.current?.querySelectorAll<HTMLButtonElement>(actionSelector) ?? [],
    );
  }, [actionSelector]);

  const focusActiveTab = React.useCallback((nextTab: TabId = tab) => {
    requestAnimationFrame(() => tabRefs.current[nextTab]?.focus());
  }, [tab]);

  const focusAction = React.useCallback((index: number) => {
    requestAnimationFrame(() => {
      const buttons = actionButtons();
      if (buttons.length === 0) {
        tabRefs.current[tab]?.focus();
        return;
      }
      buttons[Math.max(0, Math.min(buttons.length - 1, index))]?.focus();
    });
  }, [actionButtons, tab]);

  const switchTab = React.useCallback((nextTab: TabId, focus: "tab" | "action" = "tab") => {
    setTab(nextTab);
    if (focus === "tab") {
      requestAnimationFrame(() => tabRefs.current[nextTab]?.focus());
    } else {
      requestAnimationFrame(() => {
        const buttons = actionButtons();
        if (buttons.length > 0) {
          buttons[0]?.focus();
        } else {
          tabRefs.current[nextTab]?.focus();
        }
      });
    }
  }, [actionButtons]);

  React.useEffect(() => {
    requestAnimationFrame(() => actionButtons()[0]?.focus());
  }, [actionButtons]);

  const handlePanelKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== "PageDown" && event.key !== "PageUp") return;
    event.preventDefault();
    event.stopPropagation();
    switchTab(nextHarthmereJobsBoardTabForKeyV145(tab, event.key), "action");
  }, [switchTab, tab]);

  const handleTabKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLButtonElement>, itemTab: TabId) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      event.stopPropagation();
      focusAction(0);
      return;
    }
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    switchTab(nextHarthmereJobsBoardTabForKeyV145(itemTab, event.key), "tab");
  }, [focusAction, switchTab]);

  const handleActionKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    const buttons = actionButtons();
    const currentIndex = buttons.indexOf(event.currentTarget);
    if (currentIndex < 0) return;
    const columns = harthmereJobsBoardColumnCountForWidthV145(
      typeof window === "undefined" ? 0 : window.innerWidth,
    );
    if (event.key === "ArrowUp" && currentIndex < columns) {
      event.preventDefault();
      event.stopPropagation();
      focusActiveTab();
      return;
    }
    const nextIndex = nextHarthmereJobsBoardGridIndexForKeyV145({
      key: event.key,
      currentIndex,
      itemCount: buttons.length,
      columns,
    });
    event.preventDefault();
    event.stopPropagation();
    buttons[nextIndex]?.focus();
  }, [actionButtons, focusActiveTab]);

  const selectTemplate = React.useCallback((template: HarthmereJobsBoardBusinessTemplateV146) => {
    setTemplateId(template.templateId);
    setPostTitle(template.title);
    setPostDescription(template.description);
    setRewardGold(template.defaultRewardGold);
    setDeadlineDays(template.defaultDeadlineDays);
  }, []);

  const addRewardItem = React.useCallback(() => {
    const itemId = rewardItemId.trim();
    const count = Math.max(1, Math.trunc(rewardItemCount) || 1);
    if (!itemId) return;
    setRewardItems((current) => {
      const existing = current.find((item) => item.itemId === itemId);
      if (existing) {
        return current.map((item) => item.itemId === itemId ? { ...item, count: item.count + count } : item);
      }
      return [...current, { itemId, count }];
    });
  }, [rewardItemCount, rewardItemId]);

  const addRewardCollectible = React.useCallback(() => {
    if (!rewardCollectibleId) return;
    setRewardCollectibleIds((current) => current.includes(rewardCollectibleId) ? current : [...current, rewardCollectibleId]);
  }, [rewardCollectibleId]);

  const postFormValid =
    !!selectedTemplate &&
    rewardGold >= 5 &&
    rewardGold <= 5000 &&
    deadlineDays >= 1 &&
    deadlineDays <= 30 &&
    postTitle.trim().length > 0 &&
    postDescription.trim().length > 0 &&
    (issuerMode === "player" || !!selectedBusiness);

  const submitJobPosting = React.useCallback((event?: React.FormEvent) => {
    event?.preventDefault();
    if (!selectedTemplate || !postFormValid) return;
    onPostJob?.(buildHarthmereJobsBoardPostPayloadV1({
      boardId,
      templateId: selectedTemplate.templateId,
      issuerKind: issuerMode,
      businessId: issuerMode === "business" ? selectedBusiness?.businessId : undefined,
      title: postTitle,
      description: postDescription,
      kind: selectedTemplate.kind,
      requirements: selectedTemplate.requirements,
      rewardGold,
      rewardItems,
      rewardCollectibleIds,
      deadlineAtMs: Date.now() + deadlineDays * 24 * 60 * 60 * 1000,
      requiresFieldWork: true,
      mapMarkerId: selectedTemplate.mapMarkerId,
      targetId: selectedTemplate.targetId,
    }));
  }, [
    boardId,
    deadlineDays,
    issuerMode,
    onPostJob,
    postDescription,
    postFormValid,
    postTitle,
    rewardCollectibleIds,
    rewardGold,
    rewardItems,
    selectedBusiness?.businessId,
    selectedTemplate,
  ]);

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
              The jobs board is loading or has not been synced from the live backend. Try again in a moment.
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
    <section
      className="harthmere-jobs-board"
      role="document"
      aria-label={boardDisplayName}
      data-testid="harthmere-jobs-board-panel"
      ref={panelRef}
      onKeyDown={handlePanelKeyDown}
    >
      <header className="harthmere-jobs-board__header">
        <div>
          <h2>{boardDisplayName}</h2>
          <p>{board.location.district} · Jobs require in-person board interaction.</p>
        </div>
        <button onClick={onClose} aria-label="Close jobs board">×</button>
      </header>
      <nav className="harthmere-jobs-board__tabs" role="tablist" aria-label="Jobs board sections">
        {tabs.map((item) => (
          <button
            key={item.id}
            ref={(node) => { tabRefs.current[item.id as TabId] = node; }}
            className={tab === item.id ? "active" : ""}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            aria-controls={`harthmere-jobs-board-panel-${item.id}`}
            onClick={() => setTab(item.id as TabId)}
            onKeyDown={(event) => handleTabKeyDown(event, item.id as TabId)}
          >
            {item.label}{item.count ? ` (${item.count})` : ""}
          </button>
        ))}
      </nav>
      <main className="harthmere-jobs-board__content" id={`harthmere-jobs-board-panel-${tab}`}>
        {tab === "available" && (
          <div className="harthmere-jobs-grid">
            {available.length === 0 && <p className="empty">No open jobs on this board.</p>}
            {available.map((job) => (
              <article className="harthmere-jobs-card" key={job.jobId}>
                <strong>{job.title}</strong>
                <span>{job.kindLabel} · {job.rewardGold} gold</span>
                <small>{job.requiresFieldWork ? "Creates map/quest todo" : "Turn in at board"}</small>
                {job.warning && <em>{job.warning}</em>}
                <button
                  type="button"
                  aria-label={`Accept ${job.title}`}
                  data-harthmere-jobs-board-action="true"
                  data-job-action-id={job.jobId}
                  onClick={() => onAcceptJob?.(job.jobId)}
                  onKeyDown={handleActionKeyDown}
                >
                  Accept
                </button>
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
                <button
                  type="button"
                  disabled={!job.canComplete}
                  aria-label={`Turn in ${job.title}`}
                  data-harthmere-jobs-board-action="true"
                  data-job-action-id={job.jobId}
                  onClick={() => onCompleteJob?.(job.jobId)}
                  onKeyDown={handleActionKeyDown}
                >
                  Turn In
                </button>
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
                <button
                  type="button"
                  disabled={!job.canCancel}
                  aria-label={`Cancel ${job.title}`}
                  data-harthmere-jobs-board-action="true"
                  data-job-action-id={job.jobId}
                  onClick={() => onCancelJob?.(job.jobId)}
                  onKeyDown={handleActionKeyDown}
                >
                  Cancel
                </button>
              </article>
            ))}
          </div>
        )}
        {tab === "post" && (
          <form className="harthmere-jobs-board__form" onSubmit={submitJobPosting}>
            <section className="harthmere-jobs-card harthmere-jobs-card--wide">
              <strong>Create a job</strong>
              <div className="harthmere-jobs-board__form-row">
                <label>
                  Issuer
                  <select
                    value={issuerMode}
                    onChange={(event) => setIssuerMode(event.target.value as "player" | "business")}
                  >
                    <option value="business" disabled={myBusinesses.length === 0}>Owned business</option>
                    <option value="player">Personal posting</option>
                  </select>
                </label>
                <label>
                  Business
                  <select
                    value={businessId}
                    disabled={issuerMode !== "business" || myBusinesses.length === 0}
                    onChange={(event) => {
                      setBusinessId(event.target.value);
                      setTemplateId("");
                      setPostTitle("");
                      setPostDescription("");
                      setRewardGold(0);
                    }}
                  >
                    {myBusinesses.length === 0 && <option value="">No owned businesses</option>}
                    {myBusinesses.map((business) => (
                      <option key={business.businessId} value={business.businessId}>
                        {business.name} · {business.balanceGold} gold
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="harthmere-jobs-board__template-grid" role="listbox" aria-label="Business job templates">
                {postTemplates.map((template) => (
                  <button
                    key={template.templateId}
                    type="button"
                    className={template.templateId === selectedTemplate?.templateId ? "active" : ""}
                    role="option"
                    aria-selected={template.templateId === selectedTemplate?.templateId}
                    aria-label={`Use ${template.label}`}
                    data-harthmere-jobs-board-action="true"
                    data-job-action-id={`template:${template.templateId}`}
                    onClick={() => selectTemplate(template)}
                    onKeyDown={handleActionKeyDown}
                  >
                    <span>{template.label}</span>
                    <small>{template.kind} · {template.defaultRewardGold} gold</small>
                  </button>
                ))}
              </div>
              <div className="harthmere-jobs-board__form-row">
                <label>
                  Title
                  <input value={postTitle} onChange={(event) => setPostTitle(event.target.value)} maxLength={100} />
                </label>
                <label>
                  Reward gold
                  <input
                    type="number"
                    min={5}
                    max={5000}
                    value={rewardGold}
                    onChange={(event) => setRewardGold(Math.max(0, Math.trunc(Number(event.target.value) || 0)))}
                  />
                </label>
                <label>
                  Deadline
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={deadlineDays}
                    onChange={(event) => setDeadlineDays(Math.max(1, Math.trunc(Number(event.target.value) || 1)))}
                  />
                </label>
              </div>
              <label>
                Description
                <textarea value={postDescription} onChange={(event) => setPostDescription(event.target.value)} maxLength={360} />
              </label>
              <div className="harthmere-jobs-board__requirements">
                {(selectedTemplate?.requirements ?? []).map((req, index) => (
                  <span key={`${req.itemId ?? req.serviceKind ?? req.targetId}-${index}`}>
                    {req.itemId ? `${req.count ?? 1} ${req.itemId}` : `${req.serviceUnits ?? 1} ${req.serviceKind ?? "service"}`}
                    {req.targetName ? ` · ${req.targetName}` : ""}
                  </span>
                ))}
              </div>
            </section>
            <section className="harthmere-jobs-card harthmere-jobs-card--wide">
              <strong>Escrow rewards</strong>
              <p>Gold and item rewards are reserved immediately when the job is posted.</p>
              <div className="harthmere-jobs-board__form-row">
                <label>
                  Reward item
                  <select value={rewardItemId} onChange={(event) => setRewardItemId(event.target.value)}>
                    {availableRewardItemIds.length === 0 && <option value="">No items available</option>}
                    {availableRewardItemIds.map((itemId) => (
                      <option key={itemId} value={itemId}>{itemId}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Count
                  <input
                    type="number"
                    min={1}
                    value={rewardItemCount}
                    onChange={(event) => setRewardItemCount(Math.max(1, Math.trunc(Number(event.target.value) || 1)))}
                  />
                </label>
                <button
                  type="button"
                  disabled={!rewardItemId}
                  aria-label="Add item reward"
                  data-harthmere-jobs-board-action="true"
                  data-job-action-id="add-reward-item"
                  onClick={addRewardItem}
                  onKeyDown={handleActionKeyDown}
                >
                  Add Item
                </button>
              </div>
              {rewardItems.length > 0 && (
                <div className="harthmere-jobs-board__requirements">
                  {rewardItems.map((item) => (
                    <button
                      key={item.itemId}
                      type="button"
                      aria-label={`Remove ${item.itemId} reward`}
                      onClick={() => setRewardItems((current) => current.filter((entry) => entry.itemId !== item.itemId))}
                    >
                      {item.count} {item.itemId} ×
                    </button>
                  ))}
                </div>
              )}
              <div className="harthmere-jobs-board__form-row">
                <label>
                  Collectible
                  <select value={rewardCollectibleId} onChange={(event) => setRewardCollectibleId(event.target.value)}>
                    {availableCollectibleIds.length === 0 && <option value="">No discovered collectibles</option>}
                    {availableCollectibleIds.map((collectibleId) => (
                      <option key={collectibleId} value={collectibleId}>{collectibleId}</option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={!rewardCollectibleId}
                  aria-label="Add collectible reward"
                  data-harthmere-jobs-board-action="true"
                  data-job-action-id="add-reward-collectible"
                  onClick={addRewardCollectible}
                  onKeyDown={handleActionKeyDown}
                >
                  Add Collectible
                </button>
              </div>
              {rewardCollectibleIds.length > 0 && (
                <div className="harthmere-jobs-board__requirements">
                  {rewardCollectibleIds.map((collectibleId) => (
                    <button
                      key={collectibleId}
                      type="button"
                      aria-label={`Remove ${collectibleId} collectible reward`}
                      onClick={() => setRewardCollectibleIds((current) => current.filter((entry) => entry !== collectibleId))}
                    >
                      {collectibleId} ×
                    </button>
                  ))}
                </div>
              )}
              <div className="harthmere-jobs-board__form-actions">
                <button
                  type="submit"
                  disabled={!postFormValid}
                  aria-label="Create job posting"
                  data-harthmere-jobs-board-action="true"
                  data-job-action-id="create-posting"
                  onKeyDown={handleActionKeyDown}
                >
                  Create Job Posting
                </button>
              </div>
            </section>
          </form>
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
