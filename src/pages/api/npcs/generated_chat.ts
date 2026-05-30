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
Your messages should be short, personable and full of puns. \
Your messages will display inside of the game with user choices. \
In every message enclose two or three short options for player responses in <button> XML tags. \
A player named ${userName} will be interacting with you and wants to chit-chat. Make up anything you want. \
For context, ${userName} is wearing ${andify(wearingStrs)}. \
Start with an opening message for ${userName} that remarks on their outfit and explains who you are. \
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

  const options = lore
    ? [
        {
          name: "Ask what they notice",
          followUpText: lore.extraLines[0] ?? lore.currentGoal,
        },
        {
          name: "Ask how to help",
          followUpText: lore.currentGoal,
        },
        {
          name: "Ask what matters",
          followUpText: lore.motivation,
        },
      ]
    : harthmereFallbackNpcOptionsV143({
        name,
        description,
      });

  const matchedOption = userResponse
    ? options.find((option) => option.name === userResponse)
    : undefined;
  const message =
    matchedOption?.followUpText ??
    lore?.line ??
    harthmereFallbackNpcDialogTextV143({ name, description });

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
    ...(userResponse
      ? [{ role: "user" as const, content: userResponse }]
      : []),
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

    if (nextMessage?.message) {
      nextMessageContext.push(nextMessage.message);
    }

    return {
      nextDialog: {
        message: dialog,
        buttons: buttons,
        terminated: !!nextMessage?.finish_reason,
      },
      messageContext: JSON.stringify(nextMessageContext),
    };
  }
);
