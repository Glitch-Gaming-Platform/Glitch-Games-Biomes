import {
  biomesUIMicrophoneOptionsFromDevicesV1,
  biomesUISelectedMicrophoneDeviceIdV1,
} from "@/client/components/biomes_ui/tabs/microphoneDeviceSettings";
import assert from "assert";

describe("BiomesUI microphone device settings", () => {
  it("builds a stable microphone list with browser default first", () => {
    const options = biomesUIMicrophoneOptionsFromDevicesV1([
      { kind: "videoinput", deviceId: "camera-1", label: "Camera" },
      { kind: "audioinput", deviceId: "default", label: "" },
      { kind: "audioinput", deviceId: "mic-1", label: "Studio Mic" },
      { kind: "audioinput", deviceId: "mic-1", label: "Duplicate Mic" },
      { kind: "audiooutput", deviceId: "speaker-1", label: "Speakers" },
      { kind: "audioinput", deviceId: "mic-2", label: "" },
    ]);

    assert.deepEqual(options, [
      { deviceId: "", label: "Browser Default" },
      { deviceId: "default", label: "System Default" },
      { deviceId: "mic-1", label: "Studio Mic" },
      { deviceId: "mic-2", label: "Microphone 2" },
    ]);
  });

  it("falls back to browser default when a stored microphone is unavailable", () => {
    const options = biomesUIMicrophoneOptionsFromDevicesV1([
      { kind: "audioinput", deviceId: "mic-1", label: "Studio Mic" },
    ]);

    assert.equal(
      biomesUISelectedMicrophoneDeviceIdV1({
        selectedDeviceId: "mic-1",
        options,
      }),
      "mic-1"
    );
    assert.equal(
      biomesUISelectedMicrophoneDeviceIdV1({
        selectedDeviceId: "removed-mic",
        options,
      }),
      ""
    );
    assert.equal(
      biomesUISelectedMicrophoneDeviceIdV1({
        selectedDeviceId: undefined,
        options,
      }),
      ""
    );
  });
});
