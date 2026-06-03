const HARTHMERE_NON_LIVING_DIALOG_OBJECT_RE_V1 =
  /\b(crate|chest|box|barrel|container|cache|satchel|bag|basket|bin|locker|wardrobe|cabinet|shelf|workbench|anvil|board|sign|post|marker|ledger|book|note|cart|wagon)\b/i;
const HARTHMERE_LIVING_DIALOG_OBJECT_EXEMPTION_RE_V1 =
  /\b(robot|bot|construct|golem|person|traveler|runner|ranger|doctor|medic|clerk|banker|baker|cook|forager|courier|guard|wayfinder|farmer|merchant|vendor|mucker|hex)\b/i;

export function isHarthmereNonLivingDialogueObjectLabelV1(input: {
  label?: string | null;
  entityDescription?: string | null;
}) {
  const text = `${input.label ?? ""} ${input.entityDescription ?? ""}`.trim();
  if (!text) {
    return false;
  }
  return (
    HARTHMERE_NON_LIVING_DIALOG_OBJECT_RE_V1.test(text) &&
    !HARTHMERE_LIVING_DIALOG_OBJECT_EXEMPTION_RE_V1.test(text)
  );
}
