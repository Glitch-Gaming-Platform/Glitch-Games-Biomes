export const BIOMES_UI_DEFAULT_MICROPHONE_DEVICE_ID_V1 = "" as const;

export interface BiomesUIMicrophoneDeviceOptionV1 {
  deviceId: string;
  label: string;
}

export interface BiomesUIMediaDeviceLikeV1 {
  kind?: string;
  deviceId?: string;
  label?: string;
}

export function biomesUIMicrophoneOptionsFromDevicesV1(
  devices: readonly BiomesUIMediaDeviceLikeV1[]
): BiomesUIMicrophoneDeviceOptionV1[] {
  const seen = new Set<string>();
  const options: BiomesUIMicrophoneDeviceOptionV1[] = [
    {
      deviceId: BIOMES_UI_DEFAULT_MICROPHONE_DEVICE_ID_V1,
      label: "Browser Default",
    },
  ];

  let microphoneNumber = 1;
  for (const device of devices) {
    if (device.kind !== "audioinput") {
      continue;
    }
    const deviceId = device.deviceId?.trim();
    if (!deviceId || seen.has(deviceId)) {
      continue;
    }
    seen.add(deviceId);
    const isSystemDefault = deviceId === "default";
    const fallbackLabel = isSystemDefault
      ? "System Default"
      : `Microphone ${microphoneNumber}`;
    options.push({
      deviceId,
      label: device.label?.trim() || fallbackLabel,
    });
    if (!isSystemDefault) {
      microphoneNumber += 1;
    }
  }

  return options;
}

export function biomesUISelectedMicrophoneDeviceIdV1(input: {
  selectedDeviceId: string | null | undefined;
  options: readonly BiomesUIMicrophoneDeviceOptionV1[];
}) {
  const selected = input.selectedDeviceId?.trim() ?? "";
  return input.options.some((option) => option.deviceId === selected)
    ? selected
    : BIOMES_UI_DEFAULT_MICROPHONE_DEVICE_ID_V1;
}
