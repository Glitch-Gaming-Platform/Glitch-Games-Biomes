import assert from "assert";
import { harthmereBiomesAuthSessionMatchesIdentity } from "../harthmere";

const identity = {
  valid: true,
  guest: false,
  installId: "install-a",
  gameUserId: "glitch:user-a",
};

describe("Harthmere Glitch Biomes auth session reuse", () => {
  it("reuses auth only when the install is bound to both the same Biomes and Glitch users", () => {
    assert.equal(
      harthmereBiomesAuthSessionMatchesIdentity({
        authenticatedBiomesUserId: "123",
        linkedBiomesUserId: "123",
        linkedGameUserId: "glitch:user-a",
        identity,
      }),
      true
    );
  });

  it("rejects an authenticated session belonging to another Biomes user", () => {
    assert.equal(
      harthmereBiomesAuthSessionMatchesIdentity({
        authenticatedBiomesUserId: "999",
        linkedBiomesUserId: "123",
        linkedGameUserId: "glitch:user-a",
        identity,
      }),
      false
    );
  });

  it("rejects an install whose Glitch account binding changed", () => {
    assert.equal(
      harthmereBiomesAuthSessionMatchesIdentity({
        authenticatedBiomesUserId: "123",
        linkedBiomesUserId: "123",
        linkedGameUserId: "glitch:user-b",
        identity,
      }),
      false
    );
  });

  it("falls back to native ECS bootstrap when either durable binding is absent", () => {
    assert.equal(
      harthmereBiomesAuthSessionMatchesIdentity({
        authenticatedBiomesUserId: "123",
        linkedBiomesUserId: "123",
        linkedGameUserId: undefined,
        identity,
      }),
      false
    );
    assert.equal(
      harthmereBiomesAuthSessionMatchesIdentity({
        authenticatedBiomesUserId: "123",
        linkedBiomesUserId: undefined,
        linkedGameUserId: "glitch:user-a",
        identity,
      }),
      false
    );
  });

  it("allows a guest session only when its deterministic install identity matches", () => {
    assert.equal(
      harthmereBiomesAuthSessionMatchesIdentity({
        authenticatedBiomesUserId: "456",
        linkedBiomesUserId: "456",
        linkedGameUserId: "install:guest-install",
        identity: {
          valid: false,
          guest: true,
          installId: "guest-install",
          gameUserId: "install:guest-install",
        },
      }),
      true
    );
  });
});
