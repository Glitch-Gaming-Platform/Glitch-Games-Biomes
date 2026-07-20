import type { BakedBiscuitTray } from "@/server/shared/bikkie/registry";
import type { BikkieStorage } from "@/server/shared/bikkie/storage/api";
import type { Notifier } from "@/server/shared/distributed_notifier/api";
import type { WorldApi } from "@/server/shared/world/api";
import { BikkieRuntime } from "@/shared/bikkie/active";
import { WorldMetadataId } from "@/shared/ecs/ids";
import { withHarthmereNativeBikkieItems } from "@/shared/harthmere/harthmere_native_bikkie_items";
import type { BiomesId } from "@/shared/ids";
import { log } from "@/shared/logging";
import type { RegistryLoader } from "@/shared/registry";

export class BikkieRefresher {
  private pendingRefresh = false;
  private inflightRefresh: Promise<unknown> = Promise.resolve();
  private prior: BakedBiscuitTray | undefined;

  constructor(
    private readonly notifier: Notifier,
    private readonly runtime: BikkieRuntime,
    private readonly storage: BikkieStorage,
    private readonly worldApi?: WorldApi
  ) {
    this.notifier.on("change", (trayId: string) => {
      if (String(this.prior?.id) === trayId) {
        return;
      }
      if (this.pendingRefresh) {
        // One already scheduled.
        return;
      }
      if (process.env.DISABLE_BIKKIE_REFRESH === "1") {
        return;
      }
      this.pendingRefresh = true;
      this.inflightRefresh = this.inflightRefresh
        .then(async () => {
          this.pendingRefresh = false;
          await this.force();
        })
        .catch((error) => log.error("Error refreshing biscuits", { error }));
    });
  }

  async currentTray() {
    if (!this.prior) {
      await this.force();
    }
    return this.prior!;
  }

  async force() {
    const baked = withHarthmereNativeBikkieItems(
      await this.storage.load(this.prior)
    );
    this.runtime.registerBiscuits(baked.contents);
    this.prior = baked;
    return baked;
  }

  private async notifyViaEcs(trayId: BiomesId) {
    if (!this.worldApi) {
      return;
    }
    await this.worldApi.apply({
      changes: [
        {
          kind: "update",
          entity: {
            id: WorldMetadataId,
            active_tray: { id: trayId },
          },
        },
      ],
    });
  }

  async notifyRefreshNeeded(trayId: BiomesId) {
    await Promise.all([
      this.notifier.notify(String(trayId)),
      this.notifyViaEcs(trayId),
    ]);
  }
}

export async function registerBikkieRefresher<
  C extends {
    bikkieNotifiers: { tray: Notifier };
    bikkieStorage: BikkieStorage;
    worldApi?: WorldApi;
  }
>(loader: RegistryLoader<C>) {
  console.log("GLITCH_STARTUP_TRACE registerBikkieRefresher:enter");
  const tStart = Date.now();
  const [bikkieNotifiers, storage, worldApi] = await Promise.all([
    (async () => {
      const t = Date.now();
      const v = await loader.get("bikkieNotifiers");
      console.log(
        `GLITCH_STARTUP_TRACE registerBikkieRefresher:got-bikkieNotifiers elapsedMs=${
          Date.now() - t
        }`
      );
      return v;
    })(),
    (async () => {
      const t = Date.now();
      const v = await loader.get("bikkieStorage");
      console.log(
        `GLITCH_STARTUP_TRACE registerBikkieRefresher:got-bikkieStorage elapsedMs=${
          Date.now() - t
        }`
      );
      return v;
    })(),
    (async () => {
      const t = Date.now();
      const v = await loader.getOptional("worldApi");
      console.log(
        `GLITCH_STARTUP_TRACE registerBikkieRefresher:got-worldApi elapsedMs=${
          Date.now() - t
        } present=${v !== undefined}`
      );
      return v;
    })(),
  ]);
  console.log("GLITCH_STARTUP_TRACE registerBikkieRefresher:constructing");
  const refresher = new BikkieRefresher(
    bikkieNotifiers.tray,
    BikkieRuntime.get(),
    storage,
    worldApi
  );
  console.log("GLITCH_STARTUP_TRACE registerBikkieRefresher:before-force");
  const tForce = Date.now();
  await refresher.force();
  console.log(
    "GLITCH_STARTUP_TRACE registerBikkieRefresher:done" +
      ` totalMs=${Date.now() - tStart} forceMs=${Date.now() - tForce}`
  );
  return refresher;
}
