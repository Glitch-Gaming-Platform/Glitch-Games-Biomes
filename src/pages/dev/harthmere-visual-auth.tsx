// HARTHMERE_VISUAL_AUTH_BRIDGE
//
// Browser-control environments may block top-level navigation to JSON API
// routes even though same-origin fetches are allowed. This tiny page performs
// the already-gated visual_test_auth request inside the game origin, keeps the
// returned session cookie, and redirects to a local capture URL. It does not
// grant permissions itself; the API still requires HARTHMERE_VISUAL_TEST_AUTH.

import { useEffect, useState } from "react";
import { rememberHarthmereBiomesAuthSession } from "@/shared/util/harthmere_auth_session";

function safeLocalNext(value: string | null): string {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export default function HarthmereVisualAuthBridge() {
  const [status, setStatus] = useState("Authenticating visual test player…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const username = params.get("username")?.trim() || "Chapter1Marketing";
    const next = safeLocalNext(params.get("next"));
    void fetch(
      `/api/harthmere/visual_test_auth?usernameOrId=${encodeURIComponent(
        username
      )}`,
      { credentials: "include" }
    )
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`visual auth failed (${response.status})`);
        }
        return response.json();
      })
      .then((auth) => {
        // The HttpOnly cookies authenticate API calls, but the production sync
        // client also reads this explicit same-origin mirror while constructing
        // its WebSocket upgrade. Install it before redirecting so the target
        // route mounts a live player, not an observer that merely has cookies.
        rememberHarthmereBiomesAuthSession({
          userId: auth.userId,
          sessionId: auth.sessionId,
        });
        setStatus("Authenticated. Opening the capture batch…");
        window.location.assign(next);
      })
      .catch((error) => {
        setStatus(error instanceof Error ? error.message : String(error));
      });
  }, []);

  return (
    <main
      data-testid="harthmere-visual-auth-status"
      style={{ padding: 32, fontFamily: "system-ui, sans-serif" }}
    >
      {status}
    </main>
  );
}
