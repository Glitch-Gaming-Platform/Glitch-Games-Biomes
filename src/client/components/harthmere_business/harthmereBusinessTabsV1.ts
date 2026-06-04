// Pure, testable tab-label map for the Harthmere BusinessUI panel. Extracted
// from HarthmereBusinessInterfacePanel so the labels (e.g. the "Mini Game" tab)
// can be unit-tested without importing the React panel.

export const HARTHMERE_BUSINESS_TAB_LABELS_V1: Record<string, string> = {
  dashboard: "Dashboard",
  // The "customers" tab renders the customer mini-game pane, so it is labeled
  // "Mini Game".
  customers: "Mini Game",
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

export function harthmereBusinessTabLabelV1(tab: string): string {
  return HARTHMERE_BUSINESS_TAB_LABELS_V1[tab] ?? tab;
}
