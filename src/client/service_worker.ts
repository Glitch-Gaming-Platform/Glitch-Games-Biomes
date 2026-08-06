import {
  firebaseDisabledForRuntime,
  initializeFirebaseIfNeeded,
} from "@/client/game/firebase";
import {
  decodePushPayload,
  handleBackgroundPush,
} from "@/client/util/push_notifications";
import { log } from "@/shared/logging";
import { fireAndForget } from "@/shared/util/async";
import { getMessaging, onBackgroundMessage } from "firebase/messaging/sw";

// eslint-disable-next-line unused-imports/no-unused-vars
declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: ReadonlyArray<{ revision: string | null; url: string }>;
};

// Hack to use next-pwa.
//
// HARTHMERE_SERVICE_WORKER_MANIFEST (2026-08-04 asset loading audit, finding 2):
// this reference exists ONLY because next-pwa's InjectManifest plugin fails the
// build when the `self.__WB_MANIFEST` token is missing from the worker source.
// Nothing here precaches, and next.config.js now contributes no public-tree
// entries -- the default (glob every file under public/) produced a 6.88 MB
// service worker listing every .fbx, .glb, icon and voice line in the repo,
// downloaded by every player on first load and after every deploy, and never
// read. Workbox may still inject a small list of webpack outputs; it is likewise
// unused.
//
// If precaching is ever wanted, pass this to `precacheAndRoute` AND scope the
// manifest in next.config.js; an unscoped manifest here means precaching
// gigabytes of game assets into the browser's cache storage.
// eslint-disable-next-line unused-imports/no-unused-vars
const manifest = self.__WB_MANIFEST;

if (firebaseDisabledForRuntime()) {
  log.info("[background]: Firebase push disabled for Glitch/no-GCP runtime.");
} else {
  initializeFirebaseIfNeeded();

  log.info("[background]: Listening for activity.");

  onBackgroundMessage(getMessaging(), (payload) => {
    log.info("[background] got push message");
    const envelope = decodePushPayload(payload);
    if (!envelope) {
      log.warn("[background] could not decode push payload");
      return;
    }
    fireAndForget(handleBackgroundPush(self.registration, envelope));
  });
}
