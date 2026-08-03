import assert from "assert";
import { build, type Plugin } from "esbuild";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { chromium } from "playwright";

declare global {
  interface Window {
    __communicationMode: "invite" | "voice";
    __mobileControls: boolean;
    __inviteClosed: boolean;
    __joinedInviteCode?: string;
    __inviteStatus?: string;
    __copiedInviteText?: string;
  }
}

function exactAliasPlugin(modules: Record<string, string>): Plugin {
  return {
    name: "player-communication-test-aliases",
    setup(buildApi) {
      for (const [specifier, contents] of Object.entries(modules)) {
        buildApi.onResolve(
          {
            filter: new RegExp(
              `^${specifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`
            ),
          },
          () => ({ path: specifier, namespace: "communication-test" })
        );
        buildApi.onLoad(
          {
            filter: new RegExp(
              `^${specifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`
            ),
            namespace: "communication-test",
          },
          () => ({ contents, loader: "tsx", resolveDir: process.cwd() })
        );
      }
    },
  };
}

describe("player communication HUD browser controls", () => {
  it("renders and copies a one-click Glitch invite URL", async function () {
    this.timeout(30_000);
    const tempDir = await mkdtemp(path.join(tmpdir(), "biomes-communication-"));
    const entryPath = path.join(tempDir, "entry.tsx");
    const bundlePath = path.join(tempDir, "bundle.js");
    const tsconfigPath = path.join(tempDir, "tsconfig.json");
    const inviteModalPath = path
      .join(process.cwd(), "src/client/components/system/PlayerInviteModal.tsx")
      .replace(/\\/g, "/");
    const voicePath = path
      .join(process.cwd(), "src/client/components/system/PlayerVoiceChat.tsx")
      .replace(/\\/g, "/");

    await writeFile(
      entryPath,
      `
        import * as React from "react";
        import { createRoot } from "react-dom/client";
        import { PlayerInviteModal } from "${inviteModalPath}";
        import { PlayerVoiceChat } from "${voicePath}";

        function Harness() {
          const [open, setOpen] = React.useState(true);
          if (window.__communicationMode === "voice") return <PlayerVoiceChat />;
          return <PlayerInviteModal open={open} onClose={() => {
            window.__inviteClosed = true;
            setOpen(false);
          }} />;
        }
        createRoot(document.getElementById("root")).render(<Harness />);
      `
    );
    await writeFile(
      tsconfigPath,
      JSON.stringify({
        compilerOptions: {
          jsx: "react-jsx",
          baseUrl: process.cwd(),
          paths: { "@/*": ["src/*"] },
        },
      })
    );

    await build({
      entryPoints: [entryPath],
      outfile: bundlePath,
      bundle: true,
      absWorkingDir: process.cwd(),
      nodePaths: [path.join(process.cwd(), "node_modules")],
      platform: "browser",
      format: "iife",
      jsx: "automatic",
      loader: { ".tsx": "tsx", ".ts": "ts" },
      tsconfig: tsconfigPath,
      plugins: [
        exactAliasPlugin({
          "@/client/components/contexts/PointerLockContext": `
            export function usePointerLockManager() {
              return { isLocked: () => false, unlock() {}, focusAndLock() {} };
            }
          `,
          "@/client/components/contexts/pointerLockModalPolicy": `
            export function openPointerLockUnlockWhileOpen() {}
            export function closePointerLockUnlockWhileOpen() {}
          `,
          "@/client/game/invites/player_invites": `
            export const PLAYER_INVITE_HOTKEY_LABEL = "0";
            export async function createPlayerInvite() {
              return {
                ok: true,
                code: "ABCDEFGH",
                formatted_code: "ABCD-EFGH",
                play_url: "https://www.glitch.fun/games/42de534c-600f-4228-af9e-b69faef94cce/play?invite_code=ABCD-EFGH",
                inviter_name: "Tester",
                expires_at: "2026-08-02T15:00:00.000Z",
              };
            }
            export function formatPlayerInviteCode(raw) {
              const value = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
              return value.length <= 4 ? value : value.slice(0, 4) + "-" + value.slice(4);
            }
            export async function joinPlayerInviteWithRetry(code) {
              window.__joinedInviteCode = code;
              return { ok: true, inviter_name: "Friend", position: [1, 2, 3], already_joined: false };
            }
            export function dispatchPlayerInviteStatus(detail) {
              window.__inviteStatus = detail.message;
            }
          `,
          "@/client/components/contexts/ClientContextReactContext": `
            export function useClientContext() {
              return {
                audioManager: { playSound() {}, getVolume() { return 1; } },
                clientConfig: { showVirtualJoystick: window.__mobileControls },
                resources: { get() { return { v: [0, 0, 0] }; } },
                table: { get() { return { label: { text: "Tester" } }; } },
                userId: 1,
              };
            }
          `,
          "@/client/util/typed_local_storage": `
            import * as React from "react";
            export function useTypedStorageItem(_key, defaultValue) {
              return React.useState(defaultValue);
            }
          `,
          "@/client/game/voice/player_voice_chat": `
            export const PLAYER_VOICE_TOGGLE_CODE = "F8";
            export const PLAYER_VOICE_TOGGLE_LABEL = "F8";
            export function playerVoiceControlAvailable(input) {
              return !input.showVirtualJoystick && input.hasGetUserMedia && input.hasRTCPeerConnection;
            }
            export class GlitchPlayerVoiceClient {
              constructor(deps) { this.deps = deps; }
              async start() { this.deps.onStatus({ state: "connected", speaking: false, peerCount: 0 }); }
              async stop() {}
              setSpeaking(value) { this.deps.onStatus({ state: "connected", speaking: value, peerCount: 0 }); }
            }
          `,
          "@/shared/logging": `export const log = { warn() {} };`,
        }),
      ],
    });

    const browser = await chromium.launch({ headless: true });
    try {
      const script = await readFile(bundlePath, "utf8");
      const invitePage = await browser.newPage({
        viewport: { width: 900, height: 700 },
      });
      await invitePage.setContent(
        `<html><body><div id="root"></div></body></html>`
      );
      await invitePage.evaluate(() => {
        window.__communicationMode = "invite";
        window.__mobileControls = false;
        window.__inviteClosed = false;
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: {
            writeText: async (text: string) => {
              window.__copiedInviteText = text;
            },
          },
        });
      });
      await invitePage.addScriptTag({ content: script });

      await invitePage
        .getByRole("heading", {
          name: "Invite Friends To Play With You!",
        })
        .waitFor();
      assert.equal(
        await invitePage.getByLabel("Glitch invite link").inputValue(),
        "https://www.glitch.fun/games/42de534c-600f-4228-af9e-b69faef94cce/play?invite_code=ABCD-EFGH"
      );
      await invitePage
        .getByRole("button", { name: "Copy Invite Link" })
        .click();
      const copiedInvite = String(
        await invitePage.evaluate(() => window.__copiedInviteText)
      );
      assert.equal(
        copiedInvite,
        "https://www.glitch.fun/games/42de534c-600f-4228-af9e-b69faef94cce/play?invite_code=ABCD-EFGH"
      );
      await assert.rejects(
        () =>
          invitePage.getByLabel("Friend invite code").waitFor({ timeout: 100 }),
        /Timeout/
      );

      const desktopVoicePage = await browser.newPage();
      await desktopVoicePage.setContent(
        `<html><body><div id="root"></div></body></html>`
      );
      await desktopVoicePage.evaluate(() => {
        window.__communicationMode = "voice";
        window.__mobileControls = false;
        Object.defineProperty(navigator, "mediaDevices", {
          configurable: true,
          value: { getUserMedia: async () => ({}) },
        });
        window.RTCPeerConnection = class {} as typeof RTCPeerConnection;
      });
      await desktopVoicePage.addScriptTag({ content: script });
      const micButton = desktopVoicePage.locator(
        '[data-player-voice-control="true"]'
      );
      await micButton.waitFor();
      assert.equal(await micButton.getAttribute("aria-pressed"), "false");
      await desktopVoicePage.keyboard.press("F8");
      assert.equal(await micButton.getAttribute("aria-pressed"), "true");

      const mobileVoicePage = await browser.newPage();
      await mobileVoicePage.setContent(
        `<html><body><div id="root"></div></body></html>`
      );
      await mobileVoicePage.evaluate(() => {
        window.__communicationMode = "voice";
        window.__mobileControls = true;
        Object.defineProperty(navigator, "mediaDevices", {
          configurable: true,
          value: { getUserMedia: async () => ({}) },
        });
        window.RTCPeerConnection = class {} as typeof RTCPeerConnection;
      });
      await mobileVoicePage.addScriptTag({ content: script });
      await mobileVoicePage.waitForTimeout(50);
      assert.equal(
        await mobileVoicePage
          .locator('[data-player-voice-control="true"]')
          .count(),
        0
      );
    } finally {
      await browser.close();
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
