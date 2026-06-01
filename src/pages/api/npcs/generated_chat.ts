import { getSecret } from "@/server/shared/secrets";
import { okOrAPIError } from "@/server/web/errors";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import type { ReadonlyEntity } from "@/shared/ecs/gen/entities";
import {
  harthmereFallbackNpcDialogTextV143,
  harthmereFallbackNpcOptionsV143,
} from "@/shared/harthmere/npc_dialog_fallback_v143";
import { snapshotLiveNpcLoreForDialogV79 } from "@/shared/harthmere/snapshot_live_npc_bible_v79";
import { zBiomesId } from "@/shared/ids";
import { createGauge } from "@/shared/metrics/metrics";
import { relevantBiscuitForEntity } from "@/shared/npc/bikkie";
import { andify } from "@/shared/util/text";
import { sumBy } from "lodash";
import type { ChatCompletionRequestMessage } from "openai";
import { Configuration, OpenAIApi } from "openai";
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
    buttons,
    dialog: startButton < 100000 ? input.slice(0, startButton) : "",
  };
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

function systemPromptForEntity(user: ReadonlyEntity, entity: ReadonlyEntity) {
  const userName = user.label?.text ?? "Unknown";
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
Your messages should be short, personable and full of puns. \
Your messages will display inside of the game with user choices. \
In every message enclose two or three short options for player responses in <button> XML tags. \
A player named ${userName} will be interacting with you and wants to chit-chat. Make up anything you want. \
For context, ${userName} is wearing ${andify(wearingStrs)}. \
Start with an opening message for ${userName} that remarks on their outfit and explains who you are using "I" statements. \
`.trim();
}

function deterministicGeneratedChatFallbackV1(
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

  const previousContext = messageContext
    ? (() => {
        try {
          const parsed = JSON.parse(messageContext);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })()
    : [];
  const nextMessageContext: ChatCompletionRequestMessage[] = [
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
    messageContext: JSON.stringify(nextMessageContext),
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
    body: { entityId, messageContext, userResponse },
  }) => {
    const [entity, user] = await worldApi.get([entityId, userId]);
    okOrAPIError(entity, "not_found", `Entity ${entityId} not found!`);
    okOrAPIError(user, "not_found", `User ${userId} not found!`);
    const materializedEntity = entity.materialize();
    const materializedUser = user.materialize();
    const key = getSecret("openai-api-key").trim();
    if (!key) {
      return deterministicGeneratedChatFallbackV1(
        materializedEntity,
        userResponse,
        messageContext
      );
    }
    const userName = materializedUser.label?.text ?? "Unknown";
    process.env["OPENAI_API_KEY"] = key;
    const configuration = new Configuration({
      apiKey: key,
    });

    const messages: ChatCompletionRequestMessage[] = messageContext
      ? JSON.parse(messageContext)
      : [
          {
            role: "system",
            content: systemPromptForEntity(
              materializedUser,
              materializedEntity
            ),
          },
        ];

    if (userResponse) {
      messages.push({
        role: "user",
        content: `${userName} responds with: ${userResponse}`,
      });
    }

    METRICS.contextSize.set(sumBy(messages, (e) => e.content.length));

    const openai = new OpenAIApi(configuration);
    const completion = await openai.createChatCompletion(
      {
        model: "gpt-3.5-turbo",
        messages,
      },
      {}
    );

    const nextMessage = completion.data.choices[0];
    const nextMessageContent = nextMessage.message?.content ?? "";
    const { dialog, buttons } = parseDialog(nextMessageContent);
    const nextMessageContext = [...messages];
    const buttonLikeability: Record<string, number> = Object.fromEntries(
      buttons.map((button) => [
        button,
        generatedChatLikeabilityForOptionV1(button),
      ])
    );

    if (nextMessage?.message) {
      nextMessageContext.push(nextMessage.message);
    }

    return {
      nextDialog: {
        message: dialog,
        buttons: buttons,
        terminated: !!nextMessage?.finish_reason,
        likeabilityDelta: userResponse
          ? generatedChatLikeabilityForOptionV1(userResponse)
          : undefined,
        buttonLikeability,
      },
      messageContext: JSON.stringify(nextMessageContext),
    };
  }
);
