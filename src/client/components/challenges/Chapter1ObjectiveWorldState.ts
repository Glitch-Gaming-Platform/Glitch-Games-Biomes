export interface Chapter1ObjectiveWorldProjection {
  key: string;
  label: string;
  position: [number, number, number];
  trigger: string;
  targetEntityId?: number;
}

let activeProjection: Chapter1ObjectiveWorldProjection | undefined;

export function publishChapter1ObjectiveWorldProjection(
  projection: Chapter1ObjectiveWorldProjection | undefined
) {
  activeProjection = projection;
}

export function readChapter1ObjectiveWorldProjection() {
  return activeProjection;
}
