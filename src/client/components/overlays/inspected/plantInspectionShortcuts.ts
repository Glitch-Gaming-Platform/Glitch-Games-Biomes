export function plantInspectionCanHarvestV1(
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
  if (plantInspectionCanHarvestV1(status, farmingKind)) {
    titles.push("Harvest");
  }
  if (destroyPermitted) {
    titles.push("[Admin] Destroy Plant");
  }
  return titles;
}
