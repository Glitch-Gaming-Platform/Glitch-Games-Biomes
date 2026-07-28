export interface PictureFrameVisibilityTarget {
  three: { visible: boolean };
  pictureFrameInfo?: { picturePlane: { visible: boolean } };
}

export function hideUnresolvedPictureFrame(mesh: PictureFrameVisibilityTarget) {
  if (mesh.pictureFrameInfo) {
    mesh.pictureFrameInfo.picturePlane.visible = false;
  }
  mesh.three.visible = false;
}
