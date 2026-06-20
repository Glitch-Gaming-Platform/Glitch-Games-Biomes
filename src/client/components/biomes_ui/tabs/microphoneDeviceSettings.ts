export const BIOMES_UI_DEFAULT_MICROPHONE_DEVICE_ID = "" as const;

export interface BiomesUIMicrophoneDeviceOption {
  deviceId: string;
  label: string;
}

export interface BiomesUIMediaDeviceLike {
  kind?: string;
  deviceId?: string;
  label?: string;
}

export function biomesUIMicrophoneOptionsFromDevices(
  devices: readonly BiomesUIMediaDeviceLike[]
): BiomesUIMicrophoneDeviceOption[] {
  const seen = new Set<string>();
  const options: BiomesUIMicrophoneDeviceOption[] = [
    {
      deviceId: BIOMES_UI_DEFAULT_MICROPHONE_DEVICE_ID,
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

export function biomesUISelectedMicrophoneDeviceId(input: {
  selectedDeviceId: string | null | undefined;
  options: readonly BiomesUIMicrophoneDeviceOption[];
}) {
  const selected = input.selectedDeviceId?.trim() ?? "";
  return input.options.some((option) => option.deviceId === selected)
    ? selected
    : BIOMES_UI_DEFAULT_MICROPHONE_DEVICE_ID;
}
