import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { WORLD_INTERACTION_PRIORITY } from "@/client/components/challenges/worldInteractionDispatcher";
import {
  ClickIcon,
  getClickIcon,
  ShortcutText,
} from "@/client/components/system/ShortcutText";

export const NegaWandOverlay: React.FunctionComponent = () => {
  const { reactResources } = useClientContext();
  return (
    <div className="selection-inspect-overlay click-message">
      <div className="inspect">
        <div>
          <ShortcutText shortcut={<img src={getClickIcon("primary")} />}>
            Press <ClickIcon type="primary" /> to restore to seed here
          </ShortcutText>
        </div>
      </div>

      <div className="inspect">
        <ShortcutText
          shortcut="F"
          keyCode="KeyF"
          worldInteractionCandidateId="active-tool:nega-wand-radius"
          worldInteractionPriority={WORLD_INTERACTION_PRIORITY.activeTool}
          onKeyDown={() => {
            reactResources.set("/space_clipboard/radius", {
              value: Math.max(
                1,
                reactResources.get("/space_clipboard/radius").value - 1
              ),
            });
          }}
        >
          Smaller
        </ShortcutText>
        <ShortcutText
          shortcut="G"
          keyCode="KeyG"
          onKeyDown={() => {
            reactResources.set("/space_clipboard/radius", {
              value: reactResources.get("/space_clipboard/radius").value + 1,
            });
          }}
        >
          Larger
        </ShortcutText>
      </div>
    </div>
  );
};
