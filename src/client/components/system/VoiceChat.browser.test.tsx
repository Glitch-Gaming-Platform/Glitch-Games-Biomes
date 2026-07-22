import assert from "assert";
import { build } from "esbuild";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { chromium, type Browser, type Page } from "playwright";

declare global {
  interface Window {
    __ttsRequests: Array<{ text: string; provider?: string }>;
    __ttsDelayMs: number;
    __ttsDelayByText: Record<string, number>;
    __ttsIgnoreAbort: boolean;
    __ttsMode: "success" | "reject";
    __audioEvents: string[];
    __audioPlays: number;
    __audioPauses: number;
    __audioLoads: number;
    __playSources: string[];
    __voiceErrors: string[];
  }
}

async function buildVoiceChatBundle(harnessSource: string) {
  const tempDir = await mkdtemp(path.join(tmpdir(), "biomes-voice-chat-"));
  const entryPath = path.join(tempDir, "entry.tsx");
  const bundlePath = path.join(tempDir, "bundle.js");
  const tsconfigPath = path.join(tempDir, "tsconfig.json");
  const componentPath = path
    .join(process.cwd(), "src/client/components/system/VoiceChat.tsx")
    .replace(/\\/g, "/");

  await writeFile(
    entryPath,
    `
      import * as React from "react";
      import { createRoot } from "react-dom/client";
      import { VoiceChat } from "${componentPath}";

      window.__ttsRequests = [];
      window.__ttsDelayMs = 0;
      window.__ttsDelayByText = {};
      window.__ttsIgnoreAbort = false;
      window.__ttsMode = "success";
      window.__audioEvents = [];
      window.__audioPlays = 0;
      window.__audioPauses = 0;
      window.__audioLoads = 0;
      window.__playSources = [];
      window.__voiceErrors = [];

      window.HTMLMediaElement.prototype.play = function() {
        if (this.getAttribute("src")) {
          window.__audioPlays += 1;
          window.__playSources.push(this.src);
          window.__audioEvents.push("play:" + this.src);
        }
        return Promise.resolve();
      };
      window.HTMLMediaElement.prototype.pause = function() {
        window.__audioPauses += 1;
        window.__audioEvents.push("pause");
      };
      window.HTMLMediaElement.prototype.load = function() {
        window.__audioLoads += 1;
        window.__audioEvents.push("load");
      };

      ${harnessSource}

      createRoot(document.getElementById("root")).render(<Harness />);
    `
  );
  await writeFile(
    tsconfigPath,
    JSON.stringify({
      compilerOptions: {
        jsx: "react",
        baseUrl: process.cwd(),
        paths: {
          "@/*": ["src/*"],
        },
      },
    })
  );

  const stubModule = (contents: string) => ({
    contents,
    loader: "tsx" as const,
    resolveDir: process.cwd(),
  });

  await build({
    entryPoints: [entryPath],
    outfile: bundlePath,
    bundle: true,
    absWorkingDir: process.cwd(),
    nodePaths: [path.join(process.cwd(), "node_modules")],
    platform: "browser",
    format: "iife",
    jsx: "transform",
    jsxFactory: "React.createElement",
    jsxFragment: "React.Fragment",
    loader: { ".tsx": "tsx", ".ts": "ts" },
    tsconfig: tsconfigPath,
    plugins: [
      {
        name: "voice-chat-browser-cleanup-stubs",
        setup(pluginBuild) {
          const stubbed = new Map<string, string>([
            [
              "@/client/components/contexts/ClientContextReactContext",
              `
                export const useClientContext = () => ({
                  audioManager: {
                    getVolume: () => 0.4,
                  },
                });
              `,
            ],
            [
              "@/client/util/typed_local_storage",
              `
                export const useTypedStorageItem = (key, fallback) => [
                  key === "settings.voice.npcSpeechProvider"
                    ? "elevenlabs"
                    : key === "settings.voice.npcSpeechEnabled"
                    ? true
                    : fallback
                ];
              `,
            ],
            [
              "@/shared/util/fetch_helpers",
              `
                export const jsonPost = async (_url, payload, init) => {
                  window.__ttsRequests.push(payload);
                  const delayMs = window.__ttsDelayByText[payload.text] ?? window.__ttsDelayMs;
                  await new Promise((resolve, reject) => {
                    if (init?.signal?.aborted && !window.__ttsIgnoreAbort) {
                      reject(new DOMException("Aborted", "AbortError"));
                      return;
                    }
                    const timer = window.setTimeout(resolve, delayMs);
                    init?.signal?.addEventListener("abort", () => {
                      if (window.__ttsIgnoreAbort) {
                        return;
                      }
                      window.clearTimeout(timer);
                      reject(new DOMException("Aborted", "AbortError"));
                    }, { once: true });
                  });
                  if (window.__ttsMode === "reject") {
                    throw new Error("Azure text-to-speech failed");
                  }
                  return { url: "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEA#" + encodeURIComponent(payload.text) };
                };
              `,
            ],
            [
              "@/shared/logging",
              `
                export const log = {
                  warn: (_message, metadata) => window.__voiceErrors.push(String(metadata?.error ?? "")),
                  error: (_message, metadata) => window.__voiceErrors.push(String(metadata?.error ?? "")),
                };
              `,
            ],
          ]);

          pluginBuild.onResolve({ filter: /.*/ }, (args) => {
            if (stubbed.has(args.path)) {
              return {
                path: args.path,
                namespace: "voice-chat-cleanup-stub",
              };
            }
            return undefined;
          });
          pluginBuild.onLoad(
            { filter: /.*/, namespace: "voice-chat-cleanup-stub" },
            (args) => stubModule(stubbed.get(args.path)!)
          );
        },
      },
    ],
  });

  return { bundlePath, tempDir };
}

async function openVoiceChatPage(
  browser: Browser,
  bundlePath: string
): Promise<{ page: Page; browserErrors: string[] }> {
  const page = await browser.newPage({
    viewport: { width: 480, height: 320 },
  });
  const browserErrors: string[] = [];
  page.on("pageerror", (error) =>
    browserErrors.push(error.stack ?? error.message)
  );
  page.on("console", (message) => {
    if (message.type() === "error") {
      browserErrors.push(message.text());
    }
  });
  await page.setContent(`
    <html>
      <body><div id="root"></div></body>
    </html>
  `);
  await page.addScriptTag({ content: await readFile(bundlePath, "utf8") });
  return { page, browserErrors };
}

async function withVoiceChatPage(
  harnessSource: string,
  run: (input: { page: Page; browserErrors: string[] }) => Promise<void>
) {
  const { bundlePath, tempDir } = await buildVoiceChatBundle(harnessSource);
  const browser = await chromium.launch({ headless: true });
  try {
    const { page, browserErrors } = await openVoiceChatPage(
      browser,
      bundlePath
    );
    await run({ page, browserErrors });
  } finally {
    await browser.close();
    await rm(tempDir, { recursive: true, force: true });
  }
}

describe("VoiceChat browser playback cleanup", () => {
  it("does not play a late TTS response after the dialogue unmounts", async function () {
    this.timeout(30_000);

    await withVoiceChatPage(
      `
        window.__ttsDelayMs = 150;
        window.__ttsIgnoreAbort = true;

        function Harness() {
          const [open, setOpen] = React.useState(true);
          return (
            <div>
              <button id="close" onClick={() => setOpen(false)}>close</button>
              {open ? (
                <VoiceChat
                  text="Billy Rhodes should stop after close."
                  voice="azure-speech|voice=en-US-GuyNeural"
                  language="en-US"
                  playbackKey="billy-rhodes:test"
                />
              ) : (
                <div data-closed="true">closed</div>
              )}
            </div>
          );
        }
      `,
      async ({ page, browserErrors }) => {
        await page.waitForFunction(() => window.__ttsRequests.length === 1);
        await page.locator("#close").click();
        await page.locator("[data-closed='true']").waitFor({
          timeout: 10_000,
        });
        await page.waitForTimeout(250);

        assert.equal(await page.locator("audio").count(), 0);
        assert.equal(
          await page.evaluate(() => window.__audioPlays),
          0,
          "late TTS responses must not start playback after close"
        );
        assert.ok((await page.evaluate(() => window.__audioPauses)) >= 1);
        assert.ok((await page.evaluate(() => window.__audioLoads)) >= 1);
        assert.deepEqual(await page.evaluate(() => window.__voiceErrors), []);
        assert.equal(browserErrors.join("\n"), "");
      }
    );
  });

  it("pauses and clears audio that is already playing when the dialogue closes", async function () {
    this.timeout(30_000);

    await withVoiceChatPage(
      `
        function Harness() {
          const [open, setOpen] = React.useState(true);
          return (
            <div>
              <button id="close" onClick={() => setOpen(false)}>close</button>
              {open ? (
                <VoiceChat
                  text="Billy Rhodes is already speaking."
                  voice="azure-speech|voice=en-US-GuyNeural"
                  language="en-US"
                  playbackKey="billy-rhodes:active"
                />
              ) : (
                <div data-closed="true">closed</div>
              )}
            </div>
          );
        }
      `,
      async ({ page, browserErrors }) => {
        await page.waitForFunction(() => window.__audioPlays === 1);
        const eventsBeforeClose = await page.evaluate(
          () => window.__audioEvents.length
        );
        await page.locator("#close").click();
        await page.locator("[data-closed='true']").waitFor({
          timeout: 10_000,
        });
        await page.waitForTimeout(100);

        assert.equal(await page.locator("audio").count(), 0);
        assert.equal(
          await page.evaluate(() => window.__audioPlays),
          1,
          "closing active speech should not trigger a second play"
        );
        assert.ok(
          (
            await page.evaluate(
              (index) => window.__audioEvents.slice(index),
              eventsBeforeClose
            )
          ).includes("pause"),
          "closing active speech should pause the audio element"
        );
        assert.ok(
          (
            await page.evaluate(
              (index) => window.__audioEvents.slice(index),
              eventsBeforeClose
            )
          ).includes("load"),
          "closing active speech should clear/load the audio element"
        );
        assert.equal(browserErrors.join("\n"), "");
      }
    );
  });

  it("does not let a closed NPC's late TTS response play over the next NPC", async function () {
    this.timeout(30_000);

    await withVoiceChatPage(
      `
        window.__ttsIgnoreAbort = true;
        window.__ttsDelayByText = {
          "Billy's old line.": 160,
          "Jackie's current line.": 20,
        };

        function Harness() {
          const [npc, setNpc] = React.useState("Billy");
          return (
            <div>
              <button id="switch" onClick={() => setNpc("Jackie")}>switch</button>
              {npc === "Billy" ? (
                <VoiceChat
                  text="Billy's old line."
                  voice="azure-speech|voice=en-US-GuyNeural"
                  language="en-US"
                  playbackKey="billy-rhodes:old"
                />
              ) : (
                <VoiceChat
                  text="Jackie's current line."
                  voice="azure-speech|voice=en-US-AvaNeural"
                  language="en-US"
                  playbackKey="jackie:current"
                />
              )}
            </div>
          );
        }
      `,
      async ({ page, browserErrors }) => {
        await page.waitForFunction(() => window.__ttsRequests.length === 1);
        await page.locator("#switch").click();
        await page.waitForFunction(() => window.__ttsRequests.length === 2);
        await page.waitForTimeout(250);

        assert.deepEqual(
          await page.evaluate(() => window.__ttsRequests.map((r) => r.text)),
          ["Billy's old line.", "Jackie's current line."]
        );
        assert.equal(await page.evaluate(() => window.__audioPlays), 1);
        assert.ok(
          await page.evaluate(() =>
            window.__playSources.every((source) =>
              decodeURIComponent(source).includes("Jackie's current line.")
            )
          )
        );
        assert.equal(browserErrors.join("\n"), "");
      }
    );
  });

  it("keeps the page stable when Azure TTS fails under latency", async function () {
    this.timeout(30_000);

    await withVoiceChatPage(
      `
        window.__ttsDelayMs = 80;
        window.__ttsMode = "reject";

        function Harness() {
          return (
            <VoiceChat
              text="Azure may fail but the dialogue should survive."
              voice="azure-speech|voice=en-US-GuyNeural"
              language="en-US"
              playbackKey="azure:failure"
            />
          );
        }
      `,
      async ({ page, browserErrors }) => {
        await page.waitForFunction(() => window.__ttsRequests.length === 1);
        await page.waitForFunction(() => window.__voiceErrors.length === 1);
        await page.waitForTimeout(80);

        assert.equal(await page.evaluate(() => window.__audioPlays), 0);
        assert.equal(
          await page.evaluate(
            () => document.querySelector("audio")?.hasAttribute("src") ?? false
          ),
          false
        );
        assert.equal(browserErrors.join("\n"), "");
      }
    );
  });

  it("keeps duplicate suppression isolated between browser tabs", async function () {
    this.timeout(30_000);

    const { bundlePath, tempDir } = await buildVoiceChatBundle(`
      function Harness() {
        return (
          <VoiceChat
            text="Same tab-isolated line."
            voice="azure-speech|voice=en-US-GuyNeural"
            language="en-US"
            playbackKey="same-npc:same-line"
          />
        );
      }
    `);
    const browser = await chromium.launch({ headless: true });
    try {
      const first = await openVoiceChatPage(browser, bundlePath);
      const second = await openVoiceChatPage(browser, bundlePath);
      await first.page.waitForFunction(() => window.__audioPlays === 1);
      await second.page.waitForFunction(() => window.__audioPlays === 1);

      assert.equal(await first.page.evaluate(() => window.__audioPlays), 1);
      assert.equal(await second.page.evaluate(() => window.__audioPlays), 1);
      assert.equal(first.browserErrors.join("\n"), "");
      assert.equal(second.browserErrors.join("\n"), "");
    } finally {
      await browser.close();
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
