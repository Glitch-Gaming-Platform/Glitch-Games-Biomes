import assert from "assert";
import { shouldVerifyUserDocumentForAuthCheck } from "./check";

describe("auth check user-document verification policy", () => {
  it("trusts authenticated sessions in production", () => {
    assert.equal(
      shouldVerifyUserDocumentForAuthCheck({ NODE_ENV: "production" }),
      false
    );
  });

  it("keeps verification in development", () => {
    assert.equal(
      shouldVerifyUserDocumentForAuthCheck({ NODE_ENV: "development" }),
      true
    );
  });

  it("supports explicit production diagnostics", () => {
    assert.equal(
      shouldVerifyUserDocumentForAuthCheck({
        NODE_ENV: "production",
        GLITCH_VERIFY_AUTH_USER_DOCUMENT: "1",
      }),
      true
    );
  });
});
