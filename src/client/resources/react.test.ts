import { ReactResources } from "@/client/resources/react";
import type { PathDef } from "@/shared/resources/path_map";
import { TypedResourcesBuilder } from "@/shared/resources/types";
import assert from "assert";

interface TestResourcePaths {
  "/value": PathDef<[], { value: number }>;
}

describe("ReactResources flush", () => {
  it("only wakes an observed resource after its version changes", () => {
    const resources = new TypedResourcesBuilder<TestResourcePaths>()
      .add("/value", () => ({ value: 1 }))
      .build();
    const reactResources = new ReactResources(resources);
    const key = reactResources.key(["/value"]);
    let calls = 0;
    reactResources.emitter.on(key, () => calls++);

    reactResources.flush();
    reactResources.flush();
    assert.equal(calls, 1);

    resources.set("/value", { value: 2 });
    reactResources.flush();
    reactResources.flush();
    assert.equal(calls, 2);
  });

  it("preserves direct emitter events that do not use a resource key", () => {
    const resources = new TypedResourcesBuilder<TestResourcePaths>()
      .add("/value", () => ({ value: 1 }))
      .build();
    const reactResources = new ReactResources(resources);
    let calls = 0;
    reactResources.emitter.on("direct", () => calls++);

    reactResources.flush();
    reactResources.flush();
    assert.equal(calls, 2);
  });
});
