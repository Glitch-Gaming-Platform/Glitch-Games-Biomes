// HARTHMERE_TOWN_MOUNT_DISMOUNT_POLICY_V1
export const HARTHMERE_TOWN_MOUNT_POLICY_V1 = {
  mainRoads: "mount allowed on main road service lane with mounted clearance and MOUNT_RADIUS safety",
  services: "mounted access allowed near stable ferry fast travel and travel mount approach points",
  interiors: "dismount required: mount interior no_mount mounts not allowed inside tight interiors, shops, inn rooms, temple aisles, and homes",
  stuckPrevention: "mount unstuck fallback: nearest dismount safe anchor, dismount safe fallback, nearest valid dismount point",
} as const;
