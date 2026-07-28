// CHAPTER_1_DIALOGUE_TYPES
//
// The authored Chapter 1 dialogue catalog lives under src/server so unrevealed
// Act 6 text cannot be pulled into a client bundle. Only these presentation
// types cross the authenticated objective API.

export interface Ch1DialoguePage {
  speaker: string;
  text: string;
}

export interface Ch1DialogueSequence {
  title: string;
  pages: Ch1DialoguePage[];
  /** Label on the final page. Defaults to Continue. */
  completionLabel?: string;
}
