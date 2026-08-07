import type { SocialManager } from "@/client/game/context_managers/social_manager";
import { cleanEmitterCallback } from "@/client/util/helpers";
import type { BiomesId } from "@/shared/ids";
import type { UserInfoBundle } from "@/shared/util/fetch_bundles";

type UserInfoInvalidationListener = (
  invalidatedBundle: UserInfoBundle | null
) => void;

interface UserInfoInvalidationBroker {
  listenersByUserId: Map<BiomesId, Set<UserInfoInvalidationListener>>;
  subscriberCount: number;
  cleanup: () => void;
}

// Nameplates, chat rows, notifications, maps, and social UI can render more
// than 100 users at once. Attaching one EventEmitter listener per React hook
// crosses Node's listener warning threshold even when every hook cleans up
// correctly. Keep one listener per SocialManager and fan out by user id here.
const brokers = new WeakMap<SocialManager, UserInfoInvalidationBroker>();

function createBroker(
  socialManager: SocialManager
): UserInfoInvalidationBroker {
  const listenersByUserId = new Map<
    BiomesId,
    Set<UserInfoInvalidationListener>
  >();
  const broker: UserInfoInvalidationBroker = {
    listenersByUserId,
    subscriberCount: 0,
    cleanup: () => {},
  };
  broker.cleanup = cleanEmitterCallback(socialManager.emitter, {
    invalidateUserInfo: (userId, invalidatedBundle) => {
      const listeners = listenersByUserId.get(userId);
      if (!listeners) return;
      // Copy before dispatch so an unmount during a callback cannot skip the
      // next subscriber or mutate the active iteration.
      for (const listener of [...listeners]) listener(invalidatedBundle);
    },
  });
  brokers.set(socialManager, broker);
  return broker;
}

export function subscribeUserInfoInvalidation(
  socialManager: SocialManager,
  userId: BiomesId | undefined | null,
  listener: UserInfoInvalidationListener
) {
  if (userId === undefined || userId === null) {
    return () => {};
  }
  const broker = brokers.get(socialManager) ?? createBroker(socialManager);
  let listeners = broker.listenersByUserId.get(userId);
  if (!listeners) {
    listeners = new Set();
    broker.listenersByUserId.set(userId, listeners);
  }
  listeners.add(listener);
  broker.subscriberCount += 1;

  let active = true;
  return () => {
    if (!active) return;
    active = false;
    listeners!.delete(listener);
    if (listeners!.size === 0) {
      broker.listenersByUserId.delete(userId);
    }
    broker.subscriberCount -= 1;
    if (broker.subscriberCount === 0) {
      broker.cleanup();
      brokers.delete(socialManager);
    }
  };
}
