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

type OwnerTab = "dashboard" | "customers" | "orders" | "shopfront" | "finance" | "staff" | "empire" | "licenses" | "operations" | "town" | "market" | "guild";
type CustomerTab = "overview" | "customers" | "services" | "shopfront" | "status" | "market";
type PanelTab = OwnerTab | CustomerTab;
export type HarthmereBusinessInterfacePanelTabV1 = PanelTab;

const OWNER_TABS: OwnerTab[] = ["dashboard", "customers", "orders", "shopfront", "finance", "staff", "empire", "licenses", "operations", "town", "market", "guild"];
const CUSTOMER_TABS: CustomerTab[] = ["overview", "customers", "shopfront", "services", "status", "market"];
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

function ticketPatienceRemaining(ticket: { arrivedAtMs: number; patience: number; patienceRemaining: number } | undefined, nowMs: number): number {
  if (!ticket) return 0;
  const elapsed = Math.max(0, Math.floor((nowMs - ticket.arrivedAtMs) / 1000));
  return Math.max(0, Math.min(ticket.patienceRemaining, ticket.patience - elapsed));
}

function isTypingInInput(): boolean {
  if (typeof document === "undefined") return false;
  const active = document.activeElement as HTMLElement | null;
  if (!active) return false;
  const tag = active.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || active.isContentEditable;
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows.length ? rows : [[]];
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

export const HarthmereBusinessInterfacePanel: React.FunctionComponent<HarthmereBusinessInterfacePanelProps> = ({ adapter, nearbyBusinessId, context, onClose, compact = false, initialTab }) => {
  const pointerLockManager = usePointerLockManager();
  const shouldReturnPointerLock =
    React.useRef<PointerLockUnlockWhileOpenReturnRefV1>({ current: false });
  const activeBusinessId = nearbyBusinessId ?? context?.nearbyBusinessId ?? null;
  const available = adapter.isHydrated() && adapter.isAvailable(activeBusinessId);
  const business = activeBusinessId ? adapter.getBusiness(activeBusinessId) : undefined;
  const mode: HarthmereBusinessActorModeV1 = business && activeBusinessId ? adapter.getMode(activeBusinessId) : "customer";
  const tabs: PanelTab[] = mode === "owner" ? OWNER_TABS : CUSTOMER_TABS;
  const [activeTab, setActiveTab] = React.useState<PanelTab>(initialTab && tabs.includes(initialTab) ? initialTab : tabs[0]);

  React.useEffect(() => installBiomesUITheme(), []);
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

  if (!activeBusinessId || !available || !business) return null;
  const type = adapter.getBusinessType(activeBusinessId);

  return (
    <div
      role="dialog"
      aria-label={`${business.name} business interface`}
      data-harthmere-business-interface="true"
      data-business-interface-scope="inside-business-only"
      data-pointer-lock-policy="unlock-while-open"
      data-mouse-policy="show-while-open"
      data-business-id={activeBusinessId}
      data-business-mode={mode}
      className="biomes-ui-panel"
      style={{
        position: compact ? "relative" : "fixed",
        inset: compact ? undefined : "max(10px, env(safe-area-inset-top)) max(10px, env(safe-area-inset-right)) max(10px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left))",
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
      <header style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 12, alignItems: "start", marginBottom: 12 }}>
        <div>
          <h2 style={panelTitleStyle}>{business.name}</h2>
          <p style={mutedTextStyle}>{type?.displayName ?? displayLabel(business.typeId)} · {mode === "owner" ? "Owner Management" : "Customer Services"} · {displayLabel(business.status)}</p>
        </div>
        <button type="button" className="biomes-ui-tab" onClick={onClose} aria-label="Close business interface">Close</button>
      </header>

      <nav aria-label="Business interface sections" style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>
        {tabs.map((tab) => <button key={tab} type="button" className="biomes-ui-tab" aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)}>{TAB_LABELS[tab]}</button>)}
      </nav>

      {activeTab === "dashboard" && <OwnerDashboardPane adapter={adapter} businessId={activeBusinessId} />}
      {activeTab === "customers" && <CustomerMiniGamePane adapter={adapter} businessId={activeBusinessId} />}
      {activeTab === "overview" && <CustomerOverviewPane adapter={adapter} businessId={activeBusinessId} />}
      {activeTab === "orders" && <ContractBoardPane adapter={adapter} businessId={activeBusinessId} />}
      {activeTab === "shopfront" && <ShopfrontPane adapter={adapter} businessId={activeBusinessId} mode={mode} />}
      {activeTab === "finance" && <FinancePane adapter={adapter} businessId={activeBusinessId} />}
      {activeTab === "staff" && <StaffPane adapter={adapter} businessId={activeBusinessId} />}
      {activeTab === "empire" && <EmpirePane adapter={adapter} businessId={activeBusinessId} />}
      {activeTab === "licenses" && <CompliancePane adapter={adapter} businessId={activeBusinessId} />}
      {activeTab === "operations" && <OperationsPane adapter={adapter} businessId={activeBusinessId} mode={mode} />}
      {activeTab === "services" && <OperationsPane adapter={adapter} businessId={activeBusinessId} mode={mode} />}
      {activeTab === "status" && <CustomerStatusPane adapter={adapter} businessId={activeBusinessId} />}
      {activeTab === "town" && <TownHallPane adapter={adapter} />}
      {activeTab === "market" && <MarketplacePane adapter={adapter} />}
      {activeTab === "guild" && <GuildBusinessPane adapter={adapter} guildId={context?.actorGuildId} />}
    </div>
  );
};

const BikkieGraphicsStrip: React.FunctionComponent<{ graphics: readonly HarthmereBusinessBikkieGraphicV1[] }> = ({ graphics }) => {
  const shown = graphics.slice(0, 5);
  const primary = graphics.find((graphic) => graphic.role === "primary_station") ?? shown[0];
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
            const size = graphic.boxSize ? `${graphic.boxSize[0]}x${graphic.boxSize[1]}x${graphic.boxSize[2]}` : displayLabel(graphic.kind);
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
                  <p style={mutedTextStyle}>{displayLabel(graphic.role)} · {size} · {graphic.colors.slice(0, 3).join(", ")}</p>
                  <p style={{ ...mutedTextStyle, marginTop: 4 }}>{graphic.businessUse}</p>
                </div>
                <span style={bikkieGraphicKindStyle}>{displayLabel(graphic.kind)}</span>
              </div>
            );
          })}
        </div>
      ) : <p style={mutedTextStyle}>No Bikkie graphics are assigned.</p>}
    </section>
  );
};

const OwnerDashboardPane: React.FunctionComponent<{ adapter: HarthmereBusinessInterfaceAdapterV1; businessId: string }> = ({ adapter, businessId }) => {
  const dashboard = adapter.getOwnerDashboard(businessId);
  const report = adapter.getGrowthReport(businessId);
  const quests = adapter.getServiceQuests(businessId);
  const miniGame = adapter.getCustomerMiniGame(businessId);
  const business = adapter.getBusiness(businessId);
  const type = adapter.getBusinessType(businessId);
  const bikkieGraphics = adapter.getBikkieGraphics(businessId);
  const canOpen = Boolean(business?.propertyId && business.townId && business.licenseLevel >= (type?.minimumLicenseLevel ?? 1));
  const session = miniGame.activeSession;
  const shiftProgress = session ? `${session.servedTicketIds.length}/${session.queue.length} served` : `Tier ${miniGame.stats.currentTier} service`;
  const shiftHint = session ? `${session.earnedGold} gold earned · ${session.failedTicketIds.length} missed` : miniGame.dailyReturnTriggers[0];
  return (
    <div style={responsiveGridStyle}>
      <section style={highlightCardStyle}>
        <div>
          <h3 style={sectionTitleStyle}>Today's Floor</h3>
          <strong style={heroMetricStyle}>{shiftProgress}</strong>
          <p style={mutedTextStyle}>{shiftHint}</p>
        </div>
        <button className="biomes-ui-tab" type="button" disabled={Boolean(session)} onClick={() => void adapter.startCustomerSession(businessId)} style={session ? disabledButtonStyle : undefined}>Start Shift</button>
      </section>
      <BikkieGraphicsStrip graphics={bikkieGraphics} />
      {dashboard.metrics.map((metric) => <MetricCard key={metric.id} label={metric.label} value={metric.value} hint={metric.hint} />)}
      <section style={cardStyle}>
        <h3 style={sectionTitleStyle}>Daily Report</h3>
        <p style={mutedTextStyle}><strong>Earned:</strong> {report.earnedToday}</p>
        <p style={{ ...mutedTextStyle, marginTop: 6 }}><strong>Costs:</strong> {report.costsToday}</p>
        <p style={{ ...mutedTextStyle, marginTop: 6 }}><strong>Completed:</strong> {report.completedToday}</p>
        <p style={{ ...mutedTextStyle, marginTop: 6 }}><strong>Due soon:</strong> {report.expiringSoon}</p>
      </section>
      <section style={cardStyle}>
        <h3 style={sectionTitleStyle}>Growth Bottleneck</h3>
        <p style={mutedTextStyle}>{report.bottleneck}</p>
        <p style={{ ...mutedTextStyle, marginTop: 8 }}><strong>Active work:</strong> {report.activeWork}</p>
        <p style={{ ...mutedTextStyle, marginTop: 8 }}><strong>Stock focus:</strong> {report.inventoryFocus}</p>
        <p style={{ ...mutedTextStyle, marginTop: 8 }}><strong>Next upgrade:</strong> {report.nextUpgrade}</p>
      </section>
      <section style={cardStyle}>
        <h3 style={sectionTitleStyle}>Rewards Beyond Gold</h3>
        {report.rewardLayers.map((layer) => <p key={layer} style={mutedTextStyle}>{layer}</p>)}
      </section>
      <section style={cardStyle}>
        <h3 style={sectionTitleStyle}>Tasks</h3>
        {business?.status !== "open" && <button className="biomes-ui-tab" type="button" disabled={!canOpen} onClick={() => canOpen && void adapter.openBusiness(businessId, business?.propertyId, business?.townId)} style={!canOpen ? disabledButtonStyle : undefined}>Open Business</button>}
        {dashboard.todos.length ? dashboard.todos.map((todo) => <p key={todo.id} style={{ ...mutedTextStyle, marginTop: 8 }}><strong>{todo.label}:</strong> {todo.description}</p>) : <p style={mutedTextStyle}>No urgent tasks.</p>}
      </section>
      <section style={cardStyle}>
        <h3 style={sectionTitleStyle}>Field Service Quests</h3>
        {quests.length ? quests.map((quest) => <p key={quest.questId} style={mutedTextStyle}><strong>{quest.title}</strong><br />{quest.todoText}{quest.mapMarkerId ? ` · Map marker ${displayLabel(quest.mapMarkerId)}` : ""}</p>) : <p style={mutedTextStyle}>No accepted field-service quests yet.</p>}
      </section>
    </div>
  );
};

const CustomerMiniGamePane: React.FunctionComponent<{ adapter: HarthmereBusinessInterfaceAdapterV1; businessId: string }> = ({ adapter, businessId }) => {
  const panel = adapter.getCustomerMiniGame(businessId);
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
  return (
    <div style={responsiveGridStyle}>
      <MetricCard label="Served" value={`${panel.stats.totalServed}`} hint={`Best streak ${panel.stats.bestStreak} · Tier ${panel.stats.currentTier}`} />
      <MetricCard label="Shift" value={session ? `${served}/${session.queue.length}` : "Idle"} hint={session ? `${session.earnedGold} gold · ${failed} missed` : panel.dailyReturnTriggers[0]} />
      <section style={cardStyle}>
        <h3 style={sectionTitleStyle}>Getting a Job and Getting Paid</h3>
        <p style={mutedTextStyle}>
          <strong>{mechanic.gameTitle}:</strong> {mechanic.objective}
        </p>
        <div style={{ ...formRowStyle, marginTop: 12 }}>
          <button className="biomes-ui-tab" type="button" disabled={Boolean(session)} onClick={() => void adapter.startCustomerSession(businessId)} style={session ? disabledButtonStyle : undefined}>Start Shift</button>
        </div>
        {session?.notes.slice(-3).map((note) => <p key={note} style={{ ...mutedTextStyle, marginTop: 6 }}>{note}</p>)}
      </section>
      <section style={cardStyle} data-business-minigame-spec={mechanic.specId}>
        <h3 style={sectionTitleStyle}>Service Board</h3>
        <div style={{ display: "grid", gap: 8 }}>
          {mechanic.uiElements.map((element) => (
            <div key={element.elementId} style={rowCardStyle} data-business-minigame-ui-element={element.elementId}>
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
            <strong>{panel.currentNpc?.displayName ?? displayLabel(ticket.npcId)}</strong>
            <p style={{ ...mutedTextStyle, marginTop: 6 }}>{ticket.askLine}</p>
            <p style={{ ...mutedTextStyle, marginTop: 6 }}>Patience {displayedPatience}/{ticket.patience} · Difficulty {ticket.difficulty}</p>
            <RovingGrid
              ariaLabel="Customer service offers"
              items={chunk(panel.offers, 2)}
              onActivate={(_row, _col, offer) => void adapter.serveCustomer(
                businessId,
                offer.offerId,
                session?.sessionId,
                ticket.ticketId,
                createHarthmereBusinessMiniGameDecisionForOfferV1(panel.typeId as any, offer.offerId)
              )}
              renderCell={(offer, _coords, cell) => (
                <button ref={cell.ref} tabIndex={cell.tabIndex} onFocus={cell.onFocus} onKeyDown={cell.onKeyDown} onClick={cell.onClick} className="biomes-ui-tab" style={serviceButtonStyle} aria-label={offer.label}>
                  <strong>{offer.label}</strong>
                  <span style={mutedTextStyle}>{offer.description}</span>
                </button>
              )}
            />
          </>
        ) : <p style={mutedTextStyle}>{session ? "This shift is complete." : "Start a shift to bring customer-only NPCs to the counter."}</p>}
      </section>
      <section style={cardStyle}>
        <h3 style={sectionTitleStyle}>Rules</h3>
        {mechanic.winConditions.map((step) => <p key={step} style={mutedTextStyle}>{step}</p>)}
        {mechanic.edgeCases.slice(0, 3).map((step) => <p key={step} style={{ ...mutedTextStyle, marginTop: 6 }}>{step}</p>)}
      </section>
    </div>
  );
};

const CustomerOverviewPane: React.FunctionComponent<{ adapter: HarthmereBusinessInterfaceAdapterV1; businessId: string }> = ({ adapter, businessId }) => {
  const business = adapter.getBusiness(businessId)!;
  const shop = adapter.getShopfront(businessId);
  const miniGame = adapter.getCustomerMiniGame(businessId);
  return <div style={responsiveGridStyle}><MetricCard label="Satisfaction" value={`${business.customerSatisfaction}/100`} hint={`Reputation ${business.reputation}`} /><MetricCard label="Stock" value={`${shop.inventory.length}`} hint="public inventory stacks" /><BikkieGraphicsStrip graphics={miniGame.bikkieGraphics} /><section style={cardStyle}><h3 style={sectionTitleStyle}>How to use this business</h3><p style={mutedTextStyle}>{miniGame.definition.customerGoal}</p><p style={{ ...mutedTextStyle, marginTop: 8 }}>{miniGame.dailyReturnTriggers[0]}</p></section></div>;
};

const ContractBoardPane: React.FunctionComponent<{ adapter: HarthmereBusinessInterfaceAdapterV1; businessId: string }> = ({ adapter, businessId }) => {
  const board = adapter.getContractBoard(businessId);
  return <div style={responsiveGridStyle}><ContractList title="Open Orders" contracts={board.open} renderAction={(contract) => <button className="biomes-ui-tab" type="button" onClick={() => void adapter.acceptContract(businessId, contract.contractId)}>Accept</button>} /><ContractList title="Active Orders" contracts={board.active} renderAction={(contract) => <button className="biomes-ui-tab" type="button" onClick={() => void adapter.fulfillContract(businessId, contract.contractId)}>Fulfill</button>} /><ContractList title="Customer Status" contracts={board.customer} /></div>;
};

const ContractList: React.FunctionComponent<{ title: string; contracts: HarthmereBusinessContractV1[]; renderAction?: (contract: HarthmereBusinessContractV1) => React.ReactNode }> = ({ title, contracts, renderAction }) => <section style={cardStyle}><h3 style={sectionTitleStyle}>{title}</h3>{contracts.length ? contracts.map((contract) => <div key={contract.contractId} style={rowCardStyle}><div><strong>{contract.title}</strong><p style={mutedTextStyle}>{displayLabel(contract.status)} · {contract.rewardGold} gold · due {new Date(contract.deadlineAtMs).toLocaleDateString()}</p></div>{renderAction?.(contract)}</div>) : <p style={mutedTextStyle}>No matching orders.</p>}</section>;

const ShopfrontPane: React.FunctionComponent<{ adapter: HarthmereBusinessInterfaceAdapterV1; businessId: string; mode: HarthmereBusinessActorModeV1 }> = ({ adapter, businessId, mode }) => {
  const shop = adapter.getShopfront(businessId);
  const [itemId, setItemId] = React.useState("");
  const [count, setCount] = React.useState("1");
  const [priceItemId, setPriceItemId] = React.useState("");
  const [priceModifier, setPriceModifier] = React.useState("1");
  const parsedCount = Math.max(1, Number(count) || 1);
  return <section style={cardStyle}><h3 style={sectionTitleStyle}>{mode === "owner" ? "Shopfront & Inventory" : "Shopfront"}</h3>{mode === "owner" ? <><div style={formRowStyle}><input aria-label="Item" placeholder="Item" style={inputStyle} value={itemId} onChange={(event) => setItemId(event.currentTarget.value)} /><input aria-label="Count" placeholder="Count" style={{ ...inputStyle, width: 84 }} value={count} onChange={(event) => setCount(event.currentTarget.value)} /><button className="biomes-ui-tab" type="button" onClick={() => itemId && void adapter.depositInventory(businessId, itemId, parsedCount)}>Deposit</button><button className="biomes-ui-tab" type="button" onClick={() => itemId && void adapter.withdrawInventory(businessId, itemId, parsedCount)}>Withdraw</button></div><div style={formRowStyle}><input aria-label="Price Item" placeholder="Price Item" style={inputStyle} value={priceItemId} onChange={(event) => setPriceItemId(event.currentTarget.value)} /><input aria-label="Price Modifier" placeholder="Modifier" style={{ ...inputStyle, width: 104 }} value={priceModifier} onChange={(event) => setPriceModifier(event.currentTarget.value)} /><button className="biomes-ui-tab" type="button" onClick={() => priceItemId && void adapter.setPrices(businessId, { [priceItemId]: Number(priceModifier) || 1 })}>Set Price</button></div></> : <div style={formRowStyle}><label style={labelInlineStyle}>Quantity<input aria-label="Purchase quantity" style={{ ...inputStyle, width: 86 }} value={count} onChange={(event) => setCount(event.currentTarget.value)} /></label></div>}<InventoryGrid inventory={shop.inventory} emptyLabel={shop.emptyLabel} actionLabel={mode === "customer" ? "Buy" : undefined} onActivate={mode === "customer" ? (item) => void adapter.purchaseShopItem(businessId, item.itemId, parsedCount) : undefined} /></section>;
};

const InventoryGrid: React.FunctionComponent<{ inventory: HarthmereBusinessVisibleInventoryItemV1[]; emptyLabel: string; actionLabel?: string; onActivate?: (item: HarthmereBusinessVisibleInventoryItemV1) => void }> = ({ inventory, emptyLabel, actionLabel, onActivate }) => {
  if (!inventory.length) return <p style={mutedTextStyle}>{emptyLabel}</p>;
  return <RovingGrid ariaLabel="Business shopfront inventory" items={chunk(inventory, 4)} onActivate={(_row, _col, item) => onActivate?.(item)} renderCell={(item, _coords, cell) => {
    const itemLabel = displayLabel(item.itemId);
    return <button ref={cell.ref} tabIndex={cell.tabIndex} onFocus={cell.onFocus} onKeyDown={cell.onKeyDown} onClick={cell.onClick} className="biomes-ui-slot" style={{ width: 150, minHeight: 86, padding: 8, flexDirection: "column" }} aria-label={`${actionLabel ? `${actionLabel} ` : ""}${itemLabel} x${item.count}`}><strong style={{ fontSize: 12 }}>{itemLabel}</strong><span style={mutedTextStyle}>x{item.count} · {item.priceGold} gold</span>{actionLabel && <span style={actionTextStyle}>{actionLabel}</span>}</button>;
  }} />;
};

const FinancePane: React.FunctionComponent<{ adapter: HarthmereBusinessInterfaceAdapterV1; businessId: string }> = ({ adapter, businessId }) => {
  const panel = adapter.getFinancePanel(businessId);
  const [amount, setAmount] = React.useState("100");
  return <div style={responsiveGridStyle}><MetricCard label="Business Funds" value={`${panel.summary.balanceGold}`} hint={`Daily costs ${panel.summary.dailyUpkeepGold + panel.summary.dailyRentGold + panel.summary.dailyWagesGold}`} /><MetricCard label="Bank" value={`${panel.summary.bankBalanceGold}`} hint={`${panel.audit.length} audit events`} /><MetricCard label="Debt" value={`${panel.summary.debtGold}`} hint={`${panel.loans.length} loans · ${panel.insurancePolicies.length} policies`} /><section style={cardStyle}><h3 style={sectionTitleStyle}>Banking</h3><label style={labelStyle}>Gold amount<input style={inputStyle} value={amount} onChange={(event) => setAmount(event.currentTarget.value)} /></label><div style={formRowStyle}><button className="biomes-ui-tab" type="button" onClick={() => void adapter.createBankAccount(businessId)}>Create Account</button><button className="biomes-ui-tab" type="button" onClick={() => void adapter.transferPersonalToBusinessBank(businessId, Math.max(1, Number(amount) || 1))}>Deposit</button><button className="biomes-ui-tab" type="button" onClick={() => void adapter.transferBusinessToPersonalBank(businessId, Math.max(1, Number(amount) || 1))}>Withdraw</button></div></section></div>;
};

const StaffPane: React.FunctionComponent<{ adapter: HarthmereBusinessInterfaceAdapterV1; businessId: string }> = ({ adapter, businessId }) => {
  const panel = adapter.getStaffPanel(businessId);
  const [role, setRole] = React.useState("Worker");
  const [wage, setWage] = React.useState("12");
  const [assignedTask, setAssignedTask] = React.useState("front_counter");
  const [targetActorId, setTargetActorId] = React.useState("");
  const [permission, setPermission] = React.useState("employee_manager");
  return (
    <section style={cardStyle}>
      <h3 style={sectionTitleStyle}>Staff</h3>
      <div style={formRowStyle}>
        <input aria-label="Worker role" style={inputStyle} value={role} onChange={(event) => setRole(event.currentTarget.value)} />
        <input aria-label="Daily wage" style={{ ...inputStyle, width: 84 }} value={wage} onChange={(event) => setWage(event.currentTarget.value)} />
        <button className="biomes-ui-tab" type="button" onClick={() => void adapter.hireWorker(businessId, role, Math.max(1, Number(wage) || 1))}>Hire</button>
        <button className="biomes-ui-tab" type="button" onClick={() => void adapter.payPayroll(businessId)}>Pay Payroll</button>
        <button className="biomes-ui-tab" type="button" onClick={() => void adapter.refreshEmployeeCandidates(businessId, 3)}>Find Help</button>
      </div>
      <div style={formRowStyle}>
        <select aria-label="Assigned task" style={inputStyle} value={assignedTask} onChange={(event) => setAssignedTask(event.currentTarget.value)}>
          <option value="front_counter">Front Counter</option>
          <option value="stock_runner">Stock Runner</option>
          <option value="production_station">Production Station</option>
          <option value="quality_check">Quality Check</option>
          <option value="cleanup_route">Cleanup Route</option>
          <option value="dispatch_runner">Dispatch Runner</option>
          <option value="branch_manager">Branch Manager</option>
          <option value="rest_required">Rest Required</option>
        </select>
        <input aria-label="Permission target actor" placeholder="Player name" style={inputStyle} value={targetActorId} onChange={(event) => setTargetActorId(event.currentTarget.value)} />
        <select aria-label="Permission" style={inputStyle} value={permission} onChange={(event) => setPermission(event.currentTarget.value)}>
          <option value="employee_manager">Employee Manager</option>
          <option value="accountant">Accountant</option>
          <option value="inventory_manager">Inventory Manager</option>
          <option value="contract_manager">Contract Manager</option>
          <option value="price_manager">Price Manager</option>
          <option value="world_operator">World Operator</option>
          <option value="owner_admin">Owner Admin</option>
        </select>
        <button className="biomes-ui-tab" type="button" onClick={() => targetActorId && void adapter.grantPermission(businessId, targetActorId, [permission])}>Grant</button>
      </div>
      <p style={mutedTextStyle}>Payroll due: {panel.payrollDueGold} gold · Low morale: {panel.moraleWarnings.length}</p>
      {panel.employees.length ? panel.employees.map((employee) => (
        <div key={employee.employeeId} style={rowCardStyle}>
          <div>
            <strong>{displayLabel(employee.role)}</strong>
            <p style={mutedTextStyle}>Skill {employee.skill} · Wage {employee.wageGoldPerDay}/day · Morale {employee.morale} · Task {employee.assignedTask ? displayLabel(employee.assignedTask) : "Unassigned"}</p>
          </div>
          <div style={formRowStyle}>
            <button className="biomes-ui-tab" type="button" onClick={() => void adapter.assignWorker(businessId, employee.employeeId, assignedTask)}>Assign</button>
            <button className="biomes-ui-tab" type="button" onClick={() => void adapter.runEmployeeTask(businessId, employee.employeeId, assignedTask)}>Run Task</button>
            <button className="biomes-ui-tab" type="button" onClick={() => void adapter.trainWorker(businessId, employee.employeeId)}>Train</button>
            <button className="biomes-ui-tab" type="button" onClick={() => void adapter.promoteWorker(businessId, employee.employeeId, assignedTask as any)}>Promote</button>
            <button className="biomes-ui-tab" type="button" onClick={() => void adapter.fireWorker(businessId, employee.employeeId)}>Fire</button>
          </div>
        </div>
      )) : <p style={mutedTextStyle}>No workers are assigned yet.</p>}
      {panel.candidates.length ? (
        <>
          <h3 style={sectionTitleStyle}>Candidates</h3>
          {panel.candidates.map((candidate) => (
            <div key={candidate.candidateId} style={rowCardStyle}>
              <div>
                <strong>{candidate.displayName}</strong>
                <p style={mutedTextStyle}>{displayLabel(candidate.role)} · Skill {candidate.skill} · Asks {candidate.wageAskGoldPerDay}/day · {displayLabel(candidate.status)}</p>
                <p style={mutedTextStyle}>{displayLabel(candidate.personality)} · {displayLabel(candidate.schedule)} · Prefers {displayLabel(candidate.workplacePreference)}</p>
              </div>
              <div style={formRowStyle}>
                <button className="biomes-ui-tab" type="button" onClick={() => void adapter.interviewEmployeeCandidate(businessId, candidate.candidateId, "friendly")}>Interview</button>
                <button className="biomes-ui-tab" type="button" onClick={() => void adapter.negotiateEmployeeCandidate(businessId, candidate.candidateId, candidate.wageAskGoldPerDay)}>Offer</button>
                <button className="biomes-ui-tab" type="button" onClick={() => void adapter.hireEmployeeCandidate(businessId, candidate.candidateId)}>Hire</button>
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
                <p style={mutedTextStyle}>{displayLabel(run.status)} · Path {run.employeePath.length} steps · Animation {displayLabel(run.animationFamily)}</p>
              </div>
            </div>
          ))}
        </>
      ) : null}
    </section>
  );
};

const EmpirePane: React.FunctionComponent<{ adapter: HarthmereBusinessInterfaceAdapterV1; businessId: string }> = ({ adapter, businessId }) => {
  const panel = adapter.getEmpirePanel(businessId);
  const staff = adapter.getStaffPanel(businessId).employees;
  const shop = adapter.getShopfront(businessId);
  const [routeItemId, setRouteItemId] = React.useState(shop.inventory[0]?.itemId ?? "");
  const [routeCount, setRouteCount] = React.useState("1");
  const firstBranch = panel.branches.find((branch) => branch.status === "active") ?? panel.branches[0];
  const firstEmployee = staff[0];
  const branchDashboard = firstBranch ? panel.dashboards.find((dashboard) => dashboard.branchId === firstBranch.branchId) : undefined;
  return (
    <div style={responsiveGridStyle}>
      <MetricCard label="Branches" value={`${panel.branches.length}`} hint={`${panel.outpostBuildings.length} branch sites available`} />
      <MetricCard label="Daily Branch Revenue" value={`${panel.dailyRevenueGold}`} hint={`Upkeep ${panel.dailyUpkeepGold}`} />
      <MetricCard label="Branch Profit" value={`${panel.lifetimeProfitGold}`} hint={`${panel.automations.length} automations assigned`} />
      <section style={cardStyle}>
        <h3 style={sectionTitleStyle}>Empire Controls</h3>
        <div style={formRowStyle}>
          <button className="biomes-ui-tab" type="button" disabled={!panel.openBranchEligible} onClick={() => void adapter.openBranch(businessId, panel.outpostBuildings[0]?.outpostId)} style={!panel.openBranchEligible ? disabledButtonStyle : undefined}>Open Branch</button>
          <button className="biomes-ui-tab" type="button" disabled={!firstBranch} onClick={() => firstBranch && void adapter.assignAutomation(businessId, "branch_manager", firstBranch.branchId)} style={!firstBranch ? disabledButtonStyle : undefined}>Assign Manager</button>
          <button className="biomes-ui-tab" type="button" disabled={!panel.branches.length} onClick={() => void adapter.settleEmpireDay(businessId, 1)} style={!panel.branches.length ? disabledButtonStyle : undefined}>Collect Day</button>
        </div>
        <div style={formRowStyle}>
          <button className="biomes-ui-tab" type="button" disabled={!firstBranch || !firstEmployee} onClick={() => firstBranch && firstEmployee && void adapter.assignBranchManager(businessId, firstBranch.branchId, firstEmployee.employeeId)} style={!firstBranch || !firstEmployee ? disabledButtonStyle : undefined}>Set Regional Manager</button>
          <button className="biomes-ui-tab" type="button" disabled={!firstBranch || !staff.length} onClick={() => firstBranch && void adapter.scheduleBranchStaff(businessId, firstBranch.branchId, staff.slice(0, firstBranch.staffSlots).map((employee) => employee.employeeId))} style={!firstBranch || !staff.length ? disabledButtonStyle : undefined}>Schedule Staff</button>
          <button className="biomes-ui-tab" type="button" disabled={!firstBranch} onClick={() => firstBranch && void adapter.closeBranch(businessId, firstBranch.branchId)} style={!firstBranch ? disabledButtonStyle : undefined}>Close Branch</button>
        </div>
        <div style={formRowStyle}>
          <input aria-label="Route stock item" placeholder="Stock item" style={inputStyle} value={routeItemId} onChange={(event) => setRouteItemId(event.currentTarget.value)} />
          <input aria-label="Route stock count" placeholder="Count" style={{ ...inputStyle, width: 88 }} value={routeCount} onChange={(event) => setRouteCount(event.currentTarget.value)} />
          <button className="biomes-ui-tab" type="button" disabled={!firstBranch || !routeItemId} onClick={() => firstBranch && routeItemId && void adapter.routeBranchStock(businessId, firstBranch.branchId, routeItemId, Math.max(1, Number(routeCount) || 1))} style={!firstBranch || !routeItemId ? disabledButtonStyle : undefined}>Route Stock</button>
        </div>
        {panel.warnings.length ? panel.warnings.map((warning) => <p key={warning} style={mutedTextStyle}>{formatHarthmereBusinessPlayerWarningV1(warning)}</p>) : <p style={mutedTextStyle}>Branches, staff automation, and profit routing are ready.</p>}
      </section>
      <section style={cardStyle}>
        <h3 style={sectionTitleStyle}>Branches</h3>
        {panel.branches.length ? panel.branches.map((branch) => (
          <div key={branch.branchId} style={rowCardStyle}>
            <div>
              <strong>{displayLabel(branch.outpostId)}</strong>
              <p style={mutedTextStyle}>{displayLabel(branch.status)} · Revenue {branch.dailyRevenueGold} · Upkeep {branch.dailyUpkeepGold} · Queue +{branch.queueCapacityBonus}</p>
              <p style={mutedTextStyle}>Warehouse {Object.values(branch.warehouseInventory ?? {}).reduce((sum, count) => sum + count, 0)}/{branch.warehouseSlots ?? 0} · Staff {(branch.scheduledStaffIds ?? []).length}/{branch.staffSlots} · Demand {Math.round((branch.regionalDemandMultiplier ?? 1) * 100)}% · Pressure {branch.competitorPressure ?? 0}</p>
            </div>
          </div>
        )) : <p style={mutedTextStyle}>No branches are open yet.</p>}
      </section>
      <section style={cardStyle}>
        <h3 style={sectionTitleStyle}>Branch Dashboard</h3>
        {branchDashboard ? (
          <div style={rowCardStyle}>
            <div>
              <strong>{branchDashboard.dailyProfitGold} gold today</strong>
              <p style={mutedTextStyle}>Stock {branchDashboard.stockUnits} · Staff {Math.round(branchDashboard.staffCoverage * 100)}% · Demand {Math.round(branchDashboard.demandMultiplier * 100)}% · Pressure {branchDashboard.competitorPressure}</p>
              <p style={mutedTextStyle}>{branchDashboard.alerts.join(" · ")}</p>
            </div>
          </div>
        ) : <p style={mutedTextStyle}>Collect a branch day to create the first dashboard.</p>}
      </section>
      <section style={cardStyle}>
        <h3 style={sectionTitleStyle}>Automation</h3>
        {panel.automations.length ? panel.automations.map((automation) => (
          <div key={automation.automationId} style={rowCardStyle}>
            <div>
              <strong>{displayLabel(automation.role)}</strong>
              <p style={mutedTextStyle}>Level {automation.level} · Capacity +{automation.serviceCapacityBonus} · Profit {automation.passiveProfitGoldPerDay}/day · Upkeep {automation.dailyUpkeepGold}/day</p>
            </div>
          </div>
        )) : <p style={mutedTextStyle}>No branch automation is assigned yet.</p>}
      </section>
    </div>
  );
};

const CompliancePane: React.FunctionComponent<{ adapter: HarthmereBusinessInterfaceAdapterV1; businessId: string }> = ({ adapter, businessId }) => {
  const panel = adapter.getCompliancePanel(businessId);
  return <div style={responsiveGridStyle}><MetricCard label="License" value={`${displayLabel(panel.licenseClass)} ${panel.licenseLevel}`} hint={`Required ${panel.requiredLicense ? displayLabel(panel.requiredLicense) : "None"} level ${panel.minimumLicenseLevel ?? 0}`} /><MetricCard label="Safety" value={`${panel.safetyRating}`} hint="inspection rating" /><MetricCard label="Sanitation" value={`${panel.sanitationRating}`} hint="inspection rating" /><section style={cardStyle}><h3 style={sectionTitleStyle}>Warnings</h3>{panel.warnings.length ? panel.warnings.map((warning) => <p key={warning} style={mutedTextStyle}>{formatHarthmereBusinessPlayerWarningV1(warning)}</p>) : <p style={mutedTextStyle}>No current compliance warnings.</p>}</section></div>;
};

const OperationsPane: React.FunctionComponent<{ adapter: HarthmereBusinessInterfaceAdapterV1; businessId: string; mode: HarthmereBusinessActorModeV1 }> = ({ adapter, businessId, mode }) => {
  const screen = adapter.getOperationScreen(businessId);
  const actions = mode === "owner" ? screen.ownerActions : screen.customerActions;
  return <section style={cardStyle}><h3 style={sectionTitleStyle}>{screen.title} Operations</h3>{actions.length ? <RovingGrid ariaLabel="Business operation actions" items={chunk(actions, 3)} onActivate={(_row, _col, action) => mode === "owner" ? void adapter.runServiceAction(businessId, action.actionId) : void adapter.requestCustomerService(businessId, action.actionId)} renderCell={(action, _coords, cell) => <button ref={cell.ref} tabIndex={cell.tabIndex} onFocus={cell.onFocus} onKeyDown={cell.onKeyDown} onClick={cell.onClick} className="biomes-ui-tab" style={serviceButtonStyle} aria-label={action.label}><strong>{action.label}</strong><span style={mutedTextStyle}>{action.description}</span></button>} /> : <p style={mutedTextStyle}>No actions are available for this business type.</p>}<div style={{ marginTop: 12 }}><h3 style={sectionTitleStyle}>World Records</h3><p style={mutedTextStyle}>{Object.entries(screen.systemRecords).filter(([, rows]) => (rows as unknown[]).length > 0).map(([name, rows]) => `${displayLabel(name)}: ${(rows as unknown[]).length}`).join(" · ") || "No linked world records yet."}</p></div></section>;
};

const CustomerStatusPane: React.FunctionComponent<{ adapter: HarthmereBusinessInterfaceAdapterV1; businessId: string }> = ({ adapter, businessId }) => {
  const orders = adapter.getCustomerOrders(businessId);
  const business = adapter.getBusiness(businessId);
  const miniGame = adapter.getCustomerMiniGame(businessId);
  const activeCount = orders.filter((order) => order.status === "active").length;
  return <div style={responsiveGridStyle}><MetricCard label="Requests" value={`${orders.length}`} hint={`${activeCount} active`} /><MetricCard label="Business Trust" value={`${business?.customerSatisfaction ?? 0}/100`} hint={`Reputation ${business?.reputation ?? 0}`} /><section style={cardStyle}><h3 style={sectionTitleStyle}>Next Step</h3><p style={mutedTextStyle}>{orders.length ? "Track accepted work here until the owner fulfills it." : `Use Services to request work from this business. ${miniGame.definition.customerGoal}`}</p></section><ContractList title="Your Requests" contracts={orders} /></div>;
};

const TownHallPane: React.FunctionComponent<{ adapter: HarthmereBusinessInterfaceAdapterV1 }> = ({ adapter }) => {
  const panel = adapter.getTownHallPanel();
  return <div style={responsiveGridStyle}><MetricCard label="Towns" value={`${panel.towns.length}`} hint="tracked public economies" /><MetricCard label="Public Contracts" value={`${panel.publicContracts.length}`} hint="town or civic contracts" /><MetricCard label="Town Businesses" value={`${panel.townBusinesses.length}`} hint="public utilities and services" /></div>;
};

const MarketplacePane: React.FunctionComponent<{ adapter: HarthmereBusinessInterfaceAdapterV1 }> = ({ adapter }) => {
  const panel = adapter.getMarketplacePanel();
  return <section style={cardStyle}><h3 style={sectionTitleStyle}>Marketplace</h3><p style={mutedTextStyle}>{panel.openOrders.length} open orders · {Object.keys(panel.regionalPrices).length} regional prices</p>{panel.openOrders.slice(0, 8).map((order: any) => <div key={order.orderId} style={rowCardStyle}><div><strong>{displayLabel(order.itemId)}</strong><p style={mutedTextStyle}>{displayLabel(order.kind)} · x{order.count} · {order.unitPriceGold} gold</p></div></div>)}</section>;
};

const GuildBusinessPane: React.FunctionComponent<{ adapter: HarthmereBusinessInterfaceAdapterV1; guildId?: string }> = ({ adapter, guildId }) => {
  const panel = adapter.getGuildBusinessPanel(guildId);
  const permissionCount = Object.values(panel.permissions).reduce((sum, permissions) => sum + permissions.length, 0);
  return <div style={responsiveGridStyle}><MetricCard label="Guild Businesses" value={`${panel.guildBusinesses.length}`} hint="shared ownership records" /><MetricCard label="Guild Contracts" value={`${panel.guildContracts.length}`} hint="shared work and civic obligations" /><MetricCard label="Your Permissions" value={`${permissionCount}`} hint="roles granted to this actor" /><section style={cardStyle}><h3 style={sectionTitleStyle}>Guild Businesses</h3>{panel.guildBusinesses.length ? panel.guildBusinesses.map((business) => <div key={business.businessId} style={rowCardStyle}><div><strong>{business.name}</strong><p style={mutedTextStyle}>{displayLabel(business.typeId)} · Permissions {(panel.permissions[business.businessId] ?? []).map(displayLabel).join(", ") || "None"}</p></div></div>) : <p style={mutedTextStyle}>No guild-owned businesses are available to this actor yet. Start or join a guild business to share staff, contracts, and branch work.</p>}</section><ContractList title="Guild Contracts" contracts={panel.guildContracts} /></div>;
};

const MetricCard: React.FunctionComponent<{ label: string; value: string; hint: string }> = ({ label, value, hint }) => <section style={metricCardStyle}><h3 style={sectionTitleStyle}>{label}</h3><strong style={{ display: "block", fontSize: 22, marginBottom: 4 }}>{value}</strong><p style={mutedTextStyle}>{hint}</p></section>;

const panelTitleStyle: React.CSSProperties = { margin: 0, fontSize: 22, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--biomes-fg)" };
const sectionTitleStyle: React.CSSProperties = { margin: "0 0 8px", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--biomes-fg-muted)" };
const mutedTextStyle: React.CSSProperties = { margin: 0, fontSize: 12, color: "var(--biomes-fg-muted)", lineHeight: 1.45 };
const cardStyle: React.CSSProperties = { padding: 12, background: "var(--biomes-bg-glass)", border: "1px solid var(--biomes-edge-cyan-soft)", borderRadius: 4 };
const metricCardStyle: React.CSSProperties = { ...cardStyle, minHeight: 92, boxSizing: "border-box" };
const highlightCardStyle: React.CSSProperties = { ...cardStyle, display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 12, alignItems: "center", background: "linear-gradient(135deg, rgba(70, 104, 139, 0.28), rgba(17, 23, 34, 0.92))", borderColor: "rgba(154, 199, 230, 0.42)", minHeight: 108, boxSizing: "border-box" };
const heroMetricStyle: React.CSSProperties = { display: "block", fontSize: 24, marginBottom: 4, color: "var(--biomes-fg)" };
const rowCardStyle: React.CSSProperties = { ...cardStyle, display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 10, alignItems: "center", marginTop: 8 };
const bikkieGraphicRowStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "42px minmax(0, 1fr) auto", gap: 8, alignItems: "start", padding: "8px 0", borderTop: "1px solid rgba(154, 199, 230, 0.18)" };
const bikkieGraphicKindStyle: React.CSSProperties = { fontSize: 10, color: "var(--biomes-fg)", textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" };
const responsiveGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, alignItems: "start" };
const inputStyle: React.CSSProperties = { minWidth: 0, padding: "7px 9px", color: "var(--biomes-fg)", background: "var(--biomes-bg-deep)", border: "1px solid var(--biomes-edge-cyan-soft)", borderRadius: 4 };
const labelStyle: React.CSSProperties = { display: "grid", gap: 4, marginBottom: 8, fontSize: 11, color: "var(--biomes-fg-muted)", textTransform: "uppercase", letterSpacing: "0.12em" };
const labelInlineStyle: React.CSSProperties = { display: "flex", gap: 8, alignItems: "center", fontSize: 11, color: "var(--biomes-fg-muted)", textTransform: "uppercase", letterSpacing: "0.12em" };
const formRowStyle: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 };
const actionTextStyle: React.CSSProperties = { marginTop: 2, fontSize: 11, color: "var(--biomes-fg)", textTransform: "uppercase", letterSpacing: "0.08em" };
const disabledButtonStyle: React.CSSProperties = { opacity: 0.55, cursor: "not-allowed" };
const serviceButtonStyle: React.CSSProperties = { display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "flex-start", gap: 6, width: "100%", minWidth: 0, minHeight: 96, whiteSpace: "normal", textAlign: "left", border: "1px solid var(--biomes-edge-cyan-soft)", background: "var(--biomes-bg-glass)", borderRadius: 4, textTransform: "none", letterSpacing: 0 };
