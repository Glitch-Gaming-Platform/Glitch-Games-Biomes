import * as React from "react";
import { usePointerLockManager } from "../contexts/PointerLockContext";
import { purchaseHarthmereBusinessTool } from "@/client/components/challenges/LocalDevHarthmereInventorySystem";
import {
  closePointerLockUnlockWhileOpen,
  openPointerLockUnlockWhileOpen,
  type PointerLockUnlockWhileOpenReturnRef,
} from "../contexts/pointerLockModalPolicy";
import { ClientContextReactContext } from "../contexts/ClientContextReactContext";
import { installBiomesUITheme } from "../biomes_ui/theme/biomesUITheme";
import { RovingGrid } from "../biomes_ui/nav/RovingGrid";
import {
  harthmereBikkieVisualGlyphStyle,
  harthmereBikkieVisualImageStyle,
  harthmereBikkieVisualImageUrl,
  harthmereBikkieVisualTileStyle,
} from "../biomes_ui/adapters/harthmereBikkieVisualRendering";
import type { HarthmereResolvedBikkieVisual } from "@/shared/harthmere/bikkie_visual_resolver";
import { createHarthmereBusinessMiniGameDecisionForOffer } from "@/shared/harthmere/business_customer_simulator";
import type {
  HarthmereBusinessActorMode,
  HarthmereBusinessBikkieGraphic,
  HarthmereBusinessContract,
  HarthmereBusinessInterfaceAdapter,
  HarthmereBusinessVisibleInventoryItem,
  HarthmereBusinessWorldContext,
} from "./businessInterfaceLiveAdapter";
import {
  formatHarthmereBusinessPlayerWarning,
  harthmereBusinessServicePriceGold,
} from "./businessInterfaceLiveAdapter";
import { businessCheckInDisplayModel } from "./businessDailyCheckInClient";
import {
  harthmereBusinessCustomerPlayerMeshAvatar,
  type HarthmereBusinessCustomerPlayerMeshAvatar,
} from "./businessMiniGameFaces";
import { HARTHMERE_BUSINESS_TAB_LABELS } from "./harthmereBusinessTabs";
import { MathUtils, Spherical, Vector3 } from "three";

type CharacterPreviewModule = typeof import("../character/CharacterPreview");

export interface HarthmereBusinessInterfacePanelProps {
  adapter: HarthmereBusinessInterfaceAdapter;
  nearbyBusinessId?: string | null;
  context?: HarthmereBusinessWorldContext;
  onClose?: () => void;
  compact?: boolean;
  initialTab?: HarthmereBusinessInterfacePanelTab;
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
export type HarthmereBusinessInterfacePanelTab = PanelTab;

type HarthmereBusinessRenderProfileEntry = {
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
    __HARTHMERE_BUSINESS_RENDER_PROFILE__?: {
      entries: HarthmereBusinessRenderProfileEntry[];
      clear: () => void;
      slowest: (limit?: number) => HarthmereBusinessRenderProfileEntry[];
    };
  }
}

type ShopfrontMerchKind =
  | "tool"
  | "block"
  | "interior"
  | "recipe_book"
  | "stock";

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
// Labels live in a pure, unit-tested module (harthmereBusinessTabs).
const TAB_LABELS: Record<string, string> = HARTHMERE_BUSINESS_TAB_LABELS;

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

function playerFacingBusinessName(
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

function installHarthmereBusinessPendingStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById("harthmere-business-pending-styles")) return;
  const style = document.createElement("style");
  style.id = "harthmere-business-pending-styles";
  style.textContent = [
    "@keyframes harthmere-business-pending-spin { to { transform: rotate(360deg); } }",
    "@keyframes harthmere-business-meter { 0% { transform: translateX(-100%); } 100% { transform: translateX(280%); } }",
    "@keyframes harthmere-business-pulse { 0%, 100% { opacity: .58; transform: scale(.96); } 50% { opacity: 1; transform: scale(1.04); } }",
    "@keyframes harthmere-business-toast { 0% { opacity: 0; transform: translateY(8px) scale(.98); } 100% { opacity: 1; transform: none; } }",
    "@keyframes harthmere-business-urgent { 0%, 100% { opacity: 1; } 50% { opacity: .45; } }",
    "@keyframes harthmere-business-rise { 0% { opacity: 0; transform: translateY(6px); } 100% { opacity: 1; transform: none; } }",
    ".harthmere-business-customer-mesh-avatar, .harthmere-business-customer-mesh-avatar .three-object-preview-wrapper { width: 100%; height: 100%; min-height: 60px; overflow: hidden; }",
    ".harthmere-business-customer-mesh-avatar canvas { width: 100% !important; height: 100% !important; }",
  ].join("\n");
  document.head.appendChild(style);
}

function harthmereBusinessPerfNow() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function harthmereBusinessPerfShouldLog(entry: {
  kind: HarthmereBusinessRenderProfileEntry["kind"];
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

function recordHarthmereBusinessRenderProfile(
  entry: Omit<HarthmereBusinessRenderProfileEntry, "atMs">
) {
  if (typeof window === "undefined") return;
  const profiler =
    window.__HARTHMERE_BUSINESS_RENDER_PROFILE__ ??
    (window.__HARTHMERE_BUSINESS_RENDER_PROFILE__ = {
      entries: [],
      clear: () => {
        window.__HARTHMERE_BUSINESS_RENDER_PROFILE__?.entries.splice(0);
      },
      slowest: (limit = 20) =>
        [...(window.__HARTHMERE_BUSINESS_RENDER_PROFILE__?.entries ?? [])]
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
  if (harthmereBusinessPerfShouldLog(fullEntry)) {
    console.info("[HarthmereBusinessPerf]", fullEntry);
  }
}

function useMeasuredBusinessMemo<T>(
  label: string,
  factory: () => T,
  deps: React.DependencyList,
  details?: Omit<
    HarthmereBusinessRenderProfileEntry,
    "atMs" | "durationMs" | "kind" | "label"
  >
): T {
  return React.useMemo(() => {
    const start = harthmereBusinessPerfNow();
    const value = factory();
    recordHarthmereBusinessRenderProfile({
      kind: "derive",
      label,
      durationMs: harthmereBusinessPerfNow() - start,
      ...details,
    });
    return value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

function useHarthmereBusinessLongTaskObserver(
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
          recordHarthmereBusinessRenderProfile({
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

const BUSINESS_BACKEND_MUTATION_METHODS = new Set<string>([
  "submitOperation",
  "createBankAccount",
  "transferPersonalToBusinessBank",
  "transferBusinessToPersonalBank",
  "depositInventory",
  "withdrawInventory",
  "setPrices",
  "openBusiness",
  "hireWorker",
  "assignWorker",
  "fireWorker",
  "trainWorker",
  "promoteWorker",
  "payPayroll",
  "checkInDaily",
  "refreshEmployeeCandidates",
  "interviewEmployeeCandidate",
  "negotiateEmployeeCandidate",
  "hireEmployeeCandidate",
  "runEmployeeTask",
  "runEmployeeMoraleTick",
  "acceptContract",
  "fulfillContract",
  "grantPermission",
  "purchaseShopItem",
  "buyStorefrontGood",
  "runServiceAction",
  "requestCustomerService",
  "startCustomerSession",
  "serveCustomer",
  "openBranch",
  "assignAutomation",
  "assignBranchManager",
  "routeBranchStock",
  "scheduleBranchStaff",
  "closeBranch",
  "settleEmpireDay",
]);

const BUSINESS_BACKEND_REQUEST_SKIPPED = Symbol(
  "harthmere_business_backend_request_skipped"
);

function isBusinessBackendRequestSkipped(value: unknown): boolean {
  return value === BUSINESS_BACKEND_REQUEST_SKIPPED;
}

const BusinessBackendPendingContext = React.createContext(false);

function useBusinessBackendPending(): boolean {
  return React.useContext(BusinessBackendPendingContext);
}

function usePendingBusinessAdapter(
  adapter: HarthmereBusinessInterfaceAdapter
): {
  adapter: HarthmereBusinessInterfaceAdapter;
  pending: boolean;
} {
  const [pendingCount, setPendingCount] = React.useState(0);
  const pendingRef = React.useRef(false);
  const wrapped = React.useMemo(
    () =>
      new Proxy(adapter as any, {
        get(target, prop, receiver) {
          const value = Reflect.get(target, prop, receiver);
          if (typeof value !== "function") return value;
          return (...args: unknown[]) => {
            if (!BUSINESS_BACKEND_MUTATION_METHODS.has(String(prop))) {
              return value.apply(target, args);
            }
            if (pendingRef.current) {
              return Promise.resolve(BUSINESS_BACKEND_REQUEST_SKIPPED);
            }
            pendingRef.current = true;
            setPendingCount((count) => count + 1);
            const release = () => {
              pendingRef.current = false;
              setPendingCount((count) => Math.max(0, count - 1));
            };
            try {
              const result = value.apply(target, args);
              if (!result || typeof result.then !== "function") {
                release();
                return result;
              }
              return result.finally(release);
            } catch (error) {
              release();
              throw error;
            }
          };
        },
      }) as HarthmereBusinessInterfaceAdapter,
    [adapter]
  );
  return { adapter: wrapped, pending: pendingCount > 0 };
}

const BikkieVisualTileForVisual: React.FunctionComponent<{
  visual: HarthmereResolvedBikkieVisual;
  size?: number;
  dataTestId?: string;
}> = ({ visual, size, dataTestId }) => {
  const imageUrl = harthmereBikkieVisualImageUrl(visual);
  return (
    <span
      aria-label={visual.ariaLabel}
      title={visual.metadataSummary}
      style={harthmereBikkieVisualTileStyle(visual, size)}
      data-testid={dataTestId}
      data-bikkie-visual="true"
      data-visual-source={visual.source}
      data-visual-kind={visual.shape}
      data-visual-id={visual.visualId}
      data-icon-asset-path={visual.iconAssetPath}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          aria-hidden="true"
          style={harthmereBikkieVisualImageStyle}
          data-bikkie-visual-img="true"
        />
      ) : null}
      <span style={harthmereBikkieVisualGlyphStyle}>{visual.glyph}</span>
    </span>
  );
};

const BikkieVisualTile: React.FunctionComponent<{
  graphic: HarthmereBusinessBikkieGraphic;
}> = ({ graphic }) => <BikkieVisualTileForVisual visual={graphic.visual} />;

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
    React.useRef<PointerLockUnlockWhileOpenReturnRef>({ current: false });
  const { adapter: businessAdapter, pending: backendPending } =
    usePendingBusinessAdapter(adapter);
  const activeBusinessId =
    nearbyBusinessId ?? context?.nearbyBusinessId ?? null;
  const available =
    businessAdapter.isHydrated() &&
    businessAdapter.isAvailable(activeBusinessId);
  const business = activeBusinessId
    ? businessAdapter.getBusiness(activeBusinessId)
    : undefined;
  const mode: HarthmereBusinessActorMode =
    business && activeBusinessId
      ? businessAdapter.getMode(activeBusinessId)
      : "customer";
  const tabs: PanelTab[] = mode === "owner" ? OWNER_TABS : CUSTOMER_TABS;
  const [activeTab, setActiveTab] = React.useState<PanelTab>(
    initialTab && tabs.includes(initialTab) ? initialTab : tabs[0]
  );

  React.useEffect(() => {
    installBiomesUITheme();
    installHarthmereBusinessPendingStyles();
  }, []);
  React.useEffect(() => {
    if (!available || compact) return;
    openPointerLockUnlockWhileOpen(
      pointerLockManager,
      shouldReturnPointerLock.current
    );
    return () => {
      closePointerLockUnlockWhileOpen(
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
  useHarthmereBusinessLongTaskObserver(
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
      recordHarthmereBusinessRenderProfile({
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
  const businessDisplayName = playerFacingBusinessName(
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
    <BusinessBackendPendingContext.Provider value={backendPending}>
      <div
        role="dialog"
        aria-label={`${businessDisplayName} business interface`}
        data-harthmere-business-interface="true"
        data-business-interface-scope="inside-business-only"
        data-pointer-lock-policy="unlock-while-open"
        data-mouse-policy="show-while-open"
        data-business-id={activeBusinessId}
        data-business-mode={mode}
        data-business-backend-pending={backendPending ? "true" : "false"}
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
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 4,
            marginBottom: 12,
          }}
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
    </BusinessBackendPendingContext.Provider>
  );
};

const BikkieGraphicsStrip: React.FunctionComponent<{
  graphics: readonly HarthmereBusinessBikkieGraphic[];
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
        <p style={mutedTextStyle}>No service fixtures set up yet.</p>
      )}
    </section>
  );
};

const OwnerDashboardPane: React.FunctionComponent<{
  adapter: HarthmereBusinessInterfaceAdapter;
  businessId: string;
}> = ({ adapter, businessId }) => {
  const backendPending = useBusinessBackendPending();
  const {
    dashboard,
    report,
    quests,
    miniGame,
    business,
    type,
    bikkieGraphics,
    checkIn,
  } = useMeasuredBusinessMemo(
    "owner-dashboard-derive",
    () => ({
      dashboard: adapter.getOwnerDashboard(businessId),
      report: adapter.getGrowthReport(businessId),
      quests: adapter.getServiceQuests(businessId),
      miniGame: adapter.getCustomerMiniGame(businessId),
      business: adapter.getBusiness(businessId),
      type: adapter.getBusinessType(businessId),
      bikkieGraphics: adapter.getBikkieGraphics(businessId),
      checkIn: adapter.getCheckInStatus(businessId),
    }),
    [adapter, businessId],
    { businessId, tab: "dashboard" }
  );
  const checkInDisplay = checkIn
    ? businessCheckInDisplayModel(checkIn)
    : undefined;
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
          data-business-backend-action="true"
          disabled={backendPending || Boolean(session)}
          onClick={() => void adapter.startCustomerSession(businessId)}
          style={backendActionStyle(
            session ? disabledButtonStyle : startShiftButtonStyle,
            backendPending
          )}
        >
          Start Shift
        </button>
      </section>
      {checkInDisplay && (
        <section style={highlightCardStyle}>
          <div>
            <h3 style={sectionTitleStyle}>Daily Check-In</h3>
            <strong style={heroMetricStyle}>
              {checkInDisplay.streakLabel}
            </strong>
            <p
              style={
                checkInDisplay.inLosses
                  ? { ...mutedTextStyle, color: "#ff9f2f" }
                  : mutedTextStyle
              }
            >
              {checkInDisplay.revenueLabel}
            </p>
            <p style={mutedTextStyle}>{checkInDisplay.madeLabel}</p>
            <p style={mutedTextStyle}>{checkInDisplay.lostLabel}</p>
            <p style={mutedTextStyle}>{checkInDisplay.callToAction}</p>
          </div>
          <button
            className="biomes-ui-tab"
            type="button"
            data-business-backend-action="true"
            disabled={backendPending || checkInDisplay.checkedInToday}
            onClick={() => void adapter.checkInDaily(businessId)}
            style={backendActionStyle(
              checkInDisplay.checkedInToday
                ? disabledButtonStyle
                : startShiftButtonStyle,
              backendPending
            )}
          >
            {checkInDisplay.checkedInToday ? "Checked in" : "Check in (+500)"}
          </button>
        </section>
      )}
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
            data-business-backend-action="true"
            disabled={backendPending || !canOpen}
            onClick={() =>
              canOpen &&
              void adapter.openBusiness(
                businessId,
                business?.propertyId,
                business?.townId
              )
            }
            style={backendActionStyle(
              !canOpen ? disabledButtonStyle : undefined,
              backendPending
            )}
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
  adapter: HarthmereBusinessInterfaceAdapter;
  businessId: string;
}> = ({ adapter, businessId }) => {
  const backendPending = useBusinessBackendPending();
  const panel = useMeasuredBusinessMemo(
    "customer-minigame-derive",
    () => adapter.getCustomerMiniGame(businessId),
    [adapter, businessId],
    { businessId, tab: "customers" }
  );
  const session = panel.activeSession;
  const ticket = panel.currentTicket;
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  const [feedback, setFeedback] = React.useState<
    MiniGameFeedback | undefined
  >();
  const feedbackSeq = React.useRef(0);
  React.useEffect(() => {
    if (!ticket) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [ticket?.ticketId]);
  React.useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(undefined), 3400);
    return () => window.clearTimeout(timer);
  }, [feedback?.id]);
  const served = session?.servedTicketIds.length ?? 0;
  const failed = session?.failedTicketIds.length ?? 0;
  const displayedPatience = ticketPatienceRemaining(ticket, nowMs);
  const patienceRatio =
    ticket && ticket.patience > 0
      ? Math.max(0, Math.min(1, displayedPatience / ticket.patience))
      : 1;
  const mechanic = panel.definition.mechanicSpec;
  const queueTotal = Math.max(1, session?.queue.length ?? 1);
  const progressPercent = session
    ? Math.min(100, Math.round((served / queueTotal) * 100))
    : 0;
  const shiftComplete = Boolean(session && !ticket);
  const offerRows = React.useMemo(() => chunk(panel.offers, 2), [panel.offers]);
  const uiElements = mechanic.uiElements;
  const winConditions = mechanic.winConditions;
  const edgeCases = React.useMemo(
    () => mechanic.edgeCases.slice(0, 3),
    [mechanic.edgeCases]
  );
  const customerTypes = React.useMemo(
    () => mechanic.customerTypes.slice(0, 3),
    [mechanic.customerTypes]
  );
  const difficultyTier = mechanic.difficultyScaling[0];
  const customerName =
    panel.currentNpc?.displayName ?? (ticket ? displayLabel(ticket.npcId) : "");
  const customerAvatar = React.useMemo(() => {
    if (!ticket) {
      return undefined;
    }
    return harthmereBusinessCustomerPlayerMeshAvatar({
      npcId: ticket.npcId,
      displayName: customerName,
      appearance: panel.currentNpc?.appearance,
    });
  }, [ticket?.npcId, customerName, panel.currentNpc?.appearance]);
  const npcNameById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const npc of panel.customerPool) map.set(npc.npcId, npc.displayName);
    return map;
  }, [panel.customerPool]);
  const upcoming = React.useMemo(() => {
    if (!session) return [];
    const servedSet = new Set(session.servedTicketIds);
    const failedSet = new Set(session.failedTicketIds);
    return session.queue
      .filter(
        (entry) =>
          entry.ticketId !== ticket?.ticketId &&
          !servedSet.has(entry.ticketId) &&
          !failedSet.has(entry.ticketId)
      )
      .slice(0, 4);
  }, [session, ticket?.ticketId]);
  const pushFeedback = React.useCallback(
    (kind: MiniGameFeedback["kind"], message: string) => {
      feedbackSeq.current += 1;
      setFeedback({ id: feedbackSeq.current, kind, message });
    },
    []
  );
  const runCustomerAction = React.useCallback(
    (action: () => Promise<unknown>, successMessage?: string) => {
      void action()
        .then((result) => {
          if (isBusinessBackendRequestSkipped(result)) return;
          if (successMessage) pushFeedback("success", successMessage);
        })
        .catch((error) => {
          const message =
            error instanceof Error ? error.message : String(error ?? "");
          if (
            message.includes("business_customer_session_expired") ||
            message.includes("business_customer_session_not_active")
          ) {
            pushFeedback(
              "error",
              "That customer timed out. Start a new shift."
            );
            return;
          }
          if (message.includes("economy_rejected:")) {
            pushFeedback(
              "error",
              formatHarthmereBusinessPlayerWarning(message)
            );
            return;
          }
          pushFeedback(
            "error",
            "The service board could not update. Try again."
          );
        });
    },
    [pushFeedback]
  );
  const startShift = React.useCallback(
    () => runCustomerAction(() => adapter.startCustomerSession(businessId)),
    [adapter, businessId, runCustomerAction]
  );
  return (
    <div style={arenaRootStyle} data-business-minigame-arena="true">
      <section
        style={arenaHeroStyle}
        data-business-minigame-spec={mechanic.specId}
      >
        <div style={heroGlowStyle} aria-hidden="true" />
        <div style={heroTopRowStyle}>
          <div style={{ minWidth: 0 }}>
            <span style={heroEyebrowStyle}>Day Job Mini-Game</span>
            <strong style={miniGameTitleStyle}>{mechanic.gameTitle}</strong>
            <p style={dayJobIntroStyle}>Take a day job to earn some gold.</p>
          </div>
          <span style={session ? miniGameBadgeLiveStyle : miniGameBadgeStyle}>
            {session ? "Shift Live" : "Ready"}
          </span>
        </div>
        <p style={heroObjectiveStyle}>{mechanic.objective}</p>
        <div style={statChipRowStyle}>
          {session ? (
            <>
              <StatChip
                label="Served"
                value={`${served}/${session.queue.length}`}
              />
              <StatChip
                label="Gold"
                value={`${session.earnedGold}`}
                tone="gold"
              />
              <StatChip label="Streak" value={`${session.streak}`} />
              <StatChip
                label="Satisfaction"
                value={`${session.satisfaction}`}
              />
              <StatChip
                label="Missed"
                value={`${failed}`}
                tone={failed ? "warn" : undefined}
              />
            </>
          ) : (
            <>
              <StatChip
                label="Lifetime served"
                value={`${panel.stats.totalServed}`}
              />
              <StatChip
                label="Best streak"
                value={`${panel.stats.bestStreak}`}
              />
              <StatChip label="Tier" value={`${panel.stats.currentTier}`} />
            </>
          )}
        </div>
        <div style={progressTrackStyle} aria-hidden="true">
          <div style={{ ...progressFillStyle, width: `${progressPercent}%` }} />
          {session && !shiftComplete ? (
            <div style={progressSweepStyle} />
          ) : null}
        </div>
        {shiftComplete ? (
          <div style={summaryCardStyle} data-business-minigame-summary="true">
            <strong style={summaryTitleStyle}>Shift complete</strong>
            <p style={summaryLineStyle}>
              You served {served} of {session?.queue.length} customers and
              earned {session?.earnedGold ?? 0} gold.{" "}
              {failed
                ? `${failed} customer${failed === 1 ? "" : "s"} timed out.`
                : "Clean sheet — nobody left unhappy!"}
            </p>
            <div style={summaryStatRowStyle}>
              <StatChip label="Best streak" value={`${session?.streak ?? 0}`} />
              <StatChip
                label="Satisfaction"
                value={`${session?.satisfaction ?? 0}`}
              />
            </div>
            <button
              className="biomes-ui-tab"
              type="button"
              data-business-backend-action="true"
              disabled={backendPending}
              onClick={startShift}
              style={backendActionStyle(
                startShiftButtonStyle,
                backendPending
              )}
            >
              Start New Shift
            </button>
          </div>
        ) : !session ? (
          <div style={heroStartRowStyle}>
            <button
              className="biomes-ui-tab"
              type="button"
              data-business-backend-action="true"
              disabled={backendPending}
              onClick={startShift}
              style={backendActionStyle(
                startShiftButtonStyle,
                backendPending
              )}
            >
              Start Shift
            </button>
            <span style={heroStartHintStyle}>
              Bring customer-only neighbours to the counter and match each
              request before their patience runs out.
            </span>
          </div>
        ) : null}
        {session?.notes.slice(-2).map((note) => (
          <p key={note} style={heroNoteStyle}>
            {note}
          </p>
        ))}
        {feedback ? (
          <div
            key={feedback.id}
            role="status"
            style={
              feedback.kind === "success" ? toastSuccessStyle : toastErrorStyle
            }
            data-business-minigame-feedback={feedback.kind}
          >
            <span style={toastDotStyle} aria-hidden="true" />
            {feedback.message}
          </div>
        ) : null}
      </section>

      <div style={arenaWorkGridStyle}>
        <section style={boardCardStyle}>
          <h3 style={sectionTitleStyle}>Service Board</h3>
          <div style={{ display: "grid", gap: 8 }}>
            {uiElements.map((element, index) => (
              <div
                key={element.elementId}
                style={boardRowStyle}
                data-business-minigame-ui-element={element.elementId}
              >
                <span style={boardIndexStyle} aria-hidden="true">
                  {index + 1}
                </span>
                <div style={{ minWidth: 0 }}>
                  <strong style={boardRowTitleStyle}>{element.label}</strong>
                  <p style={mutedTextStyle}>{element.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section style={customerCardStyle}>
          <div style={cardHeaderRowStyle}>
            <h3 style={sectionTitleStyle}>Current Customer</h3>
            {ticket ? (
              <span style={patienceBadgeStyle(patienceRatio)}>
                {displayedPatience}s left
              </span>
            ) : null}
          </div>
          {ticket ? (
            <div key={ticket.ticketId} style={customerSwapStyle}>
              <div style={customerStageStyle}>
                <div
                  style={customerPortraitFrameStyle(patienceRatio)}
                  aria-hidden="true"
                >
                  {customerAvatar ? (
                    <CustomerPlayerMeshPortrait
                      avatar={customerAvatar}
                      ticketId={ticket.ticketId}
                    />
                  ) : (
                    <span style={customerAvatarStateStyle(patienceRatio)} />
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <strong>{customerName}</strong>
                  <p style={{ ...mutedTextStyle, marginTop: 4 }}>
                    {ticket.askLine}
                  </p>
                </div>
              </div>
              <div style={patienceTrackStyle} aria-hidden="true">
                <div
                  style={{
                    ...patienceFillStyle,
                    width: `${Math.round(patienceRatio * 100)}%`,
                    background: patienceColor(patienceRatio),
                  }}
                />
              </div>
              <div style={patienceMetaRowStyle}>
                <span style={mutedTextStyle}>
                  Patience {displayedPatience}/{ticket.patience}
                </span>
                <span style={difficultyPipRowStyle} aria-hidden="true">
                  {Array.from({ length: 5 }).map((_unused, index) => (
                    <span
                      key={index}
                      style={
                        index < Math.min(5, ticket.difficulty)
                          ? difficultyPipOnStyle
                          : difficultyPipOffStyle
                      }
                    />
                  ))}
                </span>
              </div>
              <RovingGrid
                ariaLabel="Customer service offers"
                items={offerRows}
                onActivate={(_row, _col, offer) => {
                  if (backendPending) return;
                  runCustomerAction(
                    () =>
                      adapter.serveCustomer(
                        businessId,
                        offer.offerId,
                        session?.sessionId,
                        ticket.ticketId,
                        createHarthmereBusinessMiniGameDecisionForOffer(
                          panel.typeId as any,
                          offer.offerId
                        )
                      ),
                    `Served ${customerName || "customer"} · +${
                      offer.rewardGold
                    } gold`
                  );
                }}
                renderCell={(offer, _coords, cell) => (
                  <button
                    ref={cell.ref}
                    tabIndex={cell.tabIndex}
                    onFocus={cell.onFocus}
                    onKeyDown={cell.onKeyDown}
                    onClick={cell.onClick}
                    className="biomes-ui-tab"
                    data-business-backend-action="true"
                    data-business-minigame-offer-pending={
                      backendPending ? "true" : "false"
                    }
                    disabled={backendPending}
                    aria-disabled={backendPending}
                    style={backendActionStyle(
                      serviceButtonStyle,
                      backendPending
                    )}
                    aria-label={offer.label}
                  >
                    <span style={offerHeadRowStyle}>
                      <strong style={offerLabelStyle}>{offer.label}</strong>
                      <span style={offerVerbBadgeStyle}>
                        {displayLabel(offer.interactionVerb)}
                      </span>
                    </span>
                    <span style={mutedTextStyle}>{offer.description}</span>
                    <span style={offerFooterStyle}>
                      +{offer.rewardGold} gold ·{" "}
                      {offer.satisfactionDelta >= 0 ? "+" : ""}
                      {offer.satisfactionDelta} satisfaction
                    </span>
                  </button>
                )}
              />
            </div>
          ) : (
            <div style={emptyStateStyle}>
              <span style={emptyStateGlyphStyle} aria-hidden="true">
                {shiftComplete ? "✓" : "☷"}
              </span>
              <p style={mutedTextStyle}>
                {shiftComplete
                  ? "This shift is complete. Start a new shift to keep building your streak."
                  : "Start a shift to bring customer-only NPCs to the counter."}
              </p>
            </div>
          )}
        </section>

        <section style={cardStyle}>
          <h3 style={sectionTitleStyle}>Queue</h3>
          {session ? (
            upcoming.length ? (
              <div style={{ display: "grid", gap: 8 }}>
                {upcoming.map((entry, index) => (
                  <div key={entry.ticketId} style={queueChipStyle}>
                    <span style={queueOrderStyle} aria-hidden="true">
                      {index + 1}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <strong style={queueNameStyle}>
                        {npcNameById.get(entry.npcId) ??
                          displayLabel(entry.npcId)}
                      </strong>
                      <p style={mutedTextStyle}>
                        Difficulty {entry.difficulty} · {entry.rewardGold} gold
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={mutedTextStyle}>
                {ticket
                  ? "Last customer is at the counter."
                  : "Queue cleared for this shift."}
              </p>
            )
          ) : (
            <p style={mutedTextStyle}>
              Start a shift to line up neighbours at the counter.
            </p>
          )}
          <h3 style={{ ...sectionTitleStyle, marginTop: 14 }}>Who shows up</h3>
          {customerTypes.map((type) => (
            <div key={type.customerTypeId} style={referenceRowStyle}>
              <strong style={referenceTitleStyle}>{type.label}</strong>
              <p style={mutedTextStyle}>{type.requirements}</p>
            </div>
          ))}
          {difficultyTier ? (
            <p style={{ ...mutedTextStyle, marginTop: 8 }}>
              <strong style={referenceTitleStyle}>
                {displayLabel(difficultyTier.tier)} tier:
              </strong>{" "}
              {difficultyTier.rule}
            </p>
          ) : null}
        </section>
      </div>

      <section style={howToCardStyle} data-business-minigame-howto="true">
        <h3 style={sectionTitleStyle}>How to play</h3>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={howToStepStyle}>
            <span style={howToStepIndexStyle} aria-hidden="true">
              1
            </span>
            <p style={howToTextStyle}>{mechanic.coreMechanic}</p>
          </div>
          <div style={howToStepStyle}>
            <span style={howToStepIndexStyle} aria-hidden="true">
              2
            </span>
            <p style={howToTextStyle}>{mechanic.uniqueTwist}</p>
          </div>
        </div>
        <h3 style={{ ...sectionTitleStyle, marginTop: 14 }}>Goals</h3>
        {winConditions.map((step) => (
          <p key={step} style={goalLineStyle}>
            <span style={goalMarkerStyle} aria-hidden="true" />
            {step}
          </p>
        ))}
        <h3 style={{ ...sectionTitleStyle, marginTop: 14 }}>Watch out for</h3>
        {edgeCases.map((step) => (
          <p key={step} style={warnLineStyle}>
            <span style={warnMarkerStyle} aria-hidden="true" />
            {step}
          </p>
        ))}
      </section>
    </div>
  );
};

type MiniGameFeedback = {
  id: number;
  kind: "success" | "error";
  message: string;
};

const StatChip: React.FunctionComponent<{
  label: string;
  value: string;
  tone?: "gold" | "warn";
}> = ({ label, value, tone }) => (
  <div style={statChipStyle}>
    <span style={statChipLabelStyle}>{label}</span>
    <strong
      style={
        tone === "gold"
          ? statChipValueGoldStyle
          : tone === "warn"
          ? statChipValueWarnStyle
          : statChipValueStyle
      }
    >
      {value}
    </strong>
  </div>
);

const CustomerPlayerMeshPortrait: React.FunctionComponent<{
  avatar: HarthmereBusinessCustomerPlayerMeshAvatar;
  ticketId: string;
}> = ({ avatar, ticketId }) => {
  const { clientContext } = React.useContext(ClientContextReactContext);
  const [previewModule, setPreviewModule] =
    React.useState<CharacterPreviewModule | null>(null);
  const cameraPos = React.useMemo(
    () =>
      new Vector3().setFromSpherical(
        new Spherical(2.05, MathUtils.degToRad(72), MathUtils.degToRad(198))
      ),
    []
  );
  const controlTarget = React.useMemo(() => new Vector3(0, 1.42, 0), []);
  React.useEffect(() => {
    if (!clientContext || typeof window === "undefined") {
      return;
    }
    let mounted = true;
    void import("../character/CharacterPreview")
      .then((module) => {
        if (mounted) {
          setPreviewModule(module);
        }
      })
      .catch(() => {
        if (mounted) {
          setPreviewModule(null);
        }
      });
    return () => {
      mounted = false;
    };
  }, [clientContext]);
  if (!clientContext || typeof window === "undefined" || !previewModule) {
    return (
      <span
        style={customerMeshAvatarFallbackStyle}
        data-business-customer-avatar-fallback="no-client-context"
      />
    );
  }
  const { CharacterPreview, makePreviewSlot } = previewModule;
  return (
    <CharacterPreview
      previewSlot={makePreviewSlot(
        "appearencePreview",
        `business-customer-${ticketId}-${avatar.seed}`
      )}
      meshVersionKey={avatar.meshVersionKey}
      disableLoadingBlur={true}
      appearanceOverride={avatar.appearance}
      wearableOverrides={avatar.wearableOverrides}
      controlTarget={controlTarget}
      cameraPos={cameraPos}
      cameraFOV={24}
      controls={false}
      animate={false}
      extraClassName="harthmere-business-customer-mesh-avatar"
      canShowWearableHint={false}
    />
  );
};

function patienceColor(ratio: number): string {
  if (ratio > 0.5) return "linear-gradient(90deg, #56c7ff, #92ffd7)";
  if (ratio > 0.25) return "linear-gradient(90deg, #ffd23f, #ff9f2f)";
  return "linear-gradient(90deg, #ff6b6b, #ff9f2f)";
}

const CustomerOverviewPane: React.FunctionComponent<{
  adapter: HarthmereBusinessInterfaceAdapter;
  businessId: string;
}> = ({ adapter, businessId }) => {
  const { business, shop, miniGame } = useMeasuredBusinessMemo(
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
      <section style={howToCardStyle}>
        <h3 style={sectionTitleStyle}>
          {miniGame.definition.mechanicSpec.gameTitle}
        </h3>
        <p style={{ ...mutedTextStyle, marginBottom: 12 }}>
          {miniGame.definition.customerGoal}
        </p>
        <div style={howToStepStyle}>
          <span style={howToStepIndexStyle} aria-hidden="true">
            1
          </span>
          <p style={howToTextStyle}>
            {miniGame.definition.mechanicSpec.coreMechanic}
          </p>
        </div>
        <div style={{ ...howToStepStyle, marginTop: 10 }}>
          <span style={howToStepIndexStyle} aria-hidden="true">
            2
          </span>
          <p style={howToTextStyle}>
            {miniGame.definition.mechanicSpec.uniqueTwist}
          </p>
        </div>
        <p style={{ ...mutedTextStyle, marginTop: 12 }}>
          {miniGame.dailyReturnTriggers[0]}
        </p>
      </section>
    </div>
  );
};

const ContractBoardPane: React.FunctionComponent<{
  adapter: HarthmereBusinessInterfaceAdapter;
  businessId: string;
}> = ({ adapter, businessId }) => {
  const backendPending = useBusinessBackendPending();
  const board = useMeasuredBusinessMemo(
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
            data-business-backend-action="true"
            disabled={backendPending}
            style={backendActionStyle(undefined, backendPending)}
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
            data-business-backend-action="true"
            disabled={backendPending}
            style={backendActionStyle(undefined, backendPending)}
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
  contracts: HarthmereBusinessContract[];
  renderAction?: (contract: HarthmereBusinessContract) => React.ReactNode;
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
  adapter: HarthmereBusinessInterfaceAdapter;
  businessId: string;
  mode: HarthmereBusinessActorMode;
}> = ({ adapter, businessId, mode }) => {
  const backendPending = useBusinessBackendPending();
  const shop = useMeasuredBusinessMemo(
    "shopfront-derive",
    () => adapter.getShopfront(businessId),
    [adapter, businessId],
    { businessId, tab: "shopfront" }
  );
  const [itemId, setItemId] = React.useState("");
  const [count, setCount] = React.useState("1");
  const [priceItemId, setPriceItemId] = React.useState("");
  const [priceModifier, setPriceModifier] = React.useState("1");
  const rawCount = Number(count);
  const parsedCount = Number.isFinite(rawCount)
    ? Math.max(1, Math.trunc(rawCount))
    : 1;
  const buyCountLabel = parsedCount > 1 ? `Buy x${parsedCount}` : "Buy";
  const storefrontGoods = shop.storefrontGoods ?? [];
  const buildingMaterials = storefrontGoods.filter(
    (good) => good.kind === "block"
  );
  const furnishings = storefrontGoods.filter(
    (good) => good.kind === "interior"
  );
  const recipeBooks = storefrontGoods.filter(
    (good) => good.kind === "recipe_book"
  );
  const renderStorefrontGood = (
    good: (typeof storefrontGoods)[number],
    merchKind: ShopfrontMerchKind
  ) => {
    const itemLabel = good.displayName ?? displayLabel(good.itemId);
    const isRecipeBook = merchKind === "recipe_book";
    const purchaseCount = isRecipeBook ? 1 : parsedCount;
    const learned = Boolean(good.learned);
    const disabled = backendPending || learned;
    const actionLabel = learned
      ? "Learned"
      : isRecipeBook
      ? "Learn"
      : buyCountLabel;
    return (
      <button
        key={good.itemId}
        type="button"
        data-business-backend-action="true"
        data-testid={`biomes-business-storefront-good-${good.itemId}`}
        aria-label={`${isRecipeBook ? "Learn" : "Buy"} ${itemLabel}${
          !isRecipeBook && parsedCount > 1 ? ` x${parsedCount}` : ""
        }`}
        disabled={disabled}
        style={backendActionStyle(
          shopfrontGoodButtonStyle(merchKind),
          disabled
        )}
        onClick={() =>
          void adapter.buyStorefrontGood(businessId, good.itemId, purchaseCount)
        }
      >
        <div style={shopfrontItemLeadStyle}>
          {good.visual ? (
            <BikkieVisualTileForVisual
              visual={good.visual}
              size={38}
              dataTestId={`biomes-business-storefront-good-icon-${good.itemId}`}
            />
          ) : null}
          <div style={shopfrontItemTextStyle}>
            <div style={shopItemHeaderStyle}>
              <strong style={shopItemNameStyle}>{itemLabel}</strong>
              <span style={shopfrontKindBadgeStyle(merchKind)}>
                {shopfrontKindLabel(merchKind)}
              </span>
            </div>
            <div style={shopItemMetaStyle}>
              {isRecipeBook
                ? `${good.recipeIds?.length ?? 0} recipes · ${
                    good.priceGold
                  } gold`
                : `Unit price ${good.priceGold} gold`}
            </div>
          </div>
        </div>
        <span style={buyActionTextStyle}>
          {actionLabel}
          {!learned && !isRecipeBook && parsedCount > 1
            ? ` · ${good.priceGold * parsedCount} gold`
            : ""}
        </span>
      </button>
    );
  };
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
              data-business-backend-action="true"
              disabled={backendPending || !itemId}
              style={backendActionStyle(
                !itemId ? disabledButtonStyle : undefined,
                backendPending
              )}
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
              data-business-backend-action="true"
              disabled={backendPending || !itemId}
              style={backendActionStyle(
                !itemId ? disabledButtonStyle : undefined,
                backendPending
              )}
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
              data-business-backend-action="true"
              disabled={backendPending || !priceItemId}
              style={backendActionStyle(
                !priceItemId ? disabledButtonStyle : undefined,
                backendPending
              )}
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
      {mode === "customer" && shop.toolForSale ? (
        <ShopfrontMerchSection
          kind="tool"
          title="Tools"
          countLabel="1 tool"
          dataTestId="biomes-business-tool-for-sale"
        >
          <div style={shopfrontToolListingStyle}>
            <div style={shopfrontItemLeadStyle}>
              {shop.toolForSale.visual ? (
                <BikkieVisualTileForVisual
                  visual={shop.toolForSale.visual}
                  size={38}
                  dataTestId="biomes-business-tool-for-sale-icon"
                />
              ) : null}
              <div style={shopfrontItemTextStyle}>
                <div style={shopItemHeaderStyle}>
                  <strong style={shopItemNameStyle}>
                    {shop.toolForSale.toolName}
                  </strong>
                  <span style={shopfrontKindBadgeStyle("tool")}>Tool</span>
                </div>
                <div style={shopItemMetaStyle}>
                  Unit price {shop.toolForSale.priceGold} gold
                </div>
              </div>
            </div>
            <button
              className="biomes-ui-tab"
              type="button"
              aria-label={`Buy ${shop.toolForSale.toolName}`}
              data-business-backend-action="true"
              disabled={backendPending}
              onClick={() =>
                purchaseHarthmereBusinessTool(shop.businessType)
              }
              style={backendActionStyle(
                { ...buyActionTextStyle, width: "100%" },
                backendPending
              )}
            >
              Buy {shop.toolForSale.toolName}
            </button>
          </div>
        </ShopfrontMerchSection>
      ) : null}
      {mode === "customer" && storefrontGoods.length ? (
        <div
          data-testid="biomes-business-storefront-goods"
          style={shopfrontSectionStackStyle}
        >
          {buildingMaterials.length ? (
            <ShopfrontMerchSection
              kind="block"
              title="Building Materials"
              countLabel={`${buildingMaterials.length} materials`}
            >
              <div style={shopfrontGoodsGridStyle}>
                {buildingMaterials.map((good) =>
                  renderStorefrontGood(good, "block")
                )}
              </div>
            </ShopfrontMerchSection>
          ) : null}
          {furnishings.length ? (
            <ShopfrontMerchSection
              kind="interior"
              title="Furnishings"
              countLabel={`${furnishings.length} furnishings`}
            >
              <div style={shopfrontGoodsGridStyle}>
                {furnishings.map((good) =>
                  renderStorefrontGood(good, "interior")
                )}
              </div>
            </ShopfrontMerchSection>
          ) : null}
          {recipeBooks.length ? (
            <ShopfrontMerchSection
              kind="recipe_book"
              title="Recipe Books"
              countLabel={`${recipeBooks.length} books`}
            >
              <div style={shopfrontGoodsGridStyle}>
                {recipeBooks.map((good) =>
                  renderStorefrontGood(good, "recipe_book")
                )}
              </div>
            </ShopfrontMerchSection>
          ) : null}
        </div>
      ) : null}
      {mode === "customer" ? (
        <ShopfrontMerchSection
          kind="stock"
          title="Shop Stock"
          countLabel={`${shop.inventory.length} stocked`}
        >
          <InventoryGrid
            inventory={shop.inventory}
            emptyLabel={shop.emptyLabel}
            actionLabel="Buy"
            itemKind="stock"
            purchaseCount={parsedCount}
            onActivate={(item) =>
              !backendPending &&
              void adapter.purchaseShopItem(
                businessId,
                item.itemId,
                parsedCount
              )
            }
          />
        </ShopfrontMerchSection>
      ) : (
        <InventoryGrid
          inventory={shop.inventory}
          emptyLabel={shop.emptyLabel}
        />
      )}
    </section>
  );
};

const ShopfrontMerchSection: React.FunctionComponent<{
  kind: ShopfrontMerchKind;
  title: string;
  countLabel?: string;
  dataTestId?: string;
  children: React.ReactNode;
}> = ({ kind, title, countLabel, dataTestId, children }) => (
  <div
    data-testid={dataTestId ?? `biomes-business-storefront-section-${kind}`}
    style={shopfrontSectionStyle(kind)}
  >
    <div style={shopfrontSectionHeaderStyle}>
      <strong style={shopfrontSectionTitleStyle(kind)}>{title}</strong>
      {countLabel ? (
        <span style={shopfrontSectionCountStyle(kind)}>{countLabel}</span>
      ) : null}
    </div>
    {children}
  </div>
);

const InventoryGrid: React.FunctionComponent<{
  inventory: HarthmereBusinessVisibleInventoryItem[];
  emptyLabel: string;
  actionLabel?: string;
  itemKind?: ShopfrontMerchKind;
  purchaseCount?: number;
  onActivate?: (item: HarthmereBusinessVisibleInventoryItem) => void;
}> = ({
  inventory,
  emptyLabel,
  actionLabel,
  itemKind = "stock",
  purchaseCount = 1,
  onActivate,
}) => {
  const backendPending = useBusinessBackendPending();
  const inventoryRows = React.useMemo(() => chunk(inventory, 4), [inventory]);
  if (!inventory.length) return <p style={mutedTextStyle}>{emptyLabel}</p>;
  return (
    <RovingGrid
      ariaLabel="Business shopfront inventory"
      items={inventoryRows}
      onActivate={(_row, _col, item) => {
        if (actionLabel && backendPending) return;
        onActivate?.(item);
      }}
      renderCell={(item, _coords, cell) => {
        const itemLabel = item.displayName ?? displayLabel(item.itemId);
        return (
          <button
            ref={cell.ref}
            tabIndex={cell.tabIndex}
            onFocus={cell.onFocus}
            onKeyDown={cell.onKeyDown}
            onClick={cell.onClick}
            className="biomes-ui-slot"
            data-business-backend-action={actionLabel ? "true" : undefined}
            disabled={Boolean(actionLabel && backendPending)}
            style={backendActionStyle(
              {
                width: 150,
                minHeight: actionLabel ? 112 : 96,
                padding: 8,
                flexDirection: "column",
                alignItems: "stretch",
                gap: 6,
                textAlign: "left",
                ...(actionLabel ? shopfrontInventoryButtonStyle(itemKind) : {}),
              },
              Boolean(actionLabel && backendPending)
            )}
            aria-label={
              actionLabel
                ? `${actionLabel} ${itemLabel}${
                    item.count > 1 ? ` x${item.count}` : ""
                  }`
                : itemLabel
            }
          >
            {item.visual ? (
              <BikkieVisualTileForVisual
                visual={item.visual}
                size={34}
                dataTestId={`biomes-business-shop-stock-icon-${item.itemId}`}
              />
            ) : null}
            <strong style={{ fontSize: 12 }}>{itemLabel}</strong>
            {actionLabel ? (
              <span style={shopfrontKindBadgeStyle(itemKind)}>
                {shopfrontKindLabel(itemKind)}
              </span>
            ) : null}
            <span style={mutedTextStyle}>
              Stock x{item.count} · Unit price {item.priceGold} gold
            </span>
            {actionLabel && (
              <span style={buyActionTextStyle}>
                {purchaseCount > 1
                  ? `${actionLabel} x${purchaseCount}`
                  : actionLabel}
                {purchaseCount > 1
                  ? ` · ${item.priceGold * purchaseCount} gold`
                  : ""}
              </span>
            )}
          </button>
        );
      }}
    />
  );
};

const FinancePane: React.FunctionComponent<{
  adapter: HarthmereBusinessInterfaceAdapter;
  businessId: string;
}> = ({ adapter, businessId }) => {
  const backendPending = useBusinessBackendPending();
  const panel = useMeasuredBusinessMemo(
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
            data-business-backend-action="true"
            disabled={backendPending}
            style={backendActionStyle(undefined, backendPending)}
            onClick={() => void adapter.createBankAccount(businessId)}
          >
            Create Account
          </button>
          <button
            className="biomes-ui-tab"
            type="button"
            data-business-backend-action="true"
            disabled={backendPending}
            style={backendActionStyle(undefined, backendPending)}
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
            data-business-backend-action="true"
            disabled={backendPending}
            style={backendActionStyle(undefined, backendPending)}
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
  adapter: HarthmereBusinessInterfaceAdapter;
  businessId: string;
}> = ({ adapter, businessId }) => {
  const backendPending = useBusinessBackendPending();
  const panel = useMeasuredBusinessMemo(
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
          data-business-backend-action="true"
          disabled={backendPending}
          style={backendActionStyle(undefined, backendPending)}
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
          data-business-backend-action="true"
          disabled={backendPending}
          style={backendActionStyle(undefined, backendPending)}
          onClick={() => void adapter.payPayroll(businessId)}
        >
          Pay Payroll
        </button>
        <button
          className="biomes-ui-tab"
          type="button"
          data-business-backend-action="true"
          disabled={backendPending}
          style={backendActionStyle(undefined, backendPending)}
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
          data-business-backend-action="true"
          disabled={backendPending || !targetActorId}
          style={backendActionStyle(
            !targetActorId ? disabledButtonStyle : undefined,
            backendPending
          )}
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
                data-business-backend-action="true"
                disabled={backendPending}
                style={backendActionStyle(undefined, backendPending)}
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
                data-business-backend-action="true"
                disabled={backendPending}
                style={backendActionStyle(undefined, backendPending)}
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
                data-business-backend-action="true"
                disabled={backendPending}
                style={backendActionStyle(undefined, backendPending)}
                onClick={() =>
                  void adapter.trainWorker(businessId, employee.employeeId)
                }
              >
                Train
              </button>
              <button
                className="biomes-ui-tab"
                type="button"
                data-business-backend-action="true"
                disabled={backendPending}
                style={backendActionStyle(undefined, backendPending)}
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
                data-business-backend-action="true"
                disabled={backendPending}
                style={backendActionStyle(undefined, backendPending)}
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
                  data-business-backend-action="true"
                  disabled={backendPending}
                  style={backendActionStyle(undefined, backendPending)}
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
                  data-business-backend-action="true"
                  disabled={backendPending}
                  style={backendActionStyle(undefined, backendPending)}
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
                  data-business-backend-action="true"
                  disabled={backendPending}
                  style={backendActionStyle(undefined, backendPending)}
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
  adapter: HarthmereBusinessInterfaceAdapter;
  businessId: string;
}> = ({ adapter, businessId }) => {
  const backendPending = useBusinessBackendPending();
  const { panel, staff, shop } = useMeasuredBusinessMemo(
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
            data-business-backend-action="true"
            disabled={backendPending || !panel.openBranchEligible}
            onClick={() =>
              void adapter.openBranch(
                businessId,
                panel.outpostBuildings[0]?.outpostId
              )
            }
            style={backendActionStyle(
              !panel.openBranchEligible ? disabledButtonStyle : undefined,
              backendPending
            )}
          >
            Open Branch
          </button>
          <button
            className="biomes-ui-tab"
            type="button"
            data-business-backend-action="true"
            disabled={backendPending || !firstBranch}
            onClick={() =>
              firstBranch &&
              void adapter.assignAutomation(
                businessId,
                "branch_manager",
                firstBranch.branchId
              )
            }
            style={backendActionStyle(
              !firstBranch ? disabledButtonStyle : undefined,
              backendPending
            )}
          >
            Assign Manager
          </button>
          <button
            className="biomes-ui-tab"
            type="button"
            data-business-backend-action="true"
            disabled={backendPending || !panel.branches.length}
            onClick={() => void adapter.settleEmpireDay(businessId, 1)}
            style={backendActionStyle(
              !panel.branches.length ? disabledButtonStyle : undefined,
              backendPending
            )}
          >
            Collect Day
          </button>
        </div>
        <div style={formRowStyle}>
          <button
            className="biomes-ui-tab"
            type="button"
            data-business-backend-action="true"
            disabled={backendPending || !firstBranch || !firstEmployee}
            onClick={() =>
              firstBranch &&
              firstEmployee &&
              void adapter.assignBranchManager(
                businessId,
                firstBranch.branchId,
                firstEmployee.employeeId
              )
            }
            style={backendActionStyle(
              !firstBranch || !firstEmployee ? disabledButtonStyle : undefined,
              backendPending
            )}
          >
            Set Regional Manager
          </button>
          <button
            className="biomes-ui-tab"
            type="button"
            data-business-backend-action="true"
            disabled={backendPending || !firstBranch || !staff.length}
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
            style={backendActionStyle(
              !firstBranch || !staff.length ? disabledButtonStyle : undefined,
              backendPending
            )}
          >
            Schedule Staff
          </button>
          <button
            className="biomes-ui-tab"
            type="button"
            data-business-backend-action="true"
            disabled={backendPending || !firstBranch}
            onClick={() =>
              firstBranch &&
              void adapter.closeBranch(businessId, firstBranch.branchId)
            }
            style={backendActionStyle(
              !firstBranch ? disabledButtonStyle : undefined,
              backendPending
            )}
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
            data-business-backend-action="true"
            disabled={backendPending || !firstBranch || !routeItemId}
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
            style={backendActionStyle(
              !firstBranch || !routeItemId ? disabledButtonStyle : undefined,
              backendPending
            )}
          >
            Route Stock
          </button>
        </div>
        {panel.warnings.length ? (
          panel.warnings.map((warning) => (
            <p key={warning} style={mutedTextStyle}>
              {formatHarthmereBusinessPlayerWarning(warning)}
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
  adapter: HarthmereBusinessInterfaceAdapter;
  businessId: string;
}> = ({ adapter, businessId }) => {
  const panel = useMeasuredBusinessMemo(
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
              {formatHarthmereBusinessPlayerWarning(warning)}
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
  adapter: HarthmereBusinessInterfaceAdapter;
  businessId: string;
  mode: HarthmereBusinessActorMode;
}> = ({ adapter, businessId, mode }) => {
  const backendPending = useBusinessBackendPending();
  const screen = useMeasuredBusinessMemo(
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
      {mode === "customer" ? (
        <p style={{ ...mutedTextStyle, marginBottom: 10 }}>
          Choose a paid service from this business. Buying a service creates a
          request for the owner to fulfill.
        </p>
      ) : null}
      {actions.length ? (
        <RovingGrid
          ariaLabel="Business operation actions"
          items={actionRows}
          onActivate={(_row, _col, action) => {
            if (backendPending) return;
            if (mode === "owner") {
              void adapter.runServiceAction(businessId, action.actionId);
              return;
            }
            const priceGold = harthmereBusinessServicePriceGold(action);
            void adapter.requestCustomerService(businessId, action.actionId, {
              amountGold: priceGold,
              priceGold,
            });
          }}
          renderCell={(action, _coords, cell) => {
            const priceGold = harthmereBusinessServicePriceGold(action);
            const isCustomer = mode !== "owner";
            return (
              <button
                ref={cell.ref}
                tabIndex={cell.tabIndex}
                onFocus={cell.onFocus}
                onKeyDown={cell.onKeyDown}
                onClick={cell.onClick}
                className="biomes-ui-tab"
                data-business-backend-action="true"
                data-business-service-price-gold={
                  isCustomer ? priceGold : undefined
                }
                disabled={backendPending}
                aria-disabled={backendPending}
                style={backendActionStyle(serviceButtonStyle, backendPending)}
                aria-label={
                  isCustomer
                    ? `Buy service: ${action.label}, ${priceGold} gold`
                    : action.label
                }
              >
                <span style={serviceOfferHeaderStyle}>
                  <strong>{action.label}</strong>
                  {isCustomer ? (
                    <span style={servicePriceBadgeStyle}>{priceGold} gold</span>
                  ) : null}
                </span>
                <span style={mutedTextStyle}>{action.description}</span>
                {isCustomer ? (
                  <span style={serviceBuyCtaStyle}>Buy Service</span>
                ) : null}
              </button>
            );
          }}
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
  adapter: HarthmereBusinessInterfaceAdapter;
  businessId: string;
}> = ({ adapter, businessId }) => {
  const { orders, business, miniGame } = useMeasuredBusinessMemo(
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
  adapter: HarthmereBusinessInterfaceAdapter;
}> = ({ adapter }) => {
  const panel = useMeasuredBusinessMemo(
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
  adapter: HarthmereBusinessInterfaceAdapter;
}> = ({ adapter }) => {
  const panel = useMeasuredBusinessMemo(
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
  adapter: HarthmereBusinessInterfaceAdapter;
  guildId?: string;
}> = ({ adapter, guildId }) => {
  const panel = useMeasuredBusinessMemo(
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
  gap: 4,
  minHeight: 24,
  padding: "4px 8px",
  alignSelf: "stretch",
  borderRadius: 4,
  border: "1px solid rgba(146, 255, 215, 0.82)",
  color: "#07101a",
  background: "linear-gradient(180deg, #92ffd7 0%, #37dba4 54%, #1aa979 100%)",
  boxShadow: "0 0 14px rgba(55, 219, 164, 0.46)",
  fontWeight: 900,
};
const disabledButtonStyle: React.CSSProperties = {
  opacity: 0.55,
  cursor: "not-allowed",
};
const pendingBackendActionStyle: React.CSSProperties = {
  opacity: 0.45,
  filter: "grayscale(0.65)",
  cursor: "wait",
};

function backendActionStyle(
  base: React.CSSProperties | undefined,
  pending: boolean
): React.CSSProperties | undefined {
  if (!pending) return base;
  return { ...(base ?? {}), ...pendingBackendActionStyle };
}

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
const serviceOfferHeaderStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 10,
};
const servicePriceBadgeStyle: React.CSSProperties = {
  flex: "0 0 auto",
  padding: "3px 7px",
  color: "#06111f",
  background: "linear-gradient(180deg, #fff477, #ffbd3f)",
  border: "1px solid rgba(255, 246, 142, 0.95)",
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 900,
  lineHeight: 1,
  whiteSpace: "nowrap",
};
const serviceBuyCtaStyle: React.CSSProperties = {
  marginTop: "auto",
  alignSelf: "stretch",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 28,
  padding: "0 10px",
  color: "#06111f",
  background: "linear-gradient(180deg, #92ffd7, #37dba4)",
  border: "1px solid rgba(169, 255, 225, 0.9)",
  borderRadius: 4,
  fontSize: 11,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};
const shopActionSlotStyle: React.CSSProperties = {
  borderColor: "rgba(97, 244, 188, 0.82)",
  background:
    "linear-gradient(180deg, rgba(24, 61, 58, 0.96), rgba(9, 23, 35, 0.98))",
  boxShadow: "0 0 18px rgba(55, 219, 164, 0.28)",
};
const shopfrontSectionStackStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  margin: "8px 0",
};
const shopfrontGoodsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  gap: 8,
  marginTop: 6,
  alignItems: "stretch",
};
const shopfrontMerchTones: Record<
  ShopfrontMerchKind,
  {
    label: string;
    accent: string;
    border: string;
    glow: string;
    surfaceTop: string;
    surfaceBottom: string;
    badgeBg: string;
    badgeText: string;
  }
> = {
  tool: {
    label: "Tool",
    accent: "#ffd166",
    border: "rgba(255, 209, 102, 0.82)",
    glow: "rgba(255, 188, 64, 0.28)",
    surfaceTop: "rgba(87, 61, 20, 0.84)",
    surfaceBottom: "rgba(20, 18, 30, 0.98)",
    badgeBg: "rgba(255, 209, 102, 0.2)",
    badgeText: "#ffe7a6",
  },
  block: {
    label: "Building Material",
    accent: "#58c7ff",
    border: "rgba(88, 199, 255, 0.76)",
    glow: "rgba(88, 199, 255, 0.24)",
    surfaceTop: "rgba(24, 65, 88, 0.8)",
    surfaceBottom: "rgba(9, 20, 36, 0.98)",
    badgeBg: "rgba(88, 199, 255, 0.18)",
    badgeText: "#b9ecff",
  },
  interior: {
    label: "Furnishing",
    accent: "#f78ac6",
    border: "rgba(247, 138, 198, 0.72)",
    glow: "rgba(247, 138, 198, 0.24)",
    surfaceTop: "rgba(78, 37, 63, 0.82)",
    surfaceBottom: "rgba(22, 16, 35, 0.98)",
    badgeBg: "rgba(247, 138, 198, 0.18)",
    badgeText: "#ffd0e8",
  },
  recipe_book: {
    label: "Recipe Book",
    accent: "#d8b26e",
    border: "rgba(216, 178, 110, 0.76)",
    glow: "rgba(216, 178, 110, 0.22)",
    surfaceTop: "rgba(82, 62, 36, 0.82)",
    surfaceBottom: "rgba(24, 20, 28, 0.98)",
    badgeBg: "rgba(216, 178, 110, 0.18)",
    badgeText: "#f4d99e",
  },
  stock: {
    label: "Shop Stock",
    accent: "#7cf2ae",
    border: "rgba(124, 242, 174, 0.76)",
    glow: "rgba(83, 222, 146, 0.24)",
    surfaceTop: "rgba(25, 73, 52, 0.82)",
    surfaceBottom: "rgba(9, 24, 31, 0.98)",
    badgeBg: "rgba(124, 242, 174, 0.18)",
    badgeText: "#c8ffdf",
  },
};
function shopfrontKindLabel(kind: ShopfrontMerchKind): string {
  return shopfrontMerchTones[kind].label;
}
function shopfrontSectionStyle(
  kind: ShopfrontMerchKind
): React.CSSProperties {
  const tone = shopfrontMerchTones[kind];
  return {
    margin: "8px 0",
    padding: 10,
    border: `1px solid ${tone.border}`,
    borderRadius: 4,
    background: `linear-gradient(180deg, ${tone.surfaceTop}, rgba(9, 14, 26, 0.94))`,
    boxShadow: `inset 4px 0 0 ${tone.accent}, 0 0 18px ${tone.glow}`,
  };
}
const shopfrontSectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  minWidth: 0,
};
function shopfrontSectionTitleStyle(
  kind: ShopfrontMerchKind
): React.CSSProperties {
  const tone = shopfrontMerchTones[kind];
  return {
    minWidth: 0,
    color: tone.badgeText,
    fontSize: 12,
    lineHeight: 1.2,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  };
}
function shopfrontSectionCountStyle(
  kind: ShopfrontMerchKind
): React.CSSProperties {
  const tone = shopfrontMerchTones[kind];
  return {
    flex: "0 0 auto",
    padding: "2px 6px",
    border: `1px solid ${tone.border}`,
    borderRadius: 4,
    color: tone.badgeText,
    background: tone.badgeBg,
    fontSize: 9,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    whiteSpace: "nowrap",
  };
}
function shopfrontItemSurfaceStyle(
  kind: ShopfrontMerchKind
): React.CSSProperties {
  const tone = shopfrontMerchTones[kind];
  return {
    ...shopActionSlotStyle,
    display: "flex",
    boxSizing: "border-box",
    border: `1px solid ${tone.border}`,
    borderRadius: 4,
    background: `linear-gradient(180deg, ${tone.surfaceTop}, ${tone.surfaceBottom})`,
    boxShadow: `inset 3px 0 0 ${tone.accent}, 0 0 18px ${tone.glow}`,
    textAlign: "left",
    flexDirection: "column",
    justifyContent: "space-between",
    alignItems: "stretch",
    gap: 8,
    color: "var(--biomes-fg)",
    cursor: "pointer",
    clipPath:
      "polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px)",
    whiteSpace: "normal",
    textTransform: "none",
    letterSpacing: 0,
  };
}
function shopfrontGoodButtonStyle(
  kind: ShopfrontMerchKind
): React.CSSProperties {
  return {
    ...shopfrontItemSurfaceStyle(kind),
    width: "100%",
    minWidth: 170,
    minHeight: 126,
    padding: 10,
  };
}
function shopfrontInventoryButtonStyle(
  kind: ShopfrontMerchKind
): React.CSSProperties {
  return {
    ...shopfrontItemSurfaceStyle(kind),
    width: 150,
    minHeight: 112,
    padding: 8,
  };
}
const shopfrontToolListingStyle: React.CSSProperties = {
  ...shopfrontItemSurfaceStyle("tool"),
  minHeight: 0,
  marginTop: 6,
  padding: 10,
  cursor: "default",
};
const shopfrontItemLeadStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "flex-start",
  minWidth: 0,
};
const shopfrontItemTextStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  flex: "1 1 auto",
  minWidth: 0,
};
const shopItemHeaderStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  alignItems: "flex-start",
  justifyContent: "space-between",
  minWidth: 0,
};
const shopItemNameStyle: React.CSSProperties = {
  minWidth: 0,
  fontSize: 12,
  lineHeight: 1.2,
  overflowWrap: "anywhere",
};
const shopItemMetaStyle: React.CSSProperties = {
  ...mutedTextStyle,
  lineHeight: 1.35,
};
function shopfrontKindBadgeStyle(
  kind: ShopfrontMerchKind
): React.CSSProperties {
  const tone = shopfrontMerchTones[kind];
  return {
    flex: "0 0 auto",
    padding: "2px 5px",
    border: `1px solid ${tone.border}`,
    borderRadius: 4,
    color: tone.badgeText,
    background: tone.badgeBg,
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: 0,
    textTransform: "uppercase",
  };
}
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
const dayJobIntroStyle: React.CSSProperties = {
  ...mutedTextStyle,
  marginTop: 6,
  color: "#d8f7ff",
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
  animation: "harthmere-business-meter 1.35s linear infinite",
};
const customerStageStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "60px minmax(0, 1fr)",
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
  animation: "harthmere-business-pulse 1.25s ease-in-out infinite",
};
// --- Overhauled customer mini-game arena styles -----------------------------
const arenaRootStyle: React.CSSProperties = {
  display: "grid",
  gap: 14,
  alignItems: "start",
};
const arenaHeroStyle: React.CSSProperties = {
  position: "relative",
  overflow: "hidden",
  padding: 16,
  borderRadius: 8,
  border: "1px solid rgba(154, 199, 230, 0.42)",
  background:
    "linear-gradient(135deg, rgba(70, 104, 139, 0.32), rgba(17, 23, 34, 0.94))",
  boxShadow: "0 12px 30px rgba(0, 0, 0, 0.32)",
};
const heroGlowStyle: React.CSSProperties = {
  position: "absolute",
  top: -60,
  right: -40,
  width: 220,
  height: 220,
  pointerEvents: "none",
  background:
    "radial-gradient(circle, rgba(86, 199, 255, 0.28), transparent 68%)",
};
const heroTopRowStyle: React.CSSProperties = {
  position: "relative",
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
};
const heroEyebrowStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 4,
  fontSize: 10,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--biomes-fg-muted)",
};
const heroObjectiveStyle: React.CSSProperties = {
  position: "relative",
  margin: "10px 0 0",
  fontSize: 13,
  lineHeight: 1.5,
  color: "var(--biomes-fg)",
  maxWidth: 720,
};
const miniGameBadgeLiveStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 24,
  padding: "0 10px",
  borderRadius: 999,
  color: "#06111f",
  background: "linear-gradient(180deg, #fff477, #ffd23f)",
  fontSize: 10,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  whiteSpace: "nowrap",
  boxShadow: "0 0 14px rgba(255, 210, 63, 0.55)",
};
const statChipRowStyle: React.CSSProperties = {
  position: "relative",
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginTop: 14,
};
const statChipStyle: React.CSSProperties = {
  display: "grid",
  gap: 2,
  minWidth: 78,
  padding: "7px 11px",
  borderRadius: 6,
  border: "1px solid rgba(154, 199, 230, 0.26)",
  background: "rgba(7, 13, 26, 0.55)",
};
const statChipLabelStyle: React.CSSProperties = {
  fontSize: 9,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--biomes-fg-muted)",
};
const statChipValueStyle: React.CSSProperties = {
  fontSize: 18,
  lineHeight: 1,
  color: "var(--biomes-fg)",
};
const statChipValueGoldStyle: React.CSSProperties = {
  ...statChipValueStyle,
  color: "#ffd23f",
};
const statChipValueWarnStyle: React.CSSProperties = {
  ...statChipValueStyle,
  color: "#ff8f6b",
};
const heroStartRowStyle: React.CSSProperties = {
  position: "relative",
  display: "flex",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
  marginTop: 14,
};
const heroStartHintStyle: React.CSSProperties = {
  flex: "1 1 220px",
  minWidth: 0,
  fontSize: 12,
  lineHeight: 1.45,
  color: "var(--biomes-fg-muted)",
};
const heroNoteStyle: React.CSSProperties = {
  position: "relative",
  margin: "8px 0 0",
  paddingLeft: 12,
  borderLeft: "2px solid rgba(146, 255, 215, 0.5)",
  fontSize: 12,
  color: "var(--biomes-fg)",
  animation: "harthmere-business-rise 240ms ease-out",
};
const summaryCardStyle: React.CSSProperties = {
  position: "relative",
  display: "grid",
  gap: 10,
  marginTop: 14,
  padding: 14,
  borderRadius: 8,
  border: "1px solid rgba(146, 255, 215, 0.5)",
  background:
    "linear-gradient(135deg, rgba(24, 61, 58, 0.92), rgba(9, 23, 35, 0.96))",
  boxShadow: "0 0 22px rgba(55, 219, 164, 0.24)",
  animation: "harthmere-business-rise 280ms ease-out",
};
const summaryTitleStyle: React.CSSProperties = {
  fontSize: 18,
  color: "#92ffd7",
};
const summaryLineStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  lineHeight: 1.5,
  color: "var(--biomes-fg)",
};
const summaryStatRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};
const toastBaseStyle: React.CSSProperties = {
  position: "relative",
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginTop: 12,
  padding: "9px 12px",
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 700,
  animation: "harthmere-business-toast 240ms ease-out",
};
const toastSuccessStyle: React.CSSProperties = {
  ...toastBaseStyle,
  color: "#06211a",
  border: "1px solid rgba(146, 255, 215, 0.7)",
  background:
    "linear-gradient(180deg, rgba(146, 255, 215, 0.96), rgba(55, 219, 164, 0.92))",
  boxShadow: "0 0 18px rgba(55, 219, 164, 0.4)",
};
const toastErrorStyle: React.CSSProperties = {
  ...toastBaseStyle,
  color: "#2a0d0d",
  border: "1px solid rgba(255, 143, 107, 0.7)",
  background:
    "linear-gradient(180deg, rgba(255, 178, 150, 0.96), rgba(255, 107, 107, 0.9))",
  boxShadow: "0 0 18px rgba(255, 107, 107, 0.36)",
};
const toastDotStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: 999,
  background: "currentColor",
  opacity: 0.7,
  flex: "0 0 auto",
};
const arenaWorkGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
  gap: 12,
  alignItems: "start",
};
const boardCardStyle: React.CSSProperties = {
  ...cardStyle,
};
const boardRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "26px minmax(0, 1fr)",
  gap: 10,
  alignItems: "start",
  padding: "8px 0",
  borderTop: "1px solid rgba(154, 199, 230, 0.16)",
};
const boardIndexStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 22,
  height: 22,
  borderRadius: 999,
  background: "rgba(86, 199, 255, 0.18)",
  border: "1px solid rgba(86, 199, 255, 0.4)",
  color: "#9ee0ff",
  fontSize: 11,
  fontWeight: 800,
};
const boardRowTitleStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  marginBottom: 2,
  color: "var(--biomes-fg)",
};
const customerCardStyle: React.CSSProperties = {
  ...cardStyle,
  gridColumn: "span 1",
};
const customerSwapStyle: React.CSSProperties = {
  display: "block",
  animation: "harthmere-business-rise 260ms ease-out",
};
const cardHeaderRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
};
function patienceBadgeStyle(ratio: number): React.CSSProperties {
  const urgent = ratio <= 0.25;
  return {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 22,
    padding: "0 9px",
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.04em",
    color: urgent ? "#2a0d0d" : "#06111f",
    background: urgent
      ? "linear-gradient(180deg, #ff9f2f, #ff6b6b)"
      : "linear-gradient(180deg, #92ffd7, #56c7ff)",
    animation: urgent
      ? "harthmere-business-urgent 0.8s ease-in-out infinite"
      : undefined,
  };
}
// Fixed-size portrait frame that holds the generated player-mesh avatar and
// keeps the patience-reactive glow/animation the placeholder used to provide.
function customerPortraitFrameStyle(ratio: number): React.CSSProperties {
  const urgent = ratio <= 0.25;
  return {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(5, 12, 26, 0.55)",
    border: "1px solid rgba(154, 199, 230, 0.28)",
    boxShadow: urgent
      ? "0 0 18px rgba(255, 107, 107, 0.6)"
      : "0 0 16px rgba(86, 199, 255, 0.46)",
    animation: urgent
      ? "harthmere-business-urgent 0.8s ease-in-out infinite"
      : "harthmere-business-pulse 1.6s ease-in-out infinite",
  };
}
const customerMeshAvatarFallbackStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  display: "block",
  background:
    "linear-gradient(180deg, rgba(86,199,255,0.18), rgba(5,12,26,0.55))",
};
function customerAvatarStateStyle(ratio: number): React.CSSProperties {
  const urgent = ratio <= 0.25;
  return {
    width: 34,
    height: 34,
    borderRadius: 999,
    background:
      "radial-gradient(circle at 35% 30%, #fff477 0 16%, #ff9f2f 17% 38%, #56c7ff 39% 62%, #152342 63%)",
    boxShadow: urgent
      ? "0 0 18px rgba(255, 107, 107, 0.6)"
      : "0 0 16px rgba(86, 199, 255, 0.46)",
    animation: urgent
      ? "harthmere-business-urgent 0.8s ease-in-out infinite"
      : "harthmere-business-pulse 1.6s ease-in-out infinite",
  };
}
const patienceTrackStyle: React.CSSProperties = {
  position: "relative",
  height: 8,
  marginTop: 10,
  overflow: "hidden",
  borderRadius: 999,
  background: "rgba(7, 13, 26, 0.72)",
  border: "1px solid rgba(154, 199, 230, 0.2)",
};
const patienceFillStyle: React.CSSProperties = {
  height: "100%",
  minWidth: 4,
  borderRadius: 999,
  transition: "width 0.5s linear",
};
const patienceMetaRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
  marginTop: 6,
  marginBottom: 4,
};
const difficultyPipRowStyle: React.CSSProperties = {
  display: "inline-flex",
  gap: 4,
  alignItems: "center",
};
const difficultyPipOnStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: 999,
  background: "#ffd23f",
  boxShadow: "0 0 6px rgba(255, 210, 63, 0.6)",
};
const difficultyPipOffStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: 999,
  background: "rgba(154, 199, 230, 0.22)",
};
const offerHeadRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
  width: "100%",
};
const offerLabelStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--biomes-fg)",
};
const offerVerbBadgeStyle: React.CSSProperties = {
  flex: "0 0 auto",
  padding: "2px 8px",
  borderRadius: 999,
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#9ee0ff",
  background: "rgba(86, 199, 255, 0.16)",
  border: "1px solid rgba(86, 199, 255, 0.4)",
};
const offerFooterStyle: React.CSSProperties = {
  marginTop: "auto",
  fontSize: 11,
  fontWeight: 700,
  color: "#92ffd7",
};
const emptyStateStyle: React.CSSProperties = {
  display: "grid",
  justifyItems: "center",
  gap: 10,
  padding: "22px 12px",
  textAlign: "center",
};
const emptyStateGlyphStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 38,
  height: 38,
  borderRadius: 999,
  border: "1px dashed rgba(154, 199, 230, 0.4)",
  color: "var(--biomes-fg-muted)",
  fontSize: 18,
};
const queueChipStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "24px minmax(0, 1fr)",
  gap: 10,
  alignItems: "center",
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid rgba(154, 199, 230, 0.2)",
  background: "rgba(5, 12, 26, 0.42)",
};
const queueOrderStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 22,
  height: 22,
  borderRadius: 999,
  background: "rgba(154, 199, 230, 0.14)",
  color: "var(--biomes-fg-muted)",
  fontSize: 11,
  fontWeight: 800,
};
const queueNameStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "var(--biomes-fg)",
};
const referenceRowStyle: React.CSSProperties = {
  padding: "7px 0",
  borderTop: "1px solid rgba(154, 199, 230, 0.14)",
};
const referenceTitleStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--biomes-fg)",
};
const howToCardStyle: React.CSSProperties = {
  ...cardStyle,
  padding: 14,
};
const howToStepStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "26px minmax(0, 1fr)",
  gap: 10,
  alignItems: "start",
};
const howToStepIndexStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 24,
  height: 24,
  borderRadius: 999,
  background: "linear-gradient(180deg, #56c7ff, #37dba4)",
  color: "#06111f",
  fontSize: 12,
  fontWeight: 900,
};
const howToTextStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 12.5,
  lineHeight: 1.5,
  color: "var(--biomes-fg)",
};
const goalLineStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "flex-start",
  margin: "6px 0 0",
  fontSize: 12,
  lineHeight: 1.45,
  color: "var(--biomes-fg-muted)",
};
const goalMarkerStyle: React.CSSProperties = {
  flex: "0 0 auto",
  marginTop: 5,
  width: 7,
  height: 7,
  borderRadius: 999,
  background: "#92ffd7",
};
const warnLineStyle: React.CSSProperties = {
  ...goalLineStyle,
};
const warnMarkerStyle: React.CSSProperties = {
  ...goalMarkerStyle,
  background: "#ff9f2f",
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
  animation: "harthmere-business-pending-spin 780ms linear infinite",
};
