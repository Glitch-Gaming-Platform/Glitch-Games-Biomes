import {
  type AzureOpenAIMessageV1,
  azureOpenAIConfigFromEnvV1,
  createAzureOpenAIResponseTextV1,
} from "@/server/shared/azure_openai";
import { okOrAPIError } from "@/server/web/errors";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import type { ReadonlyEntity } from "@/shared/ecs/gen/entities";
import {
  harthmereFallbackNpcDialogTextV143,
  harthmereFallbackNpcOptionsV143,
} from "@/shared/harthmere/npc_dialog_fallback_v143";
import { harthmereSpeechDeliveryPromptBriefV1 } from "@/shared/harthmere/npc_speech_delivery_v1";
import { parseHarthmereAzureVoiceIdV1 } from "@/shared/harthmere/npc_voice_profiles_v1";
import { snapshotLiveNpcLoreForDialogV79 } from "@/shared/harthmere/snapshot_live_npc_bible_v79";
import type { BiomesId } from "@/shared/ids";
import { zBiomesId } from "@/shared/ids";
import { log } from "@/shared/logging";
import { createGauge } from "@/shared/metrics/metrics";
import { relevantBiscuitForEntity } from "@/shared/npc/bikkie";
import { andify } from "@/shared/util/text";
import { sumBy } from "lodash";
import { z } from "zod";

const METRICS = {
  contextSize: createGauge({
    name: "generated_chat_context_size",
    help: "Size of generated chat (OpenAI requests)",
  }),
};

export const zGeneratedChatRequest = z.object({
  entityId: zBiomesId,
  userResponse: z.string().optional(),
  messageContext: z.string().optional(),
  questContext: z.string().optional(),
  userContext: z.string().optional(),
});

export type GeneratedChatRequest = z.infer<typeof zGeneratedChatRequest>;

export const zGeneratedChatResponse = z.object({
  nextDialog: z.object({
    message: z.string(),
    buttons: z.string().array(),
    terminated: z.boolean(),
    // likeabilityDelta is the reputation change to apply for the chosen option.
    // Positive values come from praise/friendly choices; negative from rude/mock choices.
    // Undefined means the response was an NPC opening line (no player choice made yet).
    likeabilityDelta: z.number().optional(),
    // buttonLikeability carries the delta that WILL apply when each button is pressed,
    // so the client can preview consequences before confirming a choice.
    buttonLikeability: z.record(z.string(), z.number()).optional(),
  }),
  messageContext: z.string(),
});

export type GeneratedChatResponse = z.infer<typeof zGeneratedChatResponse>;

function parseDialog(input: string): { buttons: string[]; dialog: string } {
  const buttonRegex = /<button[^>]*>([\s\S]*?)<\/button>/gi;
  const buttons: string[] = [];
  let buttonMatch: RegExpExecArray | null;

  let startButton = Infinity;
  while ((buttonMatch = buttonRegex.exec(input)) !== null) {
    startButton = Math.min(buttonMatch.index, startButton);
    buttons.push(buttonMatch[1]);
  }

  return {
    buttons: buttons.map((button) => button.trim()).filter(Boolean),
    dialog: (startButton < 100000 ? input.slice(0, startButton) : input)
      .replace(/<\/?text>/gi, "")
      .trim(),
  };
}

export function generatedChatSanitizeContextForPromptV1(
  rawContext: string | undefined
) {
  const trimmed = rawContext?.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed
    .replace(/\bGlitch[a-z0-9_-]{8,}\b/gi, "traveler")
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
      "traveler"
    )
    .replace(/\b[0-9a-f]{16,}\b/gi, "traveler")
    .slice(0, 1800);
}

function generatedChatFallbackButtonsV1(input: {
  questContext: string | undefined;
}) {
  return input.questContext?.trim()
    ? ["Ask about the quest", "Ask what to do next", "Say goodbye"]
    : ["Ask what they mean", "Ask what to do next", "Say goodbye"];
}

export function generatedChatNormalizeModelOutputForTestV1(input: {
  content: string;
  questContext?: string;
}): { buttons: string[]; dialog: string } | undefined {
  const { dialog, buttons } = parseDialog(input.content);
  if (!dialog) {
    return undefined;
  }
  return {
    dialog,
    buttons: buttons.length
      ? buttons
      : generatedChatFallbackButtonsV1({
          questContext: input.questContext,
        }),
  };
}

function isGeneratedChatConversationMessageV1(
  message: unknown
): message is GeneratedChatMessageV1 {
  return (
    typeof message === "object" &&
    message !== null &&
    ((message as GeneratedChatMessageV1).role === "user" ||
      (message as GeneratedChatMessageV1).role === "assistant") &&
    typeof (message as GeneratedChatMessageV1).content === "string"
  );
}

function parseGeneratedChatMessageContextV1(
  messageContext: string | undefined,
  entityId: BiomesId
): GeneratedChatMessageV1[] {
  if (!messageContext) {
    return [];
  }
  try {
    const parsed = JSON.parse(messageContext);
    const messages = Array.isArray(parsed)
      ? parsed
      : String(parsed?.entityId) === String(entityId) &&
        Array.isArray(parsed?.messages)
      ? parsed.messages
      : [];
    return messages.filter(isGeneratedChatConversationMessageV1).slice(-8);
  } catch {
    return [];
  }
}

function serializeGeneratedChatMessageContextV1(input: {
  entityId: BiomesId;
  messages: GeneratedChatMessageV1[];
}) {
  return JSON.stringify({
    kind: "generated_npc_chat_v1",
    entityId: input.entityId,
    messages: input.messages
      .filter(isGeneratedChatConversationMessageV1)
      .slice(-8),
  });
}

export function generatedChatConversationMessagesFromContextForTestV1(
  messageContext: string | undefined,
  entityId: BiomesId
) {
  return parseGeneratedChatMessageContextV1(messageContext, entityId);
}

export function generatedChatSerializeMessageContextForTestV1(input: {
  entityId: BiomesId;
  messages: GeneratedChatMessageV1[];
}) {
  return serializeGeneratedChatMessageContextV1(input);
}

export function generatedChatLikeabilityForOptionV1(input: string): number {
  const normalized = input
    .replace(/<[^>]*>/g, " ")
    .replace(/[^\w\s'-]/g, " ")
    .trim()
    .toLowerCase();
  if (!normalized || /^(close|goodbye|bye|leave)$/i.test(normalized)) {
    return 0;
  }
  if (
    /\b(threaten|intimidate|mock|insult|sneer|ridicule|useless|worthless|stupid|idiot|fool|trash|liar|shut up|go away|waste of time)\b/.test(
      normalized
    )
  ) {
    return -8;
  }
  if (
    /\b(compliment|praise|thank|respect|appreciate|apologize|sorry|help|support|kind|careful|honest|steady|useful|well done)\b/.test(
      normalized
    )
  ) {
    return 6;
  }
  if (
    /\b(ask|question|learn|listen|where|what|why|how|tell me|explain)\b/.test(
      normalized
    )
  ) {
    return 0;
  }
  return 1;
}

export function generatedChatPlayerNameForPromptV1(
  rawName: string | undefined
) {
  const trimmed = rawName?.trim() ?? "";
  if (!trimmed) {
    return "traveler";
  }
  if (
    /^glitch/i.test(trimmed) ||
    /[a-f0-9]{8,}/i.test(trimmed) ||
    /^[0-9a-f-]{24,}$/i.test(trimmed)
  ) {
    return "traveler";
  }
  return trimmed;
}

export function generatedChatConversationGuardrailPromptV1(input: {
  hasUserResponse: boolean;
  hasMessageContext: boolean;
}) {
  return [
    "Conversation guardrails:",
    "- Answer the player's latest words directly in a natural spoken reply.",
    "- Do not repeat the same greeting, biography, or outfit remark from earlier in the conversation.",
    "- Do not recite metadata, ids, coordinates, or context as a list.",
    "- Keep the NPC in-world; never mention prompts, APIs, speech synthesis, or system instructions.",
    input.hasUserResponse || input.hasMessageContext
      ? "- This is an ongoing conversation, so do not restart with an opening introduction."
      : "- This is the opening turn; one brief introduction is allowed.",
  ].join("\n");
}

export function generatedChatSpeechPerformanceBriefForTestV1(input: {
  npcName?: string;
  entityDescription?: string;
  voiceId?: string;
}) {
  const parsedVoice = parseHarthmereAzureVoiceIdV1(input.voiceId);
  return harthmereSpeechDeliveryPromptBriefV1({
    actorKey: parsedVoice?.actorKey,
    text: `${input.npcName ?? ""} ${input.entityDescription ?? ""}`,
  });
}

function systemPromptForEntity(user: ReadonlyEntity, entity: ReadonlyEntity) {
  const userName = generatedChatPlayerNameForPromptV1(user.label?.text);
  const wearingStrs: string[] = [];
  user.wearing?.items.forEach((val) => {
    wearingStrs.push(val.displayName);
  });

  const relevantBiscuit = relevantBiscuitForEntity(entity);

  let creatorText = "";
  if (entity.entity_description) {
    creatorText = `Your creator described you as ${entity.entity_description.text}. `;
  }
  const npcName = entity.label?.text ?? "Unknown";
  const toneBrief = generatedChatSpeechPerformanceBriefForTestV1({
    npcName,
    entityDescription: entity.entity_description?.text,
    voiceId: entity.voice?.voice,
  });

  const containerItem = entity.container_inventory?.items[0];

  if (relevantBiscuit?.isMount) {
    return `\
You are a fish mounted on a plaque similar to the popular Billy Bass toy.
Your messages should be in the form of short rhyming music. Do not include the words 'verse' or 'chorus'. \
Your fish species is ${
      containerItem?.item.displayName ?? "unknown"
    }, make sure to reference it in your song.
Your messages will display inside with user choices. \
In every message enclose exactly two short options for player responses in <button> XML tags. \
A player named ${userName} will be interacting with you. Make up anything you want. \
For context, ${userName} is wearing ${andify(wearingStrs)}. \
Respond with short rhyming song lyrics.
`.trim();
  }

  return `\
You are ${npcName}, a NPC in an online video game named Biomes. ${creatorText}\
Speak as ${npcName} in first person. Do not describe ${npcName} in third person, and do not write stage directions. \
Your messages should be short, personable, spoken aloud, and natural enough that text-to-speech can read them like a real person. \
Performance brief for ${npcName}: ${toneBrief} \
Avoid announcing emotions, brackets, stage directions, assistant disclaimers, and long exposition. Use contractions when they fit the character. \
Your messages will display inside of the game with user choices and may also be spoken through Azure Speech. \
In every message enclose two or three short options for player responses in <button> XML tags. \
A player named ${userName} will be interacting with you. Stay grounded in your name, your creator description, active quest context, and current location context. \
For context, ${userName} is wearing ${andify(wearingStrs)}. \
If this is the opening turn, you may briefly remark on concrete outfit or location details. If this is an ongoing turn, answer directly and continue the conversation. \
`.trim();
}

function questContextPromptV1(questContext: string | undefined) {
  const trimmed = questContext?.trim();
  if (!trimmed) {
    return undefined;
  }
  return `\
The player is currently talking by voice about an active quest related to this NPC.
Prioritize the quest if the player's words could reasonably refer to it.
Use this active quest context without claiming the quest is complete unless the player says so:
${trimmed}
`.trim();
}

function userContextPromptV1(userContext: string | undefined) {
  const sanitized = generatedChatSanitizeContextForPromptV1(userContext);
  if (!sanitized) {
    return undefined;
  }
  return `\
Use this current player and location context when it is naturally relevant.
Do not recite it as a list; let the NPC notice concrete details in a human way:
${sanitized}
`.trim();
}

type GeneratedChatMessageV1 = AzureOpenAIMessageV1;

function deterministicGeneratedChatFallbackV1(
  entityId: BiomesId,
  entity: ReadonlyEntity,
  userResponse: string | undefined,
  messageContext: string | undefined
): GeneratedChatResponse {
  const name = entity.label?.text ?? "Unknown";
  const description = entity.entity_description?.text;
  const lore = snapshotLiveNpcLoreForDialogV79({
    label: name,
    entityDescriptionText: description,
  });

  // Build options with likeability deltas.
  // harthmereFallbackNpcOptionsV143 already provides likeability on each option
  // (positive for praise, negative for mockery). Lore-path options get the same
  // structure: neutral ask (0), warm acknowledgement (+6), gentle challenge (−4).
  const options: Array<{
    name: string;
    followUpText: string;
    likeability: number;
    type?: "primary" | "destructive";
  }> = lore
    ? (() => {
        const first =
          lore.displayName.split(/[\s,]/).find(Boolean) ?? lore.displayName;
        const texts = [
          lore.extraLines[0] ?? lore.line,
          lore.extraLines[1] ?? lore.currentGoal,
          lore.extraLines[2] ?? lore.motivation,
        ];
        // Guarantee the three responses are distinct.
        const seen = new Set<string>();
        const fallbacks = [
          ...(lore.extraLines as readonly string[]),
          lore.line,
          lore.currentGoal,
          lore.motivation,
        ];
        const deduplicated = texts.map((text) => {
          if (seen.has(text)) {
            const alt = fallbacks.find((candidate) => !seen.has(candidate));
            return alt ?? text;
          }
          seen.add(text);
          return text;
        });
        return [
          {
            name: `Ask ${first} what they watch for`,
            followUpText: deduplicated[0],
            likeability: 0,
          },
          {
            name: `Appreciate ${first}'s work here`,
            followUpText: `${first} notices the acknowledgement. ${deduplicated[1]}`,
            likeability: 6,
            type: "primary" as const,
          },
          {
            name: `Question whether ${first}'s approach works`,
            followUpText: deduplicated[2],
            likeability: -4,
            type: "destructive" as const,
          },
        ];
      })()
    : harthmereFallbackNpcOptionsV143({ name, description });

  const matchedOption = userResponse
    ? options.find((option) => option.name === userResponse)
    : undefined;
  const message =
    matchedOption?.followUpText ??
    lore?.line ??
    harthmereFallbackNpcDialogTextV143({ name, description });

  // Build a per-button preview map so the client can show consequence hints
  // (e.g. a red tint on destructive buttons) before the player commits.
  const buttonLikeability: Record<string, number> = Object.fromEntries(
    options.map((option) => [option.name, option.likeability])
  );

  const previousContext = parseGeneratedChatMessageContextV1(
    messageContext,
    entityId
  );
  const nextMessageContext: GeneratedChatMessageV1[] = [
    ...previousContext.slice(-6),
    ...(userResponse ? [{ role: "user" as const, content: userResponse }] : []),
    {
      role: "assistant",
      content: message,
    },
  ];

  return {
    nextDialog: {
      message,
      buttons: options.map((option) => option.name),
      terminated: false,
      // likeabilityDelta: the change to apply for the option the player just chose.
      // Undefined on the opening message (no choice made yet).
      likeabilityDelta: matchedOption?.likeability,
      // buttonLikeability: per-button preview map so the client can tint or label
      // each button before the player commits (positive = friendly, negative = rude).
      buttonLikeability,
    },
    messageContext: serializeGeneratedChatMessageContextV1({
      entityId,
      messages: nextMessageContext,
    }),
  };
}

export default biomesApiHandler(
  {
    auth: "required",
    body: zGeneratedChatRequest,
    response: zGeneratedChatResponse,
  },
  async ({
    auth: { userId },
    context: { worldApi },
    body: { entityId, messageContext, userResponse, questContext, userContext },
  }) => {
    const [entity, user] = await worldApi.get([entityId, userId]);
    okOrAPIError(entity, "not_found", `Entity ${entityId} not found!`);
    okOrAPIError(user, "not_found", `User ${userId} not found!`);
    const materializedEntity = entity.materialize();
    const materializedUser = user.materialize();
    const azureConfig = azureOpenAIConfigFromEnvV1();
    if (!azureConfig) {
      return deterministicGeneratedChatFallbackV1(
        entityId,
        materializedEntity,
        userResponse,
        messageContext
      );
    }
    const userName = generatedChatPlayerNameForPromptV1(
      materializedUser.label?.text
    );

    const previousConversation = parseGeneratedChatMessageContextV1(
      messageContext,
      entityId
    );
    const messages: GeneratedChatMessageV1[] = [
      {
        role: "system",
        content: systemPromptForEntity(materializedUser, materializedEntity),
      },
    ];
    messages.push({
      role: "system",
      content: generatedChatConversationGuardrailPromptV1({
        hasUserResponse: Boolean(userResponse),
        hasMessageContext: previousConversation.length > 0,
      }),
    });
    const questPrompt = questContextPromptV1(questContext);
    if (questPrompt) {
      messages.push({
        role: "system",
        content: questPrompt,
      });
    }
    const userPrompt = userContextPromptV1(userContext);
    if (userPrompt) {
      messages.push({
        role: "system",
        content: userPrompt,
      });
    }
    messages.push(...previousConversation);

    if (userResponse) {
      messages.push({
        role: "user",
        content: `${userName} responds with: ${userResponse}`,
      });
    }

    METRICS.contextSize.set(sumBy(messages, (e) => e.content.length));

    let nextMessageContent = "";
    try {
      nextMessageContent =
        (await createAzureOpenAIResponseTextV1({
          config: azureConfig,
          messages,
          maxOutputTokens: 700,
        })) ?? "";
    } catch (error) {
      log.warn(
        "Azure OpenAI generated chat failed; using deterministic NPC fallback",
        {
          error,
          entityId,
        }
      );
      return deterministicGeneratedChatFallbackV1(
        entityId,
        materializedEntity,
        userResponse,
        messageContext
      );
    }

    const normalized = generatedChatNormalizeModelOutputForTestV1({
      content: nextMessageContent,
      questContext,
    });
    if (!normalized) {
      return deterministicGeneratedChatFallbackV1(
        entityId,
        materializedEntity,
        userResponse,
        messageContext
      );
    }
    const { dialog, buttons } = normalized;
    const nextMessageContext: GeneratedChatMessageV1[] = [
      ...previousConversation.slice(-6),
      ...(userResponse
        ? [
            {
              role: "user" as const,
              content: `${userName} responds with: ${userResponse}`,
            },
          ]
        : []),
    ];
    const buttonLikeability: Record<string, number> = Object.fromEntries(
      buttons.map((button) => [
        button,
        generatedChatLikeabilityForOptionV1(button),
      ])
    );

    nextMessageContext.push({
      role: "assistant",
      content: nextMessageContent,
    });

    return {
      nextDialog: {
        message: dialog,
        buttons: buttons,
        terminated: false,
        likeabilityDelta: userResponse
          ? generatedChatLikeabilityForOptionV1(userResponse)
          : undefined,
        buttonLikeability,
      },
      messageContext: serializeGeneratedChatMessageContextV1({
        entityId,
        messages: nextMessageContext,
      }),
    };
  }
);
