import { RootErrorBoundary } from "@/client/components/RootErrorBoundary";
import StaticGameAndLoader from "@/client/components/StaticGameAndLoader";
import { iconUrl } from "@/client/components/inventory/icons";
import { mapTileURL, mapTileUV } from "@/client/components/map/helpers";
import type { ObserverMode } from "@/client/game/util/observer";
import type { BiomesHeadTagProps } from "@/pages";
import { BiomesHeadTag } from "@/pages";
import { createBiomesAuthForGlitchInstall } from "@/pages/api/glitch/harthmere";
import {
  clearAuthCookies,
  verifyAuthenticatedRequest,
} from "@/server/shared/auth/cookies";
import { safeDetermineEmployeeUserId } from "@/server/shared/bootstrap/sync";
import type { LazyEntityWith } from "@/server/shared/ecs/gen/lazy";
import { serverModFor } from "@/server/shared/minigames/server_mods";
import { handleCreateOrJoinWebRequest } from "@/server/shared/minigames/util";
import type {
  WebServerContextSubset,
  WebServerServerSidePropsContext,
} from "@/server/web/context";
import { fetchTileMetadata } from "@/server/web/db/map";
import { feedPostById, fetchFeedPostBundleById } from "@/server/web/db/social";
import type { FirestoreUser } from "@/server/web/db/types";
import { findByUID, findUniqueByUsername } from "@/server/web/db/users_fetch";
import { okOrAPIError } from "@/server/web/errors";
import { absoluteBucketURL, resolveImageUrls } from "@/server/web/util/urls";
import type { ReadonlyEntity } from "@/shared/ecs/gen/entities";
import { WorldMetadataId } from "@/shared/ecs/ids";
import { boxToAabb } from "@/shared/game/group";
import {
  rememberHarthmereBiomesAuthSession,
  type HarthmereBiomesAuthSession,
} from "@/shared/util/harthmere_auth_session";
import {
  INVALID_BIOMES_ID,
  parseBiomesId,
  safeParseBiomesId,
  type BiomesId,
} from "@/shared/ids";
import { log } from "@/shared/logging";
import { containsAABB, pitchAndYaw } from "@/shared/math/linear";
import type {
  OptionallyOrientedPoint,
  ReadonlyAABB,
  Vec2,
  Vec3,
} from "@/shared/math/types";
import { relevantBiscuitForEntity } from "@/shared/npc/bikkie";
import { any, dictToQueryString } from "@/shared/util/helpers";
import { imageUrlForSize } from "@/shared/util/urls";
import type { Vec3f } from "@/shared/wasm/types/common";
import { isArray, last } from "lodash";

export default function DispatchView({
  tipSeed,
  userId,
  startCoordinates,
  observerMode,
  startOrientation,
  bikkieTrayId,
  headProps,
  primaryCTA,
  displayName,
  waitingForGlitchInstallAuth,
  glitchBiomesAuthSession,
}: {
  tipSeed: number;
  userId: BiomesId;
  observerMode: ObserverMode | null;
  startCoordinates: Vec3 | null;
  startOrientation: Vec2 | null;
  bikkieTrayId: BiomesId | null;
  headProps: BiomesHeadTagProps | null;
  primaryCTA: typeof CONFIG.primaryCTA | null;
  displayName: string | null;
  waitingForGlitchInstallAuth?: boolean;
  glitchBiomesAuthSession?: HarthmereBiomesAuthSession | null;
}) {
  rememberHarthmereBiomesAuthSession(glitchBiomesAuthSession ?? undefined);

  return (
    <RootErrorBoundary>
      <BiomesHeadTag {...headProps} />
      {waitingForGlitchInstallAuth ? (
        <GlitchInstallAuthLoading />
      ) : (
        <StaticGameAndLoader
          userId={userId}
          tipSeed={tipSeed}
          configOptions={{
            startCoordinates: startCoordinates ?? undefined,
            startOrientation: startOrientation ?? undefined,
            observerMode: observerMode ?? undefined,
            bikkieTrayId: bikkieTrayId ?? undefined,
            primaryCTA: primaryCTA ?? undefined,
            displayName: displayName ?? undefined,
          }}
        />
      )}
    </RootErrorBoundary>
  );
}

const observationDescription = "See the community shaping a new world";

const GLITCH_INSTALL_QUERY_KEYS = ["install_id", "installId"];

function hasGlitchInstallQuery(query: Record<string, any>) {
  return Boolean(firstGlitchInstallIdFromQuery(query));
}

function firstGlitchInstallIdFromQuery(query: Record<string, any>) {
  return GLITCH_INSTALL_QUERY_KEYS.some((key) => {
    const value = query[key];
    if (Array.isArray(value)) {
      return value.some((entry) => typeof entry === "string" && entry.trim());
    }
    return typeof value === "string" && value.trim();
  })
    ? GLITCH_INSTALL_QUERY_KEYS.map((key) => query[key])
        .flat()
        .find((entry) => typeof entry === "string" && entry.trim())
        ?.trim()
    : undefined;
}

function GlitchInstallAuthLoading() {
  return (
    <div
      data-harthmere-glitch-auth-waiting="1"
      style={{
        alignItems: "center",
        background: "#05070a",
        color: "#f8f4df",
        display: "flex",
        flexDirection: "column",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        gap: "0.75rem",
        height: "100vh",
        justifyContent: "center",
        letterSpacing: "0.02em",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>
        Signing in with Glitch…
      </div>
      <div style={{ color: "#c9c1a8", fontSize: "0.95rem" }}>
        Validating your install and preparing Harthmere.
      </div>
    </div>
  );
}

async function metaTagsForMinigameObserver(
  deps: WebServerContextSubset<"db" | "worldApi">,
  minigame: LazyEntityWith<"minigame_component">
): Promise<BiomesHeadTagProps> {
  const ret: BiomesHeadTagProps = {};
  if (minigame.minigameComponent()?.hero_photo_id) {
    const heroPhotoBundle = await fetchFeedPostBundleById(
      deps.db,
      deps.worldApi,
      minigame.minigameComponent()!.hero_photo_id!,
      undefined
    );

    if (heroPhotoBundle) {
      ret.embedImage = imageUrlForSize("big", heroPhotoBundle.imageUrls);
    }
  }

  const minigameName =
    minigame.label()?.text ??
    minigame.minigameComponent().metadata?.kind ??
    "minigame";
  const title = `Play ${minigameName}`;
  ret.refinedTitle = title;
  ret.cardMode = "summary_large_image";

  return ret;
}

function metaTagsForEntityObserver(entity: ReadonlyEntity): BiomesHeadTagProps {
  const ret: BiomesHeadTagProps = {};
  const relevantBiscuit = relevantBiscuitForEntity(entity);
  const label = entity.label?.text ?? relevantBiscuit?.displayName ?? "Entity";
  ret.refinedTitle = `Observe ${label}`;
  const icon = iconUrl(relevantBiscuit);
  if (entity.profile_pic) {
    ret.embedImage = imageUrlForSize(
      "grid",
      resolveImageUrls(
        entity.profile_pic.cloud_bundle.bucket,
        entity.profile_pic.cloud_bundle,
        icon
      )
    );
  } else if (icon) {
    ret.embedImage = icon;
  }
  ret.cardMode = "summary";
  ret.description = observationDescription;
  return ret;
}

function metaTagsForUserObserver(user: FirestoreUser): BiomesHeadTagProps {
  const ret: BiomesHeadTagProps = {};

  ret.refinedTitle = `Observe ${user.username}`;
  if (
    user.profilePicCloudBucket &&
    user.profilePicCloudImageLocations?.webp_640w
  ) {
    ret.embedImage = absoluteBucketURL(
      user.profilePicCloudBucket,
      user.profilePicCloudImageLocations?.webp_640w
    );
  }
  ret.cardMode = "summary";
  ret.description = observationDescription;
  return ret;
}

async function metaTagsForLocationObserver(
  deps: WebServerContextSubset<"db">,
  position: Vec3
): Promise<BiomesHeadTagProps> {
  const ret: BiomesHeadTagProps = {};
  const tileMetadata = await fetchTileMetadata(deps.db);
  if (!tileMetadata) {
    return ret;
  }

  const zoom = 2;
  const tileUV = mapTileUV(tileMetadata.tileSize, position, zoom);
  ret.refinedTitle = `Observe world at ${position.join(",")}`;
  ret.embedImage = mapTileURL(tileMetadata, "surface", tileUV, zoom);
  ret.description = observationDescription;
  return ret;
}

async function ensureValidWorldCoordinates(
  deps: WebServerContextSubset<"worldApi" | "askApi">,
  coords: Vec3f
) {
  const worldMetadata = await deps.worldApi.get(WorldMetadataId);
  const aabb: ReadonlyAABB = worldMetadata?.worldMetadata()?.aabb
    ? boxToAabb(worldMetadata.worldMetadata()!.aabb)
    : [
        [0, 0, 0],
        [0, 0, 0],
      ];

  if (!containsAABB(aabb, coords)) {
    return deps.askApi.centerOfTerrain();
  }

  return coords;
}

function defaultObserverMode() {
  const initial = CONFIG.observerStartPositions[0];
  const observerMode: ObserverMode = {
    kind: "rotate",
    initialSyncTarget: {
      kind: "position",
      position: [...initial[0]],
    },
    syncTargets: CONFIG.observerStartPositions.map(([position]) => ({
      kind: "position",
      position: [...position],
    })),
  };

  return observerMode;
}

interface SlugObserverSpec {
  observerMode?: ObserverMode;
  startOrientation?: Vec2;
  extraHeadProps?: BiomesHeadTagProps;
  redirect?: {
    permanent: boolean;
    destination: string;
  };
}

async function coordinateObserverForSlug(
  slug: string[]
): Promise<SlugObserverSpec> {
  let startOrientation: Vec2 = [...CONFIG.observerStartPositions[0][1]];
  const startCoordinates = slug.slice(0, 3).map((e) => parseFloat(e)) as Vec3;
  if (any(startCoordinates, isNaN)) {
    throw new Error("Invalid coordinates: " + slug.slice(0, 3).join(","));
  }

  if (slug.length === 5) {
    startOrientation = slug.slice(3, 5).map((x) => parseFloat(x)) as Vec2;
    if (any(startOrientation, isNaN)) {
      throw new Error("Invalid orientation: " + slug.slice(3, 5).join(","));
    }
  }

  if (last(slug)?.endsWith(".png")) {
    return {
      redirect: {
        permanent: false,
        destination: `/api/screenshot${dictToQueryString(
          {
            position: startCoordinates ? startCoordinates.join(",") : undefined,
            orientation: startOrientation
              ? startOrientation.join(",")
              : undefined,
          },
          true
        )}`,
      },
    };
  }

  if (startCoordinates) {
    return {
      startOrientation,
      observerMode: {
        kind: "fixed",
        initialSyncTarget: {
          kind: "position",
          position: startCoordinates,
        },
      },
    };
  }

  return {};
}
async function minigameObserverForId(
  deps: WebServerContextSubset<
    "db" | "worldApi" | "askApi" | "logicApi" | "serverMods"
  >,
  userId: BiomesId | undefined,
  minigameEntity: LazyEntityWith<"minigame_component">
): Promise<SlugObserverSpec> {
  if (userId) {
    await handleCreateOrJoinWebRequest({ ...deps, userId }, minigameEntity.id);
    return {};
  }

  const minigameElements = await deps.worldApi.get([
    ...minigameEntity.minigameComponent().minigame_element_ids,
  ]);

  const mod = serverModFor(
    minigameEntity.minigameComponent().metadata.kind,
    deps.serverMods
  );

  let observerLocation: OptionallyOrientedPoint | undefined;

  if (minigameEntity.minigameComponent().hero_photo_id) {
    const heroPhotoBundle = await feedPostById(
      deps.db,
      minigameEntity.minigameComponent()!.hero_photo_id!
    );
    const coords = heroPhotoBundle?.media?.[0]?.metadata?.coordinates;
    const lookAt = heroPhotoBundle?.media?.[0]?.metadata?.cameraLookAt;
    if (coords) {
      observerLocation = [coords, lookAt && pitchAndYaw(lookAt)];
    }
  }

  observerLocation ??= mod.observerPosition({
    minigame: minigameEntity,
    minigameElements: (minigameElements ??
      []) as LazyEntityWith<"minigame_element">[],
  });

  okOrAPIError(
    observerLocation,
    "not_found",
    "Invalid minigame observer location"
  );

  return {
    startOrientation: observerLocation[1],
    observerMode: {
      kind: "minigame",
      minigameId: minigameEntity.id,
      initialSyncTarget: {
        kind: "position",
        position: observerLocation[0],
      },
    },
    extraHeadProps: await metaTagsForMinigameObserver(deps, minigameEntity),
  };
}

async function entityObserverForSlug(
  deps: WebServerContextSubset<
    "db" | "worldApi" | "askApi" | "logicApi" | "serverMods"
  >,
  userId: BiomesId | undefined,
  entitySlug: string
): Promise<SlugObserverSpec> {
  const user = await findUniqueByUsername(deps.db, entitySlug);

  if (user?.id && user.id === userId) {
    return {};
  }

  let headProps: BiomesHeadTagProps | undefined;
  let observeEntityId: BiomesId | undefined;
  if (user && user.id !== userId) {
    observeEntityId = user.id;
    headProps = metaTagsForUserObserver(user);
  } else if (safeParseBiomesId(entitySlug)) {
    observeEntityId = parseBiomesId(entitySlug);
  } else {
    log.error(`Invalid slug, no user found: ${entitySlug}`);
    return {
      redirect: {
        permanent: false,
        destination: "/at",
      },
    };
  }

  const entity = await deps.worldApi.get(observeEntityId);

  if (entity?.minigameComponent()) {
    return minigameObserverForId(
      deps,
      userId,
      entity as LazyEntityWith<"minigame_component">
    );
  }

  if (!user && entity) {
    headProps = metaTagsForEntityObserver(entity.materialize());
  }

  if (!entity || entity.hasIced()) {
    log.warn(
      `${
        entity?.hasIced() ? "Iced" : "Invalid"
      } entity id in slug, redirecting to default observer`,
      { entityId: observeEntityId }
    );

    return {
      redirect: {
        permanent: false,
        destination: "/at",
      },
    };
  } else {
    observeEntityId = observeEntityId;
  }

  return {
    observerMode: {
      kind: "fixed",
      initialSyncTarget: {
        kind: "entity",
        entityId: observeEntityId,
      },
    },
    extraHeadProps: headProps,
  };
}

export async function getServerSideProps(
  context: WebServerServerSidePropsContext
) {
  if (CONFIG.disableGame) {
    return {
      redirect: {
        permanent: false,
        destination: `/sorry`,
      },
    };
  }
  const token = await verifyAuthenticatedRequest(
    context.req.context.sessionStore,
    context.req
  );

  const slug = context.params?.["slug"];

  let startCoordinates: Vec3 | undefined;
  let startOrientation: Vec2 | undefined = [
    ...CONFIG.observerStartPositions[0][1],
  ];
  let headProps: BiomesHeadTagProps = {};
  let observerMode: ObserverMode | undefined;

  // TODO: force anon if player is far away from their position in world
  const forceAnon = ["true", "1"].includes(
    (context.query?.["anon"]?.toString() ?? "").toLowerCase()
  );

  let authedUserId: BiomesId | undefined;
  let authedUser: FirestoreUser | undefined;
  let glitchBiomesAuthSession: HarthmereBiomesAuthSession | undefined;
  if (!forceAnon && !token.error) {
    const user = await findByUID(context.req.context.db, token.auth.userId);
    if (user) {
      authedUser = user;
      authedUserId = token.auth.userId;
    } else if (process.env.NODE_ENV !== "production") {
      // A valid session without a local user document is a stale dev cookie.
      // Clear it and start as an observer/login screen. Otherwise the client
      // reaches /sync/createPlayer and the sync service correctly returns
      // NOT_FOUND: User not found.
      clearAuthCookies(context.res);
      log.warn("Cleared stale local auth cookie for missing user", {
        userId: token.auth.userId,
      });
    }
  }

  if (!forceAnon && !authedUserId) {
    const installId = firstGlitchInstallIdFromQuery(context.query);
    if (installId) {
      try {
        const { user, session, identity } =
          await createBiomesAuthForGlitchInstall(context.req, context.res, {
            install_id: installId,
            platform: "web",
          });
        authedUser = user;
        authedUserId = user.id;
        glitchBiomesAuthSession = {
          userId: user.id,
          sessionId: session.id,
          installId: identity.installId,
          titleId: identity.titleId,
        };
        log.info("HARTHMERE_SSR_INSTALL_AUTO_AUTH_V129", {
          installId: identity.installId,
          userId: user.id,
          gameUserId: identity.gameUserId,
          hasGlitchUserId: Boolean(identity.glitchUserId),
        });
      } catch (error) {
        log.warn("HARTHMERE_SSR_INSTALL_AUTO_AUTH_FAILED_V129", {
          error,
          installId,
        });
      }
    }
  }

  const userId = authedUserId ?? INVALID_BIOMES_ID;

  // GLITCH_INSTALL_AUTH_GATE_V117
  // The install-id bootstrap runs in _app after the first /at render. Without
  // this server-side gate, the game starts as an anonymous/local player before
  // the autoLogin call sets BUID/BSID, causing sync to accept an anonymous
  // WebSocket and reject /sync/createPlayer with "Not supported".
  if (!userId && !forceAnon && hasGlitchInstallQuery(context.query)) {
    return {
      props: {
        userId,
        tipSeed: Math.random(),
        observerMode: null,
        startCoordinates: null,
        startOrientation: null,
        bikkieTrayId: null,
        headProps,
        primaryCTA: CONFIG.primaryCTA ?? null,
        displayName: null,
        waitingForGlitchInstallAuth: true,
        glitchBiomesAuthSession: null,
      },
    };
  }

  // Crazy logic below, which will all change when we have logged in observers
  // If you have a location slug, observer mode there
  // If you have an entity slug for yourself, do a normal login
  // Otherwise if you have an entity slug, observer mode at the entity
  // If no slug and logged in, start you at default location
  // If no slug and not logged in, observer mode rotating through some biomes scenes
  if (slug && isArray(slug)) {
    let slugObserverSpec: SlugObserverSpec = {};
    if (slug.length === 3 || slug.length === 5) {
      slugObserverSpec = await coordinateObserverForSlug(slug);
    } else if (slug.length === 1 || slug.length === 2) {
      // Slug length 2 puts a friendly name in the slug
      slugObserverSpec = await entityObserverForSlug(
        context.req.context,
        userId,
        slug[0]
      );
    }

    if (slugObserverSpec.redirect) {
      return {
        redirect: slugObserverSpec.redirect,
      };
    } else {
      observerMode = slugObserverSpec.observerMode;
      startOrientation = slugObserverSpec.startOrientation;
      headProps = {
        ...headProps,
        ...slugObserverSpec.extraHeadProps,
      };
    }
  }

  if (!userId && !observerMode) {
    observerMode = defaultObserverMode();
  }

  if (process.env.NODE_ENV !== "production" && startCoordinates) {
    startCoordinates = await ensureValidWorldCoordinates(
      context.req.context,
      startCoordinates
    );
  }

  if (
    observerMode?.kind !== "minigame" &&
    observerMode?.initialSyncTarget?.kind === "position"
  ) {
    headProps = {
      ...headProps,
      ...(await metaTagsForLocationObserver(
        context.req.context,
        observerMode.initialSyncTarget.position
      )),
    };

    if (observerMode.kind === "rotate") {
      headProps = {
        ...headProps,
        refinedTitle: "The Grove",
      };
    }
  }

  return {
    props: {
      userId,
      tipSeed: Math.random(),
      defaultUsernameOrId: (await safeDetermineEmployeeUserId()) ?? "",
      observerMode: observerMode ?? null,
      startCoordinates: startCoordinates ?? null,
      startOrientation: startOrientation ?? null,
      bikkieTrayId:
        (await context.req.context.bikkieRefresher.currentTray()).id ?? null,
      headProps,
      primaryCTA: CONFIG.primaryCTA ?? null,
      displayName: authedUser?.username ?? null,
      waitingForGlitchInstallAuth: false,
      glitchBiomesAuthSession: glitchBiomesAuthSession ?? null,
    },
  };
}
