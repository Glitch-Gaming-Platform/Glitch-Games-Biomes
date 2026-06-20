export function plantInspectionCanHarvest(
  status: string | undefined,
  farmingKind: string | undefined
) {
  return status === "fully_grown" && farmingKind !== "tree";
}

export function plantInspectionShortcutTitlesForTest({
  status,
  farmingKind,
  destroyPermitted = false,
}: {
  status?: string;
  farmingKind?: string;
  destroyPermitted?: boolean;
}) {
  const titles: string[] = [];
  if (plantInspectionCanHarvest(status, farmingKind)) {
    titles.push("Harvest");
  }
  if (destroyPermitted) {
    titles.push("[Admin] Destroy Plant");
  }
  return titles;
}
