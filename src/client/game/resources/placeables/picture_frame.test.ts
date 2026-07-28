import assert from "assert";
import { hideUnresolvedPictureFrame } from "./picture_frame_visibility";

describe("picture frame missing-content fallback", () => {
  it("hides an orphaned frame instead of rendering a giant black screen", () => {
    const mesh = {
      three: { visible: true },
      pictureFrameInfo: {
        picturePlane: { visible: true },
      },
    };

    hideUnresolvedPictureFrame(mesh);

    assert.equal(mesh.three.visible, false);
    assert.equal(mesh.pictureFrameInfo.picturePlane.visible, false);
  });
});
