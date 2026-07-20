import { WakeupMuckParticles } from "@/client/components/Particles";
import assert from "assert";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

describe("WakeupMuckParticles hydration", () => {
  it("renders an empty deterministic SSR shell", () => {
    assert.equal(renderToStaticMarkup(<WakeupMuckParticles />), "");
  });
});
