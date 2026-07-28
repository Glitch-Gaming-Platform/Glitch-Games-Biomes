import Module from "module";
import path from "path";
import { register } from "prom-client";
import sinon from "sinon";

declare global {
  // eslint-disable-next-line no-var
  var __serverBootstraped: boolean | undefined;
  // eslint-disable-next-line no-var
  var __staticAssetImportsInstalled: boolean | undefined;
}

function installStaticAssetImports() {
  if (global.__staticAssetImportsInstalled) {
    return;
  }

  const moduleInternals: any = Module;
  const originalResolveFilename = moduleInternals._resolveFilename;
  moduleInternals._resolveFilename = function resolveStaticAsset(
    request: string,
    parent: unknown,
    isMain: boolean,
    options: unknown
  ) {
    if (request.startsWith("/public/")) {
      return path.join(process.cwd(), request.slice(1));
    }
    return originalResolveFilename.call(this, request, parent, isMain, options);
  };

  for (const extension of [".gif", ".jpeg", ".jpg", ".png", ".webp"]) {
    require.extensions[extension] = (module: NodeModule, filename: string) => {
      const publicPath = `/${path.relative(
        path.join(process.cwd(), "public"),
        filename
      )}`;
      (module as any).exports = {
        src: publicPath,
        height: 0,
        width: 0,
      };
    };
  }
  global.__staticAssetImportsInstalled = true;
}

function installBrowserEventConstructors(force = false) {
  if (!force && typeof globalThis.CustomEvent === "function") {
    return;
  }

  Object.defineProperty(globalThis, "CustomEvent", {
    configurable: true,
    writable: true,
    value: class TestCustomEvent<T = unknown> extends Event {
      readonly detail: T;

      constructor(type: string, init: CustomEventInit<T> = {}) {
        super(type, init);
        this.detail = init.detail as T;
      }

      initCustomEvent() {}
    },
  });
}

function installBrowserNavigator() {
  if (typeof globalThis.navigator !== "undefined") return;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      userAgent: "node-test-runtime",
      platform: "node",
      maxTouchPoints: 0,
    },
  });
}

installStaticAssetImports();
installBrowserEventConstructors();
installBrowserNavigator();

export async function mochaGlobalSetup() {
  // Load the server bootstrap only after the browser shims above are installed.
  // Some transitive client modules inspect `window.navigator` at import time.
  const [{ serverTestInit }, { prepareBikkieForTest }, { log }] =
    await Promise.all([
      import("@/server/test/init"),
      import("@/shared/bikkie/test_helpers"),
      import("@/shared/logging"),
    ]);
  register.clear(); // So we don't get dupe metrics
  prepareBikkieForTest();
  if (!global.__serverBootstraped) {
    log.info("Bootstrapping tests");
    await serverTestInit();
    global.__serverBootstraped = true;
  }
}

export const mochaHooks = (): Mocha.RootHookObject => {
  return {
    beforeAll: () => mochaGlobalSetup(),
    beforeEach: () => installBrowserEventConstructors(true),
    afterEach: () => sinon.restore(),
  };
};
