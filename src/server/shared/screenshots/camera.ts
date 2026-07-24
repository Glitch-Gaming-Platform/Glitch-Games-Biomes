import { BackgroundTaskController } from "@/shared/abort";
import { log } from "@/shared/logging";
import type { Vec2, Vec3 } from "@/shared/math/types";
import type { RegistryLoader } from "@/shared/registry";
import { Delayed, sleep } from "@/shared/util/async";
import type { Browser, Page } from "puppeteer";
import { launch } from "puppeteer";

export class ServerCamera {
  private readonly controller = new BackgroundTaskController();
  private inflight: Promise<unknown> = Promise.resolve();
  private browser?: Browser;

  constructor() {}

  static async create() {
    const camera = new ServerCamera();
    await camera.warmup();
    return camera;
  }

  async warmup() {
    await this.getBrowser();
  }

  async stop() {
    await this.controller.abortAndWait();
    await this.inflight;
    this.browser?.close().catch(() => {});
  }

  private async getBrowser() {
    if (this.browser) {
      return this.browser;
    }
    log.info("Launching Chrome...");
    try {
      const browser = await launch({
        headless: CONFIG.chromeHeadlessMode,
        args: CONFIG.chromeFlags,
        userDataDir: process.env.PUPPETEER_USER_DATA_DIR || undefined,
        env: {
          ...process.env,
          HOME: process.env.PUPPETEER_HOME ?? process.env.HOME,
        },
        dumpio: CONFIG.chromeDumpIo,
      });
      browser.on("disconnected", () => {
        log.info("Chrome disconnected");
        this.browser = undefined;
      });
      this.browser = browser;
      log.info("Chrome running", {
        pid: browser.process()?.pid,
      });
      return browser;
    } catch (error) {
      log.error("Failed to launch Chrome", { error });
      throw error;
    }
  }

  private async capture(
    position: Vec3,
    orientation: Vec2,
    width: number,
    height: number
  ): Promise<Buffer> {
    const browser = await this.getBrowser();
    const suffix = `/${position.join("/")}/${orientation.join("/")}`;
    const urlParams = "?hideChrome=1&allowSoftwareWebGL=1";
    let page!: Page;
    try {
      page = await browser.newPage();
    } catch (error) {
      log.error("Failed to create page", { error });
      throw error;
    }
    try {
      try {
        await page.setViewport({ width, height, deviceScaleFactor: 1 });
        await page.goto(
          process.env.NODE_ENV === "production"
            ? `https://www.biomes.gg/at${suffix}${urlParams}`
            : `http://localhost:3000/at${suffix}${urlParams}`
        );
      } catch (error) {
        log.error("Failed to load page", { error });
        throw error;
      }
      await page.waitForFunction(
        () =>
          (window as typeof window & { __biomesCaptureReady?: boolean })
            .__biomesCaptureReady === true,
        { timeout: 20_000 }
      );
      // The renderer-ready flag guarantees live frames, but texture uploads and
      // browser layout can still trail by a few tasks on cold camera pages.
      await sleep(500);
      if (this.controller.aborted) {
        return Buffer.from("");
      }
      try {
        return await page.screenshot({ type: "png", fullPage: false });
      } catch (error) {
        log.error("Failed to take screenshot", { error });
        throw error;
      }
    } finally {
      await page.close();
    }
  }

  async takeScreenshot(
    position: Vec3,
    orientation: Vec2,
    width = 1920,
    height = 1080
  ): Promise<Buffer> {
    const delayed = new Delayed<Buffer>();
    const promise = this.inflight.then(() =>
      delayed.resolveWith(() =>
        this.capture(position, orientation, width, height)
      )
    );
    this.inflight = promise;
    return delayed.wait();
  }
}

export async function registerServerCamera<C extends {}>(
  _loader: RegistryLoader<C>
) {
  return ServerCamera.create();
}
