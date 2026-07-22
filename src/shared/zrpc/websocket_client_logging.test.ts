import { webSocketUriForSafeLogging } from "@/shared/zrpc/websocket_client";
import assert from "assert";

describe("webSocketUriForSafeLogging", () => {
  it("removes signed authentication and session query parameters", () => {
    const logged = webSocketUriForSafeLogging(
      "wss://sync.example.test/sync?bsid=secret&p=2&token=jwt"
    );
    assert.equal(logged, "wss://sync.example.test/sync");
    assert.ok(!logged.includes("secret"));
    assert.ok(!logged.includes("jwt"));
  });
});
