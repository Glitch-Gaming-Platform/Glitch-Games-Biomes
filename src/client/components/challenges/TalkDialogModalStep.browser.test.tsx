import assert from "assert";
import { build } from "esbuild";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { chromium } from "playwright";

declare global {
  interface Window {
    __ttsRequests: Array<{ text: string; provider?: string }>;
    __transcripts: string[];
    __choices: string[];
    __closedCount: number;
    __audioPlays: number;
    __recorderMode?: "success" | "reject";
    __recorderStarts: number;
    __recorderStartDelayMs: number;
    __speechToTextMode?: "success" | "empty" | "reject";
  }
}

describe("TalkDialogModalStep rendered voice conversation flow", () => {
  it("checks every rendered voice scene for one-shot audio and clickability", async function () {
    this.timeout(45_000);
    const mappedFirstLine = "Right then! Nice to meet ya BrowserTester!";

    const tempDir = await mkdtemp(path.join(tmpdir(), "biomes-talk-flow-"));
    const entryPath = path.join(tempDir, "entry.tsx");
    const bundlePath = path.join(tempDir, "bundle.js");
    const tsconfigPath = path.join(tempDir, "tsconfig.json");
    const componentPath = path
      .join(
        process.cwd(),
        "src/client/components/challenges/TalkDialogModalStep.tsx"
      )
      .replace(/\\/g, "/");

    await writeFile(
      entryPath,
      `
        import * as React from "react";
        import { createRoot } from "react-dom/client";
        import { GenericTalkDialogModalStep } from "${componentPath}";

        window.__ttsRequests = [];
        window.__transcripts = [];
        window.__choices = [];
        window.__closedCount = 0;
        window.__audioPlays = 0;
        window.__recorderMode = "success";
        window.__recorderStarts = 0;
        window.__recorderStartDelayMs = 0;
        window.HTMLMediaElement.prototype.play = function() {
          if (this.getAttribute("src")) {
            window.__audioPlays += 1;
          }
          return Promise.resolve();
        };

        window.__clientContext = {
          audioManager: {
            getVolume: () => 0.4,
            playSound: () => {},
          },
          reactResources: {
            useAll: (...keys) => keys.map(() => undefined),
            get: (path) => path === "/tweaks"
              ? { chatVoices: true, chatTranslation: false }
              : undefined,
          },
          resources: {
            get: () => undefined,
          },
        };

        function Harness() {
          const [rerenderCount, setRerenderCount] = React.useState(0);
          const [dialog, setDialog] = React.useState([
            { text: ${JSON.stringify(`<text>${mappedFirstLine}</text>`)} },
            { text: "<text>Second line.</text>" },
            {
              text: "<text>Third line.</text>",
              actions: [
                {
                  name: "Pick this",
                  onPerformed: () => window.__choices.push("Pick this"),
                },
              ],
            },
          ]);
          const [voiceQuerying, setVoiceQuerying] = React.useState(false);
          React.useEffect(() => {
            const timer = window.setTimeout(() => setRerenderCount((value) => value + 1), 60);
            return () => window.clearTimeout(timer);
          }, []);
          return (
            <div data-rerender-count={rerenderCount}>
              <GenericTalkDialogModalStep
                entityId={7520125886856339}
                title="Billy Rhodes"
                id={166072605041642}
                dialog={dialog}
                voiceInput={{
                  disabled: voiceQuerying,
                  maxRecordingMs: 700,
                  onTranscript: (text) => {
                    window.__transcripts.push(text);
                    setVoiceQuerying(true);
                    setDialog([
                      {
                        text: "<text>[listens closely...]</text>",
                        actions: [
                          {
                            name: "Close",
                            disabled: true,
                            onPerformed: () => window.__closedCount += 1,
                          },
                        ],
                      },
                    ]);
                    window.setTimeout(() => {
                      setVoiceQuerying(false);
                      setDialog([
                        {
                          text: "<text>Quest response from Jackie.</text>",
                          actions: [
                            {
                              name: "Pick this",
                              onPerformed: async () => {
                                await new Promise((resolve) => window.setTimeout(resolve, 120));
                                window.__choices.push("Pick this");
                              },
                            },
                          ],
                        },
                      ]);
                    }, 80);
                  },
                }}
                onClose={() => {
                  window.__closedCount += 1;
                }}
              />
            </div>
          );
        }

        Object.defineProperty(window.navigator, "mediaDevices", {
          value: { getUserMedia: async () => ({}) },
          configurable: true,
        });
        window.AudioContext ??= function AudioContext() {};

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
          name: "talk-dialog-browser-flow-stubs",
          setup(pluginBuild) {
            const stubbed = new Map<string, string>([
              [
                "@/client/components/challenges/QuestViews",
                `
                  import * as React from "react";
                  export const NpcDialogView = ({ text, onTypeComplete }) => {
                    React.useEffect(() => {
                      const timer = window.setTimeout(onTypeComplete, 0);
                      return () => window.clearTimeout(timer);
                    }, [text]);
                    return <div data-dialog-text={text.replace(/<[^>]+>/g, "")}>{text.replace(/<[^>]+>/g, "")}</div>;
                  };
                `,
              ],
              [
                "@/client/components/challenges/helpers",
                `
                  export const npcTypeForNpcId = () => undefined;
                  export const maybeTranslateDialogText = async (_resources, text) => {
                    const spokenText = String(text).replace(/<[^>]+>/g, "").trim();
                    return { shownText: text, spokenText };
                  };
                `,
              ],
              [
                "@/client/components/contexts/ClientContextReactContext",
                `
                  export const useClientContext = () => window.__clientContext;
                `,
              ],
              [
                "@/client/components/inventory/LanguageSelector",
                `
                  export const useSelectedLanguage = () => ["en"];
                `,
              ],
              [
                "@/client/components/challenges/LocalDevHarthmereMultiplayerCombatSystem",
                `
                  export const selectHarthmereCombatTarget = () => {};
                `,
              ],
              [
                "@/client/util/helpers",
                `
                  export const cleanListener = (target, handlers) => {
                    for (const [kind, handler] of Object.entries(handlers)) {
                      target.addEventListener(kind, handler);
                    }
                    return () => {
                      for (const [kind, handler] of Object.entries(handlers)) {
                        target.removeEventListener(kind, handler);
                      }
                    };
                  };
                `,
              ],
              [
                "@/client/util/hooks",
                `
                  import * as React from "react";
                  export const useEffectAsync = (fn, deps) => {
                    React.useEffect(() => {
                      let alive = true;
                      void Promise.resolve(fn()).catch(() => {});
                      return () => { alive = false; void alive; };
                    }, deps);
                  };
                `,
              ],
              [
                "@/shared/harthmere/npc_voice_profiles",
                `
                  export const harthmereAzureVoiceIdOrFallback = ({ voiceId, fallbackVoiceId }) => voiceId || fallbackVoiceId;
                  export const harthmereVoiceProfileForActor = () => ({ voiceParameterId: "azure-speech|voice=en-US-AvaNeural" });
                `,
              ],
              [
                "@/shared/npc/bikkie",
                `
                  export const relevantBiscuitForEntityId = () => undefined;
                `,
              ],
              [
                "@/client/components/system/speechCapture",
                `
                  export const blobToBase64 = async () => "ZmFrZQ==";
                  export const startAzureSpeechWavRecorder = async () => {
                    window.__recorderStarts += 1;
                    if (window.__recorderStartDelayMs > 0) {
                      await new Promise((resolve) => window.setTimeout(resolve, window.__recorderStartDelayMs));
                    }
                    if (window.__recorderMode === "reject") {
                      throw new Error("microphone permission denied");
                    }
                    return {
                      stop: async () => ({ blob: new Blob(["fake"], { type: "audio/wav" }), mimeType: "audio/wav" }),
                    };
                  };
                `,
              ],
              [
                "@/client/util/typed_local_storage",
                `
                  export const useTypedStorageItem = (key, fallback) => {
                    if (key === "settings.voice.microphoneDeviceId") return [""];
                    if (key === "settings.voice.npcSpeechEnabled") return [true];
                    if (key === "settings.voice.npcSpeechProvider") return ["elevenlabs"];
                    if (key === "settings.voice.microphoneInputEnabled") return [true];
                    return [fallback];
                  };
                `,
              ],
              [
                "@/shared/util/fetch_helpers",
                `
                  export const jsonFetch = async (url) => {
                    if (url === "/api/voices/speech_status") {
                      return {
                        speechToText: true,
                        textToSpeech: true,
                        openAITextToSpeech: true,
                        elevenLabsTextToSpeech: true,
                        generatedChat: true,
                      };
                    }
                    return {};
                  };
                  export const jsonPost = async (url, payload) => {
                    if (url === "/api/voices/text_to_speech") {
                      window.__ttsRequests.push(payload);
                      return { url: "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEA" };
                    }
                    if (url === "/api/voices/speech_to_text") {
                      await new Promise((resolve) => window.setTimeout(resolve, 160));
                      if (window.__speechToTextMode === "reject") {
                        throw new Error("speech-to-text failed");
                      }
                      if (window.__speechToTextMode === "empty") {
                        return { text: "", unavailableReason: "I couldn't catch that." };
                      }
                      return { text: "hello Jackie" };
                    }
                    return {};
                  };
                `,
              ],
              [
                "@/shared/logging",
                `
                  export const log = { warn: () => {}, error: () => {} };
                `,
              ],
            ]);

            pluginBuild.onResolve({ filter: /.*/ }, (args) => {
              if (stubbed.has(args.path)) {
                return { path: args.path, namespace: "talk-dialog-flow-stub" };
              }
              return undefined;
            });
            pluginBuild.onLoad(
              { filter: /.*/, namespace: "talk-dialog-flow-stub" },
              (args) => stubModule(stubbed.get(args.path)!)
            );
          },
        },
      ],
    });

    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({
        viewport: { width: 900, height: 600 },
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
          <head>
            <style>
              body { margin: 0; background: #111; color: white; font-family: sans-serif; }
              #root { width: 100vw; height: 100vh; }
              .npc-quest-dialog-container { position: fixed; left: 10px; bottom: 10px; }
            </style>
          </head>
          <body><div id="root"></div></body>
        </html>
      `);
      await page.addScriptTag({ content: await readFile(bundlePath, "utf8") });

      await page.getByText(mappedFirstLine, { exact: true }).waitFor({
        timeout: 10_000,
      });
      const expressionDialog = page.locator(
        ".npc-quest-dialog-container[data-harthmere-dialogue-expression]"
      );
      assert.equal(
        await expressionDialog.getAttribute(
          "data-harthmere-dialogue-expression"
        ),
        "gratitude"
      );
      assert.equal(
        await expressionDialog.getAttribute(
          "data-harthmere-dialogue-expression-actor"
        ),
        "billy_rhodes"
      );
      assert.equal(
        await expressionDialog.getAttribute(
          "data-harthmere-dialogue-expression-source"
        ),
        "native_quest"
      );
      assert.deepEqual(
        await page.evaluate(() => {
          const cue = (window as any).__harthmereNpcDialogueExpression;
          return cue
            ? { actorId: cue.actorId, expression: cue.expression }
            : undefined;
        }),
        { actorId: 7520125886856339, expression: "gratitude" }
      );
      await page.waitForFunction(() => window.__ttsRequests.length === 1);
      await page.waitForTimeout(120);
      assert.deepEqual(
        await page.evaluate(() => window.__ttsRequests.map((r) => r.text)),
        [mappedFirstLine]
      );
      assert.equal(
        await page.evaluate(() => window.__ttsRequests[0]?.provider),
        "elevenlabs"
      );
      assert.equal(await page.evaluate(() => window.__audioPlays), 1);
      await page.evaluate(() => {
        const audio = document.querySelector("audio");
        audio?.dispatchEvent(new Event("ended", { bubbles: true }));
      });
      assert.equal(
        await page.evaluate(
          () => document.querySelector("audio")?.hasAttribute("src") ?? false
        ),
        false,
        "finished NPC audio should clear its src so click/audio unlock cannot replay it"
      );
      await page.evaluate(() => document.querySelector("audio")?.play());
      assert.equal(
        await page.evaluate(() => window.__audioPlays),
        1,
        "external audio unlock should not replay a finished NPC line"
      );

      await page.mouse.click(450, 300);
      await page.locator("[data-dialog-text='Second line.']").waitFor({
        timeout: 10_000,
      });
      await page.waitForFunction(
        () => !(window as any).__harthmereNpcDialogueExpression
      );
      assert.equal(
        await page
          .locator(".npc-quest-dialog-container")
          .getAttribute("data-harthmere-dialogue-expression"),
        null,
        "an NPC expression must end as soon as its authored line leaves the screen"
      );
      await page.waitForFunction(() => window.__ttsRequests.length === 2);
      assert.deepEqual(
        await page.evaluate(() => window.__ttsRequests.map((r) => r.text)),
        [mappedFirstLine, "Second line."]
      );
      assert.equal(
        await page.locator("[data-npc-speech-input-button]").count(),
        0,
        "mic should stay hidden until the options stage, not every continuation line"
      );

      await page.mouse.click(450, 300);
      await page.locator("[data-dialog-text='Third line.']").waitFor({
        timeout: 10_000,
      });
      await page.waitForFunction(() => window.__ttsRequests.length === 3);
      assert.deepEqual(
        await page.evaluate(() => window.__ttsRequests.map((r) => r.text)),
        [mappedFirstLine, "Second line.", "Third line."]
      );

      assert.equal(
        await page
          .locator("[data-npc-speech-hotkey-indicator='idle']")
          .textContent(),
        "Press T to talk"
      );
      await page.evaluate(() => {
        window.__recorderStartDelayMs = 120;
      });
      await page.keyboard.down("t");
      await page
        .locator("[data-npc-speech-input-button='starting']")
        .waitFor({ timeout: 10_000 });
      await page.keyboard.up("t");
      await page
        .locator("[data-npc-speech-input-button='idle']")
        .waitFor({ timeout: 10_000 });
      await page.waitForTimeout(160);
      assert.deepEqual(
        await page.evaluate(() => window.__transcripts),
        [],
        "a quick T tap during microphone startup should not submit empty audio"
      );
      await page.evaluate(() => {
        window.__recorderStartDelayMs = 0;
      });
      await page.keyboard.down("t");
      await page
        .locator("[data-npc-speech-input-button='recording']")
        .waitFor({ timeout: 10_000 });
      assert.match(
        (await page
          .locator("[data-npc-speech-hotkey-indicator='recording']")
          .textContent()) ?? "",
        /Listening.*release T to send/
      );
      assert.equal(
        await page
          .locator("[data-npc-speech-input-button='recording']")
          .getAttribute("data-npc-speech-input-remaining-seconds"),
        "1",
        "recording mic should show a countdown while the timeout is active"
      );
      await page.waitForFunction(() => {
        const value = Number(
          document
            .querySelector("[data-npc-speech-input-button='recording']")
            ?.getAttribute("data-npc-speech-input-timeout-progress") ?? "0"
        );
        return value > 0;
      });
      assert.equal(await page.evaluate(() => window.__closedCount), 0);

      await page.keyboard.up("t");
      await page.mouse.click(450, 300);
      await page.mouse.click(450, 300);
      assert.equal(
        await page.evaluate(() => window.__closedCount),
        0,
        "extra page clicks while speech is transcribing should not close or advance"
      );
      await page.waitForFunction(() => window.__transcripts.length === 1);
      assert.deepEqual(await page.evaluate(() => window.__transcripts), [
        "hello Jackie",
      ]);
      await page.locator("[data-dialog-text='[listens closely...]']").waitFor({
        timeout: 10_000,
      });
      await page.waitForFunction(() => window.__ttsRequests.length === 4);
      await page
        .locator("[data-dialog-text='Quest response from Jackie.']")
        .waitFor({
          timeout: 10_000,
        });
      await page.waitForFunction(() => window.__ttsRequests.length === 5);
      assert.deepEqual(
        await page.evaluate(() => window.__ttsRequests.map((r) => r.text)),
        [
          mappedFirstLine,
          "Second line.",
          "Third line.",
          "[listens closely...]",
          "Quest response from Jackie.",
        ]
      );
      await page.waitForTimeout(120);
      assert.equal(
        await page.evaluate(() => window.__ttsRequests.length),
        5,
        "generated voice response scene should not replay after render settles"
      );
      assert.equal(
        await page.evaluate(() => window.__audioPlays),
        5,
        "each rendered voice scene should play exactly once"
      );
      await page
        .locator("[data-npc-speech-input-button='idle']")
        .waitFor({ timeout: 10_000 });
      assert.equal(
        await page.evaluate(() => window.__closedCount),
        0,
        "clicking the page while recording should stop the mic without closing"
      );

      await page.evaluate(() => {
        window.__speechToTextMode = "empty";
      });
      await page
        .locator("[data-npc-speech-input-button='idle'] button")
        .click();
      await page
        .locator("[data-npc-speech-input-button='recording']")
        .waitFor({ timeout: 10_000 });
      await page.mouse.click(450, 300);
      await page
        .locator("[data-npc-speech-input-button='error']")
        .waitFor({ timeout: 10_000 });
      assert.deepEqual(await page.evaluate(() => window.__transcripts), [
        "hello Jackie",
      ]);
      assert.equal(
        await page.evaluate(() => window.__ttsRequests.length),
        5,
        "empty transcripts should not replay the visible NPC response"
      );
      assert.equal(
        await page.evaluate(() => window.__audioPlays),
        5,
        "empty transcripts should not replay audio"
      );
      await page.mouse.click(450, 300);
      assert.equal(
        await page.evaluate(() => window.__closedCount),
        0,
        "empty transcripts should leave the conversation clickable without closing it"
      );

      await page.evaluate(() => {
        window.__speechToTextMode = "reject";
      });
      await page
        .locator("[data-npc-speech-input-button='error'] button")
        .click();
      await page
        .locator("[data-npc-speech-input-button='recording']")
        .waitFor({ timeout: 10_000 });
      await page.mouse.click(450, 300);
      await page
        .locator("[data-npc-speech-input-button='error']")
        .waitFor({ timeout: 10_000 });
      assert.equal(
        await page.evaluate(() => window.__ttsRequests.length),
        5,
        "failed transcription should not replay the visible NPC response"
      );
      assert.equal(
        await page.evaluate(() => window.__audioPlays),
        5,
        "failed transcription should not replay audio"
      );
      await page.mouse.click(450, 300);
      assert.equal(
        await page.evaluate(() => window.__closedCount),
        0,
        "failed transcription should not freeze or close the conversation"
      );

      const recorderStartsBeforePermissionDenial = await page.evaluate(
        () => window.__recorderStarts
      );
      await page.evaluate(() => {
        window.__recorderMode = "reject";
      });
      await page
        .locator("[data-npc-speech-input-button='error'] button")
        .click();
      await page.waitForFunction(
        (starts) => window.__recorderStarts === starts + 1,
        recorderStartsBeforePermissionDenial
      );
      await page
        .locator("[data-npc-speech-input-button='error']")
        .waitFor({ timeout: 10_000 });
      assert.equal(
        await page.evaluate(() => window.__ttsRequests.length),
        5,
        "microphone permission denial should not replay NPC audio"
      );
      assert.equal(
        await page.evaluate(() => window.__closedCount),
        0,
        "microphone permission denial should not close or freeze the conversation"
      );
      await page.mouse.click(450, 300);
      assert.equal(
        await page.evaluate(() => window.__closedCount),
        0,
        "page should remain clickable after microphone permission denial"
      );

      await page.evaluate(() => {
        window.__recorderMode = "success";
        window.__speechToTextMode = "success";
      });
      await page
        .locator("[data-npc-speech-input-button='error'] button")
        .click();
      await page
        .locator("[data-npc-speech-input-button='recording']")
        .waitFor({ timeout: 10_000 });
      await page.waitForFunction(() => window.__transcripts.length === 2, {
        timeout: 10_000,
      });
      assert.deepEqual(await page.evaluate(() => window.__transcripts), [
        "hello Jackie",
        "hello Jackie",
      ]);
      assert.equal(
        await page.evaluate(() => window.__closedCount),
        0,
        "auto-stopping at the recording limit should submit without closing"
      );

      await page.mouse.click(450, 300);
      assert.equal(
        await page.evaluate(() => window.__closedCount),
        0,
        "page clicks should not bypass visible dialogue choices"
      );

      await page.getByText("Pick this").click();
      const pendingActionButton = page.getByRole("button", {
        name: "Working…",
      });
      await pendingActionButton.waitFor({ timeout: 10_000 });
      assert.equal(
        await pendingActionButton.isDisabled(),
        true,
        "quest actions must stay disabled while the authoritative event is pending"
      );
      assert.equal(
        await page.evaluate(() => window.__closedCount),
        0,
        "the dialog must remain visible until the authoritative action resolves"
      );
      await page.waitForFunction(() => window.__closedCount === 1);
      assert.deepEqual(await page.evaluate(() => window.__choices), [
        "Pick this",
      ]);
      assert.equal(browserErrors.join("\n"), "");
    } finally {
      await browser.close();
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
