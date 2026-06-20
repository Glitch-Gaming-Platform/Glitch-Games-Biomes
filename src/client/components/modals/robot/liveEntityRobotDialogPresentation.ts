import type {
  TalkDialogInfo,
  TalkDialogStepAction,
} from "@/client/components/challenges/TalkDialogModalStep";

export interface RobotLiveEntityHelperDialog {
  dialogText: string;
  actions: TalkDialogStepAction[];
}

export function robotTalkDialogSectionsWithLiveEntityHelper(input: {
  transmissionText: string;
  transmissionActions: TalkDialogStepAction[];
  liveEntityHelperDialog?: RobotLiveEntityHelperDialog;
}) {
  const sections: TalkDialogInfo[] = [];
  if (input.liveEntityHelperDialog) {
    sections.push({
      text: input.liveEntityHelperDialog.dialogText,
      actions: input.liveEntityHelperDialog.actions,
    });
  }
  sections.push({
    text: input.transmissionText,
    actions: input.transmissionActions,
  });
  return sections;
}
