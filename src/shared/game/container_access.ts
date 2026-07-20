import type { AclAction } from "@/shared/acl_types";

/**
 * Opening or transferring items through a storage container is an interaction,
 * not a request to demolish the placeable. Keeping this action in one shared
 * constant prevents the client prompt and the server inventory validator from
 * drifting back to the old `destroy` permission check.
 */
export const CONTAINER_ACCESS_ACL_ACTION: AclAction = "interact";
