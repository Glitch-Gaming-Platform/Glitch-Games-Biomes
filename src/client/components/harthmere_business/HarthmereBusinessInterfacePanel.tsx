import * as React from "react";
import { installBiomesUITheme } from "../biomes_ui/theme/biomesUITheme";
import { RovingGrid } from "../biomes_ui/nav/RovingGrid";
import type {
  HarthmereBusinessActorModeV1,
  HarthmereBusinessContractV1,
  HarthmereBusinessInterfaceAdapterV1,
  HarthmereBusinessServiceActionV1,
  HarthmereBusinessVisibleInventoryItemV1,
  HarthmereBusinessWorldContextV1,
} from "./businessInterfaceLiveAdapter";

export interface HarthmereBusinessInterfacePanelProps {
  adapter: HarthmereBusinessInterfaceAdapterV1;
  nearbyBusinessId?: string | null;
  context?: HarthmereBusinessWorldContextV1;
  onClose?: () => void;
  compact?: boolean;
}

type OwnerTab = "dashboard" | "orders" | "shopfront" | "finance" | "staff" | "licenses" | "operations" | "town" | "market" | "guild";
type CustomerTab = "overview" | "services" | "shopfront" | "status" | "market";
type PanelTab = OwnerTab | CustomerTab;

const OWNER_TABS: OwnerTab[] = ["dashboard", "orders", "shopfront", "finance", "staff", "licenses", "operations", "town", "market", "guild"];
const CUSTOMER_TABS: CustomerTab[] = ["overview", "services", "shopfront", "status", "market"];

function isTypingInInput(): boolean {
  if (typeof document === "undefined") return false;
  const active = document.activeElement as HTMLElement | null;
  if (!active) return false;
  const tag = active.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || active.isContentEditable;
}

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows.length ? rows : [[]];
}

export const HarthmereBusinessInterfacePanel: React.FunctionComponent<HarthmereBusinessInterfacePanelProps> = ({ adapter, nearbyBusinessId, context, onClose, compact = false }) => {
  const activeBusinessId = nearbyBusinessId ?? context?.nearbyBusinessId ?? null;
  const available = adapter.isHydrated() && adapter.isAvailable(activeBusinessId);
  const business = activeBusinessId ? adapter.getBusiness(activeBusinessId) : undefined;
  const mode: HarthmereBusinessActorModeV1 = business && activeBusinessId ? adapter.getMode(activeBusinessId) : "customer";
  const tabs: PanelTab[] = mode === "owner" ? OWNER_TABS : CUSTOMER_TABS;
  const [activeTab, setActiveTab] = React.useState<PanelTab>(tabs[0]);

  React.useEffect(() => installBiomesUITheme(), []);
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
        margin: compact ? undefined : "auto",
        overflow: "auto",
        padding: compact ? 12 : "16px 18px",
      }}
    >
      <header style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 12, alignItems: "start", marginBottom: 12 }}>
        <div>
          <h2 style={panelTitleStyle}>{business.name}</h2>
          <p style={mutedTextStyle}>{type?.displayName ?? business.typeId} · {mode === "owner" ? "Owner Management" : "Customer Services"} · {business.status}</p>
        </div>
        <button type="button" className="biomes-ui-tab" onClick={onClose} aria-label="Close business interface">Close</button>
      </header>

      <nav aria-label="Business interface sections" style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>
        {tabs.map((tab) => <button key={tab} type="button" className="biomes-ui-tab" aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)}>{tab}</button>)}
      </nav>

      {activeTab === "dashboard" && <OwnerDashboardPane adapter={adapter} businessId={activeBusinessId} />}
      {activeTab === "overview" && <CustomerOverviewPane adapter={adapter} businessId={activeBusinessId} />}
      {activeTab === "orders" && <ContractBoardPane adapter={adapter} businessId={activeBusinessId} />}
      {activeTab === "shopfront" && <ShopfrontPane adapter={adapter} businessId={activeBusinessId} mode={mode} />}
      {activeTab === "finance" && <FinancePane adapter={adapter} businessId={activeBusinessId} />}
      {activeTab === "staff" && <StaffPane adapter={adapter} businessId={activeBusinessId} />}
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

const OwnerDashboardPane: React.FunctionComponent<{ adapter: HarthmereBusinessInterfaceAdapterV1; businessId: string }> = ({ adapter, businessId }) => {
  const dashboard = adapter.getOwnerDashboard(businessId);
  const quests = adapter.getServiceQuests(businessId);
  return <div style={responsiveGridStyle}>{dashboard.metrics.map((metric) => <MetricCard key={metric.id} label={metric.label} value={metric.value} hint={metric.hint} />)}<section style={cardStyle}><h3 style={sectionTitleStyle}>Todos</h3>{dashboard.todos.length ? dashboard.todos.map((todo) => <p key={todo.id} style={mutedTextStyle}><strong>{todo.label}:</strong> {todo.description}</p>) : <p style={mutedTextStyle}>No urgent backend todos.</p>}</section><section style={cardStyle}><h3 style={sectionTitleStyle}>Field Service Quests</h3>{quests.length ? quests.map((quest) => <p key={quest.questId} style={mutedTextStyle}><strong>{quest.title}</strong><br />{quest.todoText} · marker {quest.mapMarkerId ?? "none"}</p>) : <p style={mutedTextStyle}>No accepted field-service quests yet.</p>}</section></div>;
};

const CustomerOverviewPane: React.FunctionComponent<{ adapter: HarthmereBusinessInterfaceAdapterV1; businessId: string }> = ({ adapter, businessId }) => {
  const business = adapter.getBusiness(businessId)!;
  const shop = adapter.getShopfront(businessId);
  return <div style={responsiveGridStyle}><MetricCard label="Satisfaction" value={`${business.customerSatisfaction}/100`} hint={`Reputation ${business.reputation}`} /><MetricCard label="Stock" value={`${shop.inventory.length}`} hint="public inventory stacks" /><section style={cardStyle}><h3 style={sectionTitleStyle}>How to use this business</h3><p style={mutedTextStyle}>Request a service, browse the shopfront, or check the status of your current orders.</p></section></div>;
};

const ContractBoardPane: React.FunctionComponent<{ adapter: HarthmereBusinessInterfaceAdapterV1; businessId: string }> = ({ adapter, businessId }) => {
  const board = adapter.getContractBoard(businessId);
  return <div style={responsiveGridStyle}><ContractList title="Open Orders" contracts={board.open} renderAction={(contract) => <button className="biomes-ui-tab" type="button" onClick={() => void adapter.acceptContract(businessId, contract.contractId)}>Accept</button>} /><ContractList title="Active Orders" contracts={board.active} renderAction={(contract) => <button className="biomes-ui-tab" type="button" onClick={() => void adapter.fulfillContract(businessId, contract.contractId)}>Fulfill</button>} /><ContractList title="Customer Status" contracts={board.customer} /></div>;
};

const ContractList: React.FunctionComponent<{ title: string; contracts: HarthmereBusinessContractV1[]; renderAction?: (contract: HarthmereBusinessContractV1) => React.ReactNode }> = ({ title, contracts, renderAction }) => <section style={cardStyle}><h3 style={sectionTitleStyle}>{title}</h3>{contracts.length ? contracts.map((contract) => <div key={contract.contractId} style={rowCardStyle}><div><strong>{contract.title}</strong><p style={mutedTextStyle}>{contract.status} · {contract.rewardGold} gold · due {new Date(contract.deadlineAtMs).toLocaleDateString()}</p></div>{renderAction?.(contract)}</div>) : <p style={mutedTextStyle}>No matching backend contracts.</p>}</section>;

const ShopfrontPane: React.FunctionComponent<{ adapter: HarthmereBusinessInterfaceAdapterV1; businessId: string; mode: HarthmereBusinessActorModeV1 }> = ({ adapter, businessId, mode }) => {
  const shop = adapter.getShopfront(businessId);
  const [itemId, setItemId] = React.useState("");
  const [count, setCount] = React.useState("1");
  return <section style={cardStyle}><h3 style={sectionTitleStyle}>{mode === "owner" ? "Shopfront & Inventory" : "Shopfront"}</h3>{mode === "owner" && <div style={formRowStyle}><input aria-label="Item id" placeholder="item_id" style={inputStyle} value={itemId} onChange={(event) => setItemId(event.currentTarget.value)} /><input aria-label="Count" placeholder="count" style={{ ...inputStyle, width: 84 }} value={count} onChange={(event) => setCount(event.currentTarget.value)} /><button className="biomes-ui-tab" type="button" onClick={() => itemId && void adapter.depositInventory(businessId, itemId, Math.max(1, Number(count) || 1))}>Deposit</button><button className="biomes-ui-tab" type="button" onClick={() => itemId && void adapter.withdrawInventory(businessId, itemId, Math.max(1, Number(count) || 1))}>Withdraw</button></div>}<InventoryGrid inventory={shop.inventory} emptyLabel={shop.emptyLabel} /></section>;
};

const InventoryGrid: React.FunctionComponent<{ inventory: HarthmereBusinessVisibleInventoryItemV1[]; emptyLabel: string }> = ({ inventory, emptyLabel }) => {
  if (!inventory.length) return <p style={mutedTextStyle}>{emptyLabel}</p>;
  return <RovingGrid ariaLabel="Business shopfront inventory" items={chunk(inventory, 4)} renderCell={(item, _coords, cell) => <button ref={cell.ref} tabIndex={cell.tabIndex} onFocus={cell.onFocus} onKeyDown={cell.onKeyDown} onClick={cell.onClick} className="biomes-ui-slot" style={{ width: 150, minHeight: 76, padding: 8, flexDirection: "column" }} aria-label={`${item.itemId} x${item.count}`}><strong style={{ fontSize: 12 }}>{item.itemId}</strong><span style={mutedTextStyle}>x{item.count} · {item.priceGold} gold</span></button>} />;
};

const FinancePane: React.FunctionComponent<{ adapter: HarthmereBusinessInterfaceAdapterV1; businessId: string }> = ({ adapter, businessId }) => {
  const panel = adapter.getFinancePanel(businessId);
  const [amount, setAmount] = React.useState("100");
  return <div style={responsiveGridStyle}><MetricCard label="Business Funds" value={`${panel.summary.balanceGold}`} hint={`Daily costs ${panel.summary.dailyUpkeepGold + panel.summary.dailyRentGold + panel.summary.dailyWagesGold}`} /><MetricCard label="Bank" value={`${panel.summary.bankBalanceGold}`} hint={`${panel.audit.length} audit events`} /><MetricCard label="Debt" value={`${panel.summary.debtGold}`} hint={`${panel.loans.length} loans · ${panel.insurancePolicies.length} policies`} /><section style={cardStyle}><h3 style={sectionTitleStyle}>Banking</h3><label style={labelStyle}>Gold amount<input style={inputStyle} value={amount} onChange={(event) => setAmount(event.currentTarget.value)} /></label><div style={formRowStyle}><button className="biomes-ui-tab" type="button" onClick={() => void adapter.createBankAccount(businessId)}>Create Account</button><button className="biomes-ui-tab" type="button" onClick={() => void adapter.transferPersonalToBusinessBank(businessId, Math.max(1, Number(amount) || 1))}>Deposit</button><button className="biomes-ui-tab" type="button" onClick={() => void adapter.transferBusinessToPersonalBank(businessId, Math.max(1, Number(amount) || 1))}>Withdraw</button></div></section></div>;
};

const StaffPane: React.FunctionComponent<{ adapter: HarthmereBusinessInterfaceAdapterV1; businessId: string }> = ({ adapter, businessId }) => {
  const panel = adapter.getStaffPanel(businessId);
  const [role, setRole] = React.useState("worker");
  const [wage, setWage] = React.useState("12");
  return <section style={cardStyle}><h3 style={sectionTitleStyle}>Staff</h3><div style={formRowStyle}><input style={inputStyle} value={role} onChange={(event) => setRole(event.currentTarget.value)} /><input style={{ ...inputStyle, width: 84 }} value={wage} onChange={(event) => setWage(event.currentTarget.value)} /><button className="biomes-ui-tab" type="button" onClick={() => void adapter.hireWorker(businessId, role, Math.max(1, Number(wage) || 1))}>Hire</button><button className="biomes-ui-tab" type="button" onClick={() => void adapter.payPayroll(businessId)}>Pay Payroll</button></div><p style={mutedTextStyle}>Payroll due: {panel.payrollDueGold} gold · low morale: {panel.moraleWarnings.length}</p>{panel.employees.length ? panel.employees.map((employee) => <div key={employee.employeeId} style={rowCardStyle}><div><strong>{employee.role}</strong><p style={mutedTextStyle}>Skill {employee.skill} · Wage {employee.wageGoldPerDay}/day · Morale {employee.morale}</p></div><button className="biomes-ui-tab" type="button" onClick={() => void adapter.assignWorker(businessId, employee.employeeId, "front_counter")}>Assign</button></div>) : <p style={mutedTextStyle}>No workers are assigned yet.</p>}</section>;
};

const CompliancePane: React.FunctionComponent<{ adapter: HarthmereBusinessInterfaceAdapterV1; businessId: string }> = ({ adapter, businessId }) => {
  const panel = adapter.getCompliancePanel(businessId);
  return <div style={responsiveGridStyle}><MetricCard label="License" value={`${panel.licenseClass} ${panel.licenseLevel}`} hint={`Required ${panel.requiredLicense ?? "none"} level ${panel.minimumLicenseLevel ?? 0}`} /><MetricCard label="Safety" value={`${panel.safetyRating}`} hint="inspection rating" /><MetricCard label="Sanitation" value={`${panel.sanitationRating}`} hint="inspection rating" /><section style={cardStyle}><h3 style={sectionTitleStyle}>Warnings</h3>{panel.warnings.length ? panel.warnings.map((warning) => <p key={warning} style={mutedTextStyle}>{warning}</p>) : <p style={mutedTextStyle}>No current compliance warnings.</p>}</section></div>;
};

const OperationsPane: React.FunctionComponent<{ adapter: HarthmereBusinessInterfaceAdapterV1; businessId: string; mode: HarthmereBusinessActorModeV1 }> = ({ adapter, businessId, mode }) => {
  const screen = adapter.getOperationScreen(businessId);
  const actions = mode === "owner" ? screen.ownerActions : screen.customerActions;
  return <section style={cardStyle}><h3 style={sectionTitleStyle}>{screen.title} Operations</h3>{actions.length ? <RovingGrid ariaLabel="Business operation actions" items={chunk(actions, 3)} onActivate={(_row, _col, action) => mode === "owner" ? void adapter.runServiceAction(businessId, action.actionId) : void adapter.requestCustomerService(businessId, action.actionId)} renderCell={(action, _coords, cell) => <button ref={cell.ref} tabIndex={cell.tabIndex} onFocus={cell.onFocus} onKeyDown={cell.onKeyDown} onClick={() => { cell.onClick(); mode === "owner" ? void adapter.runServiceAction(businessId, action.actionId) : void adapter.requestCustomerService(businessId, action.actionId); }} className="biomes-ui-tab" style={serviceButtonStyle} aria-label={action.label}><strong>{action.label}</strong><span style={mutedTextStyle}>{action.description}</span></button>} /> : <p style={mutedTextStyle}>No actions are available for this business type.</p>}<div style={{ marginTop: 12 }}><h3 style={sectionTitleStyle}>World Records</h3><p style={mutedTextStyle}>{Object.entries(screen.systemRecords).filter(([, rows]) => (rows as unknown[]).length > 0).map(([name, rows]) => `${name}: ${(rows as unknown[]).length}`).join(" · ") || "No linked world records yet."}</p></div></section>;
};

const CustomerStatusPane: React.FunctionComponent<{ adapter: HarthmereBusinessInterfaceAdapterV1; businessId: string }> = ({ adapter, businessId }) => {
  const orders = adapter.getCustomerOrders(businessId);
  return <ContractList title="Your Requests" contracts={orders} />;
};

const TownHallPane: React.FunctionComponent<{ adapter: HarthmereBusinessInterfaceAdapterV1 }> = ({ adapter }) => {
  const panel = adapter.getTownHallPanel();
  return <div style={responsiveGridStyle}><MetricCard label="Towns" value={`${panel.towns.length}`} hint="tracked public economies" /><MetricCard label="Public Contracts" value={`${panel.publicContracts.length}`} hint="town or civic contracts" /><MetricCard label="Town Businesses" value={`${panel.townBusinesses.length}`} hint="public utilities and services" /></div>;
};

const MarketplacePane: React.FunctionComponent<{ adapter: HarthmereBusinessInterfaceAdapterV1 }> = ({ adapter }) => {
  const panel = adapter.getMarketplacePanel();
  return <section style={cardStyle}><h3 style={sectionTitleStyle}>Marketplace</h3><p style={mutedTextStyle}>{panel.openOrders.length} open orders · {Object.keys(panel.regionalPrices).length} regional prices</p>{panel.openOrders.slice(0, 8).map((order: any) => <div key={order.orderId} style={rowCardStyle}><div><strong>{order.itemId}</strong><p style={mutedTextStyle}>{order.kind} · x{order.count} · {order.unitPriceGold} gold</p></div></div>)}</section>;
};

const GuildBusinessPane: React.FunctionComponent<{ adapter: HarthmereBusinessInterfaceAdapterV1; guildId?: string }> = ({ adapter, guildId }) => {
  const panel = adapter.getGuildBusinessPanel(guildId);
  return <section style={cardStyle}><h3 style={sectionTitleStyle}>Guild Businesses</h3>{panel.guildBusinesses.length ? panel.guildBusinesses.map((business) => <div key={business.businessId} style={rowCardStyle}><div><strong>{business.name}</strong><p style={mutedTextStyle}>{business.typeId} · permissions {(panel.permissions[business.businessId] ?? []).join(", ") || "none"}</p></div></div>) : <p style={mutedTextStyle}>No guild-owned businesses are available to this actor.</p>}</section>;
};

const MetricCard: React.FunctionComponent<{ label: string; value: string; hint: string }> = ({ label, value, hint }) => <section style={cardStyle}><h3 style={sectionTitleStyle}>{label}</h3><strong style={{ display: "block", fontSize: 22, marginBottom: 4 }}>{value}</strong><p style={mutedTextStyle}>{hint}</p></section>;

const panelTitleStyle: React.CSSProperties = { margin: 0, fontSize: 22, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--biomes-fg)" };
const sectionTitleStyle: React.CSSProperties = { margin: "0 0 8px", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--biomes-fg-muted)" };
const mutedTextStyle: React.CSSProperties = { margin: 0, fontSize: 12, color: "var(--biomes-fg-muted)", lineHeight: 1.45 };
const cardStyle: React.CSSProperties = { padding: 12, background: "var(--biomes-bg-glass)", border: "1px solid var(--biomes-edge-cyan-soft)", borderRadius: 4 };
const rowCardStyle: React.CSSProperties = { ...cardStyle, display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 10, alignItems: "center", marginTop: 8 };
const responsiveGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, alignItems: "start" };
const inputStyle: React.CSSProperties = { minWidth: 0, padding: "7px 9px", color: "var(--biomes-fg)", background: "var(--biomes-bg-deep)", border: "1px solid var(--biomes-edge-cyan-soft)", borderRadius: 4 };
const labelStyle: React.CSSProperties = { display: "grid", gap: 4, marginBottom: 8, fontSize: 11, color: "var(--biomes-fg-muted)", textTransform: "uppercase", letterSpacing: "0.12em" };
const formRowStyle: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 };
const serviceButtonStyle: React.CSSProperties = { display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "flex-start", gap: 6, width: "100%", minWidth: 220, minHeight: 96, whiteSpace: "normal", textAlign: "left", border: "1px solid var(--biomes-edge-cyan-soft)", background: "var(--biomes-bg-glass)", borderRadius: 4 };
