export interface AzureSpeechWavRecordingV1 {
  blob: Blob;
  mimeType: "audio/wav";
}

export interface AzureSpeechWavRecorderV1 {
  stop: () => Promise<AzureSpeechWavRecordingV1>;
}

export interface AzureSpeechWavRecorderOptionsV1 {
  deviceId?: string;
}

export function azureSpeechAudioConstraintsV1(
  input: AzureSpeechWavRecorderOptionsV1 = {}
): MediaTrackConstraints {
  const constraints: MediaTrackConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: 1,
  };
  const deviceId = input.deviceId?.trim();
  if (deviceId) {
    constraints.deviceId = { exact: deviceId };
  }
  return constraints;
}

function clampSampleV1(value: number) {
  return Math.max(-1, Math.min(1, value));
}

export function encodePcm16WavV1(
  samples: Float32Array,
  sampleRate = 16000
): Uint8Array {
  const bytesPerSample = 2;
  const dataLength = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  function writeString(offset: number, value: string) {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (const sample of samples) {
    const clamped = clampSampleV1(sample);
    view.setInt16(
      offset,
      clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff,
      true
    );
    offset += bytesPerSample;
  }

  return new Uint8Array(buffer);
}

export function downsampleFloat32V1(
  samples: Float32Array,
  sourceSampleRate: number,
  targetSampleRate = 16000
): Float32Array {
  if (sourceSampleRate === targetSampleRate) {
    return samples;
  }
  const ratio = sourceSampleRate / targetSampleRate;
  const outputLength = Math.max(1, Math.round(samples.length / ratio));
  const output = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i += 1) {
    const start = Math.floor(i * ratio);
    const end = Math.min(samples.length, Math.floor((i + 1) * ratio));
    let total = 0;
    let count = 0;
    for (let j = start; j < end; j += 1) {
      total += samples[j];
      count += 1;
    }
    output[i] = count > 0 ? total / count : samples[start] ?? 0;
  }
  return output;
}

function mergeAudioChunksV1(chunks: Float32Array[]) {
  const totalLength = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const merged = new Float32Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

export async function blobToBase64V1(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export async function startAzureSpeechWavRecorderV1(
  input: AzureSpeechWavRecorderOptionsV1 = {}
): Promise<AzureSpeechWavRecorderV1> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: azureSpeechAudioConstraintsV1(input),
  });
  const AudioContextConstructor =
    window.AudioContext ?? (window as any).webkitAudioContext;
  if (!AudioContextConstructor) {
    stream.getTracks().forEach((track) => track.stop());
    throw new Error("AudioContext is not available in this browser.");
  }

  const audioContext = new AudioContextConstructor();
  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }
  const source = audioContext.createMediaStreamSource(stream);
  const processor = audioContext.createScriptProcessor(4096, 1, 1);
  const gain = audioContext.createGain();
  const chunks: Float32Array[] = [];

  gain.gain.value = 0;
  processor.onaudioprocess = (event: AudioProcessingEvent) => {
    chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
  };
  source.connect(processor);
  processor.connect(gain);
  gain.connect(audioContext.destination);

  return {
    stop: async () => {
      processor.disconnect();
      source.disconnect();
      gain.disconnect();
      stream.getTracks().forEach((track) => track.stop());
      await audioContext.close();
      const downsampled = downsampleFloat32V1(
        mergeAudioChunksV1(chunks),
        audioContext.sampleRate,
        16000
      );
      const wav = encodePcm16WavV1(downsampled, 16000);
      const wavBuffer = wav.buffer.slice(
        wav.byteOffset,
        wav.byteOffset + wav.byteLength
      ) as ArrayBuffer;
      return {
        blob: new Blob([wavBuffer], { type: "audio/wav" }),
        mimeType: "audio/wav",
      };
    },
  };
}
