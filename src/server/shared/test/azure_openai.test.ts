import {
  azureOpenAIConfigFromEnv,
  createAzureOpenAIResponseText,
} from "@/server/shared/azure_openai";
import assert from "assert";

const ORIGINAL_FETCH = globalThis.fetch;

function mockFetch(
  handler: (url: string, init?: RequestInit) => Promise<Response> | Response
) {
  (globalThis as any).fetch = (
    url: string | URL | Request,
    init?: RequestInit
  ) => handler(String(url), init);
}

describe("Azure OpenAI helpers", () => {
  afterEach(() => {
    (globalThis as any).fetch = ORIGINAL_FETCH;
  });

  it("treats Azure OpenAI env vars as optional", () => {
    assert.equal(azureOpenAIConfigFromEnv({}), undefined);
    assert.equal(
      azureOpenAIConfigFromEnv({
        AZURE_OPENAI_ENDPOINT: "https://example.openai.azure.com/",
        AZURE_OPENAI_API_KEY: "key",
      }),
      undefined
    );
    assert.deepEqual(
      azureOpenAIConfigFromEnv({
        AZURE_OPENAI_ENDPOINT: "https://example.openai.azure.com/",
        AZURE_OPENAI_API_KEY: "key",
        AZURE_OPENAI_DEPLOYMENT: "gpt-5.5",
      }),
      {
        endpoint: "https://example.openai.azure.com/",
        apiKey: "key",
        deployment: "gpt-5.5",
        apiVersion: "2025-04-01-preview",
      }
    );
    assert.deepEqual(
      azureOpenAIConfigFromEnv({
        AZURE_OPENAI_ENDPOINT: "https://example.openai.azure.com/",
        AZURE_OPENAI_KEY: "key",
        AZURE_OPENAI_RESPONSES_MODEL: "gpt-5.5",
        AZURE_OPENAI_API_VERSION: "2025-04-01-preview",
      }),
      {
        endpoint: "https://example.openai.azure.com/",
        apiKey: "key",
        deployment: "gpt-5.5",
        apiVersion: "2025-04-01-preview",
      }
    );
  });

  it("does not call Azure OpenAI when config is absent", async () => {
    let called = false;
    mockFetch(() => {
      called = true;
      return new Response();
    });
    const envKeys = [
      "AZURE_OPENAI_ENDPOINT",
      "AZURE_OPENAI_API_KEY",
      "AZURE_OPENAI_KEY",
      "AZURE_OPENAI_SUBSCRIPTION_KEY",
      "AZURE_OPENAI_DEPLOYMENT",
      "AZURE_OPENAI_MODEL",
      "AZURE_OPENAI_RESPONSES_MODEL",
    ];
    const originalEnv = new Map(envKeys.map((key) => [key, process.env[key]]));
    for (const key of envKeys) {
      delete process.env[key];
    }

    try {
      assert.equal(
        await createAzureOpenAIResponseText({
          messages: [{ role: "user", content: "hello" }],
        }),
        undefined
      );
      assert.equal(called, false);
    } finally {
      for (const [key, value] of originalEnv) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    }
  });

  it("posts system instructions separately from conversation input", async () => {
    let capturedUrl = "";
    let capturedBody: any;
    mockFetch(async (url, init) => {
      capturedUrl = url;
      capturedBody = JSON.parse(String(init?.body));
      return Response.json({
        output_text: "A grounded NPC answer.",
      });
    });

    const text = await createAzureOpenAIResponseText({
      config: {
        endpoint: "https://example.openai.azure.com/",
        apiKey: "openai-key",
        deployment: "gpt-5.5",
        apiVersion: "2025-04-01-preview",
      },
      messages: [
        { role: "system", content: "Stay in character." },
        { role: "user", content: "Hello." },
        { role: "assistant", content: "Well met." },
      ],
      maxOutputTokens: 123,
    });

    assert.equal(
      capturedUrl,
      "https://example.openai.azure.com/openai/responses?api-version=2025-04-01-preview"
    );
    assert.deepEqual(capturedBody, {
      model: "gpt-5.5",
      instructions: "Stay in character.",
      input: [
        { role: "user", content: "Hello." },
        { role: "assistant", content: "Well met." },
      ],
      max_output_tokens: 123,
    });
    assert.equal(text, "A grounded NPC answer.");
  });

  it("uses Responses API output fragments when output_text is absent", async () => {
    mockFetch(() =>
      Response.json({
        output: [
          {
            content: [{ text: "First." }, { value: "Second." }],
          },
        ],
      })
    );

    assert.equal(
      await createAzureOpenAIResponseText({
        config: {
          endpoint:
            "https://example.openai.azure.com/openai/responses?api-version=2025-04-01-preview",
          apiKey: "openai-key",
          deployment: "gpt-5.5",
          apiVersion: "2025-04-01-preview",
        },
        messages: [{ role: "user", content: "Hello." }],
      }),
      "First.\nSecond."
    );
  });

  it("throws with Azure OpenAI error text when generation fails", async () => {
    mockFetch(() => new Response("bad deployment", { status: 404 }));

    await assert.rejects(
      () =>
        createAzureOpenAIResponseText({
          config: {
            endpoint: "https://example.openai.azure.com/",
            apiKey: "openai-key",
            deployment: "gpt-5.5",
            apiVersion: "2025-04-01-preview",
          },
          messages: [{ role: "user", content: "Hello." }],
        }),
      /Azure OpenAI Responses API failed: 404 bad deployment/
    );
  });
});
