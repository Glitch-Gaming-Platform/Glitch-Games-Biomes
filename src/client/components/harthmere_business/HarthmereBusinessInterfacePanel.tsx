import * as React from "react";
import { usePointerLockManager } from "../contexts/PointerLockContext";
import {
  closePointerLockUnlockWhileOpenV1,
  openPointerLockUnlockWhileOpenV1,
  type PointerLockUnlockWhileOpenReturnRefV1,
} from "../contexts/pointerLockModalPolicy";
import { installBiomesUITheme } from "../biomes_ui/theme/biomesUITheme";
import { RovingGrid } from "../biomes_ui/nav/RovingGrid";
import {
  harthmereBikkieVisualGlyphStyleV1,
  harthmereBikkieVisualImageStyleV1,
  harthmereBikkieVisualImageUrlV1,
  harthmereBikkieVisualTileStyleV1,
} from "../biomes_ui/adapters/harthmereBikkieVisualRenderingV1";
import { createHarthmereBusinessMiniGameDecisionForOfferV1 } from "@/shared/harthmere/business_customer_simulator_v1";
import type {
  HarthmereBusinessActorModeV1,
  HarthmereBusinessBikkieGraphicV1,
  HarthmereBusinessContractV1,
  HarthmereBusinessInterfaceAdapterV1,
  HarthmereBusinessVisibleInventoryItemV1,
  HarthmereBusinessWorldContextV1,
} from "./businessInterfaceLiveAdapter";
import { formatHarthmereBusinessPlayerWarningV1 } from "./businessInterfaceLiveAdapter";

export interface HarthmereBusinessInterfacePanelProps {
  adapter: HarthmereBusinessInterfaceAdapterV1;
  nearbyBusinessId?: string | null;
  context?: HarthmereBusinessWorldContextV1;
  onClose?: () => void;
  compact?: boolean;
  initialTab?: HarthmereBusinessInterfacePanelTabV1;
}

type OwnerTab =
  | "dashboard"
  | "customers"
  | "orders"
  | "shopfront"
  | "finance"
  | "staff"
  | "empire"
  | "licenses"
  | "operations"
  | "town"
  | "market"
  | "guild";
type CustomerTab =
  | "overview"
  | "customers"
  | "services"
  | "shopfront"
  | "status"
  | "market";
type PanelTab = OwnerTab | CustomerTab;
export type HarthmereBusinessInterfacePanelTabV1 = PanelTab;

type HarthmereBusinessRenderProfileEntryV1 = {
  atMs: number;
  label: string;
  kind: "derive" | "render" | "commit" | "longtask";
  durationMs: number;
  businessId?: string;
  tab?: string;
  details?: Record<string, unknown>;
};

declare global {
  interface Window {
    __HARTHMERE_BUSINESS_RENDER_PROFILE_V1__?: {
      entries: HarthmereBusinessRenderProfileEntryV1[];
      clear: () => void;
      slowest: (limit?: number) => HarthmereBusinessRenderProfileEntryV1[];
    };
  }
}

const OWNER_TABS: OwnerTab[] = [
  "dashboard",
  "customers",
  "orders",
  "shopfront",
  "finance",
  "staff",
  "empire",
  "licenses",
  "operations",
  "town",
  "market",
  "guild",
];
const CUSTOMER_TABS: CustomerTab[] = [
  "overview",
  "customers",
  "shopfront",
  "services",
  "status",
  "market",
];
const TAB_LABELS: Record<PanelTab, string> = {
  dashboard: "Dashboard",
  customers: "Getting a Job and Getting Paid",
  orders: "Orders",
  shopfront: "Shopfront",
  finance: "Finance",
  staff: "Staff",
  empire: "Empire",
  licenses: "Licenses",
  operations: "Operations",
  town: "Town",
  market: "Market",
  guild: "Guild",
  overview: "Overview",
  services: "Services",
  status: "Status",
};

function displayLabel(value: string | undefined): string {
  if (!value) return "";
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/[:./]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function playerFacingBusinessNameV1(
  name: string | undefined,
  fallbackTypeId: string
) {
  const raw = name?.trim();
  if (!raw) {
    return displayLabel(fallbackTypeId);
  }
  return /[_-]|[a-z][A-Z]/.test(raw) ? displayLabel(raw) : raw;
}

function ticketPatienceRemaining(
  ticket:
    | { arrivedAtMs: number; patience: number; patienceRemaining: number }
    | undefined,
  nowMs: number
): number {
  if (!ticket) return 0;
  const elapsed = Math.max(0, Math.floor((nowMs - ticket.arrivedAtMs) / 1000));
  return Math.max(
    0,
    Math.min(ticket.patienceRemaining, ticket.patience - elapsed)
  );
}

function isTypingInInput(): boolean {
  if (typeof document === "undefined") return false;
  const active = document.activeElement as HTMLElement | null;
  if (!active) return false;
  const tag = active.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || active.isContentEditable;
}

function installHarthmereBusinessPendingStylesV1() {
  if (typeof document === "undefined") return;
  if (document.getElementById("harthmere-business-pending-styles-v1")) return;
  const style = document.createElement("style");
  style.id = "harthmere-business-pending-styles-v1";
  style.textContent = [
    "@keyframes harthmere-business-pending-spin-v1 { to { transform: rotate(360deg); } }",
    "@keyframes harthmere-business-meter-v1 { 0% { transform: translateX(-100%); } 100% { transform: translateX(280%); } }",
    "@keyframes harthmere-business-pulse-v1 { 0%, 100% { opacity: .58; transform: scale(.96); } 50% { opacity: 1; transform: scale(1.04); } }",
  ].join("\n");
  document.head.appendChild(style);
}

function harthmereBusinessPerfNowV1() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function harthmereBusinessPerfShouldLogV1(entry: {
  kind: HarthmereBusinessRenderProfileEntryV1["kind"];
  durationMs: number;
}) {
  if (typeof window === "undefined") return false;
  let debug = false;
  try {
    debug =
      window.localStorage?.getItem("harthmere.business.perf") === "1" ||
      window.localStorage?.getItem("harthmere.perf") === "1";
  } catch {
    debug = false;
  }
  if (debug) return true;
  const threshold = entry.kind === "render" ? 18 : 8;
  return entry.durationMs >= threshold;
}

function recordHarthmereBusinessRenderProfileV1(
  entry: Omit<HarthmereBusinessRenderProfileEntryV1, "atMs">
) {
  if (typeof window === "undefined") return;
  const profiler =
    window.__HARTHMERE_BUSINESS_RENDER_PROFILE_V1__ ??
    (window.__HARTHMERE_BUSINESS_RENDER_PROFILE_V1__ = {
      entries: [],
      clear: () => {
        window.__HARTHMERE_BUSINESS_RENDER_PROFILE_V1__?.entries.splice(0);
      },
      slowest: (limit = 20) =>
        [...(window.__HARTHMERE_BUSINESS_RENDER_PROFILE_V1__?.entries ?? [])]
          .sort((a, b) => b.durationMs - a.durationMs)
          .slice(0, limit),
    });
  const fullEntry = {
    atMs: Date.now(),
    ...entry,
    durationMs: Number(entry.durationMs.toFixed(2)),
  };
  profiler.entries.push(fullEntry);
  if (profiler.entries.length > 300) profiler.entries.splice(0, 50);
  if (harthmereBusinessPerfShouldLogV1(fullEntry)) {
    console.info("[HarthmereBusinessPerf]", fullEntry);
  }
}

function useMeasuredBusinessMemoV1<T>(
  label: string,
  factory: () => T,
  deps: React.DependencyList,
  details?: Omit<
    HarthmereBusinessRenderProfileEntryV1,
    "atMs" | "durationMs" | "kind" | "label"
  >
): T {
  return React.useMemo(() => {
    const start = harthmereBusinessPerfNowV1();
    const value = factory();
    recordHarthmereBusinessRenderProfileV1({
      kind: "derive",
      label,
      durationMs: harthmereBusinessPerfNowV1() - start,
      ...details,
    });
    return value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

function useHarthmereBusinessLongTaskObserverV1(
  enabled: boolean,
  businessId?: string | null,
  tab?: string
) {
  React.useEffect(() => {
    if (
      !enabled ||
      typeof window === "undefined" ||
      typeof PerformanceObserver === "undefined"
    ) {
      return;
    }
    let observer: PerformanceObserver | undefined;
    try {
      observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          recordHarthmereBusinessRenderProfileV1({
            kind: "longtask",
            label: entry.name || "browser-long-task",
            durationMs: entry.duration,
            businessId: businessId ?? undefined,
            tab,
            details: {
              startTime: Number(entry.startTime.toFixed(2)),
            },
          });
        }
      });
      observer.observe({ entryTypes: ["longtask"] });
    } catch {
      return;
    }
    return () => observer?.disconnect();
  }, [businessId, enabled, tab]);
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    rows.push(items.slice(i, i + size));
  return rows.length ? rows : [[]];
}

function usePendingBusinessAdapterV1(
  adapter: HarthmereBusinessInterfaceAdapterV1
): {
  adapter: HarthmereBusinessInterfaceAdapterV1;
  pending: boolean;
} {
  const [pendingCount, setPendingCount] = React.useState(0);
  const wrapped = React.useMemo(
    () =>
      new Proxy(adapter as any, {
        get(target, prop, receiver) {
          const value = Reflect.get(target, prop, receiver);
          if (typeof value !== "function") return value;
          return (...args: unknown[]) => {
            const result = value.apply(target, args);
            if (!result || typeof result.then !== "function") return result;
            setPendingCount((count) => count + 1);
            return result.finally(() =>
              setPendingCount((count) => Math.max(0, count - 1))
            );
          };
        },
      }) as HarthmereBusinessInterfaceAdapterV1,
    [adapter]
  );
  return { adapter: wrapped, pending: pendingCount > 0 };
}

const BikkieVisualTile: React.FunctionComponent<{
  graphic: HarthmereBusinessBikkieGraphicV1;
}> = ({ graphic }) => {
  const imageUrl = harthmereBikkieVisualImageUrlV1(graphic.visual);
  return (
    <span
      aria-label={graphic.visual.ariaLabel}
      title={graphic.visual.metadataSummary}
      style={harthmereBikkieVisualTileStyleV1(graphic.visual)}
      data-bikkie-visual="true"
      data-visual-source={graphic.visual.source}
      data-visual-kind={graphic.visual.shape}
      data-visual-id={graphic.visual.visualId}
      data-icon-asset-path={graphic.visual.iconAssetPath}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          aria-hidden="true"
          style={harthmereBikkieVisualImageStyleV1}
          data-bikkie-visual-img="true"
        />
      ) : null}
      <span style={harthmereBikkieVisualGlyphStyleV1}>
        {graphic.visual.glyph}
      </span>
    </span>
  );
};

export const HarthmereBusinessInterfacePanel: React.FunctionComponent<
  HarthmereBusinessInterfacePanelProps
> = ({
  adapter,
  nearbyBusinessId,
  context,
  onClose,
  compact = false,
  initialTab,
}) => {
  const pointerLockManager = usePointerLockManager();
  const shouldReturnPointerLock =
    React.useRef<PointerLockUnlockWhileOpenReturnRefV1>({ current: false });
  const { adapter: businessAdapter, pending: backendPending } =
    usePendingBusinessAdapterV1(adapter);
  const activeBusinessId =
    nearbyBusinessId ?? context?.nearbyBusinessId ?? null;
  const available =
    businessAdapter.isHydrated() &&
    businessAdapter.isAvailable(activeBusinessId);
  const business = activeBusinessId
    ? businessAdapter.getBusiness(activeBusinessId)
    : undefined;
  const mode: HarthmereBusinessActorModeV1 =
    business && activeBusinessId
      ? businessAdapter.getMode(activeBusinessId)
      : "customer";
  const tabs: PanelTab[] = mode === "owner" ? OWNER_TABS : CUSTOMER_TABS;
  const [activeTab, setActiveTab] = React.useState<PanelTab>(
    initialTab && tabs.includes(initialTab) ? initialTab : tabs[0]
  );

  React.useEffect(() => {
    installBiomesUITheme();
    installHarthmereBusinessPendingStylesV1();
  }, []);
  React.useEffect(() => {
    if (!available || compact) return;
    openPointerLockUnlockWhileOpenV1(
      pointerLockManager,
      shouldReturnPointerLock.current
    );
    return () => {
      closePointerLockUnlockWhileOpenV1(
        pointerLockManager,
        shouldReturnPointerLock.current
      );
    };
  }, [available, compact, pointerLockManager]);
  React.useEffect(() => {
    if (!tabs.includes(activeTab)) setActiveTab(tabs[0]);
  }, [activeTab, tabs.join("|")]);
  React.useEffect(() => {
    if (!available) return;
    function onKeyDown(event: KeyboardEvent) {
      if (isTypingInInput()) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
        return;
      }
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const index = tabs.indexOf(activeTab);
      const dir = event.key === "ArrowRight" ? 1 : -1;
      setActiveTab(tabs[(index + dir + tabs.length) % tabs.length]);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [activeTab, available, onClose, tabs.join("|")]);
  useHarthmereBusinessLongTaskObserverV1(
    available,
    activeBusinessId,
    activeTab
  );
  const onActivePaneRender = React.useCallback(
    (
      _id: string,
      phase: "mount" | "update" | "nested-update",
      actualDuration: number,
      baseDuration: number,
      startTime: number,
      commitTime: number
    ) => {
      recordHarthmereBusinessRenderProfileV1({
        kind: "render",
        label: "active-pane",
        durationMs: actualDuration,
        businessId: activeBusinessId ?? undefined,
        tab: activeTab,
        details: {
          phase,
          baseDuration: Number(baseDuration.toFixed(2)),
          commitDelayMs: Number((commitTime - startTime).toFixed(2)),
        },
      });
    },
    [activeBusinessId, activeTab]
  );

  if (!activeBusinessId || !available || !business) return null;
  const type = businessAdapter.getBusinessType(activeBusinessId);
  const businessDisplayName = playerFacingBusinessNameV1(
    business.name,
    business.typeId
  );
  let activePane: React.ReactNode = null;
  switch (activeTab) {
    case "dashboard":
      activePane = (
        <OwnerDashboardPane
          adapter={businessAdapter}
          businessId={activeBusinessId}
        />
      );
      break;
    case "customers":
      activePane = (
        <CustomerMiniGamePane
          adapter={businessAdapter}
          businessId={activeBusinessId}
        />
      );
      break;
    case "overview":
      activePane = (
        <CustomerOverviewPane
          adapter={businessAdapter}
          businessId={activeBusinessId}
        />
      );
      break;
    case "orders":
      activePane = (
        <ContractBoardPane
          adapter={businessAdapter}
          businessId={activeBusinessId}
        />
      );
      break;
    case "shopfront":
      activePane = (
        <ShopfrontPane
          adapter={businessAdapter}
          businessId={activeBusinessId}
          mode={mode}
        />
      );
      break;
    case "finance":
      activePane = (
        <FinancePane adapter={businessAdapter} businessId={activeBusinessId} />
      );
      break;
    case "staff":
      activePane = (
        <StaffPane adapter={businessAdapter} businessId={activeBusinessId} />
      );
      break;
    case "empire":
      activePane = (
        <EmpirePane adapter={businessAdapter} businessId={activeBusinessId} />
      );
      break;
    case "licenses":
      activePane = (
        <CompliancePane
          adapter={businessAdapter}
          businessId={activeBusinessId}
        />
      );
      break;
    case "operations":
    case "services":
      activePane = (
        <OperationsPane
          adapter={businessAdapter}
          businessId={activeBusinessId}
          mode={mode}
        />
      );
      break;
    case "status":
      activePane = (
        <CustomerStatusPane
          adapter={businessAdapter}
          businessId={activeBusinessId}
        />
      );
      break;
    case "town":
      activePane = <TownHallPane adapter={businessAdapter} />;
      break;
    case "market":
      activePane = <MarketplacePane adapter={businessAdapter} />;
      break;
    case "guild":
      activePane = (
        <GuildBusinessPane
          adapter={businessAdapter}
          guildId={context?.actorGuildId}
        />
      );
      break;
  }

  return (
    <div
      role="dialog"
      aria-label={`${businessDisplayName} business interface`}
      data-harthmere-business-interface="true"
      data-business-interface-scope="inside-business-only"
      data-pointer-lock-policy="unlock-while-open"
      data-mouse-policy="show-while-open"
      data-business-id={activeBusinessId}
      data-business-mode={mode}
      className="biomes-ui-panel"
      style={{
        position: compact ? "relative" : "fixed",
        inset: compact
          ? undefined
          : "max(10px, env(safe-area-inset-top)) max(10px, env(safe-area-inset-right)) max(10px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left))",
        zIndex: compact ? undefined : 1250,
        maxWidth: compact ? undefined : 1180,
        width: compact ? "100%" : "calc(100vw - 20px)",
        maxHeight: compact ? undefined : "calc(100vh - 20px)",
        boxSizing: "border-box",
        margin: compact ? undefined : "auto",
        overflow: "auto",
        padding: compact ? 12 : "16px 18px",
      }}
    >
      <header
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          gap: 12,
          alignItems: "start",
          marginBottom: 12,
        }}
      >
        <div>
          <h2 style={panelTitleStyle}>{businessDisplayName}</h2>
          <p style={mutedTextStyle}>
            {type?.displayName ?? displayLabel(business.typeId)} ·{" "}
            {mode === "owner" ? "Owner Management" : "Customer Services"} ·{" "}
            {displayLabel(business.status)}
          </p>
        </div>
        <button
          type="button"
          className="biomes-ui-tab"
          onClick={onClose}
          aria-label="Close business interface"
        >
          Close
        </button>
      </header>

      <nav
        aria-label="Business interface sections"
        style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}
      >
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className="biomes-ui-tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </nav>

      <React.Profiler
        id={`harthmere-business-${activeTab}`}
        onRender={onActivePaneRender}
      >
        {activePane}
      </React.Profiler>
      {backendPending ? (
        <div
          style={businessPendingOverlayStyle}
          aria-live="polite"
          aria-busy="true"
        >
          <span style={businessPendingSpinnerStyle} aria-hidden="true" />
          Updating business...
        </div>
      ) : null}
    </div>
  );
};

const BikkieGraphicsStrip: React.FunctionComponent<{
  graphics: readonly HarthmereBusinessBikkieGraphicV1[];
}> = ({ graphics }) => {
  const shown = graphics.slice(0, 5);
  const primary =
    graphics.find((graphic) => graphic.role === "primary_station") ?? shown[0];
  return (
    <section
      style={cardStyle}
      data-bikkie-business-graphics="true"
      data-primary-bikkie-id={primary?.bikkieId}
      data-primary-bikkie-label={primary?.label}
    >
      <h3 style={sectionTitleStyle}>Service Fixtures</h3>
      {shown.length ? (
        <div style={{ display: "grid", gap: 8 }}>
          {shown.map((graphic) => {
            const size = graphic.boxSize
              ? `${graphic.boxSize[0]}x${graphic.boxSize[1]}x${graphic.boxSize[2]}`
              : displayLabel(graphic.kind);
            return (
              <div
                key={graphic.graphicId}
                style={bikkieGraphicRowStyle}
                data-bikkie-graphic-id={graphic.graphicId}
                data-bikkie-id={graphic.bikkieId}
                data-bikkie-role={graphic.role}
                data-bikkie-visual-source={graphic.visual.source}
              >
                <BikkieVisualTile graphic={graphic} />
                <div style={{ minWidth: 0 }}>
                  <strong style={{ fontSize: 12 }}>{graphic.label}</strong>
                  <p style={mutedTextStyle}>
                    {displayLabel(graphic.role)} · {size} ·{" "}
                    {graphic.colors.slice(0, 3).join(", ")}
                  </p>
                  <p style={{ ...mutedTextStyle, marginTop: 4 }}>
                    {graphic.businessUse}
                  </p>
                </div>
                <span style={bikkieGraphicKindStyle}>
                  {displayLabel(graphic.kind)}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p style={mutedTextStyle}>No Bikkie graphics are assigned.</p>
      )}
    </section>
  );
};

const OwnerDashboardPane: React.FunctionComponent<{
  adapter: HarthmereBusinessInterfaceAdapterV1;
  businessId: string;
}> = ({ adapter, businessId }) => {
  const {
    dashboard,
    report,
    quests,
    miniGame,
    business,
    type,
    bikkieGraphics,
  } = useMeasuredBusinessMemoV1(
    "owner-dashboard-derive",
    () => ({
      dashboard: adapter.getOwnerDashboard(businessId),
      report: adapter.getGrowthReport(businessId),
      quests: adapter.getServiceQuests(businessId),
      miniGame: adapter.getCustomerMiniGame(businessId),
      business: adapter.getBusiness(businessId),
      type: adapter.getBusinessType(businessId),
      bikkieGraphics: adapter.getBikkieGraphics(businessId),
    }),
    [adapter, businessId],
    { businessId, tab: "dashboard" }
  );
  const canOpen = Boolean(
    business?.propertyId &&
      business.townId &&
      business.licenseLevel >= (type?.minimumLicenseLevel ?? 1)
  );
  const session = miniGame.activeSession;
  const shiftProgress = session
    ? `${session.servedTicketIds.length}/${session.queue.length} served`
    : `Tier ${miniGame.stats.currentTier} service`;
  const shiftHint = session
    ? `${session.earnedGold} gold earned · ${session.failedTicketIds.length} missed`
    : miniGame.dailyReturnTriggers[0];
  return (
    <div style={responsiveGridStyle}>
      <section style={highlightCardStyle}>
        <div>
          <h3 style={sectionTitleStyle}>Today's Floor</h3>
          <strong style={heroMetricStyle}>{shiftProgress}</strong>
          <p style={mutedTextStyle}>{shiftHint}</p>
        </div>
        <button
          className="biomes-ui-tab"
          type="button"
          disabled={Boolean(session)}
          onClick={() => void adapter.startCustomerSession(businessId)}
          style={session ? disabledButtonStyle : startShiftButtonStyle}
        >
          Start Shift
        </button>
      </section>
      <BikkieGraphicsStrip graphics={bikkieGraphics} />
      {dashboard.metrics.map((metric) => (
        <MetricCard
          key={metric.id}
          label={metric.label}
          value={metric.value}
          hint={metric.hint}
        />
      ))}
      <section style={cardStyle}>
        <h3 style={sectionTitleStyle}>Daily Report</h3>
        <p style={mutedTextStyle}>
          <strong>Earned:</strong> {report.earnedToday}
        </p>
        <p style={{ ...mutedTextStyle, marginTop: 6 }}>
          <strong>Costs:</strong> {report.costsToday}
        </p>
        <p style={{ ...mutedTextStyle, marginTop: 6 }}>
          <strong>Completed:</strong> {report.completedToday}
        </p>
        <p style={{ ...mutedTextStyle, marginTop: 6 }}>
          <strong>Due soon:</strong> {report.expiringSoon}
        </p>
      </section>
      <section style={cardStyle}>
        <h3 style={sectionTitleStyle}>Growth Bottleneck</h3>
        <p style={mutedTextStyle}>{report.bottleneck}</p>
        <p style={{ ...mutedTextStyle, marginTop: 8 }}>
          <strong>Active work:</strong> {report.activeWork}
        </p>
        <p style={{ ...mutedTextStyle, marginTop: 8 }}>
          <strong>Stock focus:</strong> {report.inventoryFocus}
        </p>
        <p style={{ ...mutedTextStyle, marginTop: 8 }}>
          <strong>Next upgrade:</strong> {report.nextUpgrade}
        </p>
      </section>
      <section style={cardStyle}>
        <h3 style={sectionTitleStyle}>Rewards Beyond Gold</h3>
        {report.rewardLayers.map((layer) => (
          <p key={layer} style={mutedTextStyle}>
            {layer}
          </p>
        ))}
      </section>
      <section style={cardStyle}>
        <h3 style={sectionTitleStyle}>Tasks</h3>
        {business?.status !== "open" && (
          <button
            className="biomes-ui-tab"
            type="button"
            disabled={!canOpen}
            onClick={() =>
              canOpen &&
              void adapter.openBusiness(
                businessId,
                business?.propertyId,
                business?.townId
              )
            }
            style={!canOpen ? disabledButtonStyle : undefined}
          >
            Open Business
          </button>
        )}
        {dashboard.todos.length ? (
          dashboard.todos.map((todo) => (
            <p key={todo.id} style={{ ...mutedTextStyle, marginTop: 8 }}>
              <strong>{todo.label}:</strong> {todo.description}
            </p>
          ))
        ) : (
          <p style={mutedTextStyle}>No urgent tasks.</p>
        )}
      </section>
      <section style={cardStyle}>
        <h3 style={sectionTitleStyle}>Field Service Quests</h3>
        {quests.length ? (
          quests.map((quest) => (
            <p key={quest.questId} style={mutedTextStyle}>
              <strong>{quest.title}</strong>
              <br />
              {quest.todoText}
              {quest.mapMarkerId
                ? ` · Map marker ${displayLabel(quest.mapMarkerId)}`
                : ""}
            </p>
          ))
        ) : (
          <p style={mutedTextStyle}>No accepted field-service quests yet.</p>
        )}
      </section>
    </div>
  );
};

const CustomerMiniGamePane: React.FunctionComponent<{
  adapter: HarthmereBusinessInterfaceAdapterV1;
  businessId: string;
}> = ({ adapter, businessId }) => {
  const panel = useMeasuredBusinessMemoV1(
    "customer-minigame-derive",
    () => adapter.getCustomerMiniGame(businessId),
    [adapter, businessId],
    { businessId, tab: "customers" }
  );
  const session = panel.activeSession;
  const ticket = panel.currentTicket;
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!ticket) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [ticket?.ticketId]);
  const served = session?.servedTicketIds.length ?? 0;
  const failed = session?.failedTicketIds.length ?? 0;
  const displayedPatience = ticketPatienceRemaining(ticket, nowMs);
  const mechanic = panel.definition.mechanicSpec;
  const queueTotal = Math.max(1, session?.queue.length ?? 1);
  const progressPercent = Math.min(
    100,
    Math.round((served / queueTotal) * 100)
  );
  const offerRows = React.useMemo(() => chunk(panel.offers, 2), [panel.offers]);
  const uiElements = React.useMemo(
    () => panel.definition.mechanicSpec.uiElements,
    [panel.definition.mechanicSpec.uiElements]
  );
  const winConditions = React.useMemo(
    () => panel.definition.mechanicSpec.winConditions,
    [panel.definition.mechanicSpec.winConditions]
  );
  const edgeCases = React.useMemo(
    () => panel.definition.mechanicSpec.edgeCases.slice(0, 3),
    [panel.definition.mechanicSpec.edgeCases]
  );
  return (
    <div style={responsiveGridStyle}>
      <MetricCard
        label="Served"
        value={`${panel.stats.totalServed}`}
        hint={`Best streak ${panel.stats.bestStreak} · Tier ${panel.stats.currentTier}`}
      />
      <MetricCard
        label="Shift"
        value={session ? `${served}/${session.queue.length}` : "Idle"}
        hint={
          session
            ? `${session.earnedGold} gold · ${failed} missed`
            : panel.dailyReturnTriggers[0]
        }
      />
      <section style={miniGameArenaStyle}>
        <div style={miniGameHeaderStyle}>
          <div>
            <h3 style={sectionTitleStyle}>Getting a Job and Getting Paid</h3>
            <strong style={miniGameTitleStyle}>{mechanic.gameTitle}</strong>
          </div>
          <span style={miniGameBadgeStyle}>
            {session ? "Shift Live" : "Ready"}
          </span>
        </div>
        <p style={mutedTextStyle}>{mechanic.objective}</p>
        <div style={progressTrackStyle} aria-hidden="true">
          <div style={{ ...progressFillStyle, width: `${progressPercent}%` }} />
          {session ? <div style={progressSweepStyle} /> : null}
        </div>
        <div style={{ ...formRowStyle, marginTop: 12 }}>
          <button
            className="biomes-ui-tab"
            type="button"
            disabled={Boolean(session)}
            onClick={() => void adapter.startCustomerSession(businessId)}
            style={session ? disabledButtonStyle : startShiftButtonStyle}
          >
            Start Shift
          </button>
        </div>
        {session?.notes.slice(-3).map((note) => (
          <p key={note} style={{ ...mutedTextStyle, marginTop: 6 }}>
            {note}
          </p>
        ))}
      </section>
      <section style={cardStyle} data-business-minigame-spec={mechanic.specId}>
        <h3 style={sectionTitleStyle}>Service Board</h3>
        <div style={{ display: "grid", gap: 8 }}>
          {uiElements.map((element) => (
            <div
              key={element.elementId}
              style={rowCardStyle}
              data-business-minigame-ui-element={element.elementId}
            >
              <strong>{element.label}</strong>
              <p style={mutedTextStyle}>{element.description}</p>
            </div>
          ))}
        </div>
      </section>
      <section style={cardStyle}>
        <h3 style={sectionTitleStyle}>Current Customer</h3>
        {ticket ? (
          <>
            <div style={customerStageStyle}>
              <span style={customerAvatarStyle} aria-hidden="true" />
              <div>
                <strong>
                  {panel.currentNpc?.displayName ?? displayLabel(ticket.npcId)}
                </strong>
                <p style={{ ...mutedTextStyle, marginTop: 4 }}>
                  {ticket.askLine}
                </p>
              </div>
            </div>
            <p style={{ ...mutedTextStyle, marginTop: 6 }}>
              Patience {displayedPatience}/{ticket.patience} · Difficulty{" "}
              {ticket.difficulty}
            </p>
            <RovingGrid
              ariaLabel="Customer service offers"
              items={offerRows}
              onActivate={(_row, _col, offer) =>
                void adapter.serveCustomer(
                  businessId,
                  offer.offerId,
                  session?.sessionId,
                  ticket.ticketId,
                  createHarthmereBusinessMiniGameDecisionForOfferV1(
                    panel.typeId as any,
                    offer.offerId
                  )
                )
              }
              renderCell={(offer, _coords, cell) => (
                <button
                  ref={cell.ref}
                  tabIndex={cell.tabIndex}
                  onFocus={cell.onFocus}
                  onKeyDown={cell.onKeyDown}
                  onClick={cell.onClick}
                  className="biomes-ui-tab"
                  style={serviceButtonStyle}
                  aria-label={offer.label}
                >
                  <strong>{offer.label}</strong>
                  <span style={mutedTextStyle}>{offer.description}</span>
                </button>
              )}
            />
          </>
        ) : (
          <p style={mutedTextStyle}>
            {session
              ? "This shift is complete."
              : "Start a shift to bring customer-only NPCs to the counter."}
          </p>
        )}
      </section>
      <section style={cardStyle}>
        <h3 style={sectionTitleStyle}>Rules</h3>
        {winConditions.map((step) => (
          <p key={step} style={mutedTextStyle}>
            {step}
          </p>
        ))}
        {edgeCases.map((step) => (
          <p key={step} style={{ ...mutedTextStyle, marginTop: 6 }}>
            {step}
          </p>
        ))}
      </section>
    </div>
  );
};

const CustomerOverviewPane: React.FunctionComponent<{
  adapter: HarthmereBusinessInterfaceAdapterV1;
  businessId: string;
}> = ({ adapter, businessId }) => {
  const { business, shop, miniGame } = useMeasuredBusinessMemoV1(
    "customer-overview-derive",
    () => ({
      business: adapter.getBusiness(businessId)!,
      shop: adapter.getShopfront(businessId),
      miniGame: adapter.getCustomerMiniGame(businessId),
    }),
    [adapter, businessId],
    { businessId, tab: "overview" }
  );
  return (
    <div style={responsiveGridStyle}>
      <MetricCard
        label="Satisfaction"
        value={`${business.customerSatisfaction}/100`}
        hint={`Reputation ${business.reputation}`}
      />
      <MetricCard
        label="Stock"
        value={`${shop.inventory.length}`}
        hint="public inventory stacks"
      />
      <BikkieGraphicsStrip graphics={miniGame.bikkieGraphics} />
      <section style={cardStyle}>
        <h3 style={sectionTitleStyle}>How to use this business</h3>
        <p style={mutedTextStyle}>{miniGame.definition.customerGoal}</p>
        <p style={{ ...mutedTextStyle, marginTop: 8 }}>
          {miniGame.dailyReturnTriggers[0]}
        </p>
      </section>
    </div>
  );
};

const ContractBoardPane: React.FunctionComponent<{
  adapter: HarthmereBusinessInterfaceAdapterV1;
  businessId: string;
}> = ({ adapter, businessId }) => {
  const board = useMeasuredBusinessMemoV1(
    "contract-board-derive",
    () => adapter.getContractBoard(businessId),
    [adapter, businessId],
    { businessId, tab: "orders" }
  );
  return (
    <div style={responsiveGridStyle}>
      <ContractList
        title="Open Orders"
        contracts={board.open}
        renderAction={(contract) => (
          <button
            className="biomes-ui-tab"
            type="button"
            onClick={() =>
              void adapter.acceptContract(businessId, contract.contractId)
            }
          >
            Accept
          </button>
        )}
      />
      <ContractList
        title="Active Orders"
        contracts={board.active}
        renderAction={(contract) => (
          <button
            className="biomes-ui-tab"
            type="button"
            onClick={() =>
              void adapter.fulfillContract(businessId, contract.contractId)
            }
          >
            Fulfill
          </button>
        )}
      />
      <ContractList title="Customer Status" contracts={board.customer} />
    </div>
  );
};

const ContractList: React.FunctionComponent<{
  title: string;
  contracts: HarthmereBusinessContractV1[];
  renderAction?: (contract: HarthmereBusinessContractV1) => React.ReactNode;
}> = ({ title, contracts, renderAction }) => (
  <section style={cardStyle}>
    <h3 style={sectionTitleStyle}>{title}</h3>
    {contracts.length ? (
      contracts.map((contract) => (
        <div key={contract.contractId} style={rowCardStyle}>
          <div>
            <strong>{contract.title}</strong>
            <p style={mutedTextStyle}>
              {displayLabel(contract.status)} · {contract.rewardGold} gold · due{" "}
              {new Date(contract.deadlineAtMs).toLocaleDateString()}
            </p>
          </div>
          {renderAction?.(contract)}
        </div>
      ))
    ) : (
      <p style={mutedTextStyle}>No matching orders.</p>
    )}
  </section>
);

const ShopfrontPane: React.FunctionComponent<{
  adapter: HarthmereBusinessInterfaceAdapterV1;
  businessId: string;
  mode: HarthmereBusinessActorModeV1;
}> = ({ adapter, businessId, mode }) => {
  const shop = useMeasuredBusinessMemoV1(
    "shopfront-derive",
    () => adapter.getShopfront(businessId),
    [adapter, businessId],
    { businessId, tab: "shopfront" }
  );
  const [itemId, setItemId] = React.useState("");
  const [count, setCount] = React.useState("1");
  const [priceItemId, setPriceItemId] = React.useState("");
  const [priceModifier, setPriceModifier] = React.useState("1");
  const parsedCount = Math.max(1, Number(count) || 1);
  return (
    <section style={cardStyle}>
      <h3 style={sectionTitleStyle}>
        {mode === "owner" ? "Shopfront & Inventory" : "Shopfront"}
      </h3>
      {mode === "owner" ? (
        <>
          <div style={formRowStyle}>
            <input
              aria-label="Item"
              placeholder="Item"
              style={inputStyle}
              value={itemId}
              onChange={(event) => setItemId(event.currentTarget.value)}
            />
            <input
              aria-label="Count"
              placeholder="Count"
              style={{ ...inputStyle, width: 84 }}
              value={count}
              onChange={(event) => setCount(event.currentTarget.value)}
            />
            <button
              className="biomes-ui-tab"
              type="button"
              onClick={() =>
                itemId &&
                void adapter.depositInventory(businessId, itemId, parsedCount)
              }
            >
              Deposit
            </button>
            <button
              className="biomes-ui-tab"
              type="button"
              onClick={() =>
                itemId &&
                void adapter.withdrawInventory(businessId, itemId, parsedCount)
              }
            >
              Withdraw
            </button>
          </div>
          <div style={formRowStyle}>
            <input
              aria-label="Price Item"
              placeholder="Price Item"
              style={inputStyle}
              value={priceItemId}
              onChange={(event) => setPriceItemId(event.currentTarget.value)}
            />
            <input
              aria-label="Price Modifier"
              placeholder="Modifier"
              style={{ ...inputStyle, width: 104 }}
              value={priceModifier}
              onChange={(event) => setPriceModifier(event.currentTarget.value)}
            />
            <button
              className="biomes-ui-tab"
              type="button"
              onClick={() =>
                priceItemId &&
                void adapter.setPrices(businessId, {
                  [priceItemId]: Number(priceModifier) || 1,
                })
              }
            >
              Set Price
            </button>
          </div>
        </>
      ) : (
        <div style={formRowStyle}>
          <label style={labelInlineStyle}>
            Quantity
            <input
              aria-label="Purchase quantity"
              style={{ ...inputStyle, width: 86 }}
              value={count}
              onChange={(event) => setCount(event.currentTarget.value)}
            />
          </label>
        </div>
      )}
      <InventoryGrid
        inventory={shop.inventory}
        emptyLabel={shop.emptyLabel}
        actionLabel={mode === "customer" ? "Buy" : undefined}
        onActivate={
          mode === "customer"
            ? (item) =>
                void adapter.purchaseShopItem(
                  businessId,
                  item.itemId,
                  parsedCount
                )
            : undefined
        }
      />
    </section>
  );
};

const InventoryGrid: React.FunctionComponent<{
  inventory: HarthmereBusinessVisibleInventoryItemV1[];
  emptyLabel: string;
  actionLabel?: string;
  onActivate?: (item: HarthmereBusinessVisibleInventoryItemV1) => void;
}> = ({ inventory, emptyLabel, actionLabel, onActivate }) => {
  const inventoryRows = React.useMemo(() => chunk(inventory, 4), [inventory]);
  if (!inventory.length) return <p style={mutedTextStyle}>{emptyLabel}</p>;
  return (
    <RovingGrid
      ariaLabel="Business shopfront inventory"
      items={inventoryRows}
      onActivate={(_row, _col, item) => onActivate?.(item)}
      renderCell={(item, _coords, cell) => {
        const itemLabel = displayLabel(item.itemId);
        return (
          <button
            ref={cell.ref}
            tabIndex={cell.tabIndex}
            onFocus={cell.onFocus}
            onKeyDown={cell.onKeyDown}
            onClick={cell.onClick}
            className="biomes-ui-slot"
            style={{
              width: 150,
              minHeight: 96,
              padding: 8,
              flexDirection: "column",
              ...(actionLabel ? shopActionSlotStyle : {}),
            }}
            aria-label={`${actionLabel ? `${actionLabel} ` : ""}${itemLabel} x${
              item.count
            }`}
          >
            <strong style={{ fontSize: 12 }}>{itemLabel}</strong>
            <span style={mutedTextStyle}>
              x{item.count} · {item.priceGold} gold
            </span>
            {actionLabel && (
              <span style={buyActionTextStyle}>{actionLabel}</span>
            )}
          </button>
        );
      }}
    />
  );
};

const FinancePane: React.FunctionComponent<{
  adapter: HarthmereBusinessInterfaceAdapterV1;
  businessId: string;
}> = ({ adapter, businessId }) => {
  const panel = useMeasuredBusinessMemoV1(
    "finance-derive",
    () => adapter.getFinancePanel(businessId),
    [adapter, businessId],
    { businessId, tab: "finance" }
  );
  const [amount, setAmount] = React.useState("100");
  return (
    <div style={responsiveGridStyle}>
      <MetricCard
        label="Business Funds"
        value={`${panel.summary.balanceGold}`}
        hint={`Daily costs ${
          panel.summary.dailyUpkeepGold +
          panel.summary.dailyRentGold +
          panel.summary.dailyWagesGold
        }`}
      />
      <MetricCard
        label="Bank"
        value={`${panel.summary.bankBalanceGold}`}
        hint={`${panel.audit.length} audit events`}
      />
      <MetricCard
        label="Debt"
        value={`${panel.summary.debtGold}`}
        hint={`${panel.loans.length} loans · ${panel.insurancePolicies.length} policies`}
      />
      <section style={cardStyle}>
        <h3 style={sectionTitleStyle}>Banking</h3>
        <label style={labelStyle}>
          Gold amount
          <input
            style={inputStyle}
            value={amount}
            onChange={(event) => setAmount(event.currentTarget.value)}
          />
        </label>
        <div style={formRowStyle}>
          <button
            className="biomes-ui-tab"
            type="button"
            onClick={() => void adapter.createBankAccount(businessId)}
          >
            Create Account
          </button>
          <button
            className="biomes-ui-tab"
            type="button"
            onClick={() =>
              void adapter.transferPersonalToBusinessBank(
                businessId,
                Math.max(1, Number(amount) || 1)
              )
            }
          >
            Deposit
          </button>
          <button
            className="biomes-ui-tab"
            type="button"
            onClick={() =>
              void adapter.transferBusinessToPersonalBank(
                businessId,
                Math.max(1, Number(amount) || 1)
              )
            }
          >
            Withdraw
          </button>
        </div>
      </section>
    </div>
  );
};

const StaffPane: React.FunctionComponent<{
  adapter: HarthmereBusinessInterfaceAdapterV1;
  businessId: string;
}> = ({ adapter, businessId }) => {
  const panel = useMeasuredBusinessMemoV1(
    "staff-derive",
    () => adapter.getStaffPanel(businessId),
    [adapter, businessId],
    { businessId, tab: "staff" }
  );
  const [role, setRole] = React.useState("Worker");
  const [wage, setWage] = React.useState("12");
  const [assignedTask, setAssignedTask] = React.useState("front_counter");
  const [targetActorId, setTargetActorId] = React.useState("");
  const [permission, setPermission] = React.useState("employee_manager");
  return (
    <section style={cardStyle}>
      <h3 style={sectionTitleStyle}>Staff</h3>
      <div style={formRowStyle}>
        <input
          aria-label="Worker role"
          style={inputStyle}
          value={role}
          onChange={(event) => setRole(event.currentTarget.value)}
        />
        <input
          aria-label="Daily wage"
          style={{ ...inputStyle, width: 84 }}
          value={wage}
          onChange={(event) => setWage(event.currentTarget.value)}
        />
        <button
          className="biomes-ui-tab"
          type="button"
          onClick={() =>
            void adapter.hireWorker(
              businessId,
              role,
              Math.max(1, Number(wage) || 1)
            )
          }
        >
          Hire
        </button>
        <button
          className="biomes-ui-tab"
          type="button"
          onClick={() => void adapter.payPayroll(businessId)}
        >
          Pay Payroll
        </button>
        <button
          className="biomes-ui-tab"
          type="button"
          onClick={() => void adapter.refreshEmployeeCandidates(businessId, 3)}
        >
          Find Help
        </button>
      </div>
      <div style={formRowStyle}>
        <select
          aria-label="Assigned task"
          style={inputStyle}
          value={assignedTask}
          onChange={(event) => setAssignedTask(event.currentTarget.value)}
        >
          <option value="front_counter">Front Counter</option>
          <option value="stock_runner">Stock Runner</option>
          <option value="production_station">Production Station</option>
          <option value="quality_check">Quality Check</option>
          <option value="cleanup_route">Cleanup Route</option>
          <option value="dispatch_runner">Dispatch Runner</option>
          <option value="branch_manager">Branch Manager</option>
          <option value="rest_required">Rest Required</option>
        </select>
        <input
          aria-label="Permission target actor"
          placeholder="Player name"
          style={inputStyle}
          value={targetActorId}
          onChange={(event) => setTargetActorId(event.currentTarget.value)}
        />
        <select
          aria-label="Permission"
          style={inputStyle}
          value={permission}
          onChange={(event) => setPermission(event.currentTarget.value)}
        >
          <option value="employee_manager">Employee Manager</option>
          <option value="accountant">Accountant</option>
          <option value="inventory_manager">Inventory Manager</option>
          <option value="contract_manager">Contract Manager</option>
          <option value="price_manager">Price Manager</option>
          <option value="world_operator">World Operator</option>
          <option value="owner_admin">Owner Admin</option>
        </select>
        <button
          className="biomes-ui-tab"
          type="button"
          onClick={() =>
            targetActorId &&
            void adapter.grantPermission(businessId, targetActorId, [
              permission,
            ])
          }
        >
          Grant
        </button>
      </div>
      <p style={mutedTextStyle}>
        Payroll due: {panel.payrollDueGold} gold · Low morale:{" "}
        {panel.moraleWarnings.length}
      </p>
      {panel.employees.length ? (
        panel.employees.map((employee) => (
          <div key={employee.employeeId} style={rowCardStyle}>
            <div>
              <strong>{displayLabel(employee.role)}</strong>
              <p style={mutedTextStyle}>
                Skill {employee.skill} · Wage {employee.wageGoldPerDay}/day ·
                Morale {employee.morale} · Task{" "}
                {employee.assignedTask
                  ? displayLabel(employee.assignedTask)
                  : "Unassigned"}
              </p>
            </div>
            <div style={formRowStyle}>
              <button
                className="biomes-ui-tab"
                type="button"
                onClick={() =>
                  void adapter.assignWorker(
                    businessId,
                    employee.employeeId,
                    assignedTask
                  )
                }
              >
                Assign
              </button>
              <button
                className="biomes-ui-tab"
                type="button"
                onClick={() =>
                  void adapter.runEmployeeTask(
                    businessId,
                    employee.employeeId,
                    assignedTask
                  )
                }
              >
                Run Task
              </button>
              <button
                className="biomes-ui-tab"
                type="button"
                onClick={() =>
                  void adapter.trainWorker(businessId, employee.employeeId)
                }
              >
                Train
              </button>
              <button
                className="biomes-ui-tab"
                type="button"
                onClick={() =>
                  void adapter.promoteWorker(
                    businessId,
                    employee.employeeId,
                    assignedTask as any
                  )
                }
              >
                Promote
              </button>
              <button
                className="biomes-ui-tab"
                type="button"
                onClick={() =>
                  void adapter.fireWorker(businessId, employee.employeeId)
                }
              >
                Fire
              </button>
            </div>
          </div>
        ))
      ) : (
        <p style={mutedTextStyle}>No workers are assigned yet.</p>
      )}
      {panel.candidates.length ? (
        <>
          <h3 style={sectionTitleStyle}>Candidates</h3>
          {panel.candidates.map((candidate) => (
            <div key={candidate.candidateId} style={rowCardStyle}>
              <div>
                <strong>{candidate.displayName}</strong>
                <p style={mutedTextStyle}>
                  {displayLabel(candidate.role)} · Skill {candidate.skill} ·
                  Asks {candidate.wageAskGoldPerDay}/day ·{" "}
                  {displayLabel(candidate.status)}
                </p>
                <p style={mutedTextStyle}>
                  {displayLabel(candidate.personality)} ·{" "}
                  {displayLabel(candidate.schedule)} · Prefers{" "}
                  {displayLabel(candidate.workplacePreference)}
                </p>
              </div>
              <div style={formRowStyle}>
                <button
                  className="biomes-ui-tab"
                  type="button"
                  onClick={() =>
                    void adapter.interviewEmployeeCandidate(
                      businessId,
                      candidate.candidateId,
                      "friendly"
                    )
                  }
                >
                  Interview
                </button>
                <button
                  className="biomes-ui-tab"
                  type="button"
                  onClick={() =>
                    void adapter.negotiateEmployeeCandidate(
                      businessId,
                      candidate.candidateId,
                      candidate.wageAskGoldPerDay
                    )
                  }
                >
                  Offer
                </button>
                <button
                  className="biomes-ui-tab"
                  type="button"
                  onClick={() =>
                    void adapter.hireEmployeeCandidate(
                      businessId,
                      candidate.candidateId
                    )
                  }
                >
                  Hire
                </button>
              </div>
            </div>
          ))}
        </>
      ) : null}
      {panel.recentTaskRuns.length ? (
        <>
          <h3 style={sectionTitleStyle}>Recent Staff Actions</h3>
          {panel.recentTaskRuns.map((run) => (
            <div key={run.taskRunId} style={rowCardStyle}>
              <div>
                <strong>{displayLabel(run.taskKind)}</strong>
                <p style={mutedTextStyle}>
                  {displayLabel(run.status)} · Path {run.employeePath.length}{" "}
                  steps · Animation {displayLabel(run.animationFamily)}
                </p>
              </div>
            </div>
          ))}
        </>
      ) : null}
    </section>
  );
};

const EmpirePane: React.FunctionComponent<{
  adapter: HarthmereBusinessInterfaceAdapterV1;
  businessId: string;
}> = ({ adapter, businessId }) => {
  const { panel, staff, shop } = useMeasuredBusinessMemoV1(
    "empire-derive",
    () => ({
      panel: adapter.getEmpirePanel(businessId),
      staff: adapter.getStaffPanel(businessId).employees,
      shop: adapter.getShopfront(businessId),
    }),
    [adapter, businessId],
    { businessId, tab: "empire" }
  );
  const [routeItemId, setRouteItemId] = React.useState(
    shop.inventory[0]?.itemId ?? ""
  );
  const [routeCount, setRouteCount] = React.useState("1");
  const firstBranch =
    panel.branches.find((branch) => branch.status === "active") ??
    panel.branches[0];
  const firstEmployee = staff[0];
  const branchDashboard = firstBranch
    ? panel.dashboards.find(
        (dashboard) => dashboard.branchId === firstBranch.branchId
      )
    : undefined;
  return (
    <div style={responsiveGridStyle}>
      <MetricCard
        label="Branches"
        value={`${panel.branches.length}`}
        hint={`${panel.outpostBuildings.length} branch sites available`}
      />
      <MetricCard
        label="Daily Branch Revenue"
        value={`${panel.dailyRevenueGold}`}
        hint={`Upkeep ${panel.dailyUpkeepGold}`}
      />
      <MetricCard
        label="Branch Profit"
        value={`${panel.lifetimeProfitGold}`}
        hint={`${panel.automations.length} automations assigned`}
      />
      <section style={cardStyle}>
        <h3 style={sectionTitleStyle}>Empire Controls</h3>
        <div style={formRowStyle}>
          <button
            className="biomes-ui-tab"
            type="button"
            disabled={!panel.openBranchEligible}
            onClick={() =>
              void adapter.openBranch(
                businessId,
                panel.outpostBuildings[0]?.outpostId
              )
            }
            style={!panel.openBranchEligible ? disabledButtonStyle : undefined}
          >
            Open Branch
          </button>
          <button
            className="biomes-ui-tab"
            type="button"
            disabled={!firstBranch}
            onClick={() =>
              firstBranch &&
              void adapter.assignAutomation(
                businessId,
                "branch_manager",
                firstBranch.branchId
              )
            }
            style={!firstBranch ? disabledButtonStyle : undefined}
          >
            Assign Manager
          </button>
          <button
            className="biomes-ui-tab"
            type="button"
            disabled={!panel.branches.length}
            onClick={() => void adapter.settleEmpireDay(businessId, 1)}
            style={!panel.branches.length ? disabledButtonStyle : undefined}
          >
            Collect Day
          </button>
        </div>
        <div style={formRowStyle}>
          <button
            className="biomes-ui-tab"
            type="button"
            disabled={!firstBranch || !firstEmployee}
            onClick={() =>
              firstBranch &&
              firstEmployee &&
              void adapter.assignBranchManager(
                businessId,
                firstBranch.branchId,
                firstEmployee.employeeId
              )
            }
            style={
              !firstBranch || !firstEmployee ? disabledButtonStyle : undefined
            }
          >
            Set Regional Manager
          </button>
          <button
            className="biomes-ui-tab"
            type="button"
            disabled={!firstBranch || !staff.length}
            onClick={() =>
              firstBranch &&
              void adapter.scheduleBranchStaff(
                businessId,
                firstBranch.branchId,
                staff
                  .slice(0, firstBranch.staffSlots)
                  .map((employee) => employee.employeeId)
              )
            }
            style={
              !firstBranch || !staff.length ? disabledButtonStyle : undefined
            }
          >
            Schedule Staff
          </button>
          <button
            className="biomes-ui-tab"
            type="button"
            disabled={!firstBranch}
            onClick={() =>
              firstBranch &&
              void adapter.closeBranch(businessId, firstBranch.branchId)
            }
            style={!firstBranch ? disabledButtonStyle : undefined}
          >
            Close Branch
          </button>
        </div>
        <div style={formRowStyle}>
          <input
            aria-label="Route stock item"
            placeholder="Stock item"
            style={inputStyle}
            value={routeItemId}
            onChange={(event) => setRouteItemId(event.currentTarget.value)}
          />
          <input
            aria-label="Route stock count"
            placeholder="Count"
            style={{ ...inputStyle, width: 88 }}
            value={routeCount}
            onChange={(event) => setRouteCount(event.currentTarget.value)}
          />
          <button
            className="biomes-ui-tab"
            type="button"
            disabled={!firstBranch || !routeItemId}
            onClick={() =>
              firstBranch &&
              routeItemId &&
              void adapter.routeBranchStock(
                businessId,
                firstBranch.branchId,
                routeItemId,
                Math.max(1, Number(routeCount) || 1)
              )
            }
            style={
              !firstBranch || !routeItemId ? disabledButtonStyle : undefined
            }
          >
            Route Stock
          </button>
        </div>
        {panel.warnings.length ? (
          panel.warnings.map((warning) => (
            <p key={warning} style={mutedTextStyle}>
              {formatHarthmereBusinessPlayerWarningV1(warning)}
            </p>
          ))
        ) : (
          <p style={mutedTextStyle}>
            Branches, staff automation, and profit routing are ready.
          </p>
        )}
      </section>
      <section style={cardStyle}>
        <h3 style={sectionTitleStyle}>Branches</h3>
        {panel.branches.length ? (
          panel.branches.map((branch) => (
            <div key={branch.branchId} style={rowCardStyle}>
              <div>
                <strong>{displayLabel(branch.outpostId)}</strong>
                <p style={mutedTextStyle}>
                  {displayLabel(branch.status)} · Revenue{" "}
                  {branch.dailyRevenueGold} · Upkeep {branch.dailyUpkeepGold} ·
                  Queue +{branch.queueCapacityBonus}
                </p>
                <p style={mutedTextStyle}>
                  Warehouse{" "}
                  {Object.values(branch.warehouseInventory ?? {}).reduce(
                    (sum, count) => sum + count,
                    0
                  )}
                  /{branch.warehouseSlots ?? 0} · Staff{" "}
                  {(branch.scheduledStaffIds ?? []).length}/{branch.staffSlots}{" "}
                  · Demand{" "}
                  {Math.round((branch.regionalDemandMultiplier ?? 1) * 100)}% ·
                  Pressure {branch.competitorPressure ?? 0}
                </p>
              </div>
            </div>
          ))
        ) : (
          <p style={mutedTextStyle}>No branches are open yet.</p>
        )}
      </section>
      <section style={cardStyle}>
        <h3 style={sectionTitleStyle}>Branch Dashboard</h3>
        {branchDashboard ? (
          <div style={rowCardStyle}>
            <div>
              <strong>{branchDashboard.dailyProfitGold} gold today</strong>
              <p style={mutedTextStyle}>
                Stock {branchDashboard.stockUnits} · Staff{" "}
                {Math.round(branchDashboard.staffCoverage * 100)}% · Demand{" "}
                {Math.round(branchDashboard.demandMultiplier * 100)}% · Pressure{" "}
                {branchDashboard.competitorPressure}
              </p>
              <p style={mutedTextStyle}>{branchDashboard.alerts.join(" · ")}</p>
            </div>
          </div>
        ) : (
          <p style={mutedTextStyle}>
            Collect a branch day to create the first dashboard.
          </p>
        )}
      </section>
      <section style={cardStyle}>
        <h3 style={sectionTitleStyle}>Automation</h3>
        {panel.automations.length ? (
          panel.automations.map((automation) => (
            <div key={automation.automationId} style={rowCardStyle}>
              <div>
                <strong>{displayLabel(automation.role)}</strong>
                <p style={mutedTextStyle}>
                  Level {automation.level} · Capacity +
                  {automation.serviceCapacityBonus} · Profit{" "}
                  {automation.passiveProfitGoldPerDay}/day · Upkeep{" "}
                  {automation.dailyUpkeepGold}/day
                </p>
              </div>
            </div>
          ))
        ) : (
          <p style={mutedTextStyle}>No branch automation is assigned yet.</p>
        )}
      </section>
    </div>
  );
};

const CompliancePane: React.FunctionComponent<{
  adapter: HarthmereBusinessInterfaceAdapterV1;
  businessId: string;
}> = ({ adapter, businessId }) => {
  const panel = useMeasuredBusinessMemoV1(
    "compliance-derive",
    () => adapter.getCompliancePanel(businessId),
    [adapter, businessId],
    { businessId, tab: "licenses" }
  );
  return (
    <div style={responsiveGridStyle}>
      <MetricCard
        label="License"
        value={`${displayLabel(panel.licenseClass)} ${panel.licenseLevel}`}
        hint={`Required ${
          panel.requiredLicense ? displayLabel(panel.requiredLicense) : "None"
        } level ${panel.minimumLicenseLevel ?? 0}`}
      />
      <MetricCard
        label="Safety"
        value={`${panel.safetyRating}`}
        hint="inspection rating"
      />
      <MetricCard
        label="Sanitation"
        value={`${panel.sanitationRating}`}
        hint="inspection rating"
      />
      <section style={cardStyle}>
        <h3 style={sectionTitleStyle}>Warnings</h3>
        {panel.warnings.length ? (
          panel.warnings.map((warning) => (
            <p key={warning} style={mutedTextStyle}>
              {formatHarthmereBusinessPlayerWarningV1(warning)}
            </p>
          ))
        ) : (
          <p style={mutedTextStyle}>No current compliance warnings.</p>
        )}
      </section>
    </div>
  );
};

const OperationsPane: React.FunctionComponent<{
  adapter: HarthmereBusinessInterfaceAdapterV1;
  businessId: string;
  mode: HarthmereBusinessActorModeV1;
}> = ({ adapter, businessId, mode }) => {
  const screen = useMeasuredBusinessMemoV1(
    "operations-derive",
    () => adapter.getOperationScreen(businessId),
    [adapter, businessId],
    { businessId, tab: mode === "owner" ? "operations" : "services" }
  );
  const actions =
    mode === "owner" ? screen.ownerActions : screen.customerActions;
  const actionRows = React.useMemo(() => chunk(actions, 3), [actions]);
  return (
    <section style={cardStyle}>
      <h3 style={sectionTitleStyle}>{screen.title} Operations</h3>
      {actions.length ? (
        <RovingGrid
          ariaLabel="Business operation actions"
          items={actionRows}
          onActivate={(_row, _col, action) =>
            mode === "owner"
              ? void adapter.runServiceAction(businessId, action.actionId)
              : void adapter.requestCustomerService(businessId, action.actionId)
          }
          renderCell={(action, _coords, cell) => (
            <button
              ref={cell.ref}
              tabIndex={cell.tabIndex}
              onFocus={cell.onFocus}
              onKeyDown={cell.onKeyDown}
              onClick={cell.onClick}
              className="biomes-ui-tab"
              style={serviceButtonStyle}
              aria-label={action.label}
            >
              <strong>{action.label}</strong>
              <span style={mutedTextStyle}>{action.description}</span>
            </button>
          )}
        />
      ) : (
        <p style={mutedTextStyle}>
          No actions are available for this business type.
        </p>
      )}
      <div style={{ marginTop: 12 }}>
        <h3 style={sectionTitleStyle}>World Records</h3>
        <p style={mutedTextStyle}>
          {Object.entries(screen.systemRecords)
            .filter(([, rows]) => (rows as unknown[]).length > 0)
            .map(
              ([name, rows]) =>
                `${displayLabel(name)}: ${(rows as unknown[]).length}`
            )
            .join(" · ") || "No linked world records yet."}
        </p>
      </div>
    </section>
  );
};

const CustomerStatusPane: React.FunctionComponent<{
  adapter: HarthmereBusinessInterfaceAdapterV1;
  businessId: string;
}> = ({ adapter, businessId }) => {
  const { orders, business, miniGame } = useMeasuredBusinessMemoV1(
    "customer-status-derive",
    () => ({
      orders: adapter.getCustomerOrders(businessId),
      business: adapter.getBusiness(businessId),
      miniGame: adapter.getCustomerMiniGame(businessId),
    }),
    [adapter, businessId],
    { businessId, tab: "status" }
  );
  const activeCount = orders.filter(
    (order) => order.status === "active"
  ).length;
  return (
    <div style={responsiveGridStyle}>
      <MetricCard
        label="Requests"
        value={`${orders.length}`}
        hint={`${activeCount} active`}
      />
      <MetricCard
        label="Business Trust"
        value={`${business?.customerSatisfaction ?? 0}/100`}
        hint={`Reputation ${business?.reputation ?? 0}`}
      />
      <section style={cardStyle}>
        <h3 style={sectionTitleStyle}>Next Step</h3>
        <p style={mutedTextStyle}>
          {orders.length
            ? "Track accepted work here until the owner fulfills it."
            : `Use Services to request work from this business. ${miniGame.definition.customerGoal}`}
        </p>
      </section>
      <ContractList title="Your Requests" contracts={orders} />
    </div>
  );
};

const TownHallPane: React.FunctionComponent<{
  adapter: HarthmereBusinessInterfaceAdapterV1;
}> = ({ adapter }) => {
  const panel = useMeasuredBusinessMemoV1(
    "town-hall-derive",
    () => adapter.getTownHallPanel(),
    [adapter],
    { tab: "town" }
  );
  return (
    <div style={responsiveGridStyle}>
      <MetricCard
        label="Towns"
        value={`${panel.towns.length}`}
        hint="tracked public economies"
      />
      <MetricCard
        label="Public Contracts"
        value={`${panel.publicContracts.length}`}
        hint="town or civic contracts"
      />
      <MetricCard
        label="Town Businesses"
        value={`${panel.townBusinesses.length}`}
        hint="public utilities and services"
      />
    </div>
  );
};

const MarketplacePane: React.FunctionComponent<{
  adapter: HarthmereBusinessInterfaceAdapterV1;
}> = ({ adapter }) => {
  const panel = useMeasuredBusinessMemoV1(
    "marketplace-derive",
    () => adapter.getMarketplacePanel(),
    [adapter],
    { tab: "market" }
  );
  return (
    <section style={cardStyle}>
      <h3 style={sectionTitleStyle}>Marketplace</h3>
      <p style={mutedTextStyle}>
        {panel.openOrders.length} open orders ·{" "}
        {Object.keys(panel.regionalPrices).length} regional prices
      </p>
      {panel.openOrders.slice(0, 8).map((order: any) => (
        <div key={order.orderId} style={rowCardStyle}>
          <div>
            <strong>{displayLabel(order.itemId)}</strong>
            <p style={mutedTextStyle}>
              {displayLabel(order.kind)} · x{order.count} ·{" "}
              {order.unitPriceGold} gold
            </p>
          </div>
        </div>
      ))}
    </section>
  );
};

const GuildBusinessPane: React.FunctionComponent<{
  adapter: HarthmereBusinessInterfaceAdapterV1;
  guildId?: string;
}> = ({ adapter, guildId }) => {
  const panel = useMeasuredBusinessMemoV1(
    "guild-business-derive",
    () => adapter.getGuildBusinessPanel(guildId),
    [adapter, guildId],
    { tab: "guild" }
  );
  const permissionCount = Object.values(panel.permissions).reduce(
    (sum, permissions) => sum + permissions.length,
    0
  );
  return (
    <div style={responsiveGridStyle}>
      <MetricCard
        label="Guild Businesses"
        value={`${panel.guildBusinesses.length}`}
        hint="shared ownership records"
      />
      <MetricCard
        label="Guild Contracts"
        value={`${panel.guildContracts.length}`}
        hint="shared work and civic obligations"
      />
      <MetricCard
        label="Your Permissions"
        value={`${permissionCount}`}
        hint="roles granted to this actor"
      />
      <section style={cardStyle}>
        <h3 style={sectionTitleStyle}>Guild Businesses</h3>
        {panel.guildBusinesses.length ? (
          panel.guildBusinesses.map((business) => (
            <div key={business.businessId} style={rowCardStyle}>
              <div>
                <strong>{business.name}</strong>
                <p style={mutedTextStyle}>
                  {displayLabel(business.typeId)} · Permissions{" "}
                  {(panel.permissions[business.businessId] ?? [])
                    .map(displayLabel)
                    .join(", ") || "None"}
                </p>
              </div>
            </div>
          ))
        ) : (
          <p style={mutedTextStyle}>
            No guild-owned businesses are available to this actor yet. Start or
            join a guild business to share staff, contracts, and branch work.
          </p>
        )}
      </section>
      <ContractList title="Guild Contracts" contracts={panel.guildContracts} />
    </div>
  );
};

const MetricCard: React.FunctionComponent<{
  label: string;
  value: string;
  hint: string;
}> = ({ label, value, hint }) => (
  <section style={metricCardStyle}>
    <h3 style={sectionTitleStyle}>{label}</h3>
    <strong style={{ display: "block", fontSize: 22, marginBottom: 4 }}>
      {value}
    </strong>
    <p style={mutedTextStyle}>{hint}</p>
  </section>
);

const panelTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 22,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--biomes-fg)",
};
const sectionTitleStyle: React.CSSProperties = {
  margin: "0 0 8px",
  fontSize: 11,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "var(--biomes-fg-muted)",
};
const mutedTextStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: "var(--biomes-fg-muted)",
  lineHeight: 1.45,
};
const cardStyle: React.CSSProperties = {
  padding: 12,
  background: "var(--biomes-bg-glass)",
  border: "1px solid var(--biomes-edge-cyan-soft)",
  borderRadius: 4,
};
const metricCardStyle: React.CSSProperties = {
  ...cardStyle,
  minHeight: 92,
  boxSizing: "border-box",
};
const highlightCardStyle: React.CSSProperties = {
  ...cardStyle,
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: 12,
  alignItems: "center",
  background:
    "linear-gradient(135deg, rgba(70, 104, 139, 0.28), rgba(17, 23, 34, 0.92))",
  borderColor: "rgba(154, 199, 230, 0.42)",
  minHeight: 108,
  boxSizing: "border-box",
};
const heroMetricStyle: React.CSSProperties = {
  display: "block",
  fontSize: 24,
  marginBottom: 4,
  color: "var(--biomes-fg)",
};
const rowCardStyle: React.CSSProperties = {
  ...cardStyle,
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: 10,
  alignItems: "center",
  marginTop: 8,
};
const bikkieGraphicRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "42px minmax(0, 1fr) auto",
  gap: 8,
  alignItems: "start",
  padding: "8px 0",
  borderTop: "1px solid rgba(154, 199, 230, 0.18)",
};
const bikkieGraphicKindStyle: React.CSSProperties = {
  fontSize: 10,
  color: "var(--biomes-fg)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  whiteSpace: "nowrap",
};
const responsiveGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
  alignItems: "start",
};
const inputStyle: React.CSSProperties = {
  minWidth: 0,
  padding: "7px 9px",
  color: "var(--biomes-fg)",
  background: "var(--biomes-bg-deep)",
  border: "1px solid var(--biomes-edge-cyan-soft)",
  borderRadius: 4,
};
const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
  marginBottom: 8,
  fontSize: 11,
  color: "var(--biomes-fg-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.12em",
};
const labelInlineStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  fontSize: 11,
  color: "var(--biomes-fg-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.12em",
};
const formRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginBottom: 12,
};
const actionTextStyle: React.CSSProperties = {
  marginTop: 2,
  fontSize: 11,
  color: "var(--biomes-fg)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};
const buyActionTextStyle: React.CSSProperties = {
  ...actionTextStyle,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 24,
  alignSelf: "stretch",
  borderRadius: 4,
  color: "#07101a",
  background: "linear-gradient(180deg, #92ffd7 0%, #37dba4 54%, #1aa979 100%)",
  boxShadow: "0 0 14px rgba(55, 219, 164, 0.46)",
  fontWeight: 900,
};
const disabledButtonStyle: React.CSSProperties = {
  opacity: 0.55,
  cursor: "not-allowed",
};
const startShiftButtonStyle: React.CSSProperties = {
  color: "#06111f",
  background: "linear-gradient(180deg, #fff477 0%, #ffd23f 48%, #ff9f2f 100%)",
  border: "1px solid rgba(255, 246, 142, 0.95)",
  boxShadow:
    "0 0 0 1px rgba(255, 255, 255, 0.28) inset, 0 0 18px rgba(255, 210, 63, 0.72), 0 0 34px rgba(255, 156, 47, 0.42)",
  textShadow: "0 1px 0 rgba(255, 255, 255, 0.55)",
  fontWeight: 800,
};
const serviceButtonStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  justifyContent: "flex-start",
  gap: 6,
  width: "100%",
  minWidth: 0,
  minHeight: 96,
  whiteSpace: "normal",
  textAlign: "left",
  border: "1px solid rgba(145, 224, 255, 0.7)",
  background:
    "linear-gradient(180deg, rgba(39, 70, 104, 0.72), rgba(12, 22, 42, 0.96))",
  borderRadius: 4,
  textTransform: "none",
  letterSpacing: 0,
  boxShadow:
    "0 8px 20px rgba(0, 0, 0, 0.24), 0 0 16px rgba(84, 184, 255, 0.18)",
};
const shopActionSlotStyle: React.CSSProperties = {
  borderColor: "rgba(97, 244, 188, 0.82)",
  background:
    "linear-gradient(180deg, rgba(24, 61, 58, 0.96), rgba(9, 23, 35, 0.98))",
  boxShadow: "0 0 18px rgba(55, 219, 164, 0.28)",
};
const miniGameArenaStyle: React.CSSProperties = {
  ...highlightCardStyle,
  gridTemplateColumns: "1fr",
  overflow: "hidden",
  position: "relative",
};
const miniGameHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
};
const miniGameTitleStyle: React.CSSProperties = {
  display: "block",
  fontSize: 20,
  color: "var(--biomes-fg)",
  lineHeight: 1.1,
};
const miniGameBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 24,
  padding: "0 9px",
  borderRadius: 999,
  color: "#06111f",
  background: "linear-gradient(180deg, #92ffd7, #37dba4)",
  fontSize: 10,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  whiteSpace: "nowrap",
};
const progressTrackStyle: React.CSSProperties = {
  position: "relative",
  height: 10,
  marginTop: 12,
  overflow: "hidden",
  borderRadius: 999,
  background: "rgba(7, 13, 26, 0.72)",
  border: "1px solid rgba(154, 199, 230, 0.22)",
};
const progressFillStyle: React.CSSProperties = {
  height: "100%",
  minWidth: 8,
  borderRadius: 999,
  background: "linear-gradient(90deg, #56c7ff, #92ffd7)",
};
const progressSweepStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "35%",
  background:
    "linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.42), transparent)",
  animation: "harthmere-business-meter-v1 1.35s linear infinite",
};
const customerStageStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "38px minmax(0, 1fr)",
  gap: 10,
  alignItems: "center",
  padding: 10,
  border: "1px solid rgba(154, 199, 230, 0.28)",
  borderRadius: 4,
  background: "rgba(5, 12, 26, 0.42)",
};
const customerAvatarStyle: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 999,
  background:
    "radial-gradient(circle at 35% 30%, #fff477 0 16%, #ff9f2f 17% 38%, #56c7ff 39% 62%, #152342 63%)",
  boxShadow: "0 0 16px rgba(255, 210, 63, 0.46)",
  animation: "harthmere-business-pulse-v1 1.25s ease-in-out infinite",
};
const businessPendingOverlayStyle: React.CSSProperties = {
  position: "sticky",
  bottom: 8,
  zIndex: 2,
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  marginTop: 12,
  padding: "8px 12px",
  border: "1px solid var(--biomes-edge-cyan-soft)",
  borderRadius: 999,
  background: "rgba(8, 14, 32, 0.94)",
  color: "var(--biomes-fg)",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 0,
  boxShadow: "0 10px 24px rgba(0, 0, 0, 0.35)",
};
const businessPendingSpinnerStyle: React.CSSProperties = {
  width: 14,
  height: 14,
  border: "2px solid rgba(232, 244, 255, 0.28)",
  borderTopColor: "var(--biomes-fg)",
  borderRadius: 999,
  animation: "harthmere-business-pending-spin-v1 780ms linear infinite",
};
