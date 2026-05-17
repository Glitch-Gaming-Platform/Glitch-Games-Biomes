import { ColorRowHex } from "@/client/components/character/ColorRow";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { useLatestAvailableEntity } from "@/client/components/hooks/client_hooks";
import { DialogButton } from "@/client/components/system/DialogButton";
import { PaneActionSheet } from "@/client/components/system/mini_phone/split_pane/PaneActionSheet";
import { PaneBottomDock } from "@/client/components/system/mini_phone/split_pane/PaneBottomDock";
import { UpdateTeamMetadataEvent } from "@/shared/ecs/gen/events";
import type { BiomesId } from "@/shared/ids";
import { fireAndForget } from "@/shared/util/async";
import { ok } from "assert";
import { getHarthmereEmojiNativeById } from "@/client/util/emoji_mart_compat";
import emojiData from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { useState } from "react";

export const EditTeamSheet: React.FunctionComponent<{
  teamId: BiomesId;
  onClose?: () => any;
  showing: boolean;
}> = ({ teamId, onClose, showing }) => {
  const teamEntity = useLatestAvailableEntity(teamId);
  const team = teamEntity?.team;
  const { events, userId } = useClientContext();
  const [teamName, setTeamName] = useState(teamEntity?.label?.text ?? "");
  const [teamColor, setTeamColor] = useState(team?.color);
  const [teamIcon, setTeamIcon] = useState(team?.icon);
  const [selectedEmoji, setSelectedEmoji] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const TEAM_COLORS = [
    0xc2e9ff, 0xffbbbe, 0xe7a4f0, 0xfafbc0, 0xe5daa6, 0xe3fbce, 0xc5ebdf,
    0xc7bbf6,
  ];

  const currentColorIndex = TEAM_COLORS.findIndex((e) => e === teamColor);

  return (
    <>
      <PaneActionSheet
        title="Edit Team"
        onClose={() => {
          onClose?.();
        }}
        showing={showing}
      >
        <div className="form padded-view">
          <section>
            <label>Team Name</label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
            />
          </section>

          <section>
            <label>Team Color</label>

            <div className="color-button-row grid-cols-8">
              <ColorRowHex
                colors={TEAM_COLORS}
                selectedIndex={currentColorIndex}
                onSelect={(index) => {
                  setTeamColor(TEAM_COLORS[index]);
                  ok(TEAM_COLORS[index]);
                }}
              />
            </div>
          </section>

          <section>
            <label>Team Flair</label>
            {(emojiData as any).categories.map((category: any) => (
              <>
                <div className="grid grid-cols-6">
                  {category.emojis.map((emoji: string, i: number) => (
                    <div
                      key={i}
                      className={`flex aspect-square cursor-pointer items-center justify-center rounded-md ${
                        selectedEmoji === emoji
                          ? "bg-white/50 hover:bg-white/50"
                          : " hover:bg-white/10"
                      }`}
                      onClick={() => {
                        const nativeEmoji = getHarthmereEmojiNativeById(emoji);
                        if (nativeEmoji) {
                          setSelectedEmoji(emoji);
                          setTeamIcon(nativeEmoji);
                        }
                      }}
                    >
                      <span style={{ fontSize: 24 }}>{getHarthmereEmojiNativeById(emoji)}</span>
                    </div>
                  ))}
                </div>
              </>
            ))}
            <Picker data={emojiData} onEmojiSelect={(emoji: any) => setTeamIcon(emoji.native)} />
            <DialogButton
              onClick={() => {
                setShowEmojiPicker(true);
              }}
            >
              {teamIcon} Change Icon
            </DialogButton>{" "}
          </section>
        </div>

        <PaneBottomDock>
          <DialogButton
            type="primary"
            onClick={() => {
              onClose?.();
              fireAndForget(
                events.publish(
                  new UpdateTeamMetadataEvent({
                    id: userId,
                    team_id: teamId,
                    color: teamColor,
                    name: teamName,
                    icon: teamIcon,
                  })
                )
              );
            }}
          >
            Save
          </DialogButton>
        </PaneBottomDock>
      </PaneActionSheet>

      <PaneActionSheet
        showing={showEmojiPicker}
        onClose={() => {
          setShowEmojiPicker(false);
        }}
      >
        <Picker
          data={emojiData}
          previewPosition="none"
          onEmojiSelect={(e: any) => {
            setTeamIcon(e.native);
            setShowEmojiPicker(false);
          }}
        />
      </PaneActionSheet>
    </>
  );
};
