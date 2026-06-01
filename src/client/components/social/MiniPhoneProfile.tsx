import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { usePointerLockManager } from "@/client/components/contexts/PointerLockContext";
import {
  useLatestAvailableComponents,
  useLatestAvailableEntity,
} from "@/client/components/hooks/client_hooks";
import { installBiomesUITheme } from "@/client/components/biomes_ui/theme/biomesUITheme";
import {
  questInviteOptionsFromTrackableQuestsV1,
  submitHarthmereQuestInviteMutationV1,
  type HarthmereQuestInviteOptionV1,
} from "@/client/components/biomes_ui/adapters/questInviteAdapter";
import { useAvailableOrInProgressChallenges } from "@/client/components/challenges/helpers";
import type { UserListType } from "@/client/components/inventory/SelfInventoryScreen";
import { beginTrade } from "@/client/components/inventory/helpers";
import type { InventoryLeftSlideoverStackPayload } from "@/client/components/overflow/types";
import { AvatarWearables } from "@/client/components/social/AvatarWearables";
import { MiniPhoneFollowList } from "@/client/components/social/MiniPhoneFollowList";
import { ReportFlow } from "@/client/components/social/ReportFlow";
import { TeamBadge } from "@/client/components/social/TeamLabel";
import { nextBiomesProfileFocusIndexForKeyV1 } from "@/client/components/social/biomesProfileKeyboard";
import type { SocialMiniPhonePayload } from "@/client/components/social/types";
import { MaybeError, useError } from "@/client/components/system/MaybeError";
import { MaybeGridSpinner } from "@/client/components/system/MaybeGridSpinner";
import { ShadowedImage } from "@/client/components/system/ShadowedImage";
import { useExistingMiniPhoneContext } from "@/client/components/system/mini_phone/MiniPhoneContext";
import { MiniPhoneSubModal } from "@/client/components/system/mini_phone/MiniPhoneSubModal";
import {
  PaneSlideoverStack,
  useNewPaneSlideoverStack,
} from "@/client/components/system/mini_phone/split_pane/PaneSlideoverStack";
import { CreateTeamSlideover } from "@/client/components/teams/CreateTeamSlideover";
import { ViewTeamSlideover } from "@/client/components/teams/ViewTeamSlideover";
import { useShowingTemporaryURL } from "@/client/util/hooks";
import {
  useCachedUserInfo,
  usePhotoPageLoader,
} from "@/client/util/social_manager_hooks";
import {
  absoluteWebServerURL,
  userPublicPermalink,
} from "@/server/web/util/urls";
import type { BiomesId } from "@/shared/ids";
import type { FeedPostBundle } from "@/shared/types";
import { displayUsername } from "@/shared/util/helpers";
import { imageUrlForSize } from "@/shared/util/urls";
import { startCase } from "lodash";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const PROFILE_FOCUSABLE_SELECTOR =
  '[data-biomes-profile-focusable="true"]:not([disabled])';
const QUEST_INVITE_PROFILE_MAX_DISTANCE_METERS_V1 = 16;

function isTypingInProfileInput(): boolean {
  if (typeof document === "undefined") {
    return false;
  }
  const active = document.activeElement as HTMLElement | null;
  if (!active) {
    return false;
  }
  const tag = active.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || active.isContentEditable;
}

function vec3FromUnknownV1(
  value: unknown
): [number, number, number] | undefined {
  const raw = Array.isArray(value) ? value : undefined;
  if (!Array.isArray(raw) || raw.length < 3) return undefined;
  const x = Number(raw[0]);
  const y = Number(raw[1]);
  const z = Number(raw[2]);
  return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)
    ? [x, y, z]
    : undefined;
}

function positionVec3FromComponent(
  value: unknown
): [number, number, number] | undefined {
  return vec3FromUnknownV1((value as any)?.v);
}

function isWithinQuestInviteProfileDistanceV1(
  left: [number, number, number] | undefined,
  right: [number, number, number] | undefined
) {
  if (!left || !right) return false;
  const dx = left[0] - right[0];
  const dy = left[1] - right[1];
  const dz = left[2] - right[2];
  return (
    dx * dx + dy * dy + dz * dz <=
    QUEST_INVITE_PROFILE_MAX_DISTANCE_METERS_V1 *
      QUEST_INVITE_PROFILE_MAX_DISTANCE_METERS_V1
  );
}

function questInviteOptionsFromChallengeBundlesV1(
  challenges: unknown[]
): HarthmereQuestInviteOptionV1[] {
  return questInviteOptionsFromTrackableQuestsV1(
    challenges
      .filter((challenge: any) =>
        ["available", "in_progress"].includes(String(challenge?.state ?? ""))
      )
      .map((challenge: any) => {
        const biscuit = challenge?.biscuit ?? {};
        const title =
          biscuit.displayName ?? biscuit.name ?? biscuit.label ?? biscuit.id;
        return {
          questId: String(biscuit.id ?? title ?? ""),
          title: String(title ?? "Quest"),
          area: String(biscuit.questCategory ?? biscuit.group ?? "Quest"),
          objectiveText:
            challenge?.progress?.progressString ??
            challenge?.progress?.description ??
            `Join ${String(title ?? "this quest")} together.`,
          reward: Array.isArray(challenge?.progress?.rewards)
            ? `${challenge.progress.rewards.length} rewards`
            : undefined,
          markerWorldPosition: questInviteMarkerWorldPositionFromProgressV1(
            challenge?.progress
          ),
        };
      })
  );
}

function questInviteMarkerWorldPositionFromProgressV1(
  progress: unknown
): [number, number, number] | undefined {
  const rawProgress = progress as any;
  const navigationAid = rawProgress?.navigationAid;
  const candidates = [
    navigationAid?.target?.position,
    navigationAid?.position,
    navigationAid?.pos,
    navigationAid?.target,
    rawProgress?.payload?.location,
    rawProgress?.payload?.position,
    rawProgress?.location,
    rawProgress?.position,
  ];
  for (const candidate of candidates) {
    const position = vec3FromUnknownV1(candidate);
    if (position) return position;
  }
  return undefined;
}

export const MiniPhoneProfile: React.FunctionComponent<{
  userId: BiomesId;
}> = ({ userId }) => {
  const context = useClientContext();
  const miniPhone = useExistingMiniPhoneContext<SocialMiniPhonePayload>();
  const [error, setError] = useError();

  const [showReportMenu, setShowReportMenu] = useState(false);
  const [showQuestInviteMenu, setShowQuestInviteMenu] = useState(false);
  const [invitingQuestId, setInvitingQuestId] = useState<string | undefined>(
    undefined
  );
  const [questInviteMessage, setQuestInviteMessage] = useState<
    string | undefined
  >(undefined);
  const [copyLinkText, setCopyLinkText] = useState("Copy Link to Profile");
  const rootRef = useRef<HTMLElement | null>(null);
  const sheetRef = useRef<HTMLElement | null>(null);
  const pointerLockManager = usePointerLockManager();
  const shouldReturnPointerLockRef = useRef(false);

  const userInfo = useCachedUserInfo(context.socialManager, userId);
  const isSelfProfile = userId === context.userId;
  const availableChallenges = useAvailableOrInProgressChallenges();
  const questInviteOptions = useMemo(
    () => questInviteOptionsFromChallengeBundlesV1(availableChallenges ?? []),
    [availableChallenges]
  );

  const [userListType, setUserListType] = useState<UserListType>(undefined);

  const { posts, isLoading, setIsLoading, canLoadMore, maybeLoadMore } =
    usePhotoPageLoader(
      context.socialManager,
      context.clientCache,
      userId,
      setError
    );

  const slideoverStack =
    useNewPaneSlideoverStack<InventoryLeftSlideoverStackPayload>([]);

  useShowingTemporaryURL(
    userInfo?.user?.username &&
      userPublicPermalink(userId, userInfo?.user?.username),
    [userInfo?.user.username]
  );

  useEffect(() => installBiomesUITheme(), []);

  useEffect(() => {
    shouldReturnPointerLockRef.current = pointerLockManager.isLocked();
    pointerLockManager.unlock();
    return () => {
      if (!shouldReturnPointerLockRef.current) {
        return;
      }
      shouldReturnPointerLockRef.current = false;
      pointerLockManager.focusAndLock();
    };
  }, [pointerLockManager]);

  const closeProfile = useCallback(() => {
    miniPhone.close();
  }, [miniPhone]);

  const closeTopLayer = useCallback(() => {
    if (showReportMenu) {
      setShowReportMenu(false);
      return;
    }
    if (showQuestInviteMenu) {
      setShowQuestInviteMenu(false);
      return;
    }
    if (userListType) {
      setUserListType(undefined);
      return;
    }
    if (slideoverStack.screenStack.length > 0) {
      slideoverStack.popNavigationStack();
      return;
    }
    closeProfile();
  }, [
    closeProfile,
    showQuestInviteMenu,
    showReportMenu,
    slideoverStack,
    userListType,
  ]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || isTypingInProfileInput()) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      closeTopLayer();
    }
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [closeTopLayer]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const target =
        rootRef.current?.querySelector<HTMLElement>(
          '[data-biomes-profile-autofocus="true"]'
        ) ??
        rootRef.current?.querySelector<HTMLElement>(PROFILE_FOCUSABLE_SELECTOR);
      target?.focus({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(handle);
  }, [userInfo?.user.id]);

  useEffect(() => {
    if (!userListType && !showQuestInviteMenu) {
      return;
    }
    const handle = window.setTimeout(() => {
      sheetRef.current
        ?.querySelector<HTMLElement>(PROFILE_FOCUSABLE_SELECTOR)
        ?.focus({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(handle);
  }, [showQuestInviteMenu, userListType]);

  const doFollow = useCallback(
    async (affirmative: boolean) => {
      setIsLoading(true);

      try {
        await context.socialManager.followUser(userId, affirmative);
      } catch (error: any) {
        setError(error);
      } finally {
        setIsLoading(false);
      }
    },
    [context.socialManager, setError, setIsLoading, userId]
  );

  const renderSlideoverPayload = useCallback(
    (payload: InventoryLeftSlideoverStackPayload) => {
      switch (payload.type) {
        case "create_team":
          return (
            <CreateTeamSlideover
              onCreate={(teamId) => {
                slideoverStack.popNavigationStack();
                slideoverStack.pushNavigationStack({
                  type: "view_team",
                  team_id: teamId,
                });
              }}
            />
          );
        case "view_team":
          return <ViewTeamSlideover teamId={payload.team_id} />;
      }
    },
    [slideoverStack]
  );

  const [playerTeam] = useLatestAvailableComponents(
    userId,
    "player_current_team"
  );
  const [targetPosition] = useLatestAvailableComponents(userId, "position");
  const [selfPosition] = useLatestAvailableComponents(
    context.userId,
    "position"
  );
  const canInviteToQuestFromProfile = isWithinQuestInviteProfileDistanceV1(
    positionVec3FromComponent(selfPosition),
    positionVec3FromComponent(targetPosition)
  );

  const teamEntity = useLatestAvailableEntity(playerTeam?.team_id);
  const team = teamEntity?.team;

  const copyProfileLink = useCallback(() => {
    if (!userInfo) {
      return;
    }
    const url = absoluteWebServerURL(
      userPublicPermalink(userInfo.user.id, userInfo.user.username)
    );
    void navigator.clipboard?.writeText(url);
    setCopyLinkText("Copied");
    setTimeout(() => {
      setCopyLinkText("Copy Link to Profile");
    }, 500);
  }, [userInfo]);

  const sendQuestInvite = useCallback(
    async (option: HarthmereQuestInviteOptionV1) => {
      setInvitingQuestId(option.questId);
      setQuestInviteMessage(undefined);
      try {
        const markerWorldPosition =
          option.markerWorldPosition ?? positionVec3FromComponent(selfPosition);
        await submitHarthmereQuestInviteMutationV1({
          operation: "invite_to_quest",
          inviteeActorId: String(userId),
          questId: option.questId,
          questTitle: option.title,
          questArea: option.area,
          objectiveText: option.objectiveText,
          reward: option.reward,
          firstMarkerId: option.firstMarkerId,
          markerWorldPosition,
        });
        setQuestInviteMessage("Invite sent");
        setShowQuestInviteMenu(false);
      } catch (error: any) {
        setQuestInviteMessage(error?.message ?? "Invite failed");
      } finally {
        setInvitingQuestId(undefined);
      }
    },
    [selfPosition, userId]
  );

  const profileActions = useMemo(() => {
    const actions: Array<{
      id: string;
      label: string;
      meta?: string;
      tone?: "normal" | "primary" | "danger";
      disabled?: boolean;
      onClick: () => void;
    }> = [];

    if (!isSelfProfile && userInfo) {
      actions.push(
        {
          id: "follow",
          label: userInfo.isFollowing ? "Unfollow" : "Follow",
          meta: `${userInfo.user.numFollowers ?? 0} followers`,
          tone: userInfo.isFollowing ? "normal" : "primary",
          disabled: isLoading,
          onClick: () => void doFollow(!userInfo.isFollowing),
        },
        {
          id: "message",
          label: "Message",
          onClick: () => {
            miniPhone.pushNavigationStack({
              type: "inbox",
              userId: userId,
            });
          },
        },
        {
          id: "trade",
          label: "Trade",
          onClick: () => {
            void beginTrade(context, userId).then((tradeId) => {
              miniPhone.pushNavigationStack({
                type: "trade",
                tradeId: tradeId,
              });
            });
          },
        }
      );
      if (canInviteToQuestFromProfile) {
        actions.push({
          id: "invite-to-quest",
          label: "Invite To Quest",
          meta: `${questInviteOptions.length} quests`,
          tone: "primary",
          disabled: questInviteOptions.length === 0,
          onClick: () => {
            setQuestInviteMessage(undefined);
            setShowQuestInviteMenu(true);
          },
        });
      }
    }

    if (teamEntity && team) {
      actions.push({
        id: "team",
        label: teamEntity.label?.text ?? "View Team",
        meta: "Team",
        onClick: () => {
          slideoverStack.pushNavigationStack({
            type: "view_team",
            team_id: teamEntity.id,
          });
        },
      });
    } else if (isSelfProfile) {
      actions.push({
        id: "create-team",
        label: "Create Team",
        meta: "Team",
        onClick: () => {
          slideoverStack.pushNavigationStack({
            type: "create_team",
          });
        },
      });
    }

    actions.push(
      {
        id: "followers",
        label: "Followers",
        meta: String(userInfo?.user.numFollowers ?? 0),
        disabled: !userInfo,
        onClick: () => setUserListType("followers"),
      },
      {
        id: "following",
        label: "Following",
        meta: String(userInfo?.user.numFollowing ?? 0),
        disabled: !userInfo,
        onClick: () => setUserListType("following"),
      },
      {
        id: "copy-link",
        label: copyLinkText,
        disabled: !userInfo,
        onClick: copyProfileLink,
      },
      {
        id: "report",
        label: "Report",
        tone: "danger",
        disabled: !userInfo,
        onClick: () => setShowReportMenu(true),
      }
    );

    return actions;
  }, [
    context,
    copyLinkText,
    copyProfileLink,
    canInviteToQuestFromProfile,
    doFollow,
    isLoading,
    isSelfProfile,
    miniPhone,
    questInviteOptions.length,
    slideoverStack,
    team,
    teamEntity,
    userId,
    userInfo,
  ]);

  const handleKeyboardNavigation = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (
        ![
          "ArrowLeft",
          "ArrowRight",
          "ArrowUp",
          "ArrowDown",
          "PageUp",
          "PageDown",
          "Home",
          "End",
        ].includes(event.key)
      ) {
        return;
      }
      if (isTypingInProfileInput()) {
        return;
      }

      const root =
        (userListType || showQuestInviteMenu) && sheetRef.current
          ? sheetRef.current
          : rootRef.current;
      if (!root) {
        return;
      }
      const focusable = Array.from(
        root.querySelectorAll<HTMLElement>(PROFILE_FOCUSABLE_SELECTOR)
      ).filter((element) => element.offsetParent !== null);
      const currentIndex = focusable.indexOf(
        document.activeElement as HTMLElement
      );
      if (currentIndex < 0) {
        return;
      }
      const nextIndex = nextBiomesProfileFocusIndexForKeyV1({
        key: event.key,
        currentIndex,
        itemCount: focusable.length,
      });
      if (nextIndex < 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      focusable[nextIndex]?.focus({ preventScroll: true });
    },
    [showQuestInviteMenu, userListType]
  );

  const handlePostsScroll = useCallback(
    (event: React.UIEvent<HTMLElement>) => {
      const element = event.currentTarget;
      const remaining =
        element.scrollHeight - element.scrollTop - element.clientHeight;
      if (remaining < 160 && canLoadMore && !isLoading) {
        void maybeLoadMore();
      }
    },
    [canLoadMore, isLoading, maybeLoadMore]
  );

  const displayName = userInfo
    ? displayUsername(userInfo.user.username ?? "Profile")
    : "Player Profile";
  const profileImage = userInfo
    ? imageUrlForSize("thumbnail", userInfo.user.profilePicImageUrls)
    : undefined;

  return (
    <section
      ref={rootRef}
      className="biomes-profile-screen biomes-ui-panel"
      data-biomes-profile="true"
      data-pointer-lock-policy="unlock-while-open"
      data-mouse-policy="show-while-open"
      data-keyboard-navigation="arrows-enter-escape"
      role="dialog"
      aria-label={`${displayName} profile`}
      onKeyDown={handleKeyboardNavigation}
    >
      <header className="biomes-profile-screen__header">
        <div className="biomes-profile-screen__identity">
          <span className="biomes-profile-screen__eyebrow">Player Profile</span>
          <h2>{displayName}</h2>
          {teamEntity?.label?.text ? (
            <p>{teamEntity.label.text}</p>
          ) : (
            <p>{isSelfProfile ? "Your profile" : "Traveler"}</p>
          )}
        </div>
        <button
          type="button"
          className="biomes-profile-screen__close"
          data-biomes-profile-focusable="true"
          aria-label="Close profile"
          onClick={closeProfile}
        >
          <span aria-hidden>Esc</span>
          Close
        </button>
      </header>

      <PaneSlideoverStack
        renderPayload={renderSlideoverPayload}
        existingContext={slideoverStack}
      >
        <div className="biomes-profile-screen__body">
          <aside
            className="biomes-profile-screen__summary"
            aria-label="Profile summary"
          >
            <div className="biomes-profile-summary">
              <div className="biomes-profile-summary__avatar">
                <ShadowedImage
                  extraClassNames="biomes-profile-summary__avatar-image"
                  src={profileImage}
                  fallbackSrc="/hud/avatar-placeholder.png"
                />
                {teamEntity && team && (
                  <button
                    type="button"
                    className="biomes-profile-summary__team-badge"
                    data-biomes-profile-focusable="true"
                    aria-label={`View ${teamEntity.label?.text ?? "team"}`}
                    onClick={() => {
                      slideoverStack.pushNavigationStack({
                        type: "view_team",
                        team_id: teamEntity.id,
                      });
                    }}
                  >
                    <TeamBadge team={team} />
                  </button>
                )}
              </div>

              <div className="biomes-profile-summary__copy">
                <strong>{displayName}</strong>
                <span>
                  {userInfo
                    ? `${userInfo.user.numFollowers ?? 0} followers / ${
                        userInfo.user.numFollowing ?? 0
                      } following`
                    : "Loading profile..."}
                </span>
              </div>

              <div
                className="biomes-profile-actions"
                aria-label="Profile actions"
              >
                {profileActions.map((action, index) => (
                  <button
                    key={action.id}
                    type="button"
                    className="biomes-profile-action"
                    data-tone={action.tone ?? "normal"}
                    data-biomes-profile-focusable="true"
                    data-biomes-profile-autofocus={
                      index === 0 ? "true" : undefined
                    }
                    aria-disabled={action.disabled ? "true" : undefined}
                    onClick={() => {
                      if (!action.disabled) {
                        action.onClick();
                      }
                    }}
                  >
                    <span>{action.label}</span>
                    {action.meta ? <strong>{action.meta}</strong> : null}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <section
            className="biomes-profile-screen__avatar-panel"
            aria-label="Player appearance"
          >
            <div className="biomes-profile-section-heading">
              <span>Appearance</span>
              <strong>{displayName}</strong>
            </div>
            <div className="biomes-profile-avatar-stage">
              <AvatarWearables entityId={userId} />
            </div>
          </section>

          <section
            className="biomes-profile-screen__posts-panel"
            aria-label="Player posts"
            onScroll={handlePostsScroll}
          >
            <div className="biomes-profile-section-heading">
              <span>Posts</span>
              <strong>{posts.length.toLocaleString()}</strong>
            </div>
            <ProfilePostsGrid posts={posts} />
            <MaybeGridSpinner isLoading={isLoading} />
            {canLoadMore && !isLoading ? (
              <button
                type="button"
                className="biomes-profile-load-more"
                data-biomes-profile-focusable="true"
                onClick={() => void maybeLoadMore()}
              >
                Load More
              </button>
            ) : null}
          </section>
        </div>
      </PaneSlideoverStack>

      <MaybeError error={error} />

      {userInfo && userListType && (
        <div
          className="biomes-profile-sheet-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setUserListType(undefined);
            }
          }}
        >
          <section
            ref={sheetRef}
            className="biomes-profile-sheet biomes-ui-panel"
            role="dialog"
            aria-label={startCase(userListType)}
          >
            <header className="biomes-profile-sheet__header">
              <div>
                <span className="biomes-profile-screen__eyebrow">
                  {displayName}
                </span>
                <h3>{startCase(userListType)}</h3>
              </div>
              <button
                type="button"
                className="biomes-profile-screen__close"
                data-biomes-profile-focusable="true"
                aria-label={`Close ${userListType}`}
                onClick={() => setUserListType(undefined)}
              >
                <span aria-hidden>Esc</span>
                Close
              </button>
            </header>
            <div className="biomes-profile-sheet__body">
              <MiniPhoneFollowList
                direction={
                  userListType === "following" ? "outbound" : "inbound"
                }
                userId={userInfo.user.id}
              />
            </div>
          </section>
        </div>
      )}

      {userInfo && showQuestInviteMenu && (
        <div
          className="biomes-profile-sheet-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowQuestInviteMenu(false);
            }
          }}
        >
          <section
            ref={sheetRef}
            className="biomes-profile-sheet biomes-ui-panel"
            role="dialog"
            aria-label={`Invite ${displayName} to quest`}
          >
            <header className="biomes-profile-sheet__header">
              <div>
                <span className="biomes-profile-screen__eyebrow">
                  {displayName}
                </span>
                <h3>Invite To Quest</h3>
              </div>
              <button
                type="button"
                className="biomes-profile-screen__close"
                data-biomes-profile-focusable="true"
                aria-label="Close quest invite"
                onClick={() => setShowQuestInviteMenu(false)}
              >
                <span aria-hidden>Esc</span>
                Close
              </button>
            </header>
            <div className="biomes-profile-sheet__body">
              {questInviteMessage ? (
                <p className="biomes-profile-empty">{questInviteMessage}</p>
              ) : null}
              {questInviteOptions.length === 0 ? (
                <p className="biomes-profile-empty">No quests available.</p>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 10,
                  }}
                >
                  {questInviteOptions.map((option) => {
                    const busy = invitingQuestId === option.questId;
                    return (
                      <button
                        key={option.questId}
                        type="button"
                        className="biomes-profile-action"
                        data-tone="normal"
                        data-biomes-profile-focusable="true"
                        disabled={Boolean(invitingQuestId)}
                        onClick={() => void sendQuestInvite(option)}
                        style={{
                          minHeight: 96,
                          alignItems: "flex-start",
                          gap: 6,
                          textAlign: "left",
                        }}
                      >
                        <span>{busy ? "Sending..." : option.title}</span>
                        <strong>{option.area}</strong>
                        <small
                          style={{
                            color: "var(--biomes-fg-muted)",
                            lineHeight: 1.25,
                            textTransform: "none",
                          }}
                        >
                          {option.objectiveText}
                        </small>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {showReportMenu && (
        <MiniPhoneSubModal
          onDismissal={() => {
            setShowReportMenu(false);
          }}
        >
          <ReportFlow
            target={{
              kind: "profile",
              targetId: userId,
            }}
            onClose={() => {
              setShowReportMenu(false);
            }}
          />
        </MiniPhoneSubModal>
      )}
    </section>
  );
};

const ProfilePostsGrid: React.FunctionComponent<{
  posts: FeedPostBundle[];
}> = ({ posts }) => {
  const miniPhone = useExistingMiniPhoneContext<SocialMiniPhonePayload>();

  if (posts.length === 0) {
    return <p className="biomes-profile-empty">No posts yet.</p>;
  }

  return (
    <div className="biomes-profile-post-grid" aria-label="Profile posts">
      {posts.map((post) => (
        <button
          type="button"
          key={post.id}
          className="biomes-profile-post"
          data-biomes-profile-focusable="true"
          aria-label="Open post"
          onClick={() => {
            miniPhone.pushNavigationStack({
              type: "social_detail",
              documentId: post.id,
              documentType: "post",
            });
          }}
        >
          <img
            src={imageUrlForSize("thumbnail", post.imageUrls)}
            alt=""
            aria-hidden="true"
          />
        </button>
      ))}
    </div>
  );
};
