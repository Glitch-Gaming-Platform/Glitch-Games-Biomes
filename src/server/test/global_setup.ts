import { serverTestInit } from "@/server/test/init";
import { prepareBikkieForTest } from "@/shared/bikkie/test_helpers";
import { log } from "@/shared/logging";
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

installStaticAssetImports();
installBrowserEventConstructors();

export async function mochaGlobalSetup() {
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
