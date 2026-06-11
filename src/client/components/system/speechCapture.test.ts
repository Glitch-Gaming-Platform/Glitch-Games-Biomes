import {
  azureSpeechAudioConstraintsV1,
  blobToBase64V1,
  downsampleFloat32V1,
  encodePcm16WavV1,
} from "@/client/components/system/speechCapture";
import assert from "assert";

function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

describe("speech capture WAV encoding", () => {
  it("encodes mono PCM16 WAV for Azure Speech short recognition", () => {
    const wav = encodePcm16WavV1(
      new Float32Array([0, 0.5, -0.5, 1, -1]),
      16000
    );
    const view = new DataView(wav.buffer);

    assert.equal(ascii(wav, 0, 4), "RIFF");
    assert.equal(ascii(wav, 8, 4), "WAVE");
    assert.equal(ascii(wav, 12, 4), "fmt ");
    assert.equal(view.getUint16(20, true), 1);
    assert.equal(view.getUint16(22, true), 1);
    assert.equal(view.getUint32(24, true), 16000);
    assert.equal(view.getUint16(34, true), 16);
    assert.equal(ascii(wav, 36, 4), "data");
    assert.equal(view.getUint32(40, true), 10);
  });

  it("downsamples browser audio to the Azure Speech sample rate", () => {
    const source = new Float32Array(48000);
    source.fill(0.25);
    const downsampled = downsampleFloat32V1(source, 48000, 16000);
    assert.equal(downsampled.length, 16000);
    assert.equal(downsampled[0], 0.25);
  });

  it("clamps PCM samples into the signed 16-bit WAV range", () => {
    const wav = encodePcm16WavV1(new Float32Array([-2, 2]), 16000);
    const view = new DataView(wav.buffer);

    assert.equal(view.getInt16(44, true), -32768);
    assert.equal(view.getInt16(46, true), 32767);
  });

  it("keeps at least one sample when downsampling extremely short clips", () => {
    const downsampled = downsampleFloat32V1(
      new Float32Array([0.5]),
      48000,
      16000
    );

    assert.equal(downsampled.length, 1);
    assert.equal(downsampled[0], 0.5);
  });

  it("averages source samples into each downsampled bucket", () => {
    const downsampled = downsampleFloat32V1(
      new Float32Array([0, 1, 0.5, -0.5]),
      4,
      2
    );

    assert.deepEqual([...downsampled], [0.5, 0]);
  });

  it("turns WAV blobs into base64 payloads for the STT endpoint", async () => {
    assert.equal(
      await blobToBase64V1(new Blob([Uint8Array.from([72, 105])])),
      "SGk="
    );
  });

  it("adds the selected microphone as an exact getUserMedia audio constraint", () => {
    assert.deepEqual(azureSpeechAudioConstraintsV1(), {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    });
    assert.deepEqual(azureSpeechAudioConstraintsV1({ deviceId: "mic-123" }), {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
      deviceId: { exact: "mic-123" },
    });
    assert.deepEqual(azureSpeechAudioConstraintsV1({ deviceId: "   " }), {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    });
  });
});
