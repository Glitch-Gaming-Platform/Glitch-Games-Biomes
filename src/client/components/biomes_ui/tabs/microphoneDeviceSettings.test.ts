import {
  biomesUIMicrophoneOptionsFromDevices,
  biomesUISelectedMicrophoneDeviceId,
} from "@/client/components/biomes_ui/tabs/microphoneDeviceSettings";
import assert from "assert";

describe("BiomesUI microphone device settings", () => {
  it("builds a stable microphone list with browser default first", () => {
    const options = biomesUIMicrophoneOptionsFromDevices([
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
    const options = biomesUIMicrophoneOptionsFromDevices([
      { kind: "audioinput", deviceId: "mic-1", label: "Studio Mic" },
    ]);

    assert.equal(
      biomesUISelectedMicrophoneDeviceId({
        selectedDeviceId: "mic-1",
        options,
      }),
      "mic-1"
    );
    assert.equal(
      biomesUISelectedMicrophoneDeviceId({
        selectedDeviceId: "removed-mic",
        options,
      }),
      ""
    );
    assert.equal(
      biomesUISelectedMicrophoneDeviceId({
        selectedDeviceId: undefined,
        options,
      }),
      ""
    );
  });
});
