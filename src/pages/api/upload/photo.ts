import type { SendMessageRequest } from "@/server/shared/chat/api";
import { enqueueMakePhotoWarpable } from "@/server/shared/tasks/server_tasks/ecs_repair";
import type { WebServerContext } from "@/server/web/context";
import {
  fetchFeedPostBundle,
  fetchFeedPostBundleById,
  handleFeedPostPhoto,
} from "@/server/web/db/social";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import { postPhotoToDiscord } from "@/server/web/util/discord";
import {
  zCameraMode,
  zMinigameType,
  zVec2f,
  zVec3f,
} from "@/shared/ecs/gen/types";
import type { FirehoseEvent, InPhotoEvent } from "@/shared/firehose/events";
import type { BiomesId } from "@/shared/ids";
import { zBiomesId } from "@/shared/ids";
import type {
  FeedPostBundle,
  TaggedEnvironmentGroupBundle,
  TaggedLandBundle,
  TaggedUserBundle,
} from "@/shared/types";
import { zFeedPostBundle, zPostTaggedObject } from "@/shared/types";
import { fireAndForget } from "@/shared/util/async";
import { log } from "@/shared/logging";
import { asyncBackoffOnAllErrors } from "@/shared/util/retry_helpers";
import { take } from "lodash";
import { z } from "zod";

export const zPostPhotoResponse = z.object({
  feedPostBundle: zFeedPostBundle,
});

export type PostPhotoResponse = z.infer<typeof zPostPhotoResponse>;

export const zPostPhotoRequest = z.object({
  photoDataURI: z.string(),
  position: zVec3f,
  orientation: zVec2f,
  shotCoordinates: zVec3f,
  shotLookAt: zVec3f,
  taggedObjects: z.array(zPostTaggedObject),
  caption: z.string().optional(),
  allowWarping: z.boolean(),
  cameraMode: zCameraMode,
  shotInMinigameId: zBiomesId.optional(),
  shotInMinigameInstanceId: zBiomesId.optional(),
  shotInMinigameType: zMinigameType.optional(),
});

export type PostPhotoRequest = z.infer<typeof zPostPhotoRequest>;

async function activityUpdates(
  context: WebServerContext,
  feedPostBundle: FeedPostBundle
) {
  const updates: SendMessageRequest[] = [];

  const maxTaggedUsers = 10;
  const maxTaggedEnvironmentGroups = 5;
  const maxTaggedLands = 5;
  const capturedUsers = feedPostBundle.taggedObjects.filter(
    (e) => e.kind === "user" && e.bundle.id
  ) as TaggedUserBundle[];
  const capturedEnvironmentGroups = feedPostBundle.taggedObjects.filter(
    (e) => e.kind === "environment_group" && e.bundle.creatorId
  ) as TaggedEnvironmentGroupBundle[];
  const capturedLands = feedPostBundle.taggedObjects.filter(
    (e) => e.kind === "land" && e.bundle.creatorId
  ) as TaggedLandBundle[];

  take(capturedUsers, maxTaggedUsers).forEach((taggedUserBundle) => {
    if (taggedUserBundle.bundle.id === feedPostBundle.userId) {
      return;
    }
    updates.push({
      channel: "activity",
      to: taggedUserBundle.bundle.id,
      from: feedPostBundle.userId,
      message: {
        kind: "tag",
        documentType: "post",
        documentId: feedPostBundle.id,
      },
    });
  });

  take(capturedEnvironmentGroups, maxTaggedEnvironmentGroups).forEach(
    (taggedEnvironmentBundle) => {
      if (taggedEnvironmentBundle.bundle.creatorId === feedPostBundle.userId) {
        return;
      }
      updates.push({
        channel: "activity",
        to: taggedEnvironmentBundle.bundle.creatorId,
        from: feedPostBundle.userId,
        message: {
          kind: "tag",
          documentType: "environment_group",
          documentId: feedPostBundle.id,
        },
      });
    }
  );

  take(capturedLands, maxTaggedLands).forEach((taggedLandBundle) => {
    if (taggedLandBundle.bundle.creatorId === feedPostBundle.userId) {
      return;
    }
    updates.push({
      channel: "activity",
      to: taggedLandBundle.bundle.creatorId,
      from: feedPostBundle.userId,
      message: {
        kind: "tag",
        documentType: "land",
        documentId: feedPostBundle.id,
      },
    });
  });
  return updates;
}

export default biomesApiHandler(
  {
    auth: "required",
    body: zPostPhotoRequest,
    response: zPostPhotoResponse,
  },
  async ({
    context,
    auth: { userId },
    body: {
      photoDataURI,
      position,
      orientation,
      shotCoordinates: coordinates,
      shotLookAt: cameraLookAt,
      taggedObjects,
      caption,
      allowWarping,
      cameraMode,
      shotInMinigameId,
      shotInMinigameInstanceId,
      shotInMinigameType,
    },
  }) => {
    const {
      db,
      firehose,
      logicApi,
      worldApi,
      chatApi,
      idGenerator,
      serverTaskProcessor,
    } = context;
    const feedPost = await handleFeedPostPhoto(
      db,
      idGenerator,
      userId,
      photoDataURI, // Should validate
      taggedObjects, // Should validate
      caption,
      {
        coordinates,
        cameraLookAt,
        shotInMinigameId,
        shotInMinigameInstanceId,
        shotInMinigameType,
      }
    );

    const numTaggedUsers = taggedObjects.filter(
      (e) => e.kind === "user"
    ).length;
    const taggedGroupIds = taggedObjects
      .filter((e) => e.kind === "environment_group")
      .map((e) => e.id) as BiomesId[];
    const taggedLandIds = taggedObjects
      .filter((e) => e.kind === "land")
      .map((e) => e.id) as BiomesId[];
    const bundle = await fetchFeedPostBundle(db, worldApi, feedPost, userId);

    fireAndForget(postPhotoToDiscord(context, bundle)); // Don't block on discord post

    const events: FirehoseEvent[] = [
      {
        kind: "postPhoto",
        entityId: userId,
        people: numTaggedUsers,
        groups: taggedGroupIds.length,
        groupIds: taggedGroupIds,
        lands: taggedLandIds.length,
        landOwnerIds: taggedLandIds,
        taggedObjects: taggedObjects,
        cameraMode: cameraMode,
      },
      ...taggedObjects.flatMap((e) =>
        e.kind === "user"
          ? [
              <InPhotoEvent>{
                kind: "inPhoto",
                entityId: e.id,
              },
            ]
          : []
      ),
    ];

    const updates = await activityUpdates(context, bundle);
    const sideEffects: Array<{ name: string; promise: Promise<unknown> }> = [
      {
        name: "firehose",
        // The postPhoto event advances native photo quests, so retry it before
        // treating the upload as successful. A brief downstream interruption
        // should not force the client to create a duplicate social post.
        promise: asyncBackoffOnAllErrors(() => firehose.publish(...events), {
          baseMs: 100,
          maxMs: 500,
          maxAttempts: 3,
          timeoutMs: 2_000,
        }),
      },
      ...updates.map((update, index) => ({
        name: `activity:${index}`,
        promise: chatApi.sendMessage(update),
      })),
    ];
    if (allowWarping) {
      sideEffects.push({
        name: "make_warpable",
        promise: enqueueMakePhotoWarpable(
          serverTaskProcessor,
          logicApi,
          db,
          idGenerator,
          feedPost,
          position,
          orientation
        ),
      });
    }

    const results = await Promise.allSettled(
      sideEffects.map(({ promise }) => promise)
    );
    for (let index = 0; index < results.length; index += 1) {
      const result = results[index];
      if (result.status === "rejected") {
        log.warn("Photo was created but a follow-up action failed", {
          feedPostId: feedPost.id,
          action: sideEffects[index].name,
          error: result.reason,
        });
      }
    }

    // Firehose drives native photo quest progress, but the social post is
    // already durable at this point. Never return a 500 after that boundary:
    // clients retrying the whole upload would create duplicate posts. Continue
    // retrying the event in the background instead.
    if (results[0].status === "rejected") {
      fireAndForget(
        asyncBackoffOnAllErrors(() => firehose.publish(...events), {
          baseMs: 500,
          maxMs: 5_000,
          maxAttempts: 10,
          timeoutMs: 30_000,
        }).catch((error) => {
          log.error(
            "Photo was created but its firehose event stayed unavailable",
            {
              feedPostId: feedPost.id,
              error,
            }
          );
        })
      );
    }

    try {
      const updatedBundle = await fetchFeedPostBundleById(
        db,
        worldApi,
        feedPost.id,
        userId
      );
      if (updatedBundle) {
        return { feedPostBundle: updatedBundle };
      }
      log.warn("Created photo bundle was not immediately readable", {
        feedPostId: feedPost.id,
      });
    } catch (error) {
      log.warn("Failed to refresh a newly created photo bundle", {
        feedPostId: feedPost.id,
        error,
      });
    }
    return { feedPostBundle: bundle };
  }
);

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "32mb",
    },
  },
};
