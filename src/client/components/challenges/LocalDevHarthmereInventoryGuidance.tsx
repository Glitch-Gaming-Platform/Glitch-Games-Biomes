
import React, { useMemo, useState } from "react";

export const HARTHMERE_INVENTORY_GUIDANCE_VERSION = "harthmere-inventory-guidance-ui-v1";

export type HarthmereGuidanceItem = {
  instanceId: string;
  itemId: string;
  name: string;
  category: string;
  quality: string;
  source?: string;
  binding?: string;
  tradeability?: "tradeable" | "bound" | "quest_protected" | "locked" | "escrowed" | "learned_collection";
  vendorValue?: number;
  useEffect?: string;
  cooldownMs?: number;
  equipRequirements?: string[];
  stats?: Record<string, number>;
  durability?: number;
  durabilityMax?: number;
  locked?: boolean;
  questItem?: boolean;
  safeToSell?: boolean;
};

export type HarthmereInventoryFilterState = {
  search: string;
  category: string;
  sort: "name" | "quality" | "vendor_value" | "durability" | "source";
  showOnlySafeToSell?: boolean;
};

export type HarthmereItemTooltip = {
  title: string;
  source: string;
  binding: string;
  tradeability: string;
  vendorValue: string;
  useEffect: string;
  cooldown: string;
  equipRequirements: string;
  safeToSell: string;
  questItemWarning?: string;
  durabilityWarning?: string;
  bindingWarning?: string;
  destroyConfirmation: string;
  compareStats: string[];
};

export function filterHarthmereInventoryItems(items: HarthmereGuidanceItem[], filter: HarthmereInventoryFilterState) {
  const query = filter.search.trim().toLowerCase();
  return items
    .filter((item) => !query || item.name.toLowerCase().includes(query) || item.itemId.toLowerCase().includes(query) || (item.source ?? "").toLowerCase().includes(query))
    .filter((item) => filter.category === "all" || item.category === filter.category)
    .filter((item) => !filter.showOnlySafeToSell || item.safeToSell === true)
    .sort((a, b) => {
      if (filter.sort === "vendor_value") return (b.vendorValue ?? 0) - (a.vendorValue ?? 0);
      if (filter.sort === "durability") return ((a.durability ?? 9999) / Math.max(1, a.durabilityMax ?? 1)) - ((b.durability ?? 9999) / Math.max(1, b.durabilityMax ?? 1));
      if (filter.sort === "quality") return a.quality.localeCompare(b.quality) || a.name.localeCompare(b.name);
      if (filter.sort === "source") return (a.source ?? "").localeCompare(b.source ?? "") || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name);
    });
}

export function getHarthmereTradeabilityExplanation(item: HarthmereGuidanceItem) {
  if (item.questItem || item.tradeability === "quest_protected") return "Quest item: protected from sale, trade, mail, auction, and destruction.";
  if (item.locked || item.tradeability === "locked") return "Locked item: unlock it before trading, selling, mailing, or destroying.";
  if (item.binding === "bound" || item.tradeability === "bound") return "Bound item: cannot be traded, mailed, auctioned, or sold.";
  if (item.tradeability === "escrowed") return "Escrowed item: already held by auction/trade recovery.";
  if (item.tradeability === "learned_collection") return "Collection unlock: learned mounts and pets cannot be sold after learned.";
  return "Tradeable: can be traded, sold, mailed, or auctioned if the target system accepts this category.";
}

export function getHarthmereSafeToSellState(item: HarthmereGuidanceItem) {
  const reasons: string[] = [];
  if (item.questItem) reasons.push("quest item");
  if (item.locked) reasons.push("locked");
  if (item.binding === "bound") reasons.push("bound");
  if ((item.vendorValue ?? 0) <= 0) reasons.push("no vendor value");
  if (item.useEffect) reasons.push("has use effect");
  if (item.equipRequirements?.length) reasons.push("equipment candidate");
  if (reasons.length > 0) return { safe: false, label: `Do not sell: ${reasons.join(", ")}.` };
  return { safe: item.safeToSell === true, label: item.safeToSell ? "Safe to sell junk/trade good." : "Review before selling." };
}

export function getHarthmereDurabilityWarning(item: HarthmereGuidanceItem) {
  if (!item.durabilityMax) return undefined;
  const ratio = (item.durability ?? item.durabilityMax) / item.durabilityMax;
  if (ratio <= 0) return "Broken: repair before using.";
  if (ratio < 0.25) return "Critical durability: repair soon.";
  if (ratio < 0.5) return "Worn: reduced value and possible combat penalties.";
  return undefined;
}

export function getHarthmereBindingWarning(item: HarthmereGuidanceItem) {
  if (item.binding === "bind_on_equip") return "Warning: equipping this item will bind it to you.";
  if (item.binding === "bind_on_use") return "Warning: using this item will bind or consume it.";
  if (item.binding === "account_bound") return "Account-bound: can use shared storage but cannot be traded to other players.";
  return undefined;
}

export function buildHarthmereItemTooltip(item: HarthmereGuidanceItem, equipped?: HarthmereGuidanceItem): HarthmereItemTooltip {
  const safe = getHarthmereSafeToSellState(item);
  const compareStats = Object.entries(item.stats ?? {}).map(([stat, value]) => {
    const delta = value - (equipped?.stats?.[stat] ?? 0);
    return `${stat}: ${value} (${delta >= 0 ? "+" : ""}${delta})`;
  });
  return {
    title: `${item.name} [${item.quality}]`,
    source: `Source: ${item.source ?? "Unknown"}`,
    binding: `Binding: ${item.binding ?? "unbound"}`,
    tradeability: getHarthmereTradeabilityExplanation(item),
    vendorValue: `Vendor value: ${item.vendorValue ?? 0} gold`,
    useEffect: `Use effect: ${item.useEffect ?? "none"}`,
    cooldown: `Cooldown: ${item.cooldownMs ? `${Math.ceil(item.cooldownMs / 1000)}s` : "none"}`,
    equipRequirements: `Equip requirements: ${item.equipRequirements?.join(", ") || "none"}`,
    safeToSell: safe.label,
    questItemWarning: item.questItem ? "Quest item: cannot be sold, destroyed, traded, mailed, auctioned, or banked outside quest storage." : undefined,
    durabilityWarning: getHarthmereDurabilityWarning(item),
    bindingWarning: getHarthmereBindingWarning(item),
    destroyConfirmation: getHarthmereDestroyConfirmationText(item),
    compareStats,
  };
}

export function getHarthmereDestroyConfirmationText(item: HarthmereGuidanceItem) {
  if (item.questItem) return "Cannot destroy quest items. Use recovery or abandon/restart rules.";
  if (item.locked) return "Unlock this item before destruction. This prevents accidental loss.";
  if ((item.vendorValue ?? 0) >= 100) return `Type DESTROY to delete high-value item ${item.name}.`;
  return `Confirm destruction of ${item.name}. This cannot be undone.`;
}

export function confirmHarthmereItemDestroy(item: HarthmereGuidanceItem, confirmation: string) {
  if (item.questItem) return { ok: false, reason: "quest_item_protected" as const };
  if (item.locked) return { ok: false, reason: "locked_item" as const };
  if ((item.vendorValue ?? 0) >= 100 && confirmation !== "DESTROY") return { ok: false, reason: "requires_destroy_text" as const };
  if ((item.vendorValue ?? 0) < 100 && confirmation !== item.instanceId) return { ok: false, reason: "requires_instance_confirmation" as const };
  return { ok: true };
}

const DEMO_ITEMS: HarthmereGuidanceItem[] = [
  { instanceId: "demo-1", itemId: "iron_longsword", name: "Iron Longsword", category: "weapon", quality: "common", source: "Weapons Counter", binding: "bind_on_equip", tradeability: "tradeable", vendorValue: 55, useEffect: "Equip as main-hand weapon", cooldownMs: 0, equipRequirements: ["level 1"], stats: { attack: 8 }, durability: 41, durabilityMax: 60, safeToSell: false },
  { instanceId: "demo-2", itemId: "cracked_mug", name: "Cracked Mug", category: "junk", quality: "poor", source: "Copper Kettle cleanup", binding: "unbound", tradeability: "tradeable", vendorValue: 1, safeToSell: true },
  { instanceId: "demo-3", itemId: "bank_lockbox_clue", name: "Bank Lockbox Clue", category: "quest_item", quality: "quest", source: "Missing Lockbox", binding: "quest_bound", tradeability: "quest_protected", vendorValue: 0, questItem: true, locked: true, safeToSell: false },
];

export const HarthmereInventoryGuidancePanel: React.FunctionComponent<{}> = () => {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<HarthmereInventoryFilterState["sort"]>("name");
  const items = useMemo(() => filterHarthmereInventoryItems(DEMO_ITEMS, { search, category, sort }), [search, category, sort]);
  return (
    <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs" data-harthmere-inventory-guidance="v1">
      <div className="text-sm font-bold text-sky-100">Inventory Guidance</div>
      <div className="grid gap-2 md:grid-cols-3">
        <input className="rounded bg-black/40 p-1" placeholder="Search inventory" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="rounded bg-black/40 p-1" value={category} onChange={(e) => setCategory(e.target.value)}><option value="all">All categories</option><option value="weapon">Weapons</option><option value="quest_item">Quest items</option><option value="junk">Junk</option></select>
        <select className="rounded bg-black/40 p-1" value={sort} onChange={(e) => setSort(e.target.value as HarthmereInventoryFilterState["sort"])}><option value="name">Name</option><option value="quality">Quality</option><option value="vendor_value">Vendor value</option><option value="durability">Durability</option><option value="source">Source</option></select>
      </div>
      {items.map((item) => {
        const tooltip = buildHarthmereItemTooltip(item, DEMO_ITEMS[0]);
        return <div key={item.instanceId} className="rounded-lg bg-black/30 p-2"><div className="font-semibold">{tooltip.title}</div><div className="text-white/60">{tooltip.source} · {tooltip.binding} · {tooltip.safeToSell}</div>{tooltip.durabilityWarning && <div className="text-orange-200">{tooltip.durabilityWarning}</div>}{tooltip.questItemWarning && <div className="text-yellow-200">{tooltip.questItemWarning}</div>}</div>;
      })}
    </div>
  );
};
