export interface AzureOpenAIConfigV1 {
  endpoint: string;
  apiKey: string;
  apiVersion: string;
  deployment: string;
}

export interface AzureOpenAIMessageV1 {
  role: "system" | "user" | "assistant";
  content: string;
}

export function azureOpenAIConfigFromEnvV1(
  env: Record<string, string | undefined> = process.env
): AzureOpenAIConfigV1 | undefined {
  const endpoint = (env.AZURE_OPENAI_ENDPOINT ?? "").trim();
  const apiKey = (
    env.AZURE_OPENAI_API_KEY ??
    env.AZURE_OPENAI_KEY ??
    env.AZURE_OPENAI_SUBSCRIPTION_KEY ??
    ""
  ).trim();
  const deployment = (
    env.AZURE_OPENAI_DEPLOYMENT ??
    env.AZURE_OPENAI_MODEL ??
    env.AZURE_OPENAI_RESPONSES_MODEL ??
    ""
  ).trim();
  if (!endpoint || !apiKey || !deployment) {
    return undefined;
  }
  return {
    endpoint,
    apiKey,
    deployment,
    apiVersion: (env.AZURE_OPENAI_API_VERSION ?? "2025-04-01-preview").trim(),
  };
}

function azureOpenAIResponsesUrlV1(config: AzureOpenAIConfigV1) {
  const endpoint = config.endpoint.replace(/\/+$/, "");
  if (endpoint.includes("/openai/responses")) {
    const url = new URL(endpoint);
    if (!url.searchParams.has("api-version")) {
      url.searchParams.set("api-version", config.apiVersion);
    }
    return url.toString();
  }
  const url = new URL(`${endpoint}/openai/responses`);
  url.searchParams.set("api-version", config.apiVersion);
  return url.toString();
}

async function responseErrorTextV1(response: Response) {
  try {
    return (await response.text()).slice(0, 1000);
  } catch {
    return response.statusText;
  }
}

function outputTextFromResponsesPayloadV1(payload: any): string {
  if (typeof payload?.output_text === "string") {
    return payload.output_text;
  }
  const fragments: string[] = [];
  for (const output of payload?.output ?? []) {
    for (const content of output?.content ?? []) {
      if (typeof content?.text === "string") {
        fragments.push(content.text);
      } else if (typeof content?.value === "string") {
        fragments.push(content.value);
      }
    }
  }
  return fragments.join("\n").trim();
}

export async function createAzureOpenAIResponseTextV1(input: {
  messages: AzureOpenAIMessageV1[];
  maxOutputTokens?: number;
  config?: AzureOpenAIConfigV1;
}): Promise<string | undefined> {
  const config = input.config ?? azureOpenAIConfigFromEnvV1();
  if (!config) {
    return undefined;
  }
  const instructions = input.messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
  const messages = input.messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));
  const response = await fetch(azureOpenAIResponsesUrlV1(config), {
    method: "POST",
    headers: {
      "api-key": config.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.deployment,
      ...(instructions ? { instructions } : {}),
      input: messages,
      max_output_tokens: input.maxOutputTokens ?? 700,
    }),
  });
  if (!response.ok) {
    throw new Error(
      `Azure OpenAI Responses API failed: ${
        response.status
      } ${await responseErrorTextV1(response)}`
    );
  }
  return outputTextFromResponsesPayloadV1(await response.json());
}
